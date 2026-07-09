export type LoadingProgress = {
  label: string;
  detail?: string;
};

const LOADING_ROOT_ID = 'app-loading';

export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private dismissed = false;

  constructor() {
    const root = document.getElementById(LOADING_ROOT_ID);
    if (!root) {
      throw new Error(`Missing #${LOADING_ROOT_ID} element.`);
    }

    const labelEl = root.querySelector<HTMLElement>('[data-loading-label]');
    const detailEl = root.querySelector<HTMLElement>('[data-loading-detail]');
    if (!labelEl || !detailEl) {
      throw new Error('Loading screen markup is missing label or detail elements.');
    }

    this.root = root;
    this.labelEl = labelEl;
    this.detailEl = detailEl;
  }

  static tryCreate(): LoadingScreen | null {
    if (!document.getElementById(LOADING_ROOT_ID)) return null;
    return new LoadingScreen();
  }

  setProgress(progress: LoadingProgress): void {
    if (this.dismissed) return;
    this.labelEl.textContent = progress.label;
    this.detailEl.textContent = progress.detail ?? '';
  }

  dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.root.classList.add('is-dismissed');
    window.setTimeout(() => {
      this.root.remove();
    }, 420);
  }
}
