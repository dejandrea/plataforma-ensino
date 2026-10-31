import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv';
import {selectMascot} from '../public/biblioteca-bitara/select.js';
import {validatePresentation} from '../public/apresentacoes/validate.js';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const catalog=read('public/biblioteca-bitara/catalog.json');
const inventory=read('docs/bitara-inventory.json');
const classifications=read('docs/bitara-classification.json');
test('all 64 official originals are intact, classified, dimensioned and mapped to existing local WebP files',()=>{
  assert.equal(catalog.images.length,64);assert.equal(inventory.length,64);
  assert.equal(new Set(catalog.images.map(i=>i.id)).size,64);
  for(const image of catalog.images) {
    const source=inventory.find(i=>i.id===image.id);assert.ok(source);
    const bytes=readFileSync(source.original);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
    assert.equal(bytes.length,source.bytes);
    assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);
    assert.equal(source.width,image.width);assert.equal(source.height,image.height);
    assert.match(image.src,/^\/biblioteca-bitara\/images\/bitara-[a-z0-9-]+\.webp$/);
    const derived=readFileSync(`public${image.src}`);
    assert.equal(derived.length,image.bytes);assert.equal(derived.toString('ascii',0,4),'RIFF');assert.equal(derived.toString('ascii',8,12),'WEBP');
    assert.ok(catalog.categories.includes(image.category));
    assert.equal(image.reviewStatus,'revisada');assert.ok(image.alt.trim());assert.ok(image.tags.length);assert.ok(image.purpose.trim());
    for(const field of ['category','alt','reviewStatus','kind','purpose'])assert.equal(image[field],classifications[image.id][field]);
    assert.ok(['pose','objeto','prancha'].includes(image.kind));
    source.usedBy.forEach(path=>assert.ok(existsSync(path)));
  }
  assert.equal(catalog.images.filter(i=>i.kind==='pose').length,53);
  assert.equal(catalog.images.filter(i=>i.kind==='objeto').length,8);
  assert.equal(catalog.images.filter(i=>i.kind==='prancha').length,3);
});
test('selection is deterministic, supports explicit IDs, skips pending entries and never returns remote paths',()=>{
  assert.equal(selectMascot(catalog,{category:'investigadora'}).id,'bitara-020');
  assert.equal(selectMascot({...catalog,images:[...catalog.images].reverse()},{category:'investigadora'}).id,'bitara-020');
  assert.equal(selectMascot(catalog,{id:'bitara-044'}).id,'bitara-044');
  assert.equal(selectMascot(catalog,{id:'bitara-055'}).kind,'objeto');
  assert.equal(selectMascot(catalog,{category:'outras'}).id,'bitara-009');
  assert.equal(selectMascot(catalog,{category:'inexistente'}).id,catalog.fallbackId);
  assert.equal(selectMascot(catalog,{id:'inexistente'}).id,catalog.fallbackId);
  assert.equal(selectMascot({...catalog,images:catalog.images.filter(i=>i.category!=='investigadora')},{category:'investigadora'}).id,catalog.fallbackId);
  assert.equal(selectMascot({...catalog,images:catalog.images.map(i=>({...i,reviewStatus:'pendente_revisao'}))}),null);
  assert.equal(selectMascot({...catalog,images:catalog.images.map(i=>({...i,src:'https://example.org/image.webp'}))}),null);
  assert.equal(selectMascot(null),null);
  assert.equal(selectMascot({images:[null]}),null);
});
test('mascot requests extend JSON v1 without invalidating existing decks and reject injected fields',()=>{
  const schema=read('public/apresentacoes/presentation.schema.json');const official=new Ajv().compile(schema);
  for(const name of ['aula-02-demo','template','bitara-demo']) {
    const deck=read(`public/apresentacoes/decks/${name}.json`);
    assert.equal(official(deck),true,JSON.stringify(official.errors));assert.deepEqual(validatePresentation(deck,schema),[]);
  }
  for(const request of [{},{category:'unknown'},{id:'../../secret'},{id:'bitara-001',src:'https://evil.org/a.webp'},{category:'neutra',id:'bitara-001'}]) {
    const deck={schemaVersion:1,title:'Test',slides:[{type:'concept',title:'Test',body:'Text',mascot:request}]};
    assert.equal(official(deck),false);assert.ok(validatePresentation(deck,schema).length);
  }
});
