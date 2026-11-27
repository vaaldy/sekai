import { View, div, image } from "gpui-kit";
import { checking, focused, layout, nextCommand, panes, props, run, settings, shared, spaces, window } from "herdr";

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
    this.handle = cx.focus_handle();
    this.size = { width: 640, height: 360 };
    this.x = 160; this.y = 166; this.vy = 0; this.ground = true;
    this.facing = 1; this.pose = "idle"; this.frame = 0;
    this.dashes = 2; this.dashTicks = 0; this.trail = [];
    this.keys = new Set(); this.running = false; this.message = "Click the world to take control";
    this.pane = props()?.pane;
    this.wasActive = false;
    if (checking()) return;
    // Hidden tabs may not render, so check selection even while the world is hidden.
    cx.timer.every(150, cx => this.syncFocus(cx));
    cx.spawn(async cx => {
      while (true) if (await nextCommand() === "focus" && this.pane && focused()?.pane === this.pane) { this.handle.focus(); cx.notify(); }
    });
  }

  syncFocus(cx) {
    const selection = focused();
    // Caller-supplied identity is required if more than one Sekai pane exists.
    if (!this.pane) {
      const candidates = panes().filter(p => p.mod === "sekai");
      if (candidates.length === 1) this.pane = candidates[0].pane;
    }
    const active = Boolean(this.pane && selection?.pane === this.pane && window()?.visible !== false);
    if (active && !this.wasActive) this.focusAttempts = 3;
    const request = shared("sekai.focusRequest");
    if (active && request?.pane === this.pane && request.tab === selection.tab && request.expires >= Date.now() && request.id !== this.lastFocusRequest) {
      this.lastFocusRequest = request.id;
      this.focusAttempts = 1;
    }
    if (active && this.focusAttempts > 0) {
      if (this.handle.is_focused()) this.focusAttempts = 0;
      else { this.focusAttempts--; this.handle.focus(); cx.notify(); }
    } else if (!active && this.wasActive) { this.keys.clear(); this.shiftHeld = false; }
    this.wasActive = active;
  }

  near() { return gates.find(g => Math.abs(g.x - this.x) <= 14 && Math.abs(g.y - this.y) <= 5); }

  activate(gate, cx) {
    this.keys.clear();
    const all = spaces(), current = all.find(s => s.id === focused()?.space);
    if (gate.action === "spaces") {
      run("mod.open", { name: "tab-prefix" });
    } else if (gate.action === "tabs") {
      const tabs = current?.tabs ?? [], index = tabs.findIndex(t => t.id === focused()?.tab);
      const other = tabs.slice(index + 1).concat(tabs.slice(0, index)).find(t => !t.settled);
      if (other) run("tab.select", { id: other.id });
      else this.message = "No other active tab in this workspace";
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

  key(e, cx) {
    if (!controls.has(e.key) || e.modifiers?.control || e.modifiers?.alt || e.modifiers?.platform) return;
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

  render() {
    const scale = Math.min(this.size.width / W, this.size.height / H);
    const place = (x,y,w,h) => div().absolute().left(x*scale).top(y*scale).w(w*scale).h(h*scale);
    const near = this.near();
    const current = spaces().find(s => s.active);
    return div().id("sekai").size_full().flex().items_center().justify_center().bg("#131a32")
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
          .child(near ? `E · ${near.title}` : this.message)));
  }
}
