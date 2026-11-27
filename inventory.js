import { div, image } from "gpui-kit";
import { setShared, shared, theme } from "herdr";
import { sekaiAssetPath } from "./world-data.js";

export const HOTBAR_SIZE = 9;
export const BACKPACK_SIZE = 18;
export const DEFAULT_CHEST_SIZE = 18;
export const EQUIPMENT_SLOTS = ["weapon", "tool", "cloak", "charm"];

export const sekaiItemCatalog = {
  "gear.summit-blade":  { name: "Summit Blade",    kind: "equipment", slot: "weapon", maxStack: 1,  asset: "item.blade",   rarity: "rare" },
  "gear.mason-pick":    { name: "Mason Pickaxe",   kind: "equipment", slot: "tool",   maxStack: 1,  asset: "item.pickaxe", rarity: "uncommon" },
  "gear.wind-cloak":    { name: "Wind Cloak",      kind: "equipment", slot: "cloak",  maxStack: 1,  asset: "item.cloak",   rarity: "rare" },
  "gear.feather-charm": { name: "Gale Feather",    kind: "equipment", slot: "charm",  maxStack: 1,  asset: "item.feather", rarity: "epic" },
  "gear.ember-lantern": { name: "Ember Lantern",   kind: "equipment", slot: "charm",  maxStack: 1,  asset: "item.lantern", rarity: "uncommon" },
  "mat.timber":         { name: "Cedar Timber",    kind: "material",  slot: null,     maxStack: 99, asset: "item.timber",  rarity: "common" },
  "mat.snow-stone":     { name: "Snow Stone",      kind: "material",  slot: null,     maxStack: 99, asset: "item.stone",   rarity: "common" },
  "food.star-berry":    { name: "Starlight Berry", kind: "consumable",slot: null,     maxStack: 20, asset: "item.berry",   rarity: "uncommon" },
};

const RARITY_COLOR = { common: "#dceaff", uncommon: "#67e0d4", rare: "#82c7ee", epic: "#f5d27a" };

const emptySlots = n => Array.from({ length: n }, () => null);
const cloneData = v => JSON.parse(JSON.stringify(v));
const cloneSlot = s => (s ? { itemId: s.itemId, count: s.count, ...(s.meta ? { meta: cloneData(s.meta) } : {}) } : null);
const sameStack = (a, b) => Boolean(a && b && a.itemId === b.itemId && JSON.stringify(a.meta ?? null) === JSON.stringify(b.meta ?? null));

export function createInitialStashState(chestIds = ["cottage-stash"]) {
  const hotbar = emptySlots(HOTBAR_SIZE);
  hotbar[0] = { itemId: "gear.summit-blade", count: 1 };
  hotbar[1] = { itemId: "gear.mason-pick", count: 1 };
  hotbar[2] = { itemId: "mat.timber", count: 24 };
  hotbar[3] = { itemId: "food.star-berry", count: 5 };

  const backpack = emptySlots(BACKPACK_SIZE);
  backpack[0] = { itemId: "mat.snow-stone", count: 40 };
  backpack[1] = { itemId: "gear.ember-lantern", count: 1 };

  const chests = {};
  for (const id of chestIds) {
    const slots = emptySlots(DEFAULT_CHEST_SIZE);
    if (id === chestIds[0]) {
      slots[0] = { itemId: "gear.feather-charm", count: 1 };
      slots[1] = { itemId: "mat.timber", count: 50 };
      slots[2] = { itemId: "mat.snow-stone", count: 64 };
      slots[3] = { itemId: "food.star-berry", count: 12 };
    }
    chests[id] = { id, label: "Cottage Stash", size: DEFAULT_CHEST_SIZE, slots };
  }

  return {
    version: 1,
    activeHotbar: 0,
    hotbar,
    backpack,
    equipment: {
      weapon: null,
      tool: null,
      cloak: { itemId: "gear.wind-cloak", count: 1 },
      charm: null,
    },
    chests,
  };
}

export function validateStashState(state, catalog = sekaiItemCatalog) {
  const fail = msg => { throw new Error(`Invalid Sekai stash: ${msg}`); };
  if (!state || state.version !== 1) fail("version");
  if (!Number.isInteger(state.activeHotbar) || state.activeHotbar < 0 || state.activeHotbar >= HOTBAR_SIZE) fail("activeHotbar");

  const checkSlot = (slot, label, requiredEquipSlot = null) => {
    if (slot === null) return;
    if (typeof slot !== "object") fail(`slot ${label}`);
    const spec = catalog[slot.itemId];
    if (!spec) fail(`unknown item ${slot.itemId} at ${label}`);
    if (!Number.isInteger(slot.count) || slot.count < 1 || slot.count > spec.maxStack) fail(`stack count ${slot.count} for ${slot.itemId} at ${label}`);
    if (requiredEquipSlot && spec.slot !== requiredEquipSlot) fail(`item ${slot.itemId} cannot equip in ${requiredEquipSlot}`);
  };

  const checkArray = (arr, expectedLen, label) => {
    if (!Array.isArray(arr) || arr.length !== expectedLen) fail(`${label} length`);
    arr.forEach((s, i) => checkSlot(s, `${label}[${i}]`));
  };

  checkArray(state.hotbar, HOTBAR_SIZE, "hotbar");
  checkArray(state.backpack, BACKPACK_SIZE, "backpack");

  if (!state.equipment || typeof state.equipment !== "object") fail("equipment");
  for (const key of Object.keys(state.equipment)) {
    if (!EQUIPMENT_SLOTS.includes(key)) fail(`unknown equipment slot ${key}`);
  }
  for (const slotName of EQUIPMENT_SLOTS) {
    if (!(slotName in state.equipment)) fail(`missing equipment slot ${slotName}`);
    checkSlot(state.equipment[slotName], `equipment.${slotName}`, slotName);
  }

  if (!state.chests || typeof state.chests !== "object") fail("chests");
  for (const [id, chest] of Object.entries(state.chests)) {
    if (!chest || chest.id !== id || !Number.isInteger(chest.size) || chest.size < 1 || chest.size > 54) fail(`chest ${id}`);
    checkArray(chest.slots, chest.size, `chests.${id}`);
  }
  return state;
}

function resolveRef(state, ref) {
  if (!ref || typeof ref !== "object") throw new Error("Invalid slot ref");
  if (ref.section === "hotbar") {
    if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= state.hotbar.length) throw new Error("Out of range hotbar index");
    return { get: () => state.hotbar[ref.index], set: v => { state.hotbar[ref.index] = v; }, equipSlot: null };
  }
  if (ref.section === "backpack") {
    if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= state.backpack.length) throw new Error("Out of range backpack index");
    return { get: () => state.backpack[ref.index], set: v => { state.backpack[ref.index] = v; }, equipSlot: null };
  }
  if (ref.section === "equipment") {
    if (!EQUIPMENT_SLOTS.includes(ref.slot)) throw new Error(`Unknown equipment slot ${ref.slot}`);
    return { get: () => state.equipment[ref.slot], set: v => { state.equipment[ref.slot] = v; }, equipSlot: ref.slot };
  }
  if (ref.section === "chest") {
    const chest = state.chests[ref.chestId];
    if (!chest || !Number.isInteger(ref.index) || ref.index < 0 || ref.index >= chest.slots.length) throw new Error("Invalid chest slot");
    return { get: () => chest.slots[ref.index], set: v => { chest.slots[ref.index] = v; }, equipSlot: null };
  }
  throw new Error(`Unknown section ${ref.section}`);
}

export function canAcceptItem(ref, slot, catalog = sekaiItemCatalog) {
  if (!slot) return true;
  const spec = catalog[slot.itemId];
  if (!spec) return false;
  if (ref.section === "equipment") return spec.slot === ref.slot && slot.count === 1;
  return true;
}

/** Move, merge, or swap between two slot references. Mutates a validated clone and returns it. */
export function moveOrSwapSlots(state, fromRef, toRef, count = null, catalog = sekaiItemCatalog) {
  const next = cloneData(state);
  const src = resolveRef(next, fromRef);
  const dst = resolveRef(next, toRef);
  if (fromRef.section === toRef.section && fromRef.index === toRef.index && fromRef.slot === toRef.slot && fromRef.chestId === toRef.chestId) return next;

  const srcSlot = src.get();
  if (!srcSlot) return next;
  const dstSlot = dst.get();
  const spec = catalog[srcSlot.itemId];
  const moveCount = count == null ? srcSlot.count : Math.max(1, Math.min(srcSlot.count, Math.floor(count)));

  // Partial split onto empty or matching stack
  if (moveCount < srcSlot.count) {
    if (dst.equipSlot && (spec.slot !== dst.equipSlot || moveCount !== 1 || dstSlot)) return next;
    if (!dstSlot) {
      dst.set({ ...cloneSlot(srcSlot), count: moveCount });
      src.set({ ...cloneSlot(srcSlot), count: srcSlot.count - moveCount });
      return validateStashState(next, catalog);
    }
    if (sameStack(srcSlot, dstSlot) && dstSlot.count < spec.maxStack) {
      const added = Math.min(moveCount, spec.maxStack - dstSlot.count);
      dst.set({ ...cloneSlot(dstSlot), count: dstSlot.count + added });
      src.set({ ...cloneSlot(srcSlot), count: srcSlot.count - added });
      return validateStashState(next, catalog);
    }
    return next;
  }

  // Full stack merge
  if (dstSlot && sameStack(srcSlot, dstSlot) && !dst.equipSlot && dstSlot.count < spec.maxStack) {
    const added = Math.min(srcSlot.count, spec.maxStack - dstSlot.count);
    dst.set({ ...cloneSlot(dstSlot), count: dstSlot.count + added });
    const rem = srcSlot.count - added;
    src.set(rem > 0 ? { ...cloneSlot(srcSlot), count: rem } : null);
    return validateStashState(next, catalog);
  }

  // Move or full swap (validate equipment slot compatibility in both directions)
  if (!canAcceptItem(toRef, srcSlot, catalog) || !canAcceptItem(fromRef, dstSlot, catalog)) return next;
  dst.set(cloneSlot(srcSlot));
  src.set(cloneSlot(dstSlot));
  return validateStashState(next, catalog);
}

/** Insert a stack into an array of slots (merging partial stacks first, then empty slots). Returns remainder count. */
function insertIntoArray(slots, incoming, catalog = sekaiItemCatalog) {
  const spec = catalog[incoming.itemId];
  let rem = incoming.count;
  for (let i = 0; i < slots.length && rem > 0; i++) {
    if (slots[i] && sameStack(slots[i], incoming) && slots[i].count < spec.maxStack) {
      const add = Math.min(rem, spec.maxStack - slots[i].count);
      slots[i] = { ...cloneSlot(slots[i]), count: slots[i].count + add };
      rem -= add;
    }
  }
  for (let i = 0; i < slots.length && rem > 0; i++) {
    if (!slots[i]) {
      const add = Math.min(rem, spec.maxStack);
      slots[i] = { ...cloneSlot(incoming), count: add };
      rem -= add;
    }
  }
  return rem;
}

/** Quick-transfer (Shift-click / Shift-Enter) a slot to its natural counterpart container. */
export function quickTransferSlot(state, fromRef, openChestId = null, catalog = sekaiItemCatalog) {
  const next = cloneData(state);
  const src = resolveRef(next, fromRef);
  const slot = src.get();
  if (!slot) return next;

  let rem = slot.count;
  if (fromRef.section === "chest") {
    rem = insertIntoArray(next.hotbar, { ...slot, count: rem }, catalog);
    if (rem > 0) rem = insertIntoArray(next.backpack, { ...slot, count: rem }, catalog);
  } else if (openChestId && next.chests[openChestId] && (fromRef.section === "hotbar" || fromRef.section === "backpack")) {
    rem = insertIntoArray(next.chests[openChestId].slots, { ...slot, count: rem }, catalog);
  } else if (fromRef.section === "equipment") {
    rem = insertIntoArray(next.hotbar, { ...slot, count: rem }, catalog);
    if (rem > 0) rem = insertIntoArray(next.backpack, { ...slot, count: rem }, catalog);
  } else if (fromRef.section === "hotbar") {
    rem = insertIntoArray(next.backpack, { ...slot, count: rem }, catalog);
  } else if (fromRef.section === "backpack") {
    rem = insertIntoArray(next.hotbar, { ...slot, count: rem }, catalog);
  }

  src.set(rem > 0 ? { ...cloneSlot(slot), count: rem } : null);
  return validateStashState(next, catalog);
}

/** Equip an item from hotbar/backpack/chest into its matching equipment slot (or unequip if already equipped). */
export function toggleEquipSlot(state, fromRef, catalog = sekaiItemCatalog) {
  if (fromRef.section === "equipment") return quickTransferSlot(state, fromRef, null, catalog);
  const src = resolveRef(state, fromRef);
  const slot = src.get();
  if (!slot) return state;
  const spec = catalog[slot.itemId];
  if (!spec?.slot) return state;
  return moveOrSwapSlots(state, fromRef, { section: "equipment", slot: spec.slot }, null, catalog);
}

export function ensureChest(state, chestId, label = "Storage Chest", size = DEFAULT_CHEST_SIZE) {
  if (state.chests[chestId]) return state;
  const next = cloneData(state);
  next.chests[chestId] = { id: chestId, label, size, slots: emptySlots(size) };
  return validateStashState(next);
}

const PANES_WITH_CHEST = ["hotbar", "backpack", "equipment", "chest"];
const PANES_SOLO = ["hotbar", "backpack", "equipment"];

export const inventoryMethods = {
  stashKey() {
    return `sekai.stash.${this.worldId ?? "default"}`;
  },

  loadStash() {
    const raw = shared(this.stashKey());
    if (raw) {
      try {
        this.stash = validateStashState(cloneData(raw));
        return;
      } catch {}
    }
    this.stash = createInitialStashState(["cottage-stash"]);
  },

  saveStash(next) {
    this.stash = validateStashState(next);
    setShared(this.stashKey(), this.stash);
  },

  openStashUI(chestId = null, label = "Cottage Stash") {
    if (!this.stash) this.loadStash();
    if (chestId) this.saveStash(ensureChest(this.stash, chestId, label));
    this.stashUI = {
      chestId,
      pane: chestId ? "chest" : "backpack",
      index: 0,
      grabbed: null,
    };
    this.keys.clear();
  },

  closeStashUI() {
    this.stashUI = null;
  },

  currentCursorRef() {
    const ui = this.stashUI;
    if (!ui) return null;
    if (ui.pane === "equipment") return { section: "equipment", slot: EQUIPMENT_SLOTS[ui.index % EQUIPMENT_SLOTS.length] };
    if (ui.pane === "chest") return { section: "chest", chestId: ui.chestId, index: ui.index };
    return { section: ui.pane, index: ui.index };
  },

  paneCapacity(pane) {
    if (pane === "hotbar") return HOTBAR_SIZE;
    if (pane === "backpack") return BACKPACK_SIZE;
    if (pane === "equipment") return EQUIPMENT_SLOTS.length;
    if (pane === "chest") return this.stash?.chests[this.stashUI?.chestId]?.size ?? DEFAULT_CHEST_SIZE;
    return 1;
  },

  stashKeyInput(e, cx) {
    if (!this.stash) this.loadStash();
    const ui = this.stashUI;
    const panes = ui.chestId ? PANES_WITH_CHEST : PANES_SOLO;
    const cols = ui.pane === "equipment" ? 4 : 9;
    const cap = this.paneCapacity(ui.pane);

    if (["escape", "q", "i"].includes(e.key) && !e.is_held) {
      cx.stop_propagation();
      this.closeStashUI();
      cx.notify();
      return;
    }
    if (/^[1-9]$/.test(e.key) && !e.is_held) {
      cx.stop_propagation();
      this.saveStash({ ...this.stash, activeHotbar: Number(e.key) - 1 });
      cx.notify();
      return;
    }
    if (e.key === "tab" && !e.is_held) {
      cx.stop_propagation();
      const nextPane = panes[(panes.indexOf(ui.pane) + (e.modifiers?.shift ? panes.length - 1 : 1)) % panes.length];
      ui.pane = nextPane;
      ui.index = Math.min(ui.index, this.paneCapacity(nextPane) - 1);
      cx.notify();
      return;
    }
    if (["left", "right", "up", "down", "a", "d", "w", "s"].includes(e.key)) {
      cx.stop_propagation();
      const delta = ["left", "a"].includes(e.key) ? -1 : ["right", "d"].includes(e.key) ? 1 : ["up", "w"].includes(e.key) ? -cols : cols;
      ui.index = (ui.index + delta + cap) % cap;
      cx.notify();
      return;
    }
    if (e.key === "e" && !e.is_held) {
      cx.stop_propagation();
      const ref = this.currentCursorRef();
      this.saveStash(toggleEquipSlot(this.stash, ref));
      ui.grabbed = null;
      cx.notify();
      return;
    }
    if ((e.key === "enter" || e.key === "space") && !e.is_held) {
      cx.stop_propagation();
      const ref = this.currentCursorRef();
      if (e.modifiers?.shift) {
        this.saveStash(quickTransferSlot(this.stash, ref, ui.chestId));
        ui.grabbed = null;
      } else if (!ui.grabbed) {
        const cur = resolveRef(this.stash, ref).get();
        if (cur) ui.grabbed = ref;
      } else {
        this.saveStash(moveOrSwapSlots(this.stash, ui.grabbed, ref));
        ui.grabbed = null;
      }
      cx.notify();
    }
  },

  clickStashSlot(ref, shift, cx) {
    if (!this.stash) this.loadStash();
    const ui = this.stashUI;
    if (!ui) return;
    ui.pane = ref.section;
    ui.index = ref.section === "equipment" ? EQUIPMENT_SLOTS.indexOf(ref.slot) : ref.index;
    if (shift) {
      this.saveStash(quickTransferSlot(this.stash, ref, ui.chestId));
      ui.grabbed = null;
    } else if (!ui.grabbed) {
      if (resolveRef(this.stash, ref).get()) ui.grabbed = ref;
    } else {
      this.saveStash(moveOrSwapSlots(this.stash, ui.grabbed, ref));
      ui.grabbed = null;
    }
    cx.notify();
  },

  renderHotbarHUD(place, scale) {
    if (!this.stash) this.loadStash();
    const slotW = 12, gap = 1.5, pad = 2;
    const totalW = HOTBAR_SIZE * slotW + (HOTBAR_SIZE - 1) * gap + pad * 2;
    const totalH = slotW + pad * 2;
    const startX = 4, startY = 21;
    const activeSlot = this.stash.hotbar[this.stash.activeHotbar];
    const activeSpec = activeSlot ? sekaiItemCatalog[activeSlot.itemId] : null;

    return div().absolute().inset_0()
      .child(place(startX, startY, totalW, totalH).bg("#26191b").opacity(0.92).border(scale).border_color("#9c7154").p(pad * scale).flex().items_center().gap(gap * scale)
        .children(this.stash.hotbar.map((slot, i) => {
          const selected = i === this.stash.activeHotbar;
          const spec = slot ? sekaiItemCatalog[slot.itemId] : null;
          return div().id(`hud-hotbar-${i}`).relative().w(slotW * scale).h(slotW * scale)
            .bg(selected ? "#4a3228" : "#1e1417")
            .border(scale).border_color(selected ? "#f5d27a" : "#5e4238")
            .cursor_pointer()
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .on_click((_e, cx) => { cx.stop_propagation(); this.saveStash({ ...this.stash, activeHotbar: i }); this.handle.focus(); cx.notify(); })
            .when(Boolean(spec), el => el.child(div().absolute().left(1.5 * scale).top(1.5 * scale).w(9 * scale).h(9 * scale).overflow_hidden()
              .child(div().absolute().left(-0.75 * scale).top(-0.75 * scale).w(10.5 * scale).h(10.5 * scale).child(image(sekaiAssetPath(spec.asset)).size_full()))))
            .child(div().absolute().left(0.9 * scale).top(0.4 * scale).text_size(2.6 * scale).text_color(selected ? "#f5d27a" : "#9c8374").child(String(i + 1)))
            .when(Boolean(slot && slot.count > 1), el => el.child(div().absolute().right(0.8 * scale).bottom(0.3 * scale).text_size(2.6 * scale).font_bold().text_color("#ffffff").child(String(slot.count))));
        })))
      .when(Boolean(activeSpec) && !this.stashUI, el =>
        el.child(place(startX + 1, startY + totalH + 1.5, totalW, 7).flex().items_center().text_size(3.8 * scale)
          .text_color(RARITY_COLOR[activeSpec.rarity] ?? "#f4ead8")
          .child(`${activeSpec.name}${activeSlot.count > 1 ? ` ×${activeSlot.count}` : ""}`)));
  },

  renderStashModal(W_px, H_px) {
    if (!this.stashUI) return null;
    if (!this.stash) this.loadStash();
    const ui = this.stashUI;
    const t = theme();
    const chest = ui.chestId ? this.stash.chests[ui.chestId] : null;
    const modalW = Math.min(W_px - 16, 424);
    const modalH = Math.min(H_px - 16, chest ? 378 : 276);
    const cursorRef = this.currentCursorRef();
    const inspected = cursorRef ? resolveRef(this.stash, cursorRef).get() : null;
    const inspectedSpec = inspected ? sekaiItemCatalog[inspected.itemId] : null;

    const sameRef = (a, b) => Boolean(a && b && a.section === b.section && a.index === b.index && a.slot === b.slot && a.chestId === b.chestId);

    const renderCell = (id, slot, ref, hint = null) => {
      const isCursor = sameRef(cursorRef, ref);
      const isGrabbed = sameRef(ui.grabbed, ref);
      const spec = slot ? sekaiItemCatalog[slot.itemId] : null;
      return div().id(id).relative().w(38).h(38).rounded(3)
        .bg(isGrabbed ? "#4c3b63" : isCursor ? "#314670" : "#1a233b")
        .border_1().border_color(isGrabbed ? "#f5d27a" : isCursor ? "#82c7ee" : "#3a4b6e")
        .cursor_pointer()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((e, cx) => { cx.stop_propagation(); this.clickStashSlot(ref, Boolean(e.modifiers?.shift), cx); })
        .when(Boolean(hint && !spec), el => el.flex().items_center().justify_center().text_size(9).text_color("#5e6f94").child(hint))
        .when(Boolean(spec), el => el.child(div().absolute().left(7).top(7).w(24).h(24).overflow_hidden()
          .child(div().absolute().left(-2).top(-2).w(28).h(28).child(image(sekaiAssetPath(spec.asset)).size_full()))))
        .when(Boolean(slot && slot.count > 1), el => el.child(div().absolute().right(3).bottom(2).text_size(10).font_bold().text_color("#f8fafc").child(String(slot.count))));
    };

    const renderGrid = (section, slots, chestId = null) => {
      const rows = [];
      for (let r = 0; r < slots.length; r += 9) {
        rows.push(div().flex().gap(4).children(slots.slice(r, r + 9).map((slot, c) =>
          renderCell(`stash-${section}-${r + c}`, slot, chestId ? { section, chestId, index: r + c } : { section, index: r + c }, section === "hotbar" ? String(r + c + 1) : null))));
      }
      return div().flex().flex_col().gap(4).children(rows);
    };

    return div().id("sekai-stash-modal").absolute().left((W_px - modalW) / 2).top((H_px - modalH) / 2).w(modalW).h(modalH)
      .bg(t.popover ?? "#131b30").border_1().border_color("#7c9bc4").p(12).flex().flex_col().gap(8).text_color("#e8eaff")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(div().flex().items_center().justify_between().text_size(13).font_bold()
        .child(chest ? `STASH · ${chest.label.toUpperCase()}` : "INVENTORY & EQUIPMENT")
        .child(div().text_size(11).text_color("#9aa8c7").child("TAB PANE · ENTER MOVE · SHIFT+ENTER QUICK · E EQUIP · ESC")))
      .child(div().flex().items_center().justify_between()
        .child(div().flex().items_center().gap(6)
          .child(div().text_size(11).text_color("#9aa8c7").child("EQUIP"))
          .children(EQUIPMENT_SLOTS.map(slotName =>
            renderCell(`stash-equip-${slotName}`, this.stash.equipment[slotName], { section: "equipment", slot: slotName }, slotName.slice(0, 3).toUpperCase()))))
        .child(div().text_size(12).text_color(inspectedSpec ? (RARITY_COLOR[inspectedSpec.rarity] ?? "#dceaff") : "#7c8aa8")
          .child(inspectedSpec ? `${inspectedSpec.name}${inspected.count > 1 ? ` ×${inspected.count}` : ""}${inspectedSpec.slot ? ` [${inspectedSpec.slot}]` : ""}` : (ui.grabbed ? "Select target slot…" : "Empty slot"))))
      .when(Boolean(chest), el => el.child(div().flex().flex_col().gap(3)
        .child(div().text_size(11).text_color("#f5d27a").child(`CHEST (${chest.slots.filter(Boolean).length}/${chest.size})`))
        .child(renderGrid("chest", chest.slots, chest.id))))
      .child(div().flex().flex_col().gap(3)
        .child(div().text_size(11).text_color("#9aa8c7").child("BACKPACK"))
        .child(renderGrid("backpack", this.stash.backpack)))
      .child(div().flex().flex_col().gap(3)
        .child(div().text_size(11).text_color("#9aa8c7").child("HOTBAR (1–9)"))
        .child(renderGrid("hotbar", this.stash.hotbar)));
  },
};
