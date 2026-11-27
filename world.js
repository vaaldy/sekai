import { div, image } from "gpui-kit";
import { focused, layout, openOverlay, run, setShared, settings, spaces } from "herdr";

import { sekaiAssetCatalog, sekaiAssetPath, sekaiFrames, sekaiWorldDefinition, validateSekaiWorld } from "./world-data.js";

const definition = validateSekaiWorld(sekaiWorldDefinition);
export const W = definition.viewport[0];
export const H = definition.viewport[1];
export const WORLD_W = definition.size[0];
export const WORLD_H = definition.size[1];
export const FLOOR = definition.floor;
const terrain = definition.objects.filter(o=>o.kind==="platform");
const decorations = definition.objects.filter(o=>o.kind==="decoration");
export const platforms = terrain.map(o=>[o.x,o.x+o.w,o.y]);
const gates = definition.objects.filter(o=>o.kind==="portal").map(o=>({...o,x:o.x+o.w/2,y:o.y+o.h}));
const skyline = [[-35,210],[20,170],[66,156],[95,130],[111,137],[158,160],[187,145],[224,111],[253,101],[290,49],[326,18],[339,40],[353,50],[381,90],[399,96],[422,141],[468,157],[490,126],[516,104],[526,119],[546,131],[569,155],[610,171],[670,216]];
function skyHeight(x) {
  const i = skyline.findIndex(([right]) => right >= x);
  const [a,ay] = skyline[i-1], [b,by] = skyline[i];
  return 34 + (ay + (by-ay)*(x-a)/(b-a))*174/208;
}
const twinkles = Array.from({length: 116}, (_,i) => {
  const x = (19 + i*137) % 640, size = i%4===0 ? 5 : i%3===0 ? 3 : 2;
  const ceiling = Math.min(...Array.from({length:size+1},(_,j)=>skyHeight(x+j)));
  const y = 8 + (i*53)%Math.max(1,Math.floor(ceiling-size-11));
  return { x, y, period: 1250 + (i*719)%3100, size, color: "#e5eaff" };
}).concat([90,250,410,570].map((x,i) => ({ x, y: 211+i%2*10, period: 2100+i*530, size: 3, color: "#ffe4a9" })));

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
      this.openChanges();
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

  openChanges() {
    const origin = { instanceId: this.instanceId, pane: this.pane, tab: this.tabId, worldId: this.worldId, session: `${this.instanceId}-${Date.now()}-${Math.random()}`, terminal: this.lastAgentTerminal };
    const id = openOverlay({ mod: "sekai-changes", kind: "dialog", width: 0.78, height: 0.8, props: { terminal: this.lastAgentTerminal, origin } });
    this.changesDialog = { ...origin, id };
    setShared("sekai.changesOverlay", this.changesDialog);
  },

  // Call once per movement tick, including idle ticks during the transition.
  // Initialize camera to null; this method never schedules timers or activates gates.
  updateCamera(cx) {
    const v = definition.vista;
    const margin = this.vistaActive ? 5 : 0;
    const reveal = this.x >= v.x-margin && this.x <= v.x+v.w+margin && Math.abs(this.y-v.y) <= v.tolerance+margin && (this.vistaActive || this.ground);
    const zoom = reveal ? v.zoom : 1;
    const targetX = Math.max(0, Math.min(WORLD_W-W/zoom, (reveal ? v.target[0] : this.x)-W/(2*zoom)));
    const targetY = Math.max(0, Math.min(WORLD_H-H/zoom, (reveal ? v.target[1] : this.y)-H*0.73/zoom));
    const target = { x:targetX, y:targetY, zoom };
    if (this.camera && reveal !== Boolean(this.vistaActive)) this.cameraTransitioning = true;
    this.vistaActive = reveal;
    if (!this.camera || !this.cameraTransitioning) { this.camera = target; return false; }
    for (const key of ["x","y","zoom"]) {
      const delta = target[key]-this.camera[key];
      const tolerance = key === "zoom" ? .0005 : .05;
      this.camera[key] = Math.abs(delta) <= tolerance ? target[key] : this.camera[key]+delta*.12;
    }
    this.cameraTransitioning = ["x","y","zoom"].some(key=>this.camera[key]!==target[key]);
    return this.cameraTransitioning;
  },

  renderWorld() {
    const scale = Math.min(this.size.width / W, this.size.height / H);
    const uiZoom = settings().zoom;
    const snap = n => Math.round(n*uiZoom)/uiZoom;
    const place = (x,y,w,h) => {
      const left=snap(x*scale), top=snap(y*scale);
      return div().absolute().left(left).top(top).w(snap((x+w)*scale)-left).h(snap((y+h)*scale)-top);
    };
    const cameraX = this.camera?.x ?? Math.max(0, Math.min(WORLD_W-W, this.x-W/2));
    const cameraY = this.camera?.y ?? Math.max(0, Math.min(WORLD_H-H, this.y-H*0.73));
    const z = this.camera?.zoom ?? 1;
    const worldPlace = (x,y,w,h) => place(x*z,y*z,w*z,h*z);
    const [bgWidth,bgHeight] = sekaiAssetCatalog[definition.background.asset].size;
    const [parallaxX,parallaxY] = definition.background.parallax;
    const bgX = Math.max(0,Math.min(bgWidth-W/z,cameraX*parallaxX));
    const bgY = Math.max(0,Math.min(bgHeight-H/z,cameraY*parallaxY));
    const unit = scale*z;
    const scene = (x,y,w,h) => worldPlace(x-cameraX,y-cameraY,w,h);
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
        const width=size.width/zoom, height=size.height/zoom;
        if (Math.abs(this.size.width-width)>.01 || Math.abs(this.size.height-height)>.01) { this.size={width,height}; cx.notify(); }
      })
      .child(div().relative().w(W*scale).h(H*scale).overflow_hidden()
        .child(worldPlace(-bgX,-bgY,bgWidth,bgHeight).child(image(sekaiAssetPath(definition.background.asset)).size_full()))
        .children(twinkles.filter(s => s.x >= bgX-3 && s.x <= bgX+W/z+3 && s.y >= bgY-3 && s.y <= bgY+H/z && (s.color !== "#ffe4a9" || (s.x >= bgX+(W/z-W)/2 && s.x < bgX+(W/z+W)/2))).map(s =>
          worldPlace(s.x-bgX,s.y-bgY,s.size,s.size).id(`sky-star-${s.x}-${s.y}`)
            .when(s.size>2, el => el.child(div().absolute().left((s.size-1)*unit/2).w(unit).h(s.size*unit).bg(s.color)).child(div().absolute().top((s.size-1)*unit/2).w(s.size*unit).h(unit).bg(s.color)))
            .when(s.size===2, el => el.bg(s.color))
            .loop("opacity", {from:.12,to:1,period:s.period})))
        .child(worldPlace(-bgX,172-bgY,640,78).id("forest-atmosphere").opacity(.55).overflow_hidden()
          .child(div().absolute().w(660*scale*z).h(78*scale*z).loop("left",{from:-20*scale*z,to:0,period:16000})
            .child(image(sekaiAssetPath(definition.atmosphere.mist)).size_full())).loop("opacity",{from:.42,to:.8,period:11000}))
        .children(decorations.map(o=>scene(o.x,o.y,o.w,o.h).child(image(sekaiAssetPath(o.asset)).size_full())))
        .children(terrain.filter(o=>o.x+o.w >= cameraX && o.x <= cameraX+W/z && o.y+o.h >= cameraY && o.y <= cameraY+H/z).map(o => {
          const [tileWidth] = sekaiAssetCatalog[o.asset].size;
          const first = Math.max(0,Math.floor((cameraX-o.x)/tileWidth));
          const last = Math.min(Math.ceil(o.w/tileWidth),Math.ceil((cameraX+W/z-o.x)/tileWidth));
          const left = snap((o.x-cameraX)*unit), top = snap((o.y-cameraY)*unit);
          const height = snap((o.y+o.h-cameraY)*unit)-top;
          return scene(o.x,o.y,o.w,o.h).overflow_hidden().children(Array.from({length:Math.max(0,last-first)},(_,i)=>{
            const a = snap((o.x+(first+i)*tileWidth-cameraX)*unit), b = snap((o.x+(first+i+1)*tileWidth-cameraX)*unit);
            return div().absolute().left(a-left).top(0).w(b-a).h(height).child(image(sekaiAssetPath(o.asset)).size_full());
          }));
        }))
        .children(gates.filter(g => g.x >= cameraX-30 && g.x <= cameraX+W/z+30 && g.y >= cameraY && g.y <= cameraY+H/z+25).map(g => scene(g.x-30,g.y-29,60,29).flex().flex_col().items_center()
          .child(div().text_size(5.5*unit).font_bold().text_color(near===g ? "#fff2a9" : "#dceaff").child(g.title))
          .child(image(sekaiAssetPath(g.asset)).w(g.w*unit).h(g.h*unit))))
        .children(this.trail.map((p,i) => scene(p.x-8,p.y-24,16,24).opacity(0.45-i*0.1)
          .child(image(sekaiAssetPath(`character.default.dash.${this.facing < 0 ? "left" : "right"}.0`)).size_full())))
        .child(scene(this.x-8,this.y-24,16,24).child(image(sekaiAssetPath(`character.default.${this.pose}.${this.facing < 0 ? "left" : "right"}.${Math.floor(this.frame/3)%sekaiFrames[this.pose]}`)).size_full()))
        .child(place(6,4,308,12).flex().justify_between().text_size(5*scale).text_color("#e8eaff")
          .child(`SEKAI  /  ${current?.name ?? "Mountain"}`).child("← → move  ↑ jump  ↓ drop  X/Shift dash  E enter"))

        .child(place(0,170,320,9).flex().justify_center().items_center().text_size(5*scale).text_color("#f9e1b7")
          .child(near ? `E · ${near.title}` : this.message))
        .when(this.choosingAgent, el => el.child(this.renderPicker(div().absolute().left((W*scale-pickerWidth)/2).top((H*scale-pickerHeight)/2).w(pickerWidth).h(pickerHeight), list))));
  }
};
