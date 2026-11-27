# Sekai status

## Current prototype

- Native Herdr mod tab with a pixel-art platformer, directional movement, double dash and replaceable character sprites.
- Files gate toggles Herdr's native side panel. Git uses the ordinary Changes panel before selecting an agent; afterward the gate opens the `sekai-changes` companion dialog scoped to the world's last embedded terminal address. It resolves the live model-pane cwd and machine, reuses Herdr worktree discovery and Git UI, and reports unavailable targets rather than falling back to a different repository. Live GUI/remote verification is pending.
- Workspace gate opens the existing Ctrl-Space navigation menu.
- Ctrl-Space → Escape now returns keyboard focus to the same Sekai pane (user confirmed live). This workaround requires the companion dotfiles-macos `tab-prefix` mod to publish `sekai.focusRequest` with the target pane, tab, unique ID and one-second expiry. Tab-selection and other-overlay focus restoration remain upstream limitations.
- Agent gate opens a local agent picker. Select an agent to open its original live terminal in a native Herdr floating dialog layout, without selecting its source tab. Herdr's dialog path requests terminal focus automatically; live focus restoration remains to be verified.

## Architecture decision: shared engine, independent worlds

- One Sekai instance per Herdr workspace, all using the same mod implementation and shared assets.
- Changes to movement, mechanics, UI and sprite packs should propagate to every instance through Herdr's mod reload mechanism.
- Character position, local agent selection, workspace context and panel state remain independent per instance.
- The workspace gate connects worlds through the existing Ctrl-Space menu; Git, Files and agents remain scoped to the local workspace.
- No separate server initially. Consider a shared service only when cross-machine synchronization, persistent character identities or shared world events require it.
- Each world view has a fresh instance ID; its Herdr workspace ID identifies the world, and its pane/tab IDs identify its focus target. An explicit `worldId` or `pane` prop can pre-bind identity; otherwise unique panes bind automatically and ambiguous views bind when their own keyboard handler receives input. Overlay IDs and session IDs are tracked independently of the live agent terminal address. Close-focus requests from agent overlays include the originating instance and session; older tab-prefix requests remain pane/tab scoped.
- Verify that all existing instances receive code updates without requiring manual recreation and preserve independent state where appropriate. Current Herdr does not expose an overlay-specific terminal key context, so Escape can close the tracked dialogue only if the Sekai world receives the event; when the embedded terminal itself has focus, Escape is still terminal input. Do not globally rebind Escape.

## Creative inventory and world schema (v1)

- `world-data.js` is the canonical declarative layout: world size, viewport, spawn, floor, background/parallax, scenic trigger, and stable-ID objects with asset references, logical coordinates, dimensions, collision type and optional portal action.
- `sekaiAssetCatalog` indexes reusable textures and sprites by ID, with relative path, logical size, transparency and optional tiling. The renderer and platform collision list derive from the same world definition. The workshop bench is now an independent decoration, not baked into the cottage.
- `validateSekaiWorld()` rejects invalid assets, duplicate object IDs, bounds, collision types and unsupported portal anchors. `node tests/world-data.test.mjs` tests the current world and invalid examples.
- Backlog: creative inventory UI and command console (`place`, `move`, `remove`, `undo`, `save`), persistent validated edits, then an agent-facing command interface using the same validation. Live editing and persistence are not implemented yet.

## Backlog: persistent in-world agent workflow

- E at the right gate presents a workspace-scoped picker keyed by agent terminal address. E/Enter opens the selected terminal using Herdr's documented native `openOverlay` layout API, with a close control. This first implementation is a floating dialog, not an inline split. The modal dialog does not close on outside clicks. Ctrl-Space retains Herdr's ordinary tab portal in all contexts. Ctrl-E is reserved globally for Sekai by explicit user approval (ordinary terminal Ctrl-E no longer moves the cursor to the end of a line). The companion dotfiles-macos `sekai-bridge` captures the exact world/embedded overlay context and requests the same Sekai agent picker: 1–9 switch agents, q returns to the world. Outside Sekai the bridge is a no-op. The explicit Close button remains available. Live Ctrl-E routing still needs verification. Exact world/instance/pane/tab/session IDs and request expiry guard against stale selections. Plain Escape remains terminal input. Live cross-mod integration requires verification.
- Verify actual live terminal input, resizing, close/focus restoration, and that the source pane remains in its original tab, including when switching workspaces.
- Evolve the picker into an in-world village of agent characters and investigate inline side-by-side composition without changing the user's global layout.
- If native terminal embedding is unavailable, investigate Pi session APIs (including MCP where appropriate) for an in-world dialogue/chat interface. A custom xterm/Ghostty rendering layer is a fallback, not a requirement.
- Support opening and collapsing the selected agent interaction, preserving session state and returning keyboard focus to the world.
- Future: agent-specific hot-swappable Term-chan/Haremizer character assets and dialogue bubbles.

Acceptance: choose a known agent, interact with its live session, and close the interaction without leaving Sekai or interrupting the agent's original session. Multiple agents must map deterministically to their own sessions.
