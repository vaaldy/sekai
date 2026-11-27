import { div } from "gpui-kit";
import { agents as herdrAgents, closeOverlay, focused, home, openOverlay, panes, props, run, setShared, shared, spaces } from "herdr";

const COMMAND_TAB = "Sekai Command";
const COMMAND_TASK = "Read skills/sekai-world-builder/SKILL.md and stand by as the Sekai Command Center world-builder agent. Wait for my world editing instructions.";


export const agentMethods = {
  findCommandAgent() {
    const allSpaces = spaces();
    const space = this.worldId ?? focused()?.space ?? allSpaces.find(s => s.active)?.id;
    const ordered = [allSpaces.find(s => s.id === space), ...allSpaces.filter(s => s.id !== space)].filter(Boolean);
    const allPanes = panes();
    for (const s of ordered) {
      for (const tab of s.tabs ?? []) {
        if (tab.name !== COMMAND_TAB) continue;
        const p = allPanes.find(entry => entry.tab === tab.id && entry.terminal);
        if (p) return { address: p.terminal, pane: p.pane, space: s.id, tab: tab.id, tab_name: tab.name, pane_name: p.name || COMMAND_TAB, status: p.status, app: p.app, program: p.program, title: p.title || COMMAND_TAB };
      }
    }
    return null;
  },

  openCommandCenter(cx) {
    const origin = focused();
    this.bindIdentity(origin, true);
    if (!this.pane || origin?.pane !== this.pane || origin.tab !== this.tabId) return;
    const existing = this.findCommandAgent();
    if (existing) {
      this.pendingCommandCenter = 0;
      this.keys.clear();
      setShared("sekai.portalRequest", {
        id: `${Date.now()}-${Math.random()}`,
        instanceId: this.instanceId,
        pane: this.pane,
        tab: this.tabId,
        worldId: this.worldId,
        fromSession: this.terminalDialog?.session ?? null,
        action: "open",
        terminal: existing.address,
        expires: Date.now() + 2000,
      });
      return;
    }
    if (!this.pendingCommandCenter || Date.now() > this.pendingCommandCenter) {
      run("tab.new", { name: COMMAND_TAB, space: this.worldId ?? origin.space, folder: `${home()}/Documents/sekai`, argv: ["pi"], task: COMMAND_TASK, focus: false });
      this.pendingCommandCenter = Date.now() + 8000;
    }
    this.message = "Starting Sekai Command Center...";
    cx.notify();
  },

  localAgents() {
    const space = this.worldId ?? focused()?.space ?? spaces().find(s => s.active)?.id;
    if (typeof herdrAgents === "function") return herdrAgents().filter(agent => agent.space === space && agent.address);
    // Recover when Herdr's agents export is not callable using the same model panes with a status.
    const world = spaces().find(s => s.id === space);
    const allPanes = panes();
    return (world?.tabs ?? []).flatMap(tab => allPanes.filter(p => p.tab === tab.id && p.terminal && p.status).map(p => ({
      address: p.terminal, pane: p.pane, space, tab: tab.id, tab_name: tab.name,
      pane_name: p.name, status: p.status, app: p.app, program: p.program, title: p.title
    })));
  },

  consumePortal(selection, cx) {
    const request = shared("sekai.portalRequest");
    if (!request || !this.pane || request.instanceId !== this.instanceId || request.pane !== this.pane || request.tab !== this.tabId || request.worldId !== this.worldId || request.expires < Date.now() || request.id === this.lastPortalRequest) return false;
    if (selection?.tab !== this.tabId || selection.space !== this.worldId) return false;
    const current = this.terminalDialog;
    if (request.fromSession ? current?.session !== request.fromSession || (selection.pane !== this.pane && !(selection.pane == null && selection.terminal === current.terminal)) : selection.pane !== this.pane || current) return false;
    const changes = this.changesDialog;
    if (request.fromChangesSession ? changes?.session !== request.fromChangesSession : changes) return false;
    this.lastPortalRequest = request.id;
    if (request.action === "picker") {
      if (current || changes) {
        const origin = { instanceId: this.instanceId, pane: this.pane, tab: this.tabId, worldId: this.worldId, fromSession: current?.session ?? null, ...(changes ? { fromChangesSession: changes.session } : {}) };
        const count = this.localAgents().length;
        openOverlay({ mod: "sekai", kind: "dialog", width: 400, height: 1.25 * (96 + Math.min(Math.max(count, 1) * 36, 144)), props: { role: "agent-picker", origin } });
        return false;
      }
      this.choosingAgent = !this.choosingAgent;
      this.agentIndex = 0;
      this.keys.clear(); this.focusAttempts = 1;
      cx.notify();
      return false;
    }
    const agent = request.action === "open" ? this.localAgents().find(a => a.address === request.terminal) : null;
    if (request.action === "git" && changes) return false;
    if (request.action !== "return" && request.action !== "git" && !agent) return false;
    if (request.action === "git" && !this.lastAgentTerminal) return false;
    if (current) {
      closeOverlay(current.id);
      this.terminalDialog = null;
    }
    if (changes) { closeOverlay(changes.id); this.changesDialog = null; }
    if (agent) this.openAgent(agent, cx);
    else if (request.action === "git") { this.openChanges(); cx.notify(); }
    else { this.focusAttempts = 1; cx.notify(); }
    return true;
  },

  showAgent(agent, cx) {
    if (!agent || !this.localAgents().some(a => a.address === agent.address)) return;
    const origin = focused();
    this.bindIdentity(origin, true);
    if (!this.pane || origin?.pane !== this.pane || origin.tab !== this.tabId) return;
    this.openAgent(agent, cx);
  },

  openAgent(agent, cx) {
    if (this.terminalDialog) {
      closeOverlay(this.terminalDialog.id);
      this.terminalDialog = null;
    }
    this.lastAgentTerminal = agent.address;
    this.choosingAgent = false; this.keys.clear();
    this.pendingCommandCenter = 0;
    this.focusAttempts = 0;
    this.running = false;
    const session = `${this.instanceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const overlay = openOverlay({
      kind: "dialog", modal: true, width: 0.52, height: 0.76,
      layout: { type: "column", children: [
        { type: "block", size: { px: 34 }, content: { mod: "sekai", props: { role: "terminal-title", label: agent.pane_name || agent.tab_name || agent.title, origin: { pane: this.pane, tab: this.tabId, worldId: this.worldId, instanceId: this.instanceId, overlaySession: session, terminal: agent.address } } } },
        { type: "block", content: { terminal: agent.address } }
      ] }
    });
    this.terminalDialog = { id: overlay, session, terminal: agent.address };
    setShared("sekai.terminalOverlay", { ...this.terminalDialog, pane: this.pane, tab: this.tabId, worldId: this.worldId, instanceId: this.instanceId });
    cx.notify();
  },

  close() {
    if (this.picker && this.pickerAction) {
      setShared("sekai.portalRequest", { ...this.picker.origin, ...this.pickerAction, id: `${Date.now()}-${Math.random()}`, expires: Date.now() + 2000 });
    }
    if (this.title?.origin?.pane) {
      const active = shared("sekai.terminalOverlay");
      if (active?.session !== this.title.origin.overlaySession) return;
      setShared("sekai.terminalOverlay", null);
      setShared("sekai.focusRequest", { id: `${Date.now()}-${Math.random()}`, ...this.title.origin, expires: Date.now() + 1000 });
    }
  },

  chooseAgent(agent, cx) {
    if (!agent || !this.localAgents().some(a => a.address === agent.address)) return;
    if (this.picker) {
      this.pickerAction = { action: "open", terminal: agent.address };
      closeOverlay(props().overlay);
    } else this.showAgent(agent, cx);
  },

  pickerKey(e, cx) {
    if (e.modifiers?.control || e.modifiers?.alt || e.modifiers?.platform) return;
    const list = this.localAgents();
    if (["escape", "q", "g", "e", "enter", "up", "down", "w", "s"].includes(e.key) || /^[1-9]$/.test(e.key)) {
      cx.stop_propagation();
      if (e.key === "g" && !e.is_held) {
        if (this.picker) { this.pickerAction = { action: "git" }; closeOverlay(props().overlay); }
        else { this.choosingAgent = false; this.activate({ action: "changes" }, cx); }
      } else if (e.key === "escape" || (e.key === "q" && !this.picker)) {
        if (this.picker) closeOverlay(props().overlay);
        else this.choosingAgent = false;
      } else if (e.key === "q" && this.picker) {
        this.pickerAction = { action: "return" };
        closeOverlay(props().overlay);
      } else if (/^[1-9]$/.test(e.key) && !e.is_held) this.chooseAgent(list[Number(e.key)-1], cx);
      else if (["e", "enter"].includes(e.key) && !e.is_held) this.chooseAgent(list[Math.min(this.agentIndex, list.length - 1)], cx);
      else if (["up", "w", "down", "s"].includes(e.key) && list.length) this.agentIndex = (this.agentIndex + list.length + (["up", "w"].includes(e.key) ? -1 : 1)) % list.length;
      cx.notify();
    }
  },

  renderPicker(root, list) {
    return root.bg("#17223d").border_1().border_color("#8cabc9").p(12).flex().flex_col().gap(6).text_size(13).text_color("#e8eaff")
      .font_family("PxPlus IBM VGA 8x16")
      .child("AGENT VILLAGE   1–9 OPEN · ↑ ↓ / E · ESC BACK")
      .child(div().flex_1().min_h(0).overflow_y_scrollbar().children(list.map((agent,i) => div().id(`agent-${agent.address}`).px(8).py(6)
        .bg(i === Math.min(this.agentIndex,list.length-1) ? "#50638b" : "#293655").cursor_pointer()
        .on_click((_e,cx) => this.chooseAgent(agent,cx)).child(`${i < 9 ? `${i+1}  ` : ""}${agent.tab_name} / ${agent.pane_name || agent.app || agent.title} · ${agent.status}`))))
      .when(!list.length, el => el.child("No agents in this workspace"))
      .child(div().flex().justify_between()
        .child(div().id("open-git").cursor_pointer().on_click((_e,cx) => this.pickerKey({ key: "g" }, cx)).child("G · GIT"))
        .child(div().id("return-world").cursor_pointer().on_click((_e,cx) => this.pickerKey({ key: "q" }, cx)).child("Q · RETURN TO WORLD")));
  }
};
