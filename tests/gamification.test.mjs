import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const output = ts.transpileModule(readFileSync('src/lib/gamification.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { playerLevelProgress } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const levels = [0,100,250,450,700,1000,1400,1900,2500,3200].map((min_xp,index) => ({ level:index+1,min_xp,title:`Level ${index+1}` }));
test('level boundaries match the ten Bitaria ranges', () => {
  assert.equal(playerLevelProgress(50,levels).current.level,1);
  levels.forEach((level,index) => {
    assert.equal(playerLevelProgress(level.min_xp,levels).current.level,level.level);
    if (index) assert.equal(playerLevelProgress(level.min_xp-1,levels).current.level,level.level-1);
  });
  assert.equal(playerLevelProgress(10000,levels).current.level,10);
});
test('uses the current level range for progress and caps the final level', () => {
  const mid = playerLevelProgress(750,levels);
  assert.equal(mid.remaining,250);
  assert.equal(mid.percent,50/300*100);
  assert.equal(playerLevelProgress(3200,levels).percent,100);
  assert.equal(playerLevelProgress(3200,levels).remaining,0);
});
