import { focused, panes, setShared, shared, spaces, window } from "herdr";


export const identity = {
  bindIdentity(selection, ownsInput = false) {
    const all = spaces();
    const tabs = this.worldId ? all.find(s => s.id === this.worldId)?.tabs ?? [] : null;
    const candidates = panes().filter(p => p.mod === "sekai" && (!tabs || tabs.some(t => t.id === p.tab)));
    const own = this.pane ? candidates.find(p => p.pane === this.pane) : ownsInput ? candidates.find(p => p.pane === selection?.pane) : candidates.length === 1 ? candidates[0] : null;
    if (!own) return;
    this.pane = own.pane;
    this.tabId = own.tab;
    this.worldId = all.find(s => s.tabs.some(t => t.id === own.tab))?.id ?? this.worldId;
  },

  syncFocus(cx) {
    const selection = focused();
    this.bindIdentity(selection);
    const active = Boolean(this.pane && selection?.pane === this.pane && window()?.visible !== false);
    if (active) {
      const context = shared("sekai.worldContext");
      if (context?.instanceId !== this.instanceId) setShared("sekai.worldContext", { instanceId: this.instanceId, pane: this.pane, tab: this.tabId, worldId: this.worldId });
      if (!this.wasActive) this.focusAttempts = 3;
    }
    if (active && this.pendingCommandCenter && !this.terminalDialog) {
      if (Date.now() > this.pendingCommandCenter) {
        this.pendingCommandCenter = 0;
        this.message = "";
        cx.notify();
      } else {
        const command = this.findCommandAgent();
        if (command) {
          this.pendingCommandCenter = 0;
          this.message = "";
          this.openAgent(command, cx);
          this.wasActive = false;
          return;
        }
      }
    }
    if (active && !this.terminalDialog && !this.changesDialog && this.nearCommandPreview?.()) {
      this.refreshCommandPreview(cx);
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
};
