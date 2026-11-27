import { focused, closeOverlay, window } from "herdr";
import { DAY_MS, WORLD_W, FLOOR, platforms } from "./world.js";

const controls = new Set(["left", "right", "up", "down", "a", "d", "w", "s", "space", "e", "enter", "x", "shift", "t"]);

export const player = {
  direction() {
    return [Number(this.keys.has("right") || this.keys.has("d")) - Number(this.keys.has("left") || this.keys.has("a")),
      Number(this.keys.has("down") || this.keys.has("s")) - Number(this.keys.has("up") || this.keys.has("w"))];
  },

  modifiersChanged(e, cx) {
    const shift = e.modifiers.shift;
    if (shift && !this.shiftHeld) this.key({ key: "shift", modifiers: e.modifiers }, cx);
    if (!shift) this.keys.delete("shift");
    this.shiftHeld = shift;
  },

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
    this.message = "";
    if (e.key === "t") {
      if (!e.is_held) { this.dayStart -= DAY_MS / 8; cx.notify(); }
      return;
    }
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
    if (!e.is_held && ["up", "w", "space"].includes(e.key) && this.jumps > 0) {
      this.jumps--; this.dashTicks = 0;
      this.vy = -8.6; this.ground = false;
    }
    if (!e.is_held && ["down", "s"].includes(e.key) && this.ground && this.y < FLOOR && !this.dashTicks) {
      this.y += 1; this.ground = false;
    }
    if (!this.running) { this.running = true; this.tick(cx); }
  },

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
    this.x = Math.max(8, Math.min(WORLD_W - 8, this.x + (dashing ? this.dashX : dx * 2.7)));
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
        if (!this.dashTicks) { this.jumps = 2; this.dashes = 2; }
      }
    }
    if (dashing && !this.dashTicks && !this.ground) this.vy = 0;
    const pose = dashing ? "dash" : !this.ground ? (this.vy < 0 ? "jump" : "fall") : dx ? "run" : "idle";
    this.frame = pose === this.pose ? this.frame + 1 : 0;
    this.pose = pose;
    const movingCamera = this.updateCamera(cx);
    const movingDoors = this.updateDoors();
    cx.notify();
    if (this.ground && !dx && !this.dashTicks && !this.trail.length && this.pose === "idle" && !movingCamera && !movingDoors) this.running = false;
    else cx.timer.after(30, cx => this.tick(cx));
  }
};
