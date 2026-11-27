import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sekaiAssetCatalog, sekaiWorldDefinition, validateSekaiWorld } from '../world-data.js';

assert.equal(validateSekaiWorld(sekaiWorldDefinition), sekaiWorldDefinition);
for (const asset of Object.values(sekaiAssetCatalog)) assert(fs.existsSync(new URL(`../${asset.path}`, import.meta.url)), asset.path);
const bench = sekaiWorldDefinition.objects.find(o=>o.id==='workshop-bench');
const git = sekaiWorldDefinition.objects.find(o=>o.id==='git-workshop');
assert(bench.x+bench.w <= git.x, 'workbench must not overlap Git');
const negative = [
  d=>d.objects[1].id=d.objects[0].id,
  d=>d.objects[0].asset='missing',
  d=>d.objects[0].w=10000,
  d=>d.objects[0].collision='none',
  d=>d.objects.find(o=>o.id==='git-workshop').y--,
  d=>d.objects.find(o=>o.id==='git-workshop').action='unknown',
  d=>d.vista.zoom=0,
];
for (const defect of negative) { const copy=structuredClone(sekaiWorldDefinition); defect(copy); assert.throws(()=>validateSekaiWorld(copy),/Invalid Sekai world/); }
console.log('catalog files, valid world, independent bench and seven invalid-world controls passed');
