import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePresentationPackage,packageLimits} from '../public/apresentacoes/package.js';
import {a02PackageFiles,zipFiles} from './fixtures/presentation-package.mjs';
const schema=JSON.parse(readFileSync('public/apresentacoes/presentation.schema.json','utf8'));
test('ZIP accepts the existing 15-slide A02 package and canonical root layout, verifies all CRCs and dimensions',async()=>{
  for(const legacy of [false,true]){
    const parsed=await parsePresentationPackage(zipFiles(a02PackageFiles({legacy})),schema);
    assert.equal(parsed.slideCount,15);assert.equal(parsed.files.length,8);assert.equal(parsed.files.filter(f=>f.kind==='image').length,6);
    assert.deepEqual(parsed.warnings,[]);assert.equal(parsed.files.find(f=>f.kind==='deck').path,'apresentacao.json');
    assert.ok(parsed.files.filter(f=>f.kind==='image').every(f=>f.width>0&&f.height>0));
  }
});
test('a valid text-only deck needs no image directory and surfaces the optional credits warning',async()=>{
  const deck={schemaVersion:1,title:'Conceito',slides:[{type:'concept',title:'Uma ideia',body:'Texto simples.'}]};
  const parsed=await parsePresentationPackage(zipFiles({'apresentacao.json':JSON.stringify(deck)}),schema);
  assert.equal(parsed.slideCount,1);assert.equal(parsed.files.length,1);assert.equal(parsed.warnings.length,1);
});
test('ZIP rejects malformed structure, invalid JSON/schema, missing images, duplicates, traversal, executables and fake extensions',async()=>{
  const valid=a02PackageFiles();
  const cases=[Buffer.from('not a zip'),zipFiles({...valid,'../outside.txt':'bad'}),zipFiles({...valid,'images/../evil.webp':'bad'}),zipFiles({...valid,'images\u005cevil.webp':'bad'}),zipFiles({...valid,'run.exe':'MZ'}),zipFiles({...valid,'images/test.svg':'<svg onload="alert(1)"/>'}),zipFiles({...valid,'images/fake.webp':'<script/>'}),zipFiles({...valid,'apresentacao.json':'{invalid'}),zipFiles({...valid,'apresentacao.json':'{"schemaVersion":2,"title":"x","slides":[]}'}),zipFiles({...valid,'decks/duplicate.json':valid['apresentacao.json']})];
  const missing={...valid};delete missing['images/ada-lovelace.webp'];cases.push(zipFiles(missing));
  const corrupt=zipFiles(valid,{deflate:false});corrupt[50]^=1;cases.push(corrupt);
  const duplicate=zipFiles({...valid,'images/ADA-lovelace.webp':valid['images/ada-lovelace.webp']});cases.push(duplicate);
  const symlink=zipFiles(valid);const central=symlink.readUInt32LE(symlink.length-6);symlink.writeUInt32LE((0xa000<<16)>>>0,central+38);cases.push(symlink);
  for(const value of cases)await assert.rejects(parsePresentationPackage(value,schema));
});
test('ZIP bounds compressed bytes, expanded sizes, compression ratio, entry count and forged central sizes',async()=>{
  await assert.rejects(parsePresentationPackage(new Uint8Array(packageLimits.zip+1),schema));
  const base={schemaVersion:1,title:'Test',slides:[{type:'concept',title:'Test',body:'Text'}]};
  const tiny={'apresentacao.json':JSON.stringify(base)};
  await assert.rejects(parsePresentationPackage(zipFiles({...tiny,'creditos-imagens.md':'a'.repeat(100000)}),schema),/bomba ZIP/);
  const many={...tiny};for(let n=0;n<81;n++)many[`images/test-${n}.png`]='not png';
  await assert.rejects(parsePresentationPackage(zipFiles(many),schema));
  const forged=zipFiles(tiny);const central=forged.readUInt32LE(forged.length-6);forged.writeUInt32LE(0xffffffff,central+24);
  await assert.rejects(parsePresentationPackage(forged,schema));
  // Local/central headers may agree on a small forged size, but inflation still
  // enforces that bound while reading rather than allocating an unbounded result.
  const bomb=zipFiles({'apresentacao.json':JSON.stringify(base),'creditos-imagens.md':'x'.repeat(1000000)});
  let p=bomb.readUInt32LE(bomb.length-6);p+=46+bomb.readUInt16LE(p+28);const local=bomb.readUInt32LE(p+42);bomb.writeUInt32LE(10,p+24);bomb.writeUInt32LE(10,local+22);
  await assert.rejects(parsePresentationPackage(bomb,schema),/descomprimir|Limite/);
});
