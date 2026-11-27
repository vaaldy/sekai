# Sekai status

## Current prototype

- Native Herdr mod tab with a pixel-art platformer, directional movement, double dash and replaceable character sprites.
- Git and Files gates toggle Herdr's native side panels.
- Workspace gate opens the existing Ctrl-Space navigation menu.
- Ctrl-Space → Escape now returns keyboard focus to the same Sekai pane (user confirmed live). This workaround requires the companion dotfiles-macos `tab-prefix` mod to publish `sekai.focusRequest` with the target pane, tab, unique ID and one-second expiry. Tab-selection and other-overlay focus restoration remain upstream limitations.
- Agent gate currently selects another tab in the current workspace; this leaves Sekai.

## Architecture decision: shared engine, independent worlds

- One Sekai instance per Herdr workspace, all using the same mod implementation and shared assets.
- Changes to movement, mechanics, UI and sprite packs should propagate to every instance through Herdr's mod reload mechanism.
- Character position, local agent selection, workspace context and panel state remain independent per instance.
- The workspace gate connects worlds through the existing Ctrl-Space menu; Git, Files and agents remain scoped to the local workspace.
- No separate server initially. Consider a shared service only when cross-machine synchronization, persistent character identities or shared world events require it.
- Verify that all existing instances receive code updates without requiring manual recreation and preserve independent state where appropriate.

## Backlog: persistent in-world agent workflow

- Replace the cycling agent gate with a village of agents tied to their actual Herdr session identities. Interact with a specific agent rather than an arbitrary next tab.
- Keep Sekai visible when opening an agent. Prefer embedding or revealing its existing interactive terminal alongside the world without moving it or switching its original tab.
- Investigate Herdr's supported live terminal composition API and the Orrery layout precedent. Verify terminal ownership, focus, input, resize and whether a terminal can be displayed from another tab.
- If native terminal embedding is unavailable, investigate Pi session APIs (including MCP where appropriate) for an in-world dialogue/chat interface. A custom xterm/Ghostty rendering layer is a fallback, not a requirement.
- Support opening and collapsing the selected agent interaction, preserving session state and returning keyboard focus to the world.
- Future: agent-specific hot-swappable Term-chan/Haremizer character assets and dialogue bubbles.

Acceptance: choose a known agent, interact with its live session, and close the interaction without leaving Sekai or interrupting the agent's original session. Multiple agents must map deterministically to their own sessions.
