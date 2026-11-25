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
};

type SessionInfo = {
  active: boolean;
  guestName?: string;
  branding?: Branding;
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
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return res.json();
  }

  function mount(token: string, info: SessionInfo) {
    const color = info.branding?.primaryColor || "#E85D4C";
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
        background: #0b1f2a; color: #fff; padding: 10px 12px;
        border-radius: 999px; box-shadow: 0 12px 40px rgba(11,31,42,.35);
      }
      .brand { font-weight: 700; font-size: 13px; letter-spacing: .02em; margin-right: 4px; }
      .btn {
        border: 0; border-radius: 999px; padding: 8px 12px; cursor: pointer;
        background: rgba(255,255,255,.12); color: #fff; font-size: 13px; font-weight: 600;
      }
      .btn.active, .btn.primary { background: ${color}; color: #fff; }
      .overlay {
        position: fixed; inset: 0; z-index: 2147483645; cursor: crosshair;
      }
      .pin {
        position: absolute; width: 18px; height: 18px; border-radius: 50%;
        background: ${color}; border: 2px solid #fff; transform: translate(-50%, -50%);
        box-shadow: 0 4px 12px rgba(0,0,0,.25); pointer-events: none;
      }
      .rect {
        position: absolute; border: 2px solid ${color}; background: ${color}33;
        pointer-events: none;
      }
      .composer {
        position: fixed; z-index: 2147483647; width: min(340px, calc(100vw - 24px));
        background: #fff; color: #0b1f2a; border-radius: 16px; padding: 14px;
        box-shadow: 0 18px 50px rgba(11,31,42,.28);
      }
      .composer h3 { margin: 0 0 8px; font-size: 15px; }
      .composer textarea {
        width: 100%; min-height: 90px; resize: vertical; border: 1px solid #d7dee5;
        border-radius: 10px; padding: 10px; font: inherit;
      }
      .composer .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
      .composer button {
        border: 0; border-radius: 999px; padding: 8px 14px; font-weight: 600; cursor: pointer;
      }
      .composer .cancel { background: #eef2f5; }
      .composer .send { background: ${color}; color: #fff; }
      .toast {
        position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
        background: #0b1f2a; color: #fff; padding: 10px 16px; border-radius: 999px;
        z-index: 2147483647; font-size: 13px;
      }
    `;
    shadow.appendChild(style);

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    toolbar.innerHTML = `
      <span class="brand">${info.branding?.name || "Pinlane"}</span>
      <button class="btn" data-mode="pin" type="button">Comment</button>
      <button class="btn" data-mode="rect" type="button">Highlight</button>
      <button class="btn" data-action="exit" type="button">Exit</button>
    `;
    shadow.appendChild(toolbar);

    let mode: "pin" | "rect" | null = null;
    let overlay: HTMLDivElement | null = null;
    let dragStart: { x: number; y: number } | null = null;
    let draftRect: HTMLDivElement | null = null;

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
            }),
          });
          if (!res.ok) throw new Error("Failed");
          composer.remove();
          clearOverlay();
          toast("Feedback sent");
        } catch {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send";
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
          marker.className = "pin";
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
      if (btn.getAttribute("data-action") === "exit") {
        localStorage.removeItem(STORAGE_KEY);
        host.remove();
      }
    });

    void mode;
  }

  const token = readToken();
  if (!token) return;

  validate(token).then((info) => {
    if (info?.active) mount(token, info);
  });
})();
