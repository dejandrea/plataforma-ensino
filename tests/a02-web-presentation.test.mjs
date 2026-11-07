import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv';
import {validatePresentation} from '../public/apresentacoes/validate.js';
import {selectMascot} from '../public/biblioteca-bitara/select.js';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const deck=read('public/apresentacoes/decks/html-m01-s01-a02.json');
const manifest=read('docs/manifests/html-m01-s01-a02.web.local.json');
test('A02: exact source package hashes, 15 public slides and six local historical images',()=>{
  assert.equal(deck.slides.length,15);
  assert.equal(manifest.resources.length,7);
  for(const resource of manifest.resources) {
    const bytes=readFileSync(resource.path);
    assert.equal(bytes.length,resource.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),resource.sha256);
  }
  const schema=read('public/apresentacoes/presentation.schema.json');
  const validate=new Ajv({allErrors:true}).compile(schema);
  assert.equal(validate(deck),true,JSON.stringify(validate.errors));
  assert.deepEqual(validatePresentation(deck,schema),[]);
  const images=deck.slides.filter(slide=>slide.image);
  assert.equal(images.length,6);
  assert.equal(new Set(images.map(slide=>slide.image.src)).size,6);
  for(const slide of images) {
    assert.ok(slide.image.alt.trim());assert.ok(slide.image.caption.trim());
    assert.ok(manifest.resources.some(resource=>resource.path===`public/apresentacoes/${slide.image.src.slice(2)}`));
  }
});
test('A02: official mascot categories and visible Tim Berners-Lee authorship, license and changes',()=>{
  const catalog=read('public/biblioteca-bitara/catalog.json');
  for(const slide of deck.slides.filter(slide=>slide.mascot)) {
    const selected=selectMascot(catalog,slide.mascot);
    assert.ok(selected);assert.equal(selected.category,slide.mascot.category);assert.equal(selected.reviewStatus,'revisada');
  }
  const tim=deck.slides.find(slide=>slide.image?.src==='./images/tim-berners-lee.webp');
  assert.match(tim.image.caption,/Paul Clarke/);assert.match(tim.image.caption,/CC BY 2\.0/);
  assert.match(tim.image.caption,/Conversão para WebP e redução de resolução/);
  assert.ok(tim.sources.includes('https://creativecommons.org/licenses/by/2.0/'));
});
test('A02: local validation is not publication and public files exclude administrative envelopes',()=>{
  assert.equal(manifest.publishedPresentationUrl,null);
  assert.equal(manifest.administrativeCandidate.publicUrlFilled,false);
  assert.equal(manifest.administrativeCandidate.optionalReinforcementActivities,2);
  assert.equal('teacherOnly' in deck,false);assert.equal('activities' in deck,false);
  const files=readdirSync('public',{recursive:true}).map(String);
  assert.equal(files.some(file=>/admin\.(?:candidata|revisao)|gabarito|relatorio|proveniencia|originais|manifesto-recursos/i.test(file)),false);
});
