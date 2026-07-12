const OVERLAY_ROOT_ID = 'session-connection-overlay';

export class SessionConnectionOverlay {
  private readonly root: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly detailEl: HTMLElement;

  constructor(parent: HTMLElement) {
    const existing = document.getElementById(OVERLAY_ROOT_ID);
    if (existing) {
      existing.remove();
    }

    this.root = document.createElement('div');
    this.root.id = OVERLAY_ROOT_ID;
    this.root.className = 'session-connection-overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'alertdialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'session-connection-label');
    this.root.innerHTML = `
      <div class="session-connection-card">
        <div class="app-loading-spinner" aria-hidden="true"></div>
        <p id="session-connection-label" class="app-loading-label" data-session-label>Connection lost</p>
        <p class="app-loading-detail" data-session-detail>Retrying SpacetimeDB connection…</p>
      </div>
    `;
    parent.appendChild(this.root);

    const labelEl = this.root.querySelector<HTMLElement>('[data-session-label]');
    const detailEl = this.root.querySelector<HTMLElement>('[data-session-detail]');
    if (!labelEl || !detailEl) {
      throw new Error('Session connection overlay markup is incomplete.');
    }
    this.labelEl = labelEl;
    this.detailEl = detailEl;
  }

  show(label: string, detail: string): void {
    this.labelEl.textContent = label;
    this.detailEl.textContent = detail;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }
}
