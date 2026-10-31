import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {validatePresentation} from '../public/apresentacoes/validate.js';
const read = name => JSON.parse(readFileSync(`public/apresentacoes/${name}`, 'utf8'));
const schema = read('presentation.schema.json');
const demo = read('decks/aula-02-demo.json');
const official = new Ajv({allErrors:true}).compile(schema);
test('demo covers all ten layouts and validates with JSON Schema and browser validator', () => {
  assert.equal(official(demo), true, JSON.stringify(official.errors));
  assert.deepEqual(validatePresentation(demo,schema), []);
  const starter = read('decks/template.json');
  assert.equal(official(starter),true);
  assert.deepEqual(validatePresentation(starter,schema),[]);
  assert.equal(new Set(demo.slides.map(s=>s.type)).size, 10);
});
test('schema and viewer both reject invalid versions, fields, images and layout requirements', () => {
  const cases = [null, [], {...demo,schemaVersion:2}, {...demo,slides:[]}, {...demo,extra:'bad'}, {...demo,slides:Array(61).fill(demo.slides[0])}];
  for (const original of demo.slides) {
    cases.push({...demo,slides:[{...original,title:''}]}, {...demo,slides:[{...original,title:'  '}]}, {...demo,slides:[{...original,html:'<script/>'}]});
  }
  for (const src of ['javascript:alert(1)','https://example.org/a.svg','../private.svg','./images/a.svg?script=1']) {
    cases.push({...demo,slides:[{type:'image',title:'Test',body:'Test',image:{src,alt:'Text'}}]});
  }
  cases.push({...demo,slides:[{type:'comparison',title:'Test',columns:[]}]}, {...demo,slides:[{type:'example',title:'Code',body:'Text'}]}, {...demo,slides:[{type:'unknown',title:'Title'}]});
  for (const value of cases) {
    assert.equal(official(value),false);
    assert.ok(validatePresentation(value,schema).length > 0);
  }
});
