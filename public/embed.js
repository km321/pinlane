(function(){(function(){let e=document.currentScript||document.querySelector(`script[data-project]`);if(!e)return;let t=e.getAttribute(`data-project`);if(!t)return;let n=e.getAttribute(`src`)||``,r=``;try{r=new URL(n,window.location.href).origin}catch{r=window.location.origin}let i=`pinlane_session`;function a(){let e=new URLSearchParams(window.location.search),t=e.get(`pinlane`);if(t){localStorage.setItem(i,t),e.delete(`pinlane`);let n=`${window.location.pathname}${e.toString()?`?${e}`:``}${window.location.hash}`;return window.history.replaceState({},``,n),t}return localStorage.getItem(i)}function o(e){if(!e||e===document.body||e===document.documentElement)return;let t=[],n=e;for(;n&&n!==document.body&&t.length<5;){let e=n.tagName.toLowerCase();if(n.id){e+=`#${CSS.escape(n.id)}`,t.unshift(e);break}let r=n.parentElement;if(r){let t=Array.from(r.children).filter(e=>e.tagName===n.tagName);t.length>1&&(e+=`:nth-of-type(${t.indexOf(n)+1})`)}t.unshift(e),n=r}return t.join(` > `)}async function s(e){let n=new URL(`${r}/api/embed/session`);n.searchParams.set(`publicKey`,t),n.searchParams.set(`token`,e);let i=await fetch(n.toString());return i.ok?i.json():null}function c(e,n){let a=n.branding?.primaryColor||`#E85D4C`,s=document.createElement(`div`);s.id=`pinlane-root`,document.documentElement.appendChild(s);let c=s.attachShadow({mode:`open`}),l=document.createElement(`style`);l.textContent=`
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
      .btn.active, .btn.primary { background: ${a}; color: #fff; }
      .overlay {
        position: fixed; inset: 0; z-index: 2147483645; cursor: crosshair;
      }
      .pin {
        position: absolute; width: 18px; height: 18px; border-radius: 50%;
        background: ${a}; border: 2px solid #fff; transform: translate(-50%, -50%);
        box-shadow: 0 4px 12px rgba(0,0,0,.25); pointer-events: none;
      }
      .rect {
        position: absolute; border: 2px solid ${a}; background: ${a}33;
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
      .composer .send { background: ${a}; color: #fff; }
      .toast {
        position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
        background: #0b1f2a; color: #fff; padding: 10px 16px; border-radius: 999px;
        z-index: 2147483647; font-size: 13px;
      }
    `,c.appendChild(l);let u=document.createElement(`div`);u.className=`toolbar`,u.innerHTML=`
      <span class="brand">${n.branding?.name||`Pinlane`}</span>
      <button class="btn" data-mode="pin" type="button">Comment</button>
      <button class="btn" data-mode="rect" type="button">Highlight</button>
      <button class="btn" data-action="exit" type="button">Exit</button>
    `,c.appendChild(u);let d=null,f=null,p=null;function m(e){let t=document.createElement(`div`);t.className=`toast`,t.textContent=e,c.appendChild(t),setTimeout(()=>t.remove(),2200)}function h(){d?.remove(),d=null,f=null,p=null,u.querySelectorAll(`.btn[data-mode]`).forEach(e=>e.classList.remove(`active`))}function g(n,i,a){let o=document.createElement(`div`);o.className=`composer`;let s=Math.min(Math.max(12,i),window.innerWidth-360),l=Math.min(Math.max(12,a+16),window.innerHeight-220);o.style.left=`${s}px`,o.style.top=`${l}px`,o.innerHTML=`
        <h3>Leave feedback</h3>
        <textarea placeholder="What should change?"></textarea>
        <div class="row">
          <button class="cancel" type="button">Cancel</button>
          <button class="send" type="button">Send</button>
        </div>
      `,c.appendChild(o);let u=o.querySelector(`textarea`);u.focus(),o.querySelector(`.cancel`).addEventListener(`click`,()=>{o.remove(),h()}),o.querySelector(`.send`).addEventListener(`click`,async()=>{let i=u.value.trim();if(!i)return;let a=o.querySelector(`.send`);a.disabled=!0,a.textContent=`Sending…`;try{if(!(await fetch(`${r}/api/embed/feedback`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({publicKey:t,token:e,pageUrl:window.location.href.split(`#`)[0],pageTitle:document.title,comment:i,highlight:n})})).ok)throw Error(`Failed`);o.remove(),h(),m(`Feedback sent`)}catch{a.disabled=!1,a.textContent=`Send`,m(`Could not send — try again`)}})}function _(e){h(),u.querySelector(`[data-mode="${e}"]`)?.classList.add(`active`),d=document.createElement(`div`),d.className=`overlay`,c.appendChild(d),e===`pin`?d.addEventListener(`click`,e=>{let t=document.elementFromPoint(e.clientX,e.clientY),n=document.createElement(`div`);n.className=`pin`,n.style.left=`${e.clientX}px`,n.style.top=`${e.clientY}px`,d.appendChild(n),g({type:`pin`,x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight,selector:o(t)},e.clientX,e.clientY)}):(d.addEventListener(`mousedown`,e=>{f={x:e.clientX,y:e.clientY},p=document.createElement(`div`),p.className=`rect`,d.appendChild(p)}),d.addEventListener(`mousemove`,e=>{if(!f||!p)return;let t=Math.min(f.x,e.clientX),n=Math.min(f.y,e.clientY),r=Math.abs(e.clientX-f.x),i=Math.abs(e.clientY-f.y);p.style.left=`${t}px`,p.style.top=`${n}px`,p.style.width=`${r}px`,p.style.height=`${i}px`}),d.addEventListener(`mouseup`,e=>{if(!f)return;let t=Math.min(f.x,e.clientX),n=Math.min(f.y,e.clientY),r=Math.abs(e.clientX-f.x),i=Math.abs(e.clientY-f.y);if(r<8||i<8){h();return}let a=t+r/2,s=n+i/2,c=document.elementFromPoint(a,s);g({type:`rect`,x:t/window.innerWidth,y:n/window.innerHeight,w:r/window.innerWidth,h:i/window.innerHeight,selector:o(c)},e.clientX,e.clientY),f=null}))}u.addEventListener(`click`,e=>{let t=e.target.closest(`button`);if(!t)return;let n=t.getAttribute(`data-mode`);n&&_(n),t.getAttribute(`data-action`)===`exit`&&(localStorage.removeItem(i),s.remove())})}let l=a();l&&s(l).then(e=>{e?.active&&c(l,e)})})()})();