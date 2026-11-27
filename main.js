import { View, div } from "gpui-kit";
import { checking, closeOverlay, focused, nextCommand, props } from "herdr";
import { DAY_MS, world } from "./world.js";
import { sekaiWorldDefinition } from "./world-data.js";
import { player } from "./player.js";
import { agentMethods } from "./agents.js";
import { identity } from "./identity.js";

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
    [this.x, this.y] = sekaiWorldDefinition.spawn; this.vy = 0; this.ground = true;
    this.camera = null;
    this.facing = 1; this.pose = "idle"; this.frame = 0;
    this.jumps = 2; this.dashes = 2; this.dashTicks = 0; this.trail = [];
    this.choosingAgent = false; this.agentIndex = 0;
    this.keys = new Set(); this.running = false; this.message = "Click the world to take control";
    this.instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pane = props()?.pane;
    this.worldId = props()?.worldId;
    this.wasActive = false;
    this.dayStart = Date.now() - Math.round(DAY_MS * 0.28);
    if (checking()) return;
    // Hidden tabs may not render, so check selection even while the world is hidden.
    cx.timer.every(150, cx => {
      this.syncFocus(cx);
      if (this.wasActive && !this.terminalDialog && !this.changesDialog && !this.running) cx.notify();
    });
    cx.spawn(async cx => {
      while (true) if (await nextCommand() === "focus" && !this.terminalDialog && !this.changesDialog && this.pane && focused()?.pane === this.pane) { this.handle.focus(); cx.notify(); }
    });
  }

  render() {
    if (this.picker) return this.renderPicker(div().id("sekai-agent-picker").size_full().track_focus(this.handle).on_key_down((e,cx) => this.pickerKey(e,cx)), this.localAgents());
    if (this.title) return div().size_full().flex().items_center().justify_between().px(10).bg("#252e47")
      .font_family("PxPlus IBM VGA 8x16").text_color("#e8eaff").text_size(14)
      .child(`AGENT / ${this.title.label ?? "Terminal"}`)
      .child(div().id("close-terminal").px(12).cursor_pointer().bg("#4a3557").on_mouse_down("left", (_e,cx) => cx.stop_propagation())
        .on_click((_e,cx) => { cx.stop_propagation(); closeOverlay(props().overlay); }).child("× CLOSE"));
    return this.renderWorld();
  }

  close() { agentMethods.close.call(this); }
}

const { close, ...agentInteractions } = agentMethods;
Object.assign(Sekai.prototype, world, player, identity, agentInteractions);
