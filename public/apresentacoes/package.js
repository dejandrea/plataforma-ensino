import {validatePresentation} from './validate.js';
import {readZipArchive,sha256} from './zip.js';
export {crc32,sha256,readLimited} from './zip.js';
export const packageLimits=Object.freeze({zip:10*1024*1024,total:25*1024*1024,image:5*1024*1024,json:512000,credits:102400,entries:80,pixels:16000000,ratio:200});
const decoder=new TextDecoder('utf-8',{fatal:true});
function fail(message){throw new Error(message);}
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
export async function parsePresentationPackage(input,schema){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const raw=await readZipArchive(bytes,packageLimits,fileType,['images/','decks/']);
  if(raw.filter(f=>f.kind==='deck').length!==1)fail('Inclua exatamente um JSON: apresentacao.json ou decks/nome.json.');
  const files=raw.map(f=>{const image=f.kind==='image'?dimensions(f.data,f.name.split('.').at(-1)):null;
    return {path:f.kind==='deck'?'apresentacao.json':f.name,sourcePath:f.name,kind:f.kind,mime:image?.mime??f.mime,size:f.size,sha256:f.sha256,data:f.data,...(image??{})};});
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
