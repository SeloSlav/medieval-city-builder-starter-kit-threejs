export type ToolbarStats = {
  canBuild: boolean;
  hasDraft: boolean;
  mode: 'road' | 'idle';
};

type DeletePopupOptions = {
  clientX: number;
  clientY: number;
  onRemove: () => void;
  onCancel: () => void;
};

export class BuildToolbar {
  private readonly roadButton: HTMLButtonElement;
  private readonly buildButton: HTMLButtonElement;
  private readonly deletePopup: HTMLElement;
  private readonly removeButton: HTMLButtonElement;
  private readonly cancelDeleteButton: HTMLButtonElement;
  private readonly fpsPanel: HTMLElement;
  private readonly fpsValue: HTMLElement;
  private deleteCancel: (() => void) | null = null;
  private deleteRemove: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    handlers: {
      onOpenRoads: () => void;
      onBuildRoad: () => void;
    }
  ) {
    root.innerHTML = `
      <div class="road-tools" aria-label="Road tools">
        <button type="button" class="road-tool-button" data-action="road" title="Roads (R)">Roads</button>
        <button type="button" class="road-tool-button icon-button" data-action="build" title="Build road" aria-label="Build road" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 5.5l4 4" />
            <path d="M12.3 7.7l4-4 3.9 3.9-4 4" />
            <path d="M14.8 10.8L6.4 19.2a2.1 2.1 0 0 1-3-3l8.4-8.4" />
          </svg>
        </button>
      </div>
      <div class="delete-popup" data-delete-popup hidden>
        <button type="button" data-action="confirm-delete">Remove</button>
        <button type="button" class="ghost-button" data-action="cancel-delete">Cancel</button>
      </div>
      <div class="fps-panel" data-fps-panel aria-live="polite">
        <strong data-stat="fps">--</strong>
        <span>FPS</span>
      </div>
    `;

    this.roadButton = this.mustButton(root, '[data-action="road"]');
    this.buildButton = this.mustButton(root, '[data-action="build"]');
    this.deletePopup = this.mustElement(root, '[data-delete-popup]');
    this.removeButton = this.mustButton(root, '[data-action="confirm-delete"]');
    this.cancelDeleteButton = this.mustButton(root, '[data-action="cancel-delete"]');
    this.fpsPanel = this.mustElement(root, '[data-fps-panel]');
    this.fpsValue = this.mustElement(root, '[data-stat="fps"]');

    this.roadButton.addEventListener('click', handlers.onOpenRoads);
    this.buildButton.addEventListener('click', handlers.onBuildRoad);
    this.deletePopup.addEventListener('mousedown', (event) => event.stopPropagation());
    this.deletePopup.addEventListener('click', (event) => event.stopPropagation());
    this.removeButton.addEventListener('click', () => {
      const remove = this.deleteRemove;
      this.hideDeletePopup(false);
      remove?.();
    });
    this.cancelDeleteButton.addEventListener('click', () => this.hideDeletePopup(true));
  }

  setStats(stats: ToolbarStats): void {
    this.roadButton.classList.toggle('is-active', stats.mode === 'road');
    this.roadButton.setAttribute('aria-pressed', String(stats.mode === 'road'));
    this.buildButton.disabled = !stats.canBuild;
    this.buildButton.classList.toggle('is-ready', stats.canBuild);
    this.buildButton.classList.toggle('has-draft', stats.hasDraft);
  }

  setFps(fps: number): void {
    const displayFps = Math.min(90, Math.round(fps));
    this.fpsValue.textContent = displayFps.toString();
    this.fpsPanel.classList.toggle('is-low', displayFps < 60);
    this.fpsPanel.classList.toggle('is-fast', displayFps >= 85);
  }

  showDeletePopup(options: DeletePopupOptions): void {
    this.deleteCancel = options.onCancel;
    this.deleteRemove = options.onRemove;
    const width = 168;
    const height = 44;
    const margin = 10;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, options.clientX + 12));
    const top = Math.max(margin, Math.min(window.innerHeight - height - margin, options.clientY - height * 0.5));
    this.deletePopup.style.left = `${left}px`;
    this.deletePopup.style.top = `${top}px`;
    this.deletePopup.hidden = false;
    this.removeButton.focus({ preventScroll: true });
  }

  hideDeletePopup(runCancel = true): void {
    if (this.deletePopup.hidden) return;
    const cancel = this.deleteCancel;
    this.deletePopup.hidden = true;
    this.deleteCancel = null;
    this.deleteRemove = null;
    if (runCancel) cancel?.();
  }

  private mustButton(root: HTMLElement, selector: string): HTMLButtonElement {
    const element = root.querySelector<HTMLButtonElement>(selector);
    if (!element) throw new Error(`Missing toolbar button ${selector}`);
    return element;
  }

  private mustElement(root: HTMLElement, selector: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing toolbar element ${selector}`);
    return element;
  }
}
