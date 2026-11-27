import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sekaiAssetCatalog, sekaiWorldDefinition, validateSekaiWorld } from '../world-data.js';

assert.equal(validateSekaiWorld(sekaiWorldDefinition), sekaiWorldDefinition);
for (const asset of Object.values(sekaiAssetCatalog)) assert(fs.existsSync(new URL(`../${asset.path}`, import.meta.url)), asset.path);
const bench = sekaiWorldDefinition.objects.find(o=>o.id==='workshop-bench');
const git = sekaiWorldDefinition.objects.find(o=>o.id==='git-workshop');
assert(bench.x+bench.w <= git.x, 'workbench must not overlap Git');
const cottage = sekaiWorldDefinition.objects.find(o=>o.id==='cottage-shell');
const command = sekaiWorldDefinition.objects.find(o=>o.id==='command-block');
assert(command && command.action==='command' && command.x > cottage.x+cottage.w, 'command block must be right of cottage');
const files = sekaiWorldDefinition.objects.find(o=>o.id==='file-library');
assert.equal(files.y + files.h, sekaiWorldDefinition.floor, 'files portal must rest on ground floor');
const bookshelf = sekaiWorldDefinition.objects.find(o=>o.id==='library-bookshelf');
assert(bookshelf && bookshelf.y + bookshelf.h === sekaiWorldDefinition.floor, 'library bookshelf must rest on ground floor');
for (const id of ['cottage-door-left', 'cottage-door-right']) {
  const door = sekaiWorldDefinition.objects.find(o=>o.id===id);
  assert(door && door.frames?.length === 4, `${id} must have 4 animation frames`);
}
const negative = [
  d=>d.objects[1].id=d.objects[0].id,
  d=>d.objects[0].asset='missing',
  d=>d.objects[0].w=10000,
  d=>d.objects[0].collision='none',
  d=>d.objects.find(o=>o.id==='git-workshop').y--,
  d=>d.objects.find(o=>o.id==='git-workshop').action='unknown',
  d=>d.objects.find(o=>o.id==='cottage-door-left').frames=['missing'],
  d=>d.background.dayAsset='missing',
  d=>d.vista.zoom=0,
];
for (const defect of negative) { const copy=structuredClone(sekaiWorldDefinition); defect(copy); assert.throws(()=>validateSekaiWorld(copy),/Invalid Sekai world/); }
console.log('catalog files, valid world, independent bench and seven invalid-world controls passed');
