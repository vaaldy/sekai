import { View, div, image } from "gpui-kit";
import { agents, checking, closeOverlay, focused, layout, nextCommand, openOverlay, panes, props, run, setShared, settings, shared, spaces, window } from "herdr";

const W = 320, H = 180;
const platforms = [[0, 320, 166], [120, 200, 132], [72, 136, 98], [184, 248, 98], [12, 100, 64], [220, 308, 64]];
const gates = [
  { x: 28, y: 166, title: "WORKSPACES", action: "spaces" },
  { x: 292, y: 166, title: "TABS / AGENTS", action: "tabs" },
  { x: 56, y: 64, title: "GIT", action: "changes" },
  { x: 264, y: 64, title: "FILES", action: "files" },
];
const controls = new Set(["left", "right", "up", "down", "a", "d", "w", "s", "space", "e", "enter", "x", "shift"]);
const frameCounts = { idle: 1, run: 4, jump: 2, fall: 2, dash: 2 };
const characterPack = "mods/sekai/assets/characters/default";

function find(node, id) {
  if (!node || typeof node !== "object") return undefined;
  if (node.id === id) return node;
  for (const child of Object.values(node)) {
    const match = find(child, id);
    if (match) return match;
  }
}

export default class Sekai extends View {
  init(_props, cx) {
    this.title = props()?.role === "terminal-title" ? props() : null;
    if (this.title) return;
    this.picker = props()?.role === "agent-picker" ? props() : null;
    this.handle = cx.focus_handle();
    if (this.picker) {
      this.worldId = this.picker.origin.worldId;
      this.agentIndex = 0;
      this.handle.focus();
      return;
    }
    this.size = { width: 640, height: 360 };
    this.x = 160; this.y = 166; this.vy = 0; this.ground = true;
    this.facing = 1; this.pose = "idle"; this.frame = 0;
    this.dashes = 2; this.dashTicks = 0; this.trail = [];
    this.choosingAgent = false; this.agentIndex = 0;
    this.keys = new Set(); this.running = false; this.message = "Click the world to take control";
    this.instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pane = props()?.pane;
    this.worldId = props()?.worldId;
    this.wasActive = false;
    if (checking()) return;
    // Hidden tabs may not render, so check selection even while the world is hidden.
    cx.timer.every(150, cx => this.syncFocus(cx));
    cx.spawn(async cx => {
      while (true) if (await nextCommand() === "focus" && !this.terminalDialog && !this.changesDialog && this.pane && focused()?.pane === this.pane) { this.handle.focus(); cx.notify(); }
    });
  }

  bindIdentity(selection, ownsInput = false) {
    const all = spaces();
    const tabs = this.worldId ? all.find(s => s.id === this.worldId)?.tabs ?? [] : null;
    const candidates = panes().filter(p => p.mod === "sekai" && (!tabs || tabs.some(t => t.id === p.tab)));
    const own = this.pane ? candidates.find(p => p.pane === this.pane) : ownsInput ? candidates.find(p => p.pane === selection?.pane) : candidates.length === 1 ? candidates[0] : null;
    if (!own) return;
    this.pane = own.pane;
    this.tabId = own.tab;
    this.worldId = all.find(s => s.tabs.some(t => t.id === own.tab))?.id ?? this.worldId;
  }

  syncFocus(cx) {
    const selection = focused();
    this.bindIdentity(selection);
    const active = Boolean(this.pane && selection?.pane === this.pane && window()?.visible !== false);
    if (active) {
      const context = shared("sekai.worldContext");
      if (context?.instanceId !== this.instanceId) setShared("sekai.worldContext", { instanceId: this.instanceId, pane: this.pane, tab: this.tabId, worldId: this.worldId });
      if (!this.wasActive) this.focusAttempts = 3;
    }
    if (this.consumePortal(selection, cx)) { this.wasActive = false; return; }
    const request = shared("sekai.focusRequest");
    if (active && request?.pane === this.pane && request.tab === selection.tab && (!request.instanceId || request.instanceId === this.instanceId) && request.expires >= Date.now() && request.id !== this.lastFocusRequest) {
      this.lastFocusRequest = request.id;
      if (request.overlaySession === this.terminalDialog?.session) this.terminalDialog = null;
      if (request.changesSession === this.changesDialog?.session) this.changesDialog = null;
      if (!this.terminalDialog && !this.changesDialog) this.focusAttempts = 1;
    }
    if (active && !this.terminalDialog && !this.changesDialog && this.focusAttempts > 0) {
      if (this.handle.is_focused()) this.focusAttempts = 0;
      else { this.focusAttempts--; this.handle.focus(); cx.notify(); }
    } else if (!active && this.wasActive) { this.keys.clear(); this.shiftHeld = false; }
    this.wasActive = active;
  }

  near() { return gates.find(g => Math.abs(g.x - this.x) <= 14 && Math.abs(g.y - this.y) <= 5); }

  activate(gate, cx) {
    this.keys.clear();
    if (gate.action === "spaces") {
      openOverlay({ mod: "tab-prefix", kind: "dialog", width: 320, props: { mode: "workspace" } });
    } else if (gate.action === "tabs") {
      this.choosingAgent = !this.choosingAgent; this.agentIndex = 0;
    } else if (gate.action === "changes" && this.lastAgentTerminal) {
      this.bindIdentity(focused(), true);
      if (!this.pane || focused()?.pane !== this.pane) return;
      const origin = { instanceId: this.instanceId, pane: this.pane, tab: this.tabId, worldId: this.worldId, session: `${this.instanceId}-${Date.now()}-${Math.random()}`, terminal: this.lastAgentTerminal };
      const id = openOverlay({ mod: "sekai-changes", kind: "dialog", width: 0.78, height: 0.8, props: { terminal: this.lastAgentTerminal, origin } });
      this.changesDialog = { ...origin, id };
      setShared("sekai.changesOverlay", this.changesDialog);
    } else {
      const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
      if (panel && body && find(body, gate.action)) {
        if (!panel.hidden && body.active === gate.action) run("layout.hide", { id: "panel" });
        else {
          run("layout.select", { stack: "panel-body", child: gate.action });
          run("layout.show", { id: "panel" });
        }
      } else run("mod.open", { name: gate.action });
    }
    cx.notify();
  }

  localAgents() {
    const space = this.worldId ?? focused()?.space ?? spaces().find(s => s.active)?.id;
    return agents().filter(agent => agent.space === space && agent.address);
  }

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
    if (request.action !== "return" && !agent) return false;
    if (current) { closeOverlay(current.id); this.terminalDialog = null; }
    if (changes) { closeOverlay(changes.id); this.changesDialog = null; }
    if (agent) this.openAgent(agent, cx);
    else { this.focusAttempts = 1; cx.notify(); }
    return true;
  }

  showAgent(agent, cx) {
    if (!agent || !this.localAgents().some(a => a.address === agent.address)) return;
    const origin = focused();
    this.bindIdentity(origin, true);
    if (!this.pane || origin?.pane !== this.pane || origin.tab !== this.tabId) return;
    this.openAgent(agent, cx);
  }

  openAgent(agent, cx) {
    this.lastAgentTerminal = agent.address;
    this.choosingAgent = false; this.keys.clear();
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
  }

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
  }

  direction() {
    return [Number(this.keys.has("right") || this.keys.has("d")) - Number(this.keys.has("left") || this.keys.has("a")),
      Number(this.keys.has("down") || this.keys.has("s")) - Number(this.keys.has("up") || this.keys.has("w"))];
  }

  modifiersChanged(e, cx) {
    const shift = e.modifiers.shift;
    if (shift && !this.shiftHeld) this.key({ key: "shift", modifiers: e.modifiers }, cx);
    if (!shift) this.keys.delete("shift");
    this.shiftHeld = shift;
  }

  chooseAgent(agent, cx) {
    if (!agent || !this.localAgents().some(a => a.address === agent.address)) return;
    if (this.picker) {
      this.pickerAction = { action: "open", terminal: agent.address };
      closeOverlay(props().overlay);
    } else this.showAgent(agent, cx);
  }

  pickerKey(e, cx) {
    if (e.modifiers?.control || e.modifiers?.alt || e.modifiers?.platform) return;
    const list = this.localAgents();
    if (["escape", "q", "e", "enter", "up", "down", "w", "s"].includes(e.key) || /^[1-9]$/.test(e.key)) {
      cx.stop_propagation();
      if (e.key === "escape" || (e.key === "q" && !this.picker)) {
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
  }

  key(e, cx) {
    if (e.keystroke === "ctrl-e" && !e.is_held) {
      cx.stop_propagation();
      this.bindIdentity(focused(), true);
      this.choosingAgent = !this.choosingAgent;
      this.agentIndex = 0;
      this.keys.clear();
      cx.notify();
      return;
    }
    if (e.modifiers?.control || e.modifiers?.alt || e.modifiers?.platform) return;
    this.bindIdentity(focused(), true);
    if (e.key === "escape" && this.terminalDialog && focused()?.pane === this.pane) {
      cx.stop_propagation();
      closeOverlay(this.terminalDialog.id);
      this.terminalDialog = null;
      return;
    }
    if (this.choosingAgent) { this.pickerKey(e, cx); return; }
    if (!controls.has(e.key)) return;
    cx.stop_propagation();
    this.inputPane = focused()?.pane;
    this.message = "Explore the mountain";
    if (e.key === "e" || e.key === "enter") {
      if (!e.is_held && this.near()) this.activate(this.near(), cx);
      return;
    }
    this.keys.add(e.key);
    if (!e.is_held && ["x", "shift"].includes(e.key) && this.dashes > 0 && !this.dashTicks) {
      let [dx,dy] = this.direction();
      if (!dx && !dy) dx = this.facing;
      const length = Math.hypot(dx,dy);
      this.dashX = dx / length * 9; this.dashY = dy / length * 9;
      this.dashTicks = 7; this.dashes--; this.ground = false;
      if (dx) this.facing = Math.sign(dx);
    }
    if (!e.is_held && ["up", "w", "space"].includes(e.key) && this.ground && !this.dashTicks) {
      this.vy = -8.6; this.ground = false;
    }
    if (!e.is_held && ["down", "s"].includes(e.key) && this.ground && this.y < 166 && !this.dashTicks) {
      this.y += 1; this.ground = false;
    }
    if (!this.running) { this.running = true; this.tick(cx); }
  }

  tick(cx) {
    if (focused()?.pane !== this.inputPane || !this.handle.is_focused() || window()?.visible === false) this.keys.clear();
    const [dx] = this.direction();
    const dashing = this.dashTicks > 0;
    if (dashing) {
      this.trail.unshift({ x: this.x, y: this.y });
      this.trail.length = Math.min(4, this.trail.length);
      this.dashTicks--;
      this.vy = this.dashY;
    } else {
      this.trail.pop();
      this.vy += 0.62;
      if (dx) this.facing = Math.sign(dx);
    }
    this.x = Math.max(8, Math.min(W - 8, this.x + (dashing ? this.dashX : dx * 2.7)));
    const oldY = this.y;
    this.y = Math.max(24, this.y + this.vy);
    if (this.y === 24 && this.vy < 0) { this.vy = 0; this.dashTicks = 0; }
    this.ground = false;
    if (this.vy >= 0) {
      const surface = platforms.filter(([a,b,y]) => this.x >= a && this.x <= b && oldY <= y && this.y >= y)
        .sort((a,b) => a[2] - b[2])[0];
      if (surface) {
        this.y = surface[2]; this.vy = 0; this.ground = true;
        if (this.dashY > 0) this.dashTicks = 0;
        if (!this.dashTicks) this.dashes = 2;
      }
    }
    if (dashing && !this.dashTicks && !this.ground) this.vy = 0;
    const pose = dashing ? "dash" : !this.ground ? (this.vy < 0 ? "jump" : "fall") : dx ? "run" : "idle";
    this.frame = pose === this.pose ? this.frame + 1 : 0;
    this.pose = pose;
    cx.notify();
    if (this.ground && !dx && !this.dashTicks && !this.trail.length && this.pose === "idle") this.running = false;
    else cx.timer.after(30, cx => this.tick(cx));
  }

  renderPicker(root, list) {
    return root.bg("#17223d").border_1().border_color("#8cabc9").p(12).flex().flex_col().gap(6).text_size(13).text_color("#e8eaff")
      .font_family("PxPlus IBM VGA 8x16")
      .child("AGENT VILLAGE   1–9 OPEN · ↑ ↓ / E · ESC BACK")
      .child(div().flex_1().min_h(0).overflow_y_scrollbar().children(list.map((agent,i) => div().id(`agent-${agent.address}`).px(8).py(6)
        .bg(i === Math.min(this.agentIndex,list.length-1) ? "#50638b" : "#293655").cursor_pointer()
        .on_click((_e,cx) => this.chooseAgent(agent,cx)).child(`${i < 9 ? `${i+1}  ` : ""}${agent.tab_name} / ${agent.pane_name || agent.app || agent.title} · ${agent.status}`))))
      .when(!list.length, el => el.child("No agents in this workspace"))
      .child(div().id("return-world").cursor_pointer().on_click((_e,cx) => this.pickerKey({ key: "q" }, cx)).child("Q · RETURN TO WORLD"));
  }

  render() {
    if (this.picker) return this.renderPicker(div().id("sekai-agent-picker").size_full().track_focus(this.handle).on_key_down((e,cx) => this.pickerKey(e,cx)), this.localAgents());
    if (this.title) return div().size_full().flex().items_center().justify_between().px(10).bg("#252e47")
      .font_family("PxPlus IBM VGA 8x16").text_color("#e8eaff").text_size(14)
      .child(`AGENT / ${this.title.label ?? "Terminal"}`)
      .child(div().id("close-terminal").px(12).cursor_pointer().bg("#4a3557").on_mouse_down("left", (_e,cx) => cx.stop_propagation())
        .on_click((_e,cx) => { cx.stop_propagation(); closeOverlay(props().overlay); }).child("× CLOSE"));
    const scale = Math.min(this.size.width / W, this.size.height / H);
    const place = (x,y,w,h) => div().absolute().left(x*scale).top(y*scale).w(w*scale).h(h*scale);
    const near = this.near();
    const current = spaces().find(s => s.active);
    const list = this.choosingAgent ? this.localAgents() : [];
    const pickerWidth = Math.min(W * scale, 400);
    const pickerHeight = Math.min(H * scale, 1.25 * (96 + Math.min(Math.max(list.length, 1) * 36, 144)));
    return div().id("sekai").size_full().flex().items_center().justify_center().bg("#131a32")
      .font_family("PxPlus IBM VGA 8x16")
      .track_focus(this.handle)
      .on_mouse_down("left", (_e, cx) => { this.handle.focus(); cx.stop_propagation(); cx.notify(); })
      .on_click((_e, cx) => { this.handle.focus(); cx.notify(); })
      .on_key_down((e,cx) => this.key(e,cx))
      .on_key_up((e) => this.keys.delete(e.key))
      .on_modifiers_changed((e, cx) => this.modifiersChanged(e, cx))
      .on_size_change((size,cx) => {
        const zoom = settings().zoom;
        this.size = { width: size.width/zoom, height: size.height/zoom }; cx.notify();
      })
      .child(div().relative().w(W*scale).h(H*scale).overflow_hidden()
        .child(image("mods/sekai/assets/mountain.png").size_full())
        .children(gates.map(g => place(g.x-30,g.y-25,60,12).flex().justify_center().items_center()
          .text_size(5.5*scale).font_bold().text_color(near===g ? "#fff2a9" : "#dceaff").child(g.title)))
        .children(this.trail.map((p,i) => place(p.x-8,p.y-24,16,24).opacity(0.45-i*0.1)
          .child(image(`${characterPack}/dash/${this.facing < 0 ? "left" : "right"}-0.png`).size_full())))
        .child(place(this.x-8,this.y-24,16,24).child(image(`${characterPack}/${this.pose}/${this.facing < 0 ? "left" : "right"}-${Math.floor(this.frame/3)%frameCounts[this.pose]}.png`).size_full()))
        .child(place(6,4,308,12).flex().justify_between().text_size(5*scale).text_color("#e8eaff")
          .child(`SEKAI  /  ${current?.name ?? "Mountain"}`).child("← → move  ↑ jump  ↓ drop  X/Shift dash  E enter"))

        .child(place(0,170,320,9).flex().justify_center().items_center().text_size(5*scale).text_color("#f9e1b7")
          .child(near ? `E · ${near.title}` : this.message))
        .when(this.choosingAgent, el => el.child(this.renderPicker(div().absolute().left((W*scale-pickerWidth)/2).top((H*scale-pickerHeight)/2).w(pickerWidth).h(pickerHeight), list))));
  }
}
