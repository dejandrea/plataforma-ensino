const decoder=new TextDecoder('utf-8',{fatal:true});
const crcTable=Uint32Array.from({length:256},(_,n)=>{let value=n;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;});
function fail(message){throw new Error(message);}
export function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255];
  return (crc^0xffffffff)>>>0;
}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function readLimited(stream,limit){
  if(!stream)fail('Arquivo vazio.');
  const reader=stream.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();fail('Limite de descompressão ou tamanho excedido.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}

/** Shared bounded ZIP engine; never writes to disk. */
export async function readZipArchive(input,limits,fileType,directories=[]){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length>limits.zip||bytes.length<22)fail('ZIP excede o limite ou não contém arquivos válidos.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)fail('ZIP inválido ou truncado.');
  const count=view.getUint16(end+10,true),centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count<1||count>limits.entries||centralOffset+centralSize!==end||view.getUint32(0,true)!==0x04034b50)fail('ZIP dividido, ZIP64, vazio ou com arquivos demais não é aceito.');
  const entries=[];const names=new Set();const ranges=[];let cursor=centralOffset,total=0;
  for(let i=0;i<count;i++){
    if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)fail('Diretório ZIP inválido.');
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),crc=view.getUint32(cursor+16,true),packed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true);
    const nameSize=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true);
    if(cursor+46+nameSize+extra+comment>end||view.getUint16(cursor+34,true)||((view.getUint32(cursor+38,true)>>>16)&0xf000)===0xa000)fail('Entrada ZIP inválida ou link simbólico proibido.');
    const nameBytes=bytes.subarray(cursor+46,cursor+46+nameSize);const name=decoder.decode(nameBytes);
    cursor+=46+nameSize+extra+comment;
    if(name.length>160||names.has(name.toLowerCase()))fail('Nome duplicado ou longo demais.');names.add(name.toLowerCase());
    if(flags&~0x080e||![0,8].includes(method)||size===0xffffffff||packed===0xffffffff)fail('ZIP criptografado ou método de compressão não suportado.');
    if(local+30>centralOffset||view.getUint32(local,true)!==0x04034b50||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method)fail('Cabeçalho local divergente.');
    const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),start=local+30+localName+localExtra,stop=start+packed;
    if(localName!==nameSize||decoder.decode(bytes.subarray(local+30,local+30+localName))!==name||stop>centralOffset||ranges.some(([a,b])=>local<b&&stop>a))fail('Entradas ZIP sobrepostas ou caminhos divergentes.');ranges.push([local,stop]);
    if(!(flags&8)&&(view.getUint32(local+14,true)!==crc||view.getUint32(local+18,true)!==packed||view.getUint32(local+22,true)!==size))fail('Integridade do cabeçalho ZIP inválida.');
    if(directories.includes(name)){if(size!==0)fail('Diretório ZIP inválido.');continue;}
    const type=fileType(name);
    if(size<1)fail(`Arquivo vazio: ${name}`);
    total+=size;
    if(size>type.limit||total>limits.total||(packed===0&&size>0)||size>Math.max(1024,packed*limits.ratio))fail('Arquivo grande demais ou suspeita de bomba ZIP.');
    entries.push({name,flags,method,crc,packed,size,start,...type});
  }
  if(cursor!==end)fail('Diretório ZIP divergente.');
  const files=[];
  for(const entry of entries){
    const packed=bytes.slice(entry.start,entry.start+entry.packed);
    let data;
    try{data=entry.method===0?packed:await readLimited(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')),Math.min(entry.size,entry.limit));}
    catch(error){fail(`Não foi possível descomprimir ${entry.name}: ${error.message}`);}
    if(data.length!==entry.size||crc32(data)!==entry.crc)fail(`CRC ou tamanho divergente: ${entry.name}`);
    files.push({...entry,path:entry.name,sourcePath:entry.name,size:data.length,sha256:await sha256(data),data});
  }
  return files;
}

/** Small deterministic ZIP writer for production kits; no filesystem extraction. */
export function createStoredZip(entries){
 const encoder=new TextEncoder();const chunks=[],central=[];let offset=0,centralSize=0;
 const seen=new Set();
 for(const {path,data:input} of entries){
  if(!path||path.startsWith('/')||path.includes('\\')||path.split('/').includes('..')||seen.has(path.toLowerCase()))fail('Caminho ZIP inválido.');
  seen.add(path.toLowerCase());const name=encoder.encode(path),data=typeof input==='string'?encoder.encode(input):new Uint8Array(input);
  const crc=crc32(data),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);
  const record=new Uint8Array(46+name.length),v=new DataView(record.buffer);
  v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);record.set(name,46);
  chunks.push(local,data);central.push(record);offset+=local.length+data.length;centralSize+=record.length;
 }
 if(entries.length>200||offset+centralSize>64*1024*1024)fail('Kit acima do limite.');
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 const result=new Uint8Array(offset+centralSize+22);let cursor=0;for(const chunk of [...chunks,...central,end]){result.set(chunk,cursor);cursor+=chunk.length;}return result;
}
