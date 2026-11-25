import html2canvas from "html2canvas";

type PinHighlight = {
  type: "pin" | "rect";
  /** Document-normalized (scrollWidth / scrollHeight). */
  x: number;
  y: number;
  w?: number;
  h?: number;
  selector?: string;
  /** Offset inside the target element (0–1) for sticky placement. */
  ox?: number;
  oy?: number;
};

type Branding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  sidebarColor?: string;
  surfaceColor?: string;
  radius?: number;
  showPoweredBy?: boolean;
};

type PinRecord = {
  id: string;
  authorName: string;
  comment: string;
  pageUrl: string;
  pageTitle?: string | null;
  highlight: PinHighlight;
  screenshotUrl?: string | null;
  createdAt?: string;
  mine?: boolean;
  onThisPage?: boolean;
};

type SessionInfo = {
  active: boolean;
  guestName?: string;
  branding?: Branding;
  pins?: PinRecord[];
};

(function pinlaneEmbed() {
  const script =
    document.currentScript ||
    document.querySelector<HTMLScriptElement>("script[data-project]");
  if (!script) return;

  const publicKey = script.getAttribute("data-project");
  if (!publicKey) return;

  const src = script.getAttribute("src") || "";
  let appOrigin = "";
  try {
    appOrigin = new URL(src, window.location.href).origin;
  } catch {
    appOrigin = window.location.origin;
  }

  const STORAGE_KEY = "pinlane_session";
  const TOUR_KEY = "pinlane_tour_v1";

  function readToken(): string | null {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("pinlane");
    if (fromQuery) {
      localStorage.setItem(STORAGE_KEY, fromQuery);
      params.delete("pinlane");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
      return fromQuery;
    }
    return localStorage.getItem(STORAGE_KEY);
  }

  function focusPinIdFromHash(): string | null {
    const match = /(?:^|#|&)pinlane-pin=([^&]+)/.exec(window.location.hash);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }

  function cssPath(el: Element | null): string | undefined {
    if (!el || el === document.body || el === document.documentElement) {
      return undefined;
    }
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += `#${CSS.escape(node.id)}`;
        parts.unshift(part);
        break;
      }
      const parentEl: Element | null = node.parentElement;
      if (parentEl) {
        const siblings = Array.from(parentEl.children).filter(
          (child) => (child as Element).tagName === node!.tagName,
        );
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = parentEl;
    }
    return parts.join(" > ");
  }

  function docSize() {
    const docW = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
      1,
    );
    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0,
      1,
    );
    return { docW, docH };
  }

  function isPinlaneNode(el: Element | null): boolean {
    if (!el) return false;
    if (el.id === "pinlane-root") return true;
    try {
      return Boolean(el.closest?.("#pinlane-root"));
    } catch {
      return false;
    }
  }

  /** Page element under a point, ignoring the Pinlane overlay/widget. */
  function pageTargetFromPoint(clientX: number, clientY: number): Element | null {
    const host = document.getElementById("pinlane-root");
    const prev = host?.style.pointerEvents;
    if (host) host.style.pointerEvents = "none";
    const target = document.elementFromPoint(clientX, clientY);
    if (host) host.style.pointerEvents = prev || "";
    if (!target || isPinlaneNode(target)) return null;
    if (target === document.body || target === document.documentElement) {
      return null;
    }
    return target;
  }

  /**
   * Map stored highlight → current viewport pixels (scroll-aware).
   * Always use document-normalized coords for placement so markers stay
   * visible even when the captured selector was the widget/overlay.
   */
  function resolveViewportBox(h: PinHighlight): {
    left: number;
    top: number;
    width: number;
    height: number;
  } {
    const { docW, docH } = docSize();
    return {
      left: h.x * docW - window.scrollX,
      top: h.y * docH - window.scrollY,
      width: (h.w || 0) * docW,
      height: (h.h || 0) * docH,
    };
  }

  function capturePinHighlight(
    clientX: number,
    clientY: number,
    target: Element | null,
  ): PinHighlight {
    const { docW, docH } = docSize();
    const pageX = clientX + window.scrollX;
    const pageY = clientY + window.scrollY;
    const safeTarget = target && !isPinlaneNode(target) ? target : null;
    let ox: number | undefined;
    let oy: number | undefined;
    if (
      safeTarget &&
      safeTarget !== document.body &&
      safeTarget !== document.documentElement
    ) {
      const r = safeTarget.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        ox = (clientX - r.left) / r.width;
        oy = (clientY - r.top) / r.height;
      }
    }
    return {
      type: "pin",
      x: pageX / docW,
      y: pageY / docH,
      selector: cssPath(safeTarget),
      ox,
      oy,
    };
  }

  function captureRectHighlight(
    clientX: number,
    clientY: number,
    clientW: number,
    clientH: number,
    target: Element | null,
  ): PinHighlight {
    const { docW, docH } = docSize();
    const pageX = clientX + window.scrollX;
    const pageY = clientY + window.scrollY;
    const safeTarget = target && !isPinlaneNode(target) ? target : null;
    return {
      type: "rect",
      x: pageX / docW,
      y: pageY / docH,
      w: clientW / docW,
      h: clientH / docH,
      selector: cssPath(safeTarget),
    };
  }

  async function validate(token: string): Promise<SessionInfo | null> {
    const url = new URL(`${appOrigin}/api/embed/session`);
    url.searchParams.set("publicKey", publicKey!);
    url.searchParams.set("token", token);
    url.searchParams.set("pageUrl", window.location.href.split("#")[0]);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return res.json();
  }

  async function captureScreenshot(
    highlight: PinHighlight,
    accent = "#E85D4C",
  ): Promise<string | undefined> {
    try {
      const host = document.getElementById("pinlane-root");
      // Hide widget chrome so the shot is the real page, then stamp the pin on.
      if (host) host.style.visibility = "hidden";
      const scale = Math.min(1, 1200 / Math.max(window.innerWidth, 1));
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale,
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (el) =>
          el.id === "pinlane-root" ||
          (el as HTMLElement).dataset?.pinlane === "ui",
      });
      if (host) host.style.visibility = "";

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // highlight x/y are document-normalized; convert to viewport CSS px, then canvas px
        const { docW, docH } = docSize();
        const viewLeft = highlight.x * docW - window.scrollX;
        const viewTop = highlight.y * docH - window.scrollY;
        const viewW = (highlight.w || 0) * docW;
        const viewH = (highlight.h || 0) * docH;
        const sx = canvas.width / Math.max(window.innerWidth, 1);
        const sy = canvas.height / Math.max(window.innerHeight, 1);
        const x = viewLeft * sx;
        const y = viewTop * sy;
        const w = viewW * sx;
        const h = viewH * sy;

        ctx.save();
        if (highlight.type === "pin") {
          const r = 16 * Math.max(sx, sy);
          // Drop shadow
          ctx.beginPath();
          ctx.arc(x, y + 2 * sy, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fill();
          // Filled pin badge
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.lineWidth = 3 * Math.max(sx, sy);
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
          // Crosshair to mark exact point
          ctx.beginPath();
          ctx.arc(x, y, 3 * Math.max(sx, sy), 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        } else {
          ctx.fillStyle = accent + "44";
          ctx.strokeStyle = accent;
          ctx.lineWidth = 3 * Math.max(sx, sy);
          ctx.fillRect(x, y, Math.max(w, 4), Math.max(h, 4));
          ctx.strokeRect(x, y, Math.max(w, 4), Math.max(h, 4));
          // Corner badge
          const br = 12 * Math.max(sx, sy);
          ctx.beginPath();
          ctx.arc(x, y, br, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.lineWidth = 2 * Math.max(sx, sy);
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.62);
      if (dataUrl.length > 1_400_000) {
        // Retry more compressed if oversized for Postgres text
        const smaller = canvas.toDataURL("image/jpeg", 0.4);
        if (smaller.length > 1_400_000) return undefined;
        return smaller;
      }
      return dataUrl;
    } catch {
      const host = document.getElementById("pinlane-root");
      if (host) host.style.visibility = "";
      return undefined;
    }
  }

  function mount(token: string, info: SessionInfo) {
    const color = info.branding?.primaryColor || "#E85D4C";
    const sidebar = info.branding?.sidebarColor || "#0b1f2a";
    const surface = info.branding?.surfaceColor || "#ffffff";
    const radius = `${info.branding?.radius ?? 0.75}rem`;
    const brandName = info.branding?.name || "Pinlane";
    const showPoweredBy = info.branding?.showPoweredBy !== false;

    const host = document.createElement("div");
    host.id = "pinlane-root";
    host.style.pointerEvents = "none";
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        pointer-events: none !important;
      }
      * { box-sizing: border-box; font-family: "DM Sans", system-ui, sans-serif; }
      .toolbar, .panel, .overlay, .composer, .toast, .tour-backdrop, .tour-card,
      .pin-marker, .rect-marker, .powered, .panel * {
        pointer-events: auto;
      }
      .toolbar {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
        display: flex; gap: 8px; align-items: center;
        background: ${sidebar}; color: #fff; padding: 10px 12px;
        border-radius: calc(${radius} * 2); box-shadow: 0 12px 40px rgba(11,31,42,.35);
      }
      .brand-wrap { display: flex; align-items: center; gap: 8px; margin-right: 4px; }
      .brand-logo { height: 18px; width: auto; max-width: 72px; object-fit: contain; }
      .brand { font-weight: 700; font-size: 13px; letter-spacing: .02em; }
      .guest { font-size: 11px; opacity: .7; margin-right: 4px; }
      .btn {
        border: 0; border-radius: calc(${radius} * 2); padding: 8px 12px; cursor: pointer;
        background: rgba(255,255,255,.12); color: #fff; font-size: 13px; font-weight: 600;
      }
      .btn.active, .btn.primary { background: ${color}; color: #fff; }
      .overlay {
        position: fixed; inset: 0; z-index: 2147483645; cursor: crosshair;
      }
      .pins-layer {
        position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      }
      .pin-marker {
        position: absolute; min-width: 24px; height: 24px; padding: 0 6px;
        border-radius: 999px; display: flex; align-items: center; justify-content: center;
        background: ${color}; border: 2px solid #fff; transform: translate(-50%, -50%);
        box-shadow: 0 4px 12px rgba(0,0,0,.25); pointer-events: auto; cursor: pointer;
        color: #fff; font-size: 11px; font-weight: 700; line-height: 1;
      }
      .pin-marker.mine { outline: 2px solid #fff; outline-offset: 2px; }
      .pin-marker.focused { transform: translate(-50%, -50%) scale(1.2); z-index: 2; }
      .rect-marker {
        position: absolute; border: 2px solid ${color}; background: ${color}33;
        pointer-events: auto; cursor: pointer;
      }
      .rect-badge {
        position: absolute; left: 0; top: 0; transform: translate(-30%, -50%);
        min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
        background: ${color}; color: #fff; border: 2px solid #fff;
        font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      }
      .panel {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483646;
        width: min(360px, 100vw); background: ${surface}; color: #0b1f2a;
        box-shadow: -12px 0 40px rgba(11,31,42,.2);
        transform: translateX(105%); transition: transform .22s ease;
        display: flex; flex-direction: column; pointer-events: auto;
      }
      .panel.open { transform: translateX(0); }
      .panel-header {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 14px 16px; background: ${sidebar}; color: #fff;
      }
      .panel-header h2 { margin: 0; font-size: 15px; font-weight: 700; }
      .panel-header button {
        border: 0; background: rgba(255,255,255,.12); color: #fff;
        border-radius: calc(${radius} * 2); padding: 6px 10px; cursor: pointer; font-weight: 600;
      }
      .panel-filters {
        display: flex; gap: 6px; padding: 10px 12px; border-bottom: 1px solid #e4ebf0;
      }
      .panel-filters button {
        border: 0; border-radius: calc(${radius} * 2); padding: 6px 10px; cursor: pointer;
        background: #eef2f5; color: #0b1f2a; font-size: 12px; font-weight: 600;
      }
      .panel-filters button.active { background: ${color}; color: #fff; }
      .panel-list { flex: 1; overflow: auto; padding: 8px; }
      .note {
        border: 1px solid #e4ebf0; border-radius: ${radius}; padding: 10px;
        margin-bottom: 8px; background: #fff; text-align: left; width: 100%;
        cursor: pointer; font: inherit; color: inherit;
      }
      .note.active { border-color: ${color}; box-shadow: 0 0 0 1px ${color}; }
      .note .meta {
        display: flex; justify-content: space-between; gap: 8px;
        font-size: 11px; color: #5a6e7a; margin-bottom: 4px;
      }
      .note .num {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; border-radius: 999px; background: ${color};
        color: #fff; font-size: 10px; font-weight: 700; margin-right: 6px;
      }
      .note .body { font-size: 13px; line-height: 1.4; white-space: pre-wrap; }
      .note .page { margin-top: 6px; font-size: 11px; color: #8a9aa5; }
      .note-actions { display: flex; gap: 6px; margin-top: 8px; }
      .note-actions button {
        border: 0; border-radius: calc(${radius} * 1.5); padding: 6px 10px;
        font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .note-actions .edit { background: #eef2f5; }
      .note-actions .del { background: #fdeceb; color: #c23b2e; }
      .note-actions .save { background: ${color}; color: #fff; }
      .note textarea {
        width: 100%; min-height: 72px; margin-top: 6px; resize: vertical;
        border: 1px solid #d7dee5; border-radius: calc(${radius} * 0.8);
        padding: 8px; font: inherit;
      }
      .panel-empty {
        padding: 24px 12px; text-align: center; color: #5a6e7a; font-size: 13px;
      }
      .pin-tip {
        position: absolute; transform: translate(-50%, calc(-100% - 10px));
        background: ${surface}; color: #0b1f2a; border-radius: ${radius};
        padding: 8px 10px; min-width: 140px; max-width: 240px;
        box-shadow: 0 10px 30px rgba(11,31,42,.25); font-size: 12px; pointer-events: none;
      }
      .pin-tip strong { display: block; margin-bottom: 2px; }
      .rect {
        position: absolute; border: 2px solid ${color}; background: ${color}33;
        pointer-events: none;
      }
      .composer {
        position: fixed; z-index: 2147483647; width: min(340px, calc(100vw - 24px));
        background: ${surface}; color: #0b1f2a; border-radius: ${radius}; padding: 14px;
        box-shadow: 0 18px 50px rgba(11,31,42,.28);
      }
      .composer h3 { margin: 0 0 8px; font-size: 15px; }
      .composer textarea {
        width: 100%; min-height: 90px; resize: vertical; border: 1px solid #d7dee5;
        border-radius: calc(${radius} * 0.8); padding: 10px; font: inherit;
      }
      .composer .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
      .composer button {
        border: 0; border-radius: calc(${radius} * 2); padding: 8px 14px; font-weight: 600; cursor: pointer;
      }
      .composer .cancel { background: #eef2f5; }
      .composer .send { background: ${color}; color: #fff; }
      .toast {
        position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
        background: ${sidebar}; color: #fff; padding: 10px 16px; border-radius: calc(${radius} * 2);
        z-index: 2147483647; font-size: 13px;
      }
      .powered {
        position: fixed; left: 16px; bottom: 16px; z-index: 2147483646;
        font-size: 10px; letter-spacing: .04em; text-transform: uppercase;
        color: rgba(11,31,42,.45); background: rgba(255,255,255,.7);
        padding: 4px 8px; border-radius: calc(${radius} * 0.8);
      }
      .tour-backdrop {
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(11,31,42,.45);
      }
      .tour-card {
        position: fixed; z-index: 2147483647; width: min(320px, calc(100vw - 32px));
        background: ${surface}; color: #0b1f2a; border-radius: ${radius};
        padding: 16px; box-shadow: 0 20px 50px rgba(11,31,42,.35);
      }
      .tour-card h3 { margin: 0 0 6px; font-size: 15px; }
      .tour-card p { margin: 0; font-size: 13px; line-height: 1.45; color: #5a6e7a; }
      .tour-card .steps { margin-top: 10px; font-size: 11px; color: #8a9aa5; }
      .tour-card .actions {
        display: flex; justify-content: space-between; gap: 8px; margin-top: 14px;
      }
      .tour-card button {
        border: 0; border-radius: calc(${radius} * 2); padding: 8px 12px;
        font-weight: 600; cursor: pointer; font-size: 13px;
      }
      .tour-card .skip { background: transparent; color: #5a6e7a; }
      .tour-card .next { background: ${color}; color: #fff; margin-left: auto; }
      .tour-pulse {
        box-shadow: 0 0 0 0 ${color}88 !important;
        animation: pinlane-pulse 1.4s ease-out infinite;
      }
      @keyframes pinlane-pulse {
        0% { box-shadow: 0 0 0 0 ${color}88; }
        70% { box-shadow: 0 0 0 12px ${color}00; }
        100% { box-shadow: 0 0 0 0 ${color}00; }
      }
    `;
    shadow.appendChild(style);

    const pinsLayer = document.createElement("div");
    pinsLayer.className = "pins-layer";
    shadow.appendChild(pinsLayer);

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const logoHtml = info.branding?.logoUrl
      ? `<img class="brand-logo" src="${info.branding.logoUrl}" alt="" />`
      : "";
    toolbar.innerHTML = `
      <div class="brand-wrap">${logoHtml}<span class="brand">${brandName}</span></div>
      <span class="guest">${info.guestName || "Reviewer"}</span>
      <button class="btn" data-mode="pin" type="button">Comment</button>
      <button class="btn" data-mode="rect" type="button">Highlight</button>
      <button class="btn" data-action="notes" type="button">Notes</button>
      <button class="btn" data-action="tour" type="button" title="Quick tour">?</button>
      <button class="btn" data-action="exit" type="button">Exit</button>
    `;
    shadow.appendChild(toolbar);

    const panel = document.createElement("aside");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="panel-header">
        <h2>Notes</h2>
        <button type="button" data-close-panel>Close</button>
      </div>
      <div class="panel-filters">
        <button type="button" data-filter="page" class="active">This page</button>
        <button type="button" data-filter="all">All pages</button>
        <button type="button" data-filter="mine">Mine</button>
      </div>
      <div class="panel-list"></div>
    `;
    shadow.appendChild(panel);
    const panelList = panel.querySelector(".panel-list") as HTMLDivElement;

    if (showPoweredBy) {
      const powered = document.createElement("div");
      powered.className = "powered";
      powered.textContent = "Powered by Pinlane";
      shadow.appendChild(powered);
    }

    let mode: "pin" | "rect" | null = null;
    let overlay: HTMLDivElement | null = null;
    let dragStart: { x: number; y: number } | null = null;
    let draftRect: HTMLDivElement | null = null;
    let pins: PinRecord[] = [...(info.pins || [])].map((p) => ({
      ...p,
      onThisPage:
        p.onThisPage ??
        samePageClient(p.pageUrl, window.location.href.split("#")[0]),
    }));
    let tipEl: HTMLDivElement | null = null;
    let notesFilter: "page" | "all" | "mine" = "page";
    let panelOpen = false;
    let editingId: string | null = null;
    let selectedId: string | null = null;

    function samePageClient(a: string, b: string) {
      try {
        const ua = new URL(a);
        const ub = new URL(b);
        return (
          ua.origin === ub.origin &&
          ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "")
        );
      } catch {
        return a.split("#")[0].split("?")[0] === b.split("#")[0].split("?")[0];
      }
    }

    function pagePins() {
      const current = window.location.href.split("#")[0];
      return pins.filter(
        (p) => p.onThisPage === true || samePageClient(p.pageUrl, current),
      );
    }

    function pinNumber(id: string) {
      const ordered = [...pagePins()].sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
      );
      const idx = ordered.findIndex((p) => p.id === id);
      return idx >= 0 ? idx + 1 : null;
    }

    function toast(msg: string) {
      const el = document.createElement("div");
      el.className = "toast";
      el.textContent = msg;
      shadow.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }

    function clearOverlay() {
      overlay?.remove();
      overlay = null;
      dragStart = null;
      draftRect = null;
      mode = null;
      toolbar
        .querySelectorAll(".btn[data-mode]")
        .forEach((b) => b.classList.remove("active"));
    }

    function setPanelOpen(open: boolean) {
      panelOpen = open;
      panel.classList.toggle("open", open);
      toolbar
        .querySelector('[data-action="notes"]')
        ?.classList.toggle("active", open);
      if (open) renderNotesPanel();
    }

    let focusedPinId: string | null = focusPinIdFromHash();
    let tipPinId: string | null = null;

    function focusPin(pin: PinRecord, openPanel = false) {
      selectedId = pin.id;
      tipPinId = pin.id;
      const box = resolveViewportBox(pin.highlight);
      const offscreen =
        box.top < 40 ||
        box.top > window.innerHeight - 40 ||
        box.left < 0 ||
        box.left > window.innerWidth;
      if (offscreen) {
        const { docH } = docSize();
        window.scrollTo({
          top: Math.max(0, pin.highlight.y * docH - window.innerHeight / 2),
          behavior: "smooth",
        });
      }
      renderPins();
      renderNotesPanel();
      if (openPanel) setPanelOpen(true);
      const boxAfter = resolveViewportBox(pin.highlight);
      showTip(
        pin,
        pin.highlight.type === "pin"
          ? boxAfter.left
          : boxAfter.left + boxAfter.width / 2,
        boxAfter.top,
      );
    }

    function renderPins(focusId?: string | null) {
      if (focusId !== undefined) focusedPinId = focusId;
      pinsLayer.innerHTML = "";
      tipEl = null;

      // Markers stay on the live page at all times for notes on this page.
      for (const pin of pagePins()) {
        const box = resolveViewportBox(pin.highlight);
        const num = pinNumber(pin.id);
        const isFocused =
          selectedId === pin.id ||
          tipPinId === pin.id ||
          focusedPinId === pin.id;

        if (pin.highlight.type === "pin") {
          const marker = document.createElement("div");
          marker.className = `pin-marker${pin.mine ? " mine" : ""}${isFocused ? " focused" : ""}`;
          marker.style.left = `${box.left}px`;
          marker.style.top = `${box.top}px`;
          marker.textContent = num != null ? String(num) : "•";
          marker.title = `${pin.authorName}: ${pin.comment}`;
          marker.addEventListener("click", (e) => {
            e.stopPropagation();
            focusPin(pin, true);
          });
          pinsLayer.appendChild(marker);
        } else {
          const marker = document.createElement("div");
          marker.className = `rect-marker${isFocused ? " focused" : ""}`;
          marker.style.left = `${box.left}px`;
          marker.style.top = `${box.top}px`;
          marker.style.width = `${Math.max(box.width, 4)}px`;
          marker.style.height = `${Math.max(box.height, 4)}px`;
          marker.title = `${pin.authorName}: ${pin.comment}`;
          const badge = document.createElement("span");
          badge.className = "rect-badge";
          badge.textContent = num != null ? String(num) : "•";
          marker.appendChild(badge);
          marker.addEventListener("click", (e) => {
            e.stopPropagation();
            focusPin(pin, true);
          });
          pinsLayer.appendChild(marker);
        }
      }

      if (tipPinId) {
        const tipPin = pins.find((p) => p.id === tipPinId);
        if (tipPin && samePageClient(tipPin.pageUrl, window.location.href)) {
          const box = resolveViewportBox(tipPin.highlight);
          showTip(
            tipPin,
            tipPin.highlight.type === "pin"
              ? box.left
              : box.left + box.width / 2,
            box.top,
          );
        }
      } else if (focusedPinId) {
        const focusTarget = pins.find((p) => p.id === focusedPinId);
        if (focusTarget) {
          focusPin(focusTarget, true);
          focusedPinId = null;
        }
      }
    }

    function filteredNotes() {
      const current = window.location.href.split("#")[0];
      if (notesFilter === "mine") return pins.filter((p) => p.mine);
      if (notesFilter === "all") return pins;
      return pins.filter((p) => samePageClient(p.pageUrl, current));
    }

    function renderNotesPanel() {
      const list = filteredNotes().sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
      if (list.length === 0) {
        panelList.innerHTML =
          '<div class="panel-empty">No notes here yet. Drop a comment pin or highlight to start.</div>';
        return;
      }

      panelList.innerHTML = "";
      for (const pin of list) {
        const num = pinNumber(pin.id);
        const card = document.createElement("div");
        card.className = `note${selectedId === pin.id ? " active" : ""}`;
        const onPage = samePageClient(
          pin.pageUrl,
          window.location.href.split("#")[0],
        );
        if (editingId === pin.id && pin.mine) {
          card.innerHTML = `
            <div class="meta">
              <span>${num != null ? `<span class="num">${num}</span>` : ""}${escapeHtml(pin.authorName)}</span>
              <span>${pin.highlight.type}</span>
            </div>
            <textarea data-edit-area>${escapeHtml(pin.comment)}</textarea>
            <div class="note-actions">
              <button type="button" class="save" data-save>Save</button>
              <button type="button" class="edit" data-cancel-edit>Cancel</button>
            </div>
          `;
          card.querySelector("[data-save]")!.addEventListener("click", async (e) => {
            e.stopPropagation();
            const next = (
              card.querySelector("[data-edit-area]") as HTMLTextAreaElement
            ).value.trim();
            if (!next) return;
            await saveNote(pin.id, next);
          });
          card
            .querySelector("[data-cancel-edit]")!
            .addEventListener("click", (e) => {
              e.stopPropagation();
              editingId = null;
              renderNotesPanel();
            });
        } else {
          card.innerHTML = `
            <div class="meta">
              <span>${num != null ? `<span class="num">${num}</span>` : ""}${escapeHtml(pin.authorName)}${pin.mine ? " · you" : ""}</span>
              <span>${pin.highlight.type}</span>
            </div>
            <div class="body">${escapeHtml(pin.comment)}</div>
            ${
              onPage
                ? ""
                : `<div class="page">${escapeHtml(pin.pageTitle || pin.pageUrl)}</div>`
            }
            ${
              pin.mine
                ? `<div class="note-actions">
                    <button type="button" class="edit" data-edit>Edit</button>
                    <button type="button" class="del" data-del>Delete</button>
                  </div>`
                : ""
            }
          `;
          card.addEventListener("click", () => {
            if (onPage) focusPin(pin, true);
            else window.open(pin.pageUrl, "_blank", "noopener,noreferrer");
          });
          card.querySelector("[data-edit]")?.addEventListener("click", (e) => {
            e.stopPropagation();
            editingId = pin.id;
            renderNotesPanel();
          });
          card.querySelector("[data-del]")?.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!window.confirm("Delete this note?")) return;
            await removeNote(pin.id);
          });
        }
        panelList.appendChild(card);
      }
    }

    async function saveNote(id: string, comment: string) {
      try {
        const res = await fetch(`${appOrigin}/api/embed/feedback/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, token, comment }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        pins = pins.map((p) =>
          p.id === id
            ? {
                ...p,
                comment: data.pin.comment,
                mine: true,
              }
            : p,
        );
        editingId = null;
        renderPins();
        renderNotesPanel();
        toast("Note updated");
      } catch {
        toast("Could not save note");
      }
    }

    async function removeNote(id: string) {
      try {
        const res = await fetch(`${appOrigin}/api/embed/feedback/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, token }),
        });
        if (!res.ok) throw new Error("Failed");
        pins = pins.filter((p) => p.id !== id);
        if (selectedId === id) selectedId = null;
        if (tipPinId === id) tipPinId = null;
        renderPins();
        renderNotesPanel();
        toast("Note deleted");
      } catch {
        toast("Could not delete note");
      }
    }

    function showTip(pin: PinRecord, x: number, y: number) {
      tipEl?.remove();
      tipEl = document.createElement("div");
      tipEl.className = "pin-tip";
      tipEl.style.left = `${Math.min(Math.max(80, x), window.innerWidth - 80)}px`;
      tipEl.style.top = `${Math.max(40, y)}px`;
      const num = pinNumber(pin.id);
      tipEl.innerHTML = `<strong>${num != null ? `#${num} · ` : ""}${escapeHtml(pin.authorName)}</strong>${escapeHtml(pin.comment)}`;
      pinsLayer.appendChild(tipEl);
      window.setTimeout(() => {
        if (tipPinId === pin.id) {
          tipPinId = null;
          tipEl?.remove();
          tipEl = null;
        }
      }, 5000);
    }

    panel.querySelector("[data-close-panel]")!.addEventListener("click", () => {
      setPanelOpen(false);
    });
    panel.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        notesFilter = btn.getAttribute("data-filter") as
          | "page"
          | "all"
          | "mine";
        panel
          .querySelectorAll("[data-filter]")
          .forEach((el) => el.classList.remove("active"));
        btn.classList.add("active");
        renderNotesPanel();
      });
    });

    function escapeHtml(value: string) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function openComposer(
      highlight: PinHighlight,
      clientX: number,
      clientY: number,
    ) {
      const composer = document.createElement("div");
      composer.className = "composer";
      const left = Math.min(Math.max(12, clientX), window.innerWidth - 360);
      const top = Math.min(Math.max(12, clientY + 16), window.innerHeight - 220);
      composer.style.left = `${left}px`;
      composer.style.top = `${top}px`;
      composer.innerHTML = `
        <h3>Leave feedback</h3>
        <textarea placeholder="What should change?"></textarea>
        <div class="row">
          <button class="cancel" type="button">Cancel</button>
          <button class="send" type="button">Send</button>
        </div>
      `;
      shadow.appendChild(composer);
      const textarea = composer.querySelector("textarea")!;
      textarea.focus();

      composer.querySelector(".cancel")!.addEventListener("click", () => {
        composer.remove();
        clearOverlay();
      });

      composer.querySelector(".send")!.addEventListener("click", async () => {
        const comment = textarea.value.trim();
        if (!comment) return;
        const sendBtn = composer.querySelector(".send") as HTMLButtonElement;
        sendBtn.disabled = true;
        sendBtn.textContent = "Sending…";
        try {
          composer.style.opacity = "0";
          clearOverlay();
          const screenshotUrl = await captureScreenshot(highlight, color);
          composer.style.opacity = "1";
          const res = await fetch(`${appOrigin}/api/embed/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicKey,
              token,
              pageUrl: window.location.href.split("#")[0],
              pageTitle: document.title,
              comment,
              highlight,
              screenshotUrl,
            }),
          });
          if (!res.ok) throw new Error("Failed");
          const data = await res.json();
          if (data.pin) {
            const nextPin: PinRecord = {
              ...data.pin,
              pageUrl:
                data.pin.pageUrl || window.location.href.split("#")[0],
              onThisPage: true,
              mine: true,
            };
            pins = [nextPin, ...pins.filter((p) => p.id !== nextPin.id)];
            selectedId = nextPin.id;
            tipPinId = nextPin.id;
            composer.remove();
            clearOverlay();
            renderPins();
            renderNotesPanel();
            setPanelOpen(true);
            const box = resolveViewportBox(nextPin.highlight);
            showTip(
              nextPin,
              nextPin.highlight.type === "pin"
                ? box.left
                : box.left + box.width / 2,
              box.top,
            );
          } else {
            composer.remove();
            clearOverlay();
          }
          toast("Feedback sent — pin stays on the page");
        } catch {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send";
          composer.style.opacity = "1";
          toast("Could not send — try again");
        }
      });
    }

    function startMode(next: "pin" | "rect") {
      clearOverlay();
      mode = next;
      toolbar.querySelector(`[data-mode="${next}"]`)?.classList.add("active");
      overlay = document.createElement("div");
      overlay.className = "overlay";
      shadow.appendChild(overlay);

      if (next === "pin") {
        overlay.addEventListener("click", (e) => {
          const target = pageTargetFromPoint(e.clientX, e.clientY);
          const marker = document.createElement("div");
          marker.className = "pin-marker";
          marker.style.left = `${e.clientX}px`;
          marker.style.top = `${e.clientY}px`;
          marker.textContent = "+";
          overlay!.appendChild(marker);
          const highlight = capturePinHighlight(e.clientX, e.clientY, target);
          openComposer(highlight, e.clientX, e.clientY);
        });
      } else {
        overlay.addEventListener("mousedown", (e) => {
          dragStart = { x: e.clientX, y: e.clientY };
          draftRect = document.createElement("div");
          draftRect.className = "rect";
          overlay!.appendChild(draftRect);
        });
        overlay.addEventListener("mousemove", (e) => {
          if (!dragStart || !draftRect) return;
          const x = Math.min(dragStart.x, e.clientX);
          const y = Math.min(dragStart.y, e.clientY);
          const w = Math.abs(e.clientX - dragStart.x);
          const h = Math.abs(e.clientY - dragStart.y);
          draftRect.style.left = `${x}px`;
          draftRect.style.top = `${y}px`;
          draftRect.style.width = `${w}px`;
          draftRect.style.height = `${h}px`;
        });
        overlay.addEventListener("mouseup", (e) => {
          if (!dragStart) return;
          const x = Math.min(dragStart.x, e.clientX);
          const y = Math.min(dragStart.y, e.clientY);
          const w = Math.abs(e.clientX - dragStart.x);
          const h = Math.abs(e.clientY - dragStart.y);
          if (w < 8 || h < 8) {
            clearOverlay();
            return;
          }
          const cx = x + w / 2;
          const cy = y + h / 2;
          const target = pageTargetFromPoint(cx, cy);
          const highlight = captureRectHighlight(x, y, w, h, target);
          openComposer(highlight, e.clientX, e.clientY);
          dragStart = null;
        });
      }
    }

    toolbar.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      const nextMode = btn.getAttribute("data-mode") as "pin" | "rect" | null;
      if (nextMode) startMode(nextMode);
      if (btn.getAttribute("data-action") === "notes") {
        setPanelOpen(!panelOpen);
      }
      if (btn.getAttribute("data-action") === "tour") startTour(true);
      if (btn.getAttribute("data-action") === "exit") {
        localStorage.removeItem(STORAGE_KEY);
        host.remove();
      }
    });

    const tourSteps = [
      {
        title: `Welcome, ${info.guestName || "reviewer"}`,
        body: `This toolbar is your review kit for ${brandName}. Leave comments on the live page — the team sees who wrote each pin.`,
        target: null as string | null,
      },
      {
        title: "Drop a comment pin",
        body: "Click Comment, then tap anything on the page. Add a short note and send — numbered pins stay on the page.",
        target: '[data-mode="pin"]',
      },
      {
        title: "Highlight a region",
        body: "Use Highlight to drag a box around a section that needs work. Great for layout and spacing notes.",
        target: '[data-mode="rect"]',
      },
      {
        title: "Notes sidebar",
        body: "Open Notes anytime to see everyone’s feedback, jump to a pin, and edit or delete your own.",
        target: '[data-action="notes"]',
      },
    ];

    let tourEls: HTMLElement[] = [];

    function endTour(markSeen: boolean) {
      tourEls.forEach((el) => el.remove());
      tourEls = [];
      toolbar.querySelectorAll(".tour-pulse").forEach((el) => {
        el.classList.remove("tour-pulse");
      });
      if (markSeen) localStorage.setItem(TOUR_KEY, "1");
    }

    function placeTourCard(card: HTMLElement, targetSel: string | null) {
      const margin = 16;
      if (!targetSel) {
        card.style.left = `${Math.max(margin, window.innerWidth / 2 - 160)}px`;
        card.style.top = `${Math.max(margin, window.innerHeight / 2 - 90)}px`;
        return;
      }
      const target = toolbar.querySelector(targetSel) as HTMLElement | null;
      toolbar.querySelectorAll(".tour-pulse").forEach((el) => {
        el.classList.remove("tour-pulse");
      });
      target?.classList.add("tour-pulse");
      const rect = (target || toolbar).getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 32);
      let left = Math.min(
        Math.max(margin, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - margin,
      );
      let top = rect.top - 12 - 170;
      if (top < margin) top = rect.bottom + 12;
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.width = `${width}px`;
    }

    function startTour(force = false) {
      if (!force && localStorage.getItem(TOUR_KEY)) return;
      endTour(false);
      let step = 0;

      const backdrop = document.createElement("div");
      backdrop.className = "tour-backdrop";
      backdrop.addEventListener("click", () => endTour(true));
      shadow.appendChild(backdrop);

      const card = document.createElement("div");
      card.className = "tour-card";
      shadow.appendChild(card);
      tourEls = [backdrop, card];

      function renderStep() {
        const current = tourSteps[step]!;
        card.innerHTML = `
          <h3>${escapeHtml(current.title)}</h3>
          <p>${escapeHtml(current.body)}</p>
          <div class="steps">${step + 1} of ${tourSteps.length}</div>
          <div class="actions">
            <button class="skip" type="button">${step === tourSteps.length - 1 ? "Done" : "Skip"}</button>
            <button class="next" type="button">${step === tourSteps.length - 1 ? "Got it" : "Next"}</button>
          </div>
        `;
        placeTourCard(card, current.target);
        card.querySelector(".skip")!.addEventListener("click", () => endTour(true));
        card.querySelector(".next")!.addEventListener("click", () => {
          if (step >= tourSteps.length - 1) {
            endTour(true);
            return;
          }
          step += 1;
          renderStep();
        });
      }

      renderStep();
    }

    let ticking = false;
    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        renderPins();
      });
    }
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    renderPins(focusPinIdFromHash());
    renderNotesPanel();
    void mode;

    // First visit on this device/browser → gentle coachmarks.
    window.setTimeout(() => startTour(false), 450);
  }

  const token = readToken();
  if (!token) return;

  validate(token).then((info) => {
    if (info?.active) mount(token, info);
  });
})();
