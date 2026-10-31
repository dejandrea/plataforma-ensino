import {validatePresentation} from './validate.js';

export const packageLimits=Object.freeze({zip:10*1024*1024,total:25*1024*1024,image:5*1024*1024,json:512000,credits:102400,entries:80,pixels:16000000,ratio:200});
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
function dimensions(bytes,extension){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height,mime;
  const text=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
  if(extension==='png'){
    if(bytes.length<45||text(1,4)!=='PNG'||bytes[0]!==137||text(12,16)!=='IHDR'||text(bytes.length-8,bytes.length-4)!=='IEND')fail('PNG inválido ou extensão falsa.');
    width=view.getUint32(16);height=view.getUint32(20);mime='image/png';
  }else if(extension==='webp'){
    if(bytes.length<30||text(0,4)!=='RIFF'||text(8,12)!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)fail('WebP inválido ou extensão falsa.');
    const kind=text(12,16);
    if(kind==='VP8X'){
      if(bytes[20]&2)fail('WebP animado não é aceito neste importador.');
      width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);
    }else if(kind==='VP8L'&&bytes[20]===47){
      const bits=view.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;
    }else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else fail('Cabeçalho WebP inválido.');
    mime='image/webp';
  }else{
    if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)fail('JPEG inválido ou extensão falsa.');
    let offset=2;
    while(offset+9<bytes.length){
      if(bytes[offset]!==255)break;const marker=bytes[offset+1];
      if(marker===0xda)break;const length=view.getUint16(offset+2);
      if(length<2||offset+2+length>bytes.length)fail('Segmento JPEG inválido.');
      if([0xc0,0xc1,0xc2].includes(marker)){height=view.getUint16(offset+5);width=view.getUint16(offset+7);break;}
      offset+=length+2;
    }
    mime='image/jpeg';
  }
  if(!width||!height||width*height>packageLimits.pixels)fail('Dimensões inválidas ou imagem acima de 16 milhões de pixels.');
  return {width,height,mime};
}
function fileType(name){
  if(name==='apresentacao.json'||/^decks\/[a-z0-9][a-z0-9-]{0,79}\.json$/.test(name))return {limit:packageLimits.json,mime:'application/json',kind:'deck'};
  if(name==='creditos-imagens.md')return {limit:packageLimits.credits,mime:'text/markdown',kind:'credits'};
  if(/^images\/[a-z0-9][a-z0-9_-]{0,99}\.(webp|png|jpg|jpeg)$/.test(name))return {limit:packageLimits.image,kind:'image'};
  fail(`Arquivo não permitido ou caminho inseguro: ${name}`);
}
/** Bounded central-directory parser. Never extracts paths onto a filesystem. */
export async function parsePresentationPackage(input,schema){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length>packageLimits.zip||bytes.length<22)fail('O pacote ZIP deve ter até 10 MB e conter arquivos válidos.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)fail('ZIP inválido ou truncado.');
  const count=view.getUint16(end+10,true),centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count<1||count>packageLimits.entries||centralOffset+centralSize!==end||view.getUint32(0,true)!==0x04034b50)fail('ZIP dividido, ZIP64, vazio ou com arquivos demais não é aceito.');
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
    if(['images/','decks/'].includes(name)){if(size!==0)fail('Diretório ZIP inválido.');continue;}
    const type=fileType(name);
    if(size<1)fail(`Arquivo vazio: ${name}`);
    total+=size;
    if(size>type.limit||total>packageLimits.total||(packed===0&&size>0)||size>Math.max(1024,packed*packageLimits.ratio))fail('Arquivo grande demais ou suspeita de bomba ZIP.');
    entries.push({name,flags,method,crc,packed,size,start,...type});
  }
  if(cursor!==end||entries.filter(e=>e.kind==='deck').length!==1)fail('Inclua exatamente um JSON: apresentacao.json ou decks/nome.json.');
  const files=[];
  for(const entry of entries){
    const packed=bytes.slice(entry.start,entry.start+entry.packed);
    let data;
    try{data=entry.method===0?packed:await readLimited(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')),Math.min(entry.size,entry.limit));}
    catch(error){fail(`Não foi possível descomprimir ${entry.name}: ${error.message}`);}
    if(data.length!==entry.size||crc32(data)!==entry.crc)fail(`CRC ou tamanho divergente: ${entry.name}`);
    const image=entry.kind==='image'?dimensions(data,entry.name.split('.').at(-1)):null;
    files.push({path:entry.kind==='deck'?'apresentacao.json':entry.name,sourcePath:entry.name,kind:entry.kind,mime:image?.mime??entry.mime,size:data.length,sha256:await sha256(data),data,...(image??{})});
  }
  let deck;
  try{deck=JSON.parse(decoder.decode(files.find(f=>f.kind==='deck').data).replace(/^\uFEFF/,''));}
  catch{fail('JSON inválido ou codificação diferente de UTF-8.');}
  const errors=validatePresentation(deck,schema);
  if(errors.length)fail(errors.slice(0,8).join('\n'));
  const warnings=[];const used=new Set();
  for(const slide of deck.slides){
    if(!slide.image)continue;const name=slide.image.src.slice(2);used.add(name);
    if(!files.some(f=>f.path===name&&f.kind==='image'))fail(`Imagem referenciada não encontrada: ${name}`);
    if(!slide.image.caption)warnings.push(`Revise a autoria/licença da imagem do slide “${slide.title}”.`);
  }
  for(const image of files.filter(f=>f.kind==='image'))if(!used.has(image.path))warnings.push(`Imagem não utilizada: ${image.path}`);
  const credits=files.find(f=>f.kind==='credits');
  if(credits){try{decoder.decode(credits.data);}catch{fail('Créditos devem estar em UTF-8.');}}
  else warnings.push('Sem documento de créditos: confira as atribuições e licenças nos slides.');
  return {deck,files,warnings,packageHash:await sha256(bytes),slideCount:deck.slides.length};
}
