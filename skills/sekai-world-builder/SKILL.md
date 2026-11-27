---
name: sekai-world-builder
description: Edit and generate Sekai worlds, terrain, buildings, decorations, portals, and 16-bit pixel assets through the validated world-data.js schema.
---

# Sekai World Builder

You are the always-alive Command Center agent for Sekai, a native Herdr Desktop mod. All world generation and layout edits go through the declarative schema in `world-data.js` and its asset catalog.

## Core files

- `world-data.js` — `sekaiAssetCatalog`, `sekaiFrames`, `sekaiWorldDefinition`, and `validateSekaiWorld()`.
- `world.js` — renderer, parallax sky/atmosphere, camera vista trigger, and portal dispatch.
- `player.js` — movement, double jump, double dash, and one-way platform collision.
- `agents.js` — agent picker, embedded native terminal overlays, and Command Center launcher.
- `assets/terrain/` — 16-bit pixel-art sprites and tiles.

## Schema rules (`world-data.js`)

1. **Asset catalog (`sekaiAssetCatalog`):** every texture has a stable ID, relative `path`, logical `size: [w, h]`, `transparent: boolean`, and `tile: true` for repeatable platform strips.
2. **World definition (`sekaiWorldDefinition`):** `version: 1`, `size: [W, H]`, `viewport: [320, 180]`, `spawn: [x, y]`, `floor`, `background`, `atmosphere`, `vista`, and `objects[]`.
3. **Objects:** each object has a unique `id`, `kind`, `asset`, `x`, `y`, `w`, `h`, and `collision`:
   - `platform`: `collision: "one-way"`, asset must have `tile: true`.
   - `decoration`: `collision: "none"`. Keep furniture and props as separate objects rather than baking them into building sprites.
   - `portal`: `collision: "none"`, `title`, and `action` in `["spaces", "tabs", "changes", "files", "command"]`. Every portal's bottom-center `(x + w/2, y + h)` must rest on a `platform`.
4. **Reachability:** keep vertical rises between consecutive platforms `<= 42` logical pixels (a single jump reaches ~58 px; double jump + double dash reach further). Avoid placing platforms overlapping building facades unless intentional.

## Creating or editing pixel art

- Author terrain tiles at `32×5` logical pixels (opaque) and sprites/decorations at their logical pixel dimensions (RGBA transparent).
- Upscale all generated PNGs 4× with nearest-neighbor resampling (`Image.Resampling.NEAREST`) so pixels stay crisp.
- Keep stars behind the mountain silhouette in `world.js` (`skyline` / `skyHeight`).

## Validation and live reload

After every edit, run all checks and sync to the live Herdr mod directory:

```sh
node tests/world-data.test.mjs
node --experimental-vm-modules tests/agents.test.mjs
~/.local/bin/herdr-app check "$PWD"
```

Deploy updated files to `~/.config/herdr-app/mods/sekai/` (copy assets and imported modules before `main.js`), then verify:

```sh
~/.local/bin/herdr-app check ~/.config/herdr-app/mods/sekai
```

## Guardrails

- Never export a symbol named `agents` from any module that imports `agents` from `"herdr"`.
- Do not modify unrelated Herdr dotfiles, keymaps, or other workspaces unless explicitly asked.
- Do not commit or push without explicit user instruction.
