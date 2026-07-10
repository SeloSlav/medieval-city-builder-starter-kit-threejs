import { getCompassHeadingRad, subscribeCompassHeading } from './compassHeading.ts';

const TWO_PI = Math.PI * 2;
const DEG_STEP = 15;
const CYCLE_PIXELS = 720;
const TICKS_PER_CYCLE = Math.round(360 / DEG_STEP);
const PX_PER_TICK = CYCLE_PIXELS / TICKS_PER_CYCLE;
const TICK_COUNT = TICKS_PER_CYCLE * 13;
const TICK_CENTER_IDX = Math.floor(TICK_COUNT / 2);

const MAJOR: ReadonlyArray<{ deg: number; label: string; strong: boolean }> = [
  { deg: 0, label: 'N', strong: true },
  { deg: 45, label: 'NE', strong: false },
  { deg: 90, label: 'E', strong: false },
  { deg: 135, label: 'SE', strong: false },
  { deg: 180, label: 'S', strong: false },
  { deg: 225, label: 'SW', strong: false },
  { deg: 270, label: 'W', strong: false },
  { deg: 315, label: 'NW', strong: false },
];

function normDegDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export class CompassHud {
  private readonly root: HTMLElement;
  private readonly band: HTMLElement;
  private readonly unsubscribe: () => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'compass-hud';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.hidden = true;

    this.root.innerHTML = `
      <div class="compass-hud__frame"></div>
      <div class="compass-hud__fade"></div>
      <div class="compass-hud__caret"></div>
      <div class="compass-hud__viewport">
        <div class="compass-hud__band"></div>
      </div>
    `;

    this.band = this.root.querySelector<HTMLElement>('.compass-hud__band')!;
    this.band.style.marginLeft = `${-(TICK_COUNT * PX_PER_TICK) / 2}px`;
    this.buildTicks();

    parent.appendChild(this.root);
    this.unsubscribe = subscribeCompassHeading(() => this.applyHeading());
    this.applyHeading();
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) this.applyHeading();
  }

  dispose(): void {
    this.unsubscribe();
    this.root.remove();
  }

  private applyHeading(): void {
    const heading = getCompassHeadingRad();
    const offsetPx = -(heading / TWO_PI) * CYCLE_PIXELS;
    this.band.style.transform = `translate3d(${offsetPx}px,0,0)`;
  }

  private buildTicks(): void {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < TICK_COUNT; i += 1) {
      const bearingDeg = (i - TICK_CENTER_IDX) * DEG_STEP;
      const mod = normDegDeg(bearingDeg);
      let major: (typeof MAJOR)[number] | undefined;
      for (const entry of MAJOR) {
        if (entry.deg === mod) {
          major = entry;
          break;
        }
      }

      const tickIdxFromNorth = Math.round(mod / DEG_STEP);
      const isHalfStep = tickIdxFromNorth % 2 === 1;
      const tick = document.createElement('div');
      tick.className = 'compass-hud__tick';
      tick.style.width = `${PX_PER_TICK}px`;

      if (major) {
        const label = document.createElement('span');
        label.className = `compass-hud__label${major.strong ? ' is-cardinal' : ''}`;
        label.textContent = major.label;
        tick.appendChild(label);
      } else {
        const mark = document.createElement('div');
        mark.className = `compass-hud__mark${isHalfStep ? ' is-minor' : ''}`;
        mark.style.height = `${isHalfStep ? 5 : 8}px`;
        tick.appendChild(mark);
      }

      fragment.appendChild(tick);
    }

    this.band.appendChild(fragment);
  }
}
