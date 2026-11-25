import html2canvas from "html2canvas";

type PinHighlight =
  | { type: "pin"; x: number; y: number; selector?: string }
  | {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      selector?: string;
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
  highlight: PinHighlight;
  screenshotUrl?: string | null;
  mine?: boolean;
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

  async function validate(token: string): Promise<SessionInfo | null> {
    const url = new URL(`${appOrigin}/api/embed/session`);
    url.searchParams.set("publicKey", publicKey!);
    url.searchParams.set("token", token);
    url.searchParams.set("pageUrl", window.location.href.split("#")[0]);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return res.json();
  }

  async function captureScreenshot(highlight: PinHighlight): Promise<string | undefined> {
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(1, 1200 / Math.max(window.innerWidth, 1)),
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.strokeStyle = "#E85D4C";
        ctx.lineWidth = 3;
        if (highlight.type === "pin") {
          const x = highlight.x * canvas.width;
          const y = highlight.y * canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 14, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeRect(
            highlight.x * canvas.width,
            highlight.y * canvas.height,
            (highlight.w || 0) * canvas.width,
            (highlight.h || 0) * canvas.height,
          );
        }
        ctx.restore();
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
      if (dataUrl.length > 1_400_000) return undefined;
      return dataUrl;
    } catch {
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
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: "DM Sans", system-ui, sans-serif; }
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
        position: fixed; inset: 0; z-index: 2147483644; pointer-events: none;
      }
      .pin-marker {
        position: absolute; width: 22px; height: 22px; border-radius: 50%;
        background: ${color}; border: 2px solid #fff; transform: translate(-50%, -50%);
        box-shadow: 0 4px 12px rgba(0,0,0,.25); pointer-events: auto; cursor: pointer;
      }
      .pin-marker.mine { outline: 2px solid #fff; outline-offset: 2px; }
      .pin-marker.focused { transform: translate(-50%, -50%) scale(1.25); }
      .rect-marker {
        position: absolute; border: 2px solid ${color}; background: ${color}33;
        pointer-events: auto; cursor: pointer;
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
      <button class="btn" data-action="tour" type="button" title="Quick tour">?</button>
      <button class="btn" data-action="exit" type="button">Exit</button>
    `;
    shadow.appendChild(toolbar);

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
    let pins: PinRecord[] = [...(info.pins || [])];
    let tipEl: HTMLDivElement | null = null;

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

    function renderPins(focusId?: string | null) {
      pinsLayer.innerHTML = "";
      tipEl = null;
      for (const pin of pins) {
        const h = pin.highlight;
        if (h.type === "pin") {
          const marker = document.createElement("div");
          marker.className = `pin-marker${pin.mine ? " mine" : ""}${focusId === pin.id ? " focused" : ""}`;
          marker.style.left = `${h.x * 100}%`;
          marker.style.top = `${h.y * 100}%`;
          marker.title = `${pin.authorName}: ${pin.comment}`;
          marker.addEventListener("click", (e) => {
            e.stopPropagation();
            showTip(pin, h.x * window.innerWidth, h.y * window.innerHeight);
          });
          pinsLayer.appendChild(marker);
          if (focusId === pin.id) {
            showTip(pin, h.x * window.innerWidth, h.y * window.innerHeight);
            window.scrollTo({
              top: Math.max(0, h.y * document.documentElement.scrollHeight - window.innerHeight / 2),
              behavior: "smooth",
            });
          }
        } else {
          const marker = document.createElement("div");
          marker.className = "rect-marker";
          marker.style.left = `${h.x * 100}%`;
          marker.style.top = `${h.y * 100}%`;
          marker.style.width = `${(h.w || 0) * 100}%`;
          marker.style.height = `${(h.h || 0) * 100}%`;
          marker.title = `${pin.authorName}: ${pin.comment}`;
          marker.addEventListener("click", (e) => {
            e.stopPropagation();
            showTip(
              pin,
              (h.x + (h.w || 0) / 2) * window.innerWidth,
              h.y * window.innerHeight,
            );
          });
          pinsLayer.appendChild(marker);
          if (focusId === pin.id) {
            showTip(
              pin,
              (h.x + (h.w || 0) / 2) * window.innerWidth,
              h.y * window.innerHeight,
            );
          }
        }
      }
    }

    function showTip(pin: PinRecord, x: number, y: number) {
      tipEl?.remove();
      tipEl = document.createElement("div");
      tipEl.className = "pin-tip";
      tipEl.style.left = `${Math.min(Math.max(80, x), window.innerWidth - 80)}px`;
      tipEl.style.top = `${Math.max(40, y)}px`;
      tipEl.innerHTML = `<strong>${escapeHtml(pin.authorName)}</strong>${escapeHtml(pin.comment)}`;
      pinsLayer.appendChild(tipEl);
      setTimeout(() => tipEl?.remove(), 5000);
    }

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
          const screenshotUrl = await captureScreenshot(highlight);
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
            pins = [data.pin, ...pins.filter((p) => p.id !== data.pin.id)];
            renderPins(data.pin.id);
          }
          composer.remove();
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
          const target = document.elementFromPoint(e.clientX, e.clientY);
          const marker = document.createElement("div");
          marker.className = "pin-marker";
          marker.style.left = `${e.clientX}px`;
          marker.style.top = `${e.clientY}px`;
          overlay!.appendChild(marker);
          const highlight: PinHighlight = {
            type: "pin",
            x: e.clientX / window.innerWidth,
            y: e.clientY / window.innerHeight,
            selector: cssPath(target),
          };
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
          const target = document.elementFromPoint(cx, cy);
          const highlight: PinHighlight = {
            type: "rect",
            x: x / window.innerWidth,
            y: y / window.innerHeight,
            w: w / window.innerWidth,
            h: h / window.innerHeight,
            selector: cssPath(target),
          };
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
        body: "Click Comment, then tap anything on the page. Add a short note and send — your pin stays visible afterward.",
        target: '[data-mode="pin"]',
      },
      {
        title: "Highlight a region",
        body: "Use Highlight to drag a box around a section that needs work. Great for layout and spacing notes.",
        target: '[data-mode="rect"]',
      },
      {
        title: "Pins stick around",
        body: "Existing feedback from everyone on this page shows as markers. Click a marker to read it. Open ? anytime to replay this tour.",
        target: '[data-action="tour"]',
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

    window.addEventListener("resize", () => renderPins(focusPinIdFromHash()));
    renderPins(focusPinIdFromHash());
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
