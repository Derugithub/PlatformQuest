/**
 * Fixed on-screen multitouch controls drawn as DOM elements over the canvas. Each control tracks
 * its own pointer ids, so the D-pad and any number of buttons can be held at once.
 * Keyboard keys mirror the buttons for desktop testing.
 */

export type Button = 'jump' | 'spin' | 'run' | 'shoot' | 'grab';

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  held: Record<Button, boolean>;
};

export type Insets = { left: number; right: number; top: number; bottom: number };

const BUTTONS: { id: Button; label: string; size: number; right: number; bottom: number; color: string }[] = [
  { id: 'jump', label: 'JUMP', size: 96, right: 22, bottom: 26, color: '#22c55e' },
  { id: 'spin', label: 'SPIN', size: 74, right: 132, bottom: 16, color: '#a855f7' },
  { id: 'run', label: 'RUN', size: 70, right: 128, bottom: 104, color: '#f97316' },
  { id: 'shoot', label: 'TOOL', size: 66, right: 34, bottom: 136, color: '#64748b' },
  { id: 'grab', label: 'GRAB', size: 70, right: 222, bottom: 44, color: '#0ea5e9' },
];

const ICONS: Record<Button, string> = {
  jump: '<path d="M12 4l7 8h-4v7H9v-7H5z" fill="#fff"/>',
  spin: '<path d="M12 4a8 8 0 1 0 8 8h-3a5 5 0 1 1-5-5V4z" fill="#fff"/><path d="M12 1v8l4-4z" fill="#fff"/>',
  run: '<path d="M4 6l6 6-6 6M12 6l6 6-6 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  shoot: '<path d="M5 19l8-8m1-6a4 4 0 0 0 5 5l-2 2-3-1-1-3z" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  grab: '<path d="M7 12V7a1.5 1.5 0 0 1 3 0v4m0-5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v6c0 4-2 6-5 6s-4-1-6-4l-2-3a1.5 1.5 0 0 1 2.5-1.5L7 13" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
};

export class Controls {
  readonly state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    held: { jump: false, spin: false, run: false, shoot: false, grab: false },
  };
  private pressedCount: Record<Button, number> = { jump: 0, spin: 0, run: 0, shoot: 0, grab: 0 };
  private consumed: Record<Button, number> = { jump: 0, spin: 0, run: 0, shoot: 0, grab: 0 };
  private pointers: Record<Button, Set<number>> = {
    jump: new Set(), spin: new Set(), run: new Set(), shoot: new Set(), grab: new Set(),
  };
  private keys = new Set<string>();
  private padPointer: number | null = null;
  private pad: { left: boolean; right: boolean; up: boolean; down: boolean } = { left: false, right: false, up: false, down: false };
  private root: HTMLDivElement;
  private padKnob: HTMLDivElement;
  private buttons = new Map<Button, HTMLDivElement>();
  private onFirstTouch: () => void;

  constructor(onFirstTouch: () => void) {
    this.onFirstTouch = onFirstTouch;
    const style = document.createElement('style');
    style.textContent = CONTROLS_CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'controls';
    document.body.appendChild(this.root);

    const pad = document.createElement('div');
    pad.className = 'pad';
    pad.innerHTML =
      '<div class="arrow l"></div><div class="arrow r"></div><div class="arrow u"></div><div class="arrow d"></div>';
    this.padKnob = document.createElement('div');
    this.padKnob.className = 'knob';
    pad.appendChild(this.padKnob);
    this.root.appendChild(pad);
    this.bindPad(pad);

    BUTTONS.forEach((b) => {
      const el = document.createElement('div');
      el.className = `btn btn-${b.id}`;
      el.style.width = `${b.size}px`;
      el.style.height = `${b.size}px`;
      el.style.setProperty('--r', `${b.right}px`);
      el.style.setProperty('--b', `${b.bottom}px`);
      el.style.background = b.color;
      el.innerHTML = `<svg viewBox="0 0 24 24" width="${Math.round(b.size * 0.36)}" height="${Math.round(b.size * 0.36)}">${ICONS[b.id]}</svg><span>${b.label}</span>`;
      this.root.appendChild(el);
      this.buttons.set(b.id, el);
      this.bindButton(el, b.id);
    });

    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.releaseAll());
  }

  setInsets(insets: Insets): void {
    this.root.style.setProperty('--il', `${insets.left}px`);
    this.root.style.setProperty('--ir', `${insets.right}px`);
    this.root.style.setProperty('--ib', `${insets.bottom}px`);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
    if (!visible) this.releaseAll();
  }

  /** Shoot is only usable in the tool suit; Grab only shows near a stunned shell or while carrying. */
  setContext(ctx: { shootEnabled: boolean; grab: 'hidden' | 'grab' | 'kick' }): void {
    this.buttons.get('shoot')?.classList.toggle('off', !ctx.shootEnabled);
    const grab = this.buttons.get('grab');
    if (grab) {
      grab.classList.toggle('hidden', ctx.grab === 'hidden');
      const label = grab.querySelector('span');
      if (label) label.textContent = ctx.grab === 'kick' ? 'KICK' : 'GRAB';
    }
  }

  /** True once per press. */
  pressed(button: Button): boolean {
    if (this.pressedCount[button] > this.consumed[button]) {
      this.consumed[button] = this.pressedCount[button];
      return true;
    }
    return false;
  }

  /** Forget presses that happened while the game was paused. */
  flush(): void {
    (Object.keys(this.pressedCount) as Button[]).forEach((b) => {
      this.consumed[b] = this.pressedCount[b];
    });
  }

  releaseAll(): void {
    (Object.keys(this.pointers) as Button[]).forEach((b) => {
      this.pointers[b].clear();
      this.buttons.get(b)?.classList.remove('down');
    });
    this.keys.clear();
    this.padPointer = null;
    this.pad = { left: false, right: false, up: false, down: false };
    this.padKnob.style.transform = 'translate(-50%, -50%)';
    this.sync();
  }

  private press(button: Button): void {
    this.pressedCount[button] += 1;
  }

  private sync(): void {
    const k = this.keys;
    this.state.left = this.pad.left || k.has('ArrowLeft') || k.has('KeyA');
    this.state.right = this.pad.right || k.has('ArrowRight') || k.has('KeyD');
    this.state.up = this.pad.up || k.has('ArrowUp') || k.has('KeyW');
    this.state.down = this.pad.down || k.has('ArrowDown') || k.has('KeyS');
    this.state.held.jump = this.pointers.jump.size > 0 || k.has('Space') || k.has('KeyZ');
    this.state.held.spin = this.pointers.spin.size > 0 || k.has('KeyX');
    this.state.held.run = this.pointers.run.size > 0 || k.has('ShiftLeft') || k.has('ShiftRight');
    this.state.held.shoot = this.pointers.shoot.size > 0 || k.has('KeyC');
    this.state.held.grab = this.pointers.grab.size > 0 || k.has('KeyV');
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const map: Record<string, Button> = { Space: 'jump', KeyZ: 'jump', KeyX: 'spin', KeyC: 'shoot', KeyV: 'grab' };
    if (down && !this.keys.has(e.code) && map[e.code]) this.press(map[e.code]);
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    this.onFirstTouch();
    this.sync();
  }

  private bindButton(el: HTMLDivElement, id: Button): void {
    const set = this.pointers[id];
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onFirstTouch();
      el.setPointerCapture(e.pointerId);
      if (set.size === 0) this.press(id);
      set.add(e.pointerId);
      el.classList.add('down');
      this.sync();
    });
    const up = (e: PointerEvent) => {
      set.delete(e.pointerId);
      if (set.size === 0) el.classList.remove('down');
      this.sync();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private bindPad(pad: HTMLDivElement): void {
    const update = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      this.pad = {
        left: dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.5,
        right: dx > dead && Math.abs(dx) > Math.abs(dy) * 0.5,
        up: dy < -dead * 1.6 && Math.abs(dy) > Math.abs(dx) * 0.6,
        down: dy > dead * 1.6 && Math.abs(dy) > Math.abs(dx) * 0.6,
      };
      const len = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * len * r.width * 0.28;
      const ky = Math.sin(ang) * len * r.width * 0.28;
      this.padKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      this.sync();
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onFirstTouch();
      pad.setPointerCapture(e.pointerId);
      this.padPointer = e.pointerId;
      update(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.padPointer) update(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.padPointer) return;
      this.padPointer = null;
      this.pad = { left: false, right: false, up: false, down: false };
      this.padKnob.style.transform = 'translate(-50%, -50%)';
      this.sync();
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  }
}

const CONTROLS_CSS = `
#controls{position:fixed;inset:0;pointer-events:none;z-index:5;font-family:Inter,sans-serif;--il:0px;--ir:0px;--ib:0px;user-select:none;-webkit-user-select:none}
#controls .pad{position:absolute;left:calc(22px + var(--il));bottom:calc(18px + var(--ib));width:164px;height:164px;border-radius:50%;background:rgba(15,23,42,.28);border:3px solid rgba(255,255,255,.55);pointer-events:auto;touch-action:none}
#controls .knob{position:absolute;left:50%;top:50%;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 3px 0 rgba(0,0,0,.25);transform:translate(-50%,-50%)}
#controls .arrow{position:absolute;width:0;height:0;border:11px solid transparent;opacity:.85}
#controls .arrow.l{left:10px;top:50%;margin-top:-11px;border-right:14px solid #fff;border-left:0}
#controls .arrow.r{right:10px;top:50%;margin-top:-11px;border-left:14px solid #fff;border-right:0}
#controls .arrow.u{top:10px;left:50%;margin-left:-11px;border-bottom:14px solid #fff;border-top:0}
#controls .arrow.d{bottom:10px;left:50%;margin-left:-11px;border-top:14px solid #fff;border-bottom:0}
#controls .btn{position:absolute;right:calc(var(--r) + var(--ir));bottom:calc(var(--b) + var(--ib));border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;letter-spacing:.5px;pointer-events:auto;touch-action:none;opacity:.88;border:3px solid rgba(255,255,255,.7);box-shadow:0 4px 0 rgba(0,0,0,.28)}
#controls .btn span{margin-top:1px;text-shadow:0 1px 0 rgba(0,0,0,.35)}
#controls .btn.down{transform:translateY(3px) scale(.95);box-shadow:0 1px 0 rgba(0,0,0,.28);opacity:1}
#controls .btn.off{opacity:.32;filter:grayscale(1)}
#controls .btn.hidden{display:none}
#controls .btn-grab{animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,.6),0 4px 0 rgba(0,0,0,.28)}50%{box-shadow:0 0 0 10px rgba(14,165,233,0),0 4px 0 rgba(0,0,0,.28)}}
`;
