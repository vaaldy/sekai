import { div, image } from "gpui-kit";
import { focused, layout, openOverlay, run, setShared, settings, spaces } from "herdr";

export const W = 320, H = 180;
export const platforms = [[0, 320, 166], [120, 200, 132], [72, 136, 98], [184, 248, 98], [12, 100, 64], [220, 308, 64]];
const gates = [
  { x: 28, y: 166, title: "WORKSPACES", action: "spaces" },
  { x: 292, y: 166, title: "TABS / AGENTS", action: "tabs" },
  { x: 56, y: 64, title: "GIT", action: "changes" },
  { x: 264, y: 64, title: "FILES", action: "files" },
];

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

export const world = {
  near() { return gates.find(g => Math.abs(g.x - this.x) <= 14 && Math.abs(g.y - this.y) <= 5); },

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
  },

  renderWorld() {
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
};
