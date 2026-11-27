import vm from "node:vm";
import fs from "node:fs";
import assert from "node:assert/strict";

const context = vm.createContext({});
const sharedStore = new Map();
function make(name, exports) {
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
  }, { context, identifier: name });
}

const herdr = make("herdr", {
  shared: k => sharedStore.get(k),
  setShared: (k, v) => sharedStore.set(k, structuredClone(v)),
  theme: () => ({ popover: "#131b30" }),
});
const gpui = make("gpui-kit", { div() {}, image() {} });

const worldData = new vm.SourceTextModule(fs.readFileSync("world-data.js", "utf8"), { context, identifier: "./world-data.js" });
const inv = new vm.SourceTextModule(fs.readFileSync("inventory.js", "utf8"), { context, identifier: "./inventory.js" });

for (const m of [worldData, inv]) {
  m.linkRequests(m.moduleRequests.map(r => (r.specifier === "herdr" ? herdr : r.specifier === "gpui-kit" ? gpui : worldData)));
}
inv.instantiate();
await inv.evaluate();

const {
  HOTBAR_SIZE, BACKPACK_SIZE, EQUIPMENT_SLOTS, sekaiItemCatalog,
  createInitialStashState, validateStashState, moveOrSwapSlots, quickTransferSlot, toggleEquipSlot, inventoryMethods,
} = inv.namespace;

const catalog = worldData.namespace.sekaiAssetCatalog;
for (const spec of Object.values(sekaiItemCatalog)) {
  assert(catalog[spec.asset], `item asset ${spec.asset} registered in sekaiAssetCatalog`);
}

let state = createInitialStashState(["cottage-stash"]);
assert.equal(validateStashState(state), state);
assert.equal(state.hotbar.length, HOTBAR_SIZE);
assert.equal(state.backpack.length, BACKPACK_SIZE);
assert.deepEqual(Object.keys(state.equipment), [...EQUIPMENT_SLOTS]);

// 1. Stack merging with maxStack cap (99): 24 + 50 = 74, then + 40 -> 99 + remainder 15
state = moveOrSwapSlots(state, { section: "chest", chestId: "cottage-stash", index: 1 }, { section: "hotbar", index: 2 });
assert.equal(state.hotbar[2].count, 74);
assert.equal(state.chests["cottage-stash"].slots[1], null);

state.chests["cottage-stash"].slots[1] = { itemId: "mat.timber", count: 40 };
state = moveOrSwapSlots(state, { section: "chest", chestId: "cottage-stash", index: 1 }, { section: "hotbar", index: 2 });
assert.equal(state.hotbar[2].count, 99);
assert.equal(state.chests["cottage-stash"].slots[1].count, 15);

// 2. Partial split onto empty slot
state = moveOrSwapSlots(state, { section: "hotbar", index: 2 }, { section: "hotbar", index: 8 }, 19);
assert.equal(state.hotbar[2].count, 80);
assert.equal(state.hotbar[8].count, 19);

// 3. Equipment slot enforcement: material rejected in weapon slot; weapon accepted
const beforeInvalidEquip = JSON.stringify(state);
state = moveOrSwapSlots(state, { section: "hotbar", index: 2 }, { section: "equipment", slot: "weapon" });
assert.equal(JSON.stringify(state), beforeInvalidEquip);

state = toggleEquipSlot(state, { section: "hotbar", index: 0 });
assert.equal(state.equipment.weapon.itemId, "gear.summit-blade");
assert.equal(state.hotbar[0], null);

// Swapping two charm items via toggleEquipSlot
state = toggleEquipSlot(state, { section: "backpack", index: 1 }); // ember-lantern -> charm
assert.equal(state.equipment.charm.itemId, "gear.ember-lantern");
assert.equal(state.backpack[1], null);
state = toggleEquipSlot(state, { section: "chest", chestId: "cottage-stash", index: 0 }); // feather-charm swaps with ember-lantern
assert.equal(state.equipment.charm.itemId, "gear.feather-charm");
assert.equal(state.chests["cottage-stash"].slots[0].itemId, "gear.ember-lantern");

// 4. Quick-transfer between chest and player inventory
state = quickTransferSlot(state, { section: "chest", chestId: "cottage-stash", index: 3 }, "cottage-stash"); // 12 berries -> merges into hotbar[3] (5 + 12 = 17 <= 20)
assert.equal(state.hotbar[3].count, 17);
assert.equal(state.chests["cottage-stash"].slots[3], null);

// 5. Persistence round-trip via shared()
const host = { worldId: "w-test", keys: new Set(), ...inventoryMethods };
host.saveStash(state);
const host2 = { worldId: "w-test", keys: new Set(), ...inventoryMethods };
host2.loadStash();
assert.equal(host2.stash.hotbar[3].count, 17);
assert.equal(host2.stash.equipment.weapon.itemId, "gear.summit-blade");

// 6. Negative controls on validateStashState
const negatives = [
  s => { s.activeHotbar = 9; },
  s => { s.hotbar[0] = { itemId: "unknown.item", count: 1 }; },
  s => { s.hotbar[2].count = 100; }, // exceeds maxStack 99
  s => { s.equipment.weapon = { itemId: "mat.timber", count: 1 }; },
  s => { delete s.equipment.charm; },
  s => { s.chests["cottage-stash"].slots.pop(); },
];
for (const mutate of negatives) {
  const copy = structuredClone(state);
  mutate(copy);
  assert.throws(() => validateStashState(copy), /Invalid Sekai stash/);
}

console.log("stash schema, stack merge/overflow, split, equipment rules, quick-transfer, persistence, and 6 negative controls passed");
