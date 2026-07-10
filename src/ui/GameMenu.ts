import {
  areTipCardsDisabled,
  setTipCardsDisabled,
} from './tipCardsPreference.ts';

type GameMenuOptions = {
  onTipsPreferenceChange: () => void;
  onOpenChange?: (open: boolean) => void;
};

export class GameMenu {
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly tipsCheckbox: HTMLInputElement;
  private readonly menuButton: HTMLButtonElement;
  private open = false;
  private readonly onTipsPreferenceChange: () => void;
  private readonly onOpenChange?: (open: boolean) => void;
  private readonly onKeyDown: (event: KeyboardEvent) => void;

  constructor(parent: HTMLElement, options: GameMenuOptions) {
    this.onTipsPreferenceChange = options.onTipsPreferenceChange;
    this.onOpenChange = options.onOpenChange;

    this.menuButton = document.createElement('button');
    this.menuButton.type = 'button';
    this.menuButton.className = 'hud-menu-button';
    this.menuButton.setAttribute('aria-label', 'Open menu');
    this.menuButton.setAttribute('aria-haspopup', 'dialog');
    this.menuButton.setAttribute('aria-expanded', 'false');
    this.menuButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    `;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'game-menu-backdrop';
    this.backdrop.hidden = true;
    this.backdrop.innerHTML = `
      <div class="game-menu-dialog" role="dialog" aria-modal="true" aria-labelledby="game-menu-title">
        <h2 id="game-menu-title" class="game-menu-title">Menu</h2>
        <label class="game-menu-option">
          <input type="checkbox" data-tips-checkbox />
          <span>Turn off tips</span>
        </label>
        <button type="button" class="game-menu-return" data-return-button>Return to game</button>
      </div>
    `;

    this.dialog = this.backdrop.querySelector<HTMLElement>('.game-menu-dialog')!;
    this.tipsCheckbox = this.backdrop.querySelector<HTMLInputElement>('[data-tips-checkbox]')!;
    const returnButton = this.backdrop.querySelector<HTMLButtonElement>('[data-return-button]')!;

    parent.appendChild(this.menuButton);
    parent.appendChild(this.backdrop);

    this.tipsCheckbox.checked = areTipCardsDisabled();
    this.menuButton.addEventListener('click', () => this.toggle());
    returnButton.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (event) => event.stopPropagation());
    this.tipsCheckbox.addEventListener('change', () => {
      setTipCardsDisabled(this.tipsCheckbox.checked);
      this.onTipsPreferenceChange();
    });

    this.onKeyDown = (event: KeyboardEvent) => {
      if (!this.open || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    };
  }

  isOpen(): boolean {
    return this.open;
  }

  dispose(): void {
    this.close();
    this.menuButton.remove();
    this.backdrop.remove();
  }

  private toggle(): void {
    if (this.open) this.close();
    else this.openMenu();
  }

  private openMenu(): void {
    this.open = true;
    this.tipsCheckbox.checked = areTipCardsDisabled();
    this.backdrop.hidden = false;
    this.menuButton.setAttribute('aria-expanded', 'true');
    window.addEventListener('keydown', this.onKeyDown, true);
    this.onOpenChange?.(true);
    this.backdrop.querySelector<HTMLButtonElement>('[data-return-button]')?.focus({ preventScroll: true });
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    this.backdrop.hidden = true;
    this.menuButton.setAttribute('aria-expanded', 'false');
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.onOpenChange?.(false);
  }
}
