import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {crc32} from '../../public/apresentacoes/package.js';
export function zipFiles(files,{deflate=true}={}){
  const locals=[],directory=[];let offset=0;
  for(const [path,value] of Object.entries(files)){
    const data=Buffer.from(value),name=Buffer.from(path),packed=deflate?deflateRawSync(data):data,crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(deflate?8:0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(deflate?8:0,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,name,packed);directory.push(central,name);offset+=local.length+name.length+packed.length;
  }
  const cd=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,cd,end]);
}
export function a02PackageFiles({revision=false,legacy=false}={}){
  const original=readFileSync(new URL('./a02-package/apresentacao.json',import.meta.url));
  const deck=JSON.parse(original);if(revision)deck.title+=' · atualização isolada';
  const files={[legacy?'decks/html-m01-s01-a02.json':'apresentacao.json']:revision?JSON.stringify(deck):original};
  for(const slide of deck.slides)if(slide.image)files[slide.image.src.slice(2)]=readFileSync(new URL(`./a02-package/${slide.image.src.slice(2)}`,import.meta.url));
  files['creditos-imagens.md']=deck.slides.filter(s=>s.image).map(s=>`${s.image.caption}\n${s.sources.join('\n')}`).join('\n\n');
  return files;
}
