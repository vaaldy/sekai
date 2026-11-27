import { div, image } from "gpui-kit";
import { focused, layout, openOverlay, run, setShared, settings, spaces, theme } from "herdr";

import { sekaiAssetCatalog, sekaiAssetPath, sekaiFrames, sekaiWorldDefinition, validateSekaiWorld } from "./world-data.js";

const definition = validateSekaiWorld(sekaiWorldDefinition);
export const W = definition.viewport[0];
export const H = definition.viewport[1];
export const WORLD_W = definition.size[0];
export const WORLD_H = definition.size[1];
export const FLOOR = definition.floor;
export const DAY_MS = 180000;
const terrain = definition.objects.filter(o=>o.kind==="platform");
const decorations = definition.objects.filter(o=>o.kind==="decoration");
const doors = decorations.filter(o=>o.frames);
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

function skyState(phase) {
  const p = ((phase % 1) + 1) % 1;
  const sunAlt = -Math.cos(p * 2 * Math.PI);
  const daylight = Math.max(0, Math.min(1, (sunAlt + 0.25) / 0.5));
  const twilight = Math.max(0, 1 - Math.abs(sunAlt) / 0.35);
  const mins = Math.floor(p * 1440);
  const clock = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const label = p < 0.2 || p >= 0.85 ? "NIGHT" : p < 0.35 ? "DAWN" : p < 0.7 ? "DAY" : "DUSK";
  const dayT = Math.max(0, Math.min(1, (p - 0.22) / 0.56));
  const sunX = 80 + dayT * 480;
  const sunY = 92 - Math.sin(dayT * Math.PI) * 68;
  return { daylight, twilight, night: 1 - daylight, clock, label, sunX, sunY, sunVisible: p > 0.21 && p < 0.79 };
}

const flocks = {
  DAWN:  { kind: "dawn",  dir:  1, speed: 14, flapMs: 260, bob: 3,   birds: [[110, 56, 0], [134, 66, 1.3], [360, 48, 2.7]] },
  DAY:   { kind: "day",   dir:  1, speed: 19, flapMs: 220, bob: 5,   birds: [[80, 44, 0], [270, 62, 1.8], [460, 40, 3.4]] },
  DUSK:  { kind: "dusk",  dir: -1, speed: 12, flapMs: 360, bob: 2,   birds: [[220, 52, 0], [238, 45, 0.5], [240, 60, 1.0]] },
  NIGHT: { kind: "night", dir: -1, speed:  9, flapMs: 440, bob: 2.5, birds: [[390, 46, 0]] },
};

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

  nearCommandPreview() {
    const g = gates.find(entry => entry.action === "command");
    return g && Math.abs(g.x - this.x) <= 64 && Math.abs(g.y - this.y) <= 32 ? g : null;
  },

  activate(gate, cx) {
    this.keys.clear();
    if (gate.action === "spaces") {
      openOverlay({ mod: "tab-prefix", kind: "dialog", width: 320, props: { mode: "workspace" } });
    } else if (gate.action === "tabs") {
      this.choosingAgent = !this.choosingAgent; this.agentIndex = 0;
    } else if (gate.action === "chest") {
      if (this.stashUI?.chestId === gate.id) this.closeStashUI();
      else this.openStashUI(gate.id, gate.title);
    } else if (gate.action === "command") {
      this.openCommandCenter(cx);
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

  updateDoors() {
    this.doorState ??= {};
    let moving = false;
    for (const d of doors) {
      const open = Math.abs(d.x + d.w / 2 - this.x) <= 22 && this.y >= d.y && this.y <= d.y + d.h + 6;
      const target = open ? d.frames.length - 1 : 0;
      const cur = this.doorState[d.id] ?? 0;
      if (cur !== target) {
        this.doorState[d.id] = cur < target ? Math.min(target, cur + 0.5) : Math.max(target, cur - 0.5);
        moving = true;
      }
    }
    return moving;
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
    // Clip out GPUI's 0.5px SDF quad border & linear atlas bleed using 1-logical-px padded sprites.
    const clippedSprite = (assetId, pxX, pxY, w, h) => {
      const left = snap(pxX*unit), top = snap(pxY*unit);
      const boxW = snap((pxX+w)*unit)-left, boxH = snap((pxY+h)*unit)-top;
      return div().absolute().left(left).top(top).w(boxW).h(boxH).overflow_hidden()
        .child(div().absolute().left(-unit).top(-unit).w(boxW+2*unit).h(boxH+2*unit)
          .child(image(sekaiAssetPath(assetId)).size_full()));
    };
    const sprite = (assetId, x, y, w, h) => clippedSprite(assetId, x-cameraX, y-cameraY, w, h);
    const near = this.near();
    const now = Date.now();
    const sky = skyState(((now - (this.dayStart ?? now)) % DAY_MS) / DAY_MS);
    const flock = flocks[sky.label];
    const span = bgWidth + 40;
    const skyBirds = flock.birds.map(([x0, y0, ph], i) => {
      const x = (((x0 + flock.dir * (now / 1000) * flock.speed) % span) + span) % span - 20;
      const y = y0 + Math.sin(now / 700 + ph) * flock.bob;
      const frame = Math.floor(now / flock.flapMs + ph) % 2;
      return { id: `${flock.kind}-${i}`, x, y, asset: `wildlife.bird.${flock.kind}.${frame}` };
    }).filter(b => b.x >= bgX - 16 && b.x <= bgX + W / z + 16 && b.y >= bgY - 12 && b.y <= bgY + H / z + 12);
    const cmdAgent = this.findCommandAgent();
    const cmdGate = !this.choosingAgent && !this.terminalDialog && !this.changesDialog ? this.nearCommandPreview() : null;
    const cmdWorking = cmdAgent?.status === "working";
    const t = theme();
    const cmdColor = { working: t.working, blocked: t.blocked, done: t.done, idle: t.muted }[cmdAgent?.status] ?? t.dim;
    const lineColor = { tool: t.ansi6 ?? t.accent, subtool: t.muted, error: t.ansi1 ?? t.blocked, ok: t.ansi2 ?? t.done, accent: t.ansi3 ?? t.accent, text: t.foreground };
    const cmdLines = cmdAgent && this.commandPreview?.address === cmdAgent.address
      ? (this.commandPreview.lines.length ? this.commandPreview.lines : [{ text: `Ready (${cmdAgent.status ?? "idle"})`, kind: "subtool" }])
      : [{ text: cmdAgent ? "Reading terminal…" : "Offline · press E to start", kind: "subtool" }];
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
        .child(worldPlace(-bgX-2,-bgY-2,bgWidth+4,bgHeight+4).child(image(sekaiAssetPath(definition.background.asset)).size_full()))
        .when(Boolean(definition.background.dayAsset) && sky.daylight > 0.01, el =>
          el.child(worldPlace(-bgX-2,-bgY-2,bgWidth+4,bgHeight+4).opacity(sky.daylight).child(image(sekaiAssetPath(definition.background.dayAsset)).size_full())))
        .when(sky.sunVisible && sky.daylight > 0.05 && sky.sunX >= bgX-20 && sky.sunX <= bgX+W/z+20, el =>
          el.child(worldPlace(sky.sunX-9-bgX,sky.sunY-9-bgY,18,18).opacity(Math.min(1, sky.daylight*1.2))
            .child(div().absolute().left(2*unit).top(0).w(14*unit).h(18*unit).bg("#fff1a8"))
            .child(div().absolute().left(0).top(2*unit).w(18*unit).h(14*unit).bg("#fff1a8"))
            .child(div().absolute().left(3*unit).top(3*unit).w(12*unit).h(12*unit).bg("#fffbe0"))))
        .when(sky.twilight > 0.02, el => el.child(place(0,0,W,H).bg("#e87d52").opacity(sky.twilight * 0.26)))
        .when(sky.night > 0.02, el => el.child(div().absolute().inset_0().opacity(sky.night)
          .children(twinkles.filter(s => s.x >= bgX-3 && s.x <= bgX+W/z+3 && s.y >= bgY-3 && s.y <= bgY+H/z && (s.color !== "#ffe4a9" || (s.x >= bgX+(W/z-W)/2 && s.x < bgX+(W/z+W)/2))).map(s =>
            worldPlace(s.x-bgX,s.y-bgY,s.size,s.size).id(`sky-star-${s.x}-${s.y}`)
              .when(s.size>2, el => el.child(div().absolute().left((s.size-1)*unit/2).w(unit).h(s.size*unit).bg(s.color)).child(div().absolute().top((s.size-1)*unit/2).w(s.size*unit).h(unit).bg(s.color)))
              .when(s.size===2, el => el.bg(s.color))
              .loop("opacity", {from:.12,to:1,period:s.period})))))
        .children(skyBirds.map(b => clippedSprite(b.asset, b.x-bgX, b.y-bgY, 14, 10).id(b.id)))
        .child(worldPlace(-bgX,172-bgY,640,78).id("forest-atmosphere").opacity(.55).overflow_hidden()
          .child(div().absolute().w(660*scale*z).h(78*scale*z).loop("left",{from:-20*scale*z,to:0,period:16000})
            .child(image(sekaiAssetPath(definition.atmosphere.mist)).size_full())).loop("opacity",{from:.42,to:.8,period:11000}))
        .children(decorations.map(o=>sprite(o.frames ? o.frames[Math.round(this.doorState?.[o.id] ?? 0)] : o.asset, o.x, o.y, o.w, o.h)))
        .children(terrain.filter(o=>o.x+o.w >= cameraX && o.x <= cameraX+W/z && o.y+o.h >= cameraY && o.y <= cameraY+H/z).map(o => {
          if (o.asset === "terrain.dirt-ground") {
            const [tileWidth] = sekaiAssetCatalog[o.asset].size;
            const first = Math.max(0, Math.floor((cameraX - o.x) / tileWidth));
            const last = Math.min(Math.ceil(o.w / tileWidth), Math.ceil((cameraX + W / z - o.x) / tileWidth));
            const left = snap((o.x - cameraX) * unit), top = snap((o.y - cameraY) * unit);
            const height = snap((o.y + o.h - cameraY) * unit) - top;
            return scene(o.x, o.y, o.w, o.h).bg("#4c322e").overflow_hidden().children(Array.from({ length: Math.max(0, last - first) }, (_, i) => {
              const a = snap((o.x + (first + i) * tileWidth - cameraX) * unit), b = snap((o.x + (first + i + 1) * tileWidth - cameraX) * unit);
              return div().absolute().left(a - left).top(0).w(b - a).h(height).child(image(sekaiAssetPath(o.asset)).size_full());
            }));
          }
          const timber = o.asset === "terrain.timber";
          const row = (y, c) => div().w_full().h(unit).bg(c);
          return scene(o.x,o.y,o.w,o.h).bg(timber ? "#664753" : "#474760").overflow_hidden().flex().flex_col()
            .child(row(0, timber ? "#d7ac7d" : "#d0e0eb"))
            .child(row(1, timber ? "#b88c68" : "#8eb9d2"))
            .child(row(2, timber ? "#7a5458" : "#686483"))
            .child(row(3, timber ? "#664753" : "#565570"))
            .child(div().w_full().flex_1().bg(timber ? "#44383e" : "#37384f"));
        }))
        .children(gates.filter(g => g.x >= cameraX-30 && g.x <= cameraX+W/z+30 && g.y >= cameraY && g.y <= cameraY+H/z+25).map(g => scene(g.x-30,g.y-29,60,29).flex().flex_col().items_center().justify_end()
          .child(div().text_size(5.5*unit).font_bold().text_color(near===g ? "#fff2a9" : "#dceaff").child(g.title))
          .child(div().relative().w(g.w*unit).h(g.h*unit).overflow_hidden()
            .child(div().absolute().left(-unit).top(-unit).w((g.w+2)*unit).h((g.h+2)*unit).child(image(sekaiAssetPath(g.asset)).size_full()))
            .when(g.action === "command" && cmdWorking, el => el
              .child(div().id("cmd-pulse-a").absolute().left(7*unit).top(6*unit).w(2*unit).h(2*unit).bg("#f5d27a").loop("opacity", { from: 0.1, to: 1, period: 520 }))
              .child(div().id("cmd-pulse-b").absolute().left(11*unit).top(6*unit).w(2*unit).h(2*unit).bg("#e6838d").loop("opacity", { from: 0.1, to: 1, period: 710 }))
              .child(div().id("cmd-pulse-c").absolute().left(9*unit).top(8*unit).w(2*unit).h(2*unit).bg("#b894ff").loop("opacity", { from: 0.1, to: 1, period: 610 }))
              .child(div().id("cmd-pulse-d").absolute().left(7*unit).top(10*unit).w(2*unit).h(2*unit).bg("#67e0d4").loop("opacity", { from: 0.1, to: 1, period: 830 }))
              .child(div().id("cmd-pulse-e").absolute().left(11*unit).top(10*unit).w(2*unit).h(2*unit).bg("#9cf5e8").loop("opacity", { from: 0.1, to: 1, period: 460 }))))))
        .when(Boolean(cmdGate), el => el.child(scene(cmdGate.x-66,cmdGate.y-82,132,52).bg(t.background).opacity(.95).border(unit).border_color(cmdColor).p(3*unit).flex().flex_col().gap(1.5*unit).overflow_hidden()
          .child(div().w_full().flex().items_center().justify_between().text_size(3.8*unit).font_bold().text_color(cmdColor)
            .child(`COMMAND · ${(cmdAgent?.status ?? "offline").toUpperCase()}`)
            .child(div().text_color(t.muted).child("E OPEN")))
          .child(div().w_full().min_w(0).flex().flex_col().gap(unit).text_size(3.4*unit)
            .children(cmdLines.map(line => div().w_full().truncate().text_color(lineColor[line.kind] ?? t.foreground).child(line.text))))))
        .children(this.trail.map((p,i) => sprite(`character.default.dash.${this.facing < 0 ? "left" : "right"}.0`, p.x-8, p.y-24, 16, 24).opacity(0.45-i*0.1)))
        .child(sprite(`character.default.${this.pose}.${this.facing < 0 ? "left" : "right"}.${Math.floor(this.frame/3)%sekaiFrames[this.pose]}`, this.x-8, this.y-24, 16, 24))
        .when(this.swingTicks > 0, el => {
          const swingSide = (this.swingDir ?? this.facing) < 0 ? "left" : "right";
          const swingFrame = Math.min(3, Math.floor((8 - this.swingTicks) / 2));
          return el.child(sprite(`fx.${this.swingKind ?? "swing"}.${swingSide}.${swingFrame}`, this.x + (swingSide === "right" ? -4 : -20), this.y - 24, 24, 24));
        })
        .when(sky.night > 0.02, el => el.child(place(0,0,W,H).bg("#0f1838").opacity(sky.night * 0.16)))
        .when(sky.twilight > 0.02, el => el.child(place(0,0,W,H).bg("#ff8b4a").opacity(sky.twilight * 0.09)))
        .child((() => {
          const timeColor = { DAWN: "#ffd28a", DAY: "#a8e0ff", DUSK: "#ff9e6e", NIGHT: "#c2cff8" }[sky.label] ?? "#e8eaff";
          const plaque = content => div().relative().overflow_hidden().bg("#2c1d1e").border(scale).border_color("#201417")
            .child(div().absolute().inset_0().opacity(0.55).child(image(sekaiAssetPath("terrain.dirt-ground")).size_full()))
            .child(div().absolute().inset_0().bg("#221518").opacity(0.58))
            .child(div().relative().flex().items_center().gap(3*scale).px(4*scale).py(1.5*scale).border(scale).border_color("#9c7154")
              .child(div().absolute().left(scale).top(scale).w(scale).h(scale).bg("#d7ac7d"))
              .child(div().absolute().right(scale).top(scale).w(scale).h(scale).bg("#d7ac7d"))
              .child(div().absolute().left(scale).bottom(scale).w(scale).h(scale).bg("#6b4738"))
              .child(div().absolute().right(scale).bottom(scale).w(scale).h(scale).bg("#6b4738"))
              .child(content));
          return place(4,3,312,16).flex().items_center().justify_between().text_size(4.6*scale)
            .child(plaque(div().flex().items_center().gap(2.5*scale)
              .child(div().font_bold().text_color("#f5d27a").child("SEKAI"))
              .child(div().text_color("#8c6a56").child("·"))
              .child(div().text_color("#f4ead8").child(current?.name ?? "Mountain"))
              .child(div().text_color("#8c6a56").child("·"))
              .child(div().font_bold().text_color(timeColor).child(`${sky.clock} ${sky.label}`))))
            .child(plaque(div().text_color("#dfd2be").child("← → move  ↑ jump  X dash  E use  I bag  T time")));
        })())
        .child(this.renderHotbarHUD(place, scale))
        .when(Boolean(near || this.message), el => el.child(place(0,131,320,14).flex().justify_center().items_center().text_size(4.6*scale)
          .child(div().relative().overflow_hidden().bg("#2c1d1e").border(scale).border_color("#201417")
            .child(div().absolute().inset_0().opacity(0.5).child(image(sekaiAssetPath("terrain.dirt-ground")).size_full()))
            .child(div().absolute().inset_0().bg("#221518").opacity(0.62))
            .child(div().relative().px(5*scale).py(1.5*scale).border(scale).border_color("#c79a72").font_bold().text_color("#fff0c2")
              .child(near ? `E · ${near.title}` : this.message)))))
        .when(Boolean(this.stashUI), el => el.child(this.renderStashModal(W*scale, H*scale)))
        .when(this.choosingAgent, el => el.child(this.renderPicker(div().absolute().left((W*scale-pickerWidth)/2).top((H*scale-pickerHeight)/2).w(pickerWidth).h(pickerHeight), list))));
  }
};
