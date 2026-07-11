import { CompassHud } from './CompassHud.ts';
import { GameMenu } from './GameMenu.ts';
import { formatBuildingCost, getBuildingCost, residenceZoneCost } from '../resources/buildingEconomy.ts';
import type { BurgageLayoutHudState } from '../residences/BurgageTool.ts';
import { syncTipCardVisibility } from './tipCards.ts';
import { areTipCardsDisabled, setTipCardsDisabled, subscribeTipCardsPreference } from './tipCardsPreference.ts';

export type ToolbarStats = {
  canBuild: boolean;
  hasDraft: boolean;
  mode: 'road' | 'lumber_mill' | 'reforester' | 'woodcutters_lodge' | 'stone_quarry' | 'residences' | 'idle';
  statusDetail?: string | null;
};

const BUILD_CARD_ART = {
  lumber_mill: '/assets/ui/build-menu/lumber-mill.png',
  reforester: '/assets/ui/build-menu/reforester.png',
  woodcutters_lodge: '/assets/ui/build-menu/woodcutters-lodge.png',
  stone_quarry: '/assets/ui/build-menu/stonecutters-camp.png',
  residences: '/assets/ui/build-menu/residence.png',
} as const;

type DeletePopupOptions = {
  clientX: number;
  clientY: number;
  onRemove: () => void;
  onCancel: () => void;
};

export class BuildToolbar {
  private readonly roadButton: HTMLButtonElement;
  private readonly buildMenuButton: HTMLButtonElement;
  private readonly helpButton: HTMLButtonElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly lumberMillButton: HTMLButtonElement;
  private readonly reforesterButton: HTMLButtonElement;
  private readonly woodcuttersLodgeButton: HTMLButtonElement;
  private readonly stoneQuarryButton: HTMLButtonElement;
  private readonly residencesButton: HTMLButtonElement;
  private readonly buildButton: HTMLButtonElement;
  private readonly buildMenu: HTMLElement;
  private readonly burgageLayoutHud: HTMLElement;
  private readonly burgagePlotDecreaseButton: HTMLButtonElement;
  private readonly burgagePlotIncreaseButton: HTMLButtonElement;
  private readonly burgagePlotCountLabel: HTMLElement;
  private readonly burgagePlotMaxLabel: HTMLElement;
  private readonly burgageRotateFrontageButton: HTMLButtonElement;
  private readonly burgageFrontageLabel: HTMLElement;
  private readonly statusLabel: HTMLElement;
  private readonly deletePopup: HTMLElement;
  private readonly removeButton: HTMLButtonElement;
  private readonly cancelDeleteButton: HTMLButtonElement;
  private readonly fpsPanel: HTMLElement;
  private readonly fpsValue: HTMLElement;
  private readonly zoomValue: HTMLElement;
  private readonly fpModePanel: HTMLElement;
  private readonly constructionDock: HTMLElement;
  private readonly zoomStat: HTMLElement;
  private readonly builderPanelTitle: HTMLElement;
  private readonly builderHelpList: HTMLElement;
  private readonly builderStatusBar: HTMLElement;
  private readonly root: HTMLElement;
  private readonly compassHud: CompassHud;
  private gameMenu: GameMenu | null = null;
  private readonly unsubscribeTipsPreference: () => void;
  private firstPersonActive = false;
  private buildMenuOpen = false;
  private buildButtonVisible = false;
  private burgageLayoutHudVisible = false;
  private lastBuildLeft = Number.NaN;
  private lastBuildTop = Number.NaN;
  private lastHudLeft = Number.NaN;
  private lastHudTop = Number.NaN;
  private hudMode: ToolbarStats['mode'] = 'idle';
  private deleteCancel: (() => void) | null = null;
  private deleteRemove: (() => void) | null = null;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target) || this.firstPersonActive || this.gameMenu?.isOpen()) return;
    const key = event.key.toLowerCase();
    if (key === 'b' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      this.toggleBuildMenu();
      return;
    }
    if (key === 'escape' && this.buildMenuOpen) {
      event.preventDefault();
      event.stopPropagation();
      this.setBuildMenuOpen(false);
    }
  };

  constructor(
    root: HTMLElement,
    handlers: {
      onOpenRoads: () => void;
      onBuildRoad: () => void;
      onToggleLumberMill: () => void;
      onToggleReforester: () => void;
      onToggleWoodcuttersLodge: () => void;
      onToggleStoneQuarry: () => void;
      onToggleResidences: () => void;
      onBurgagePlotDecrease?: () => void;
      onBurgagePlotIncrease?: () => void;
      onBurgageRotateFrontage?: () => void;
      onMenuOpenChange?: (open: boolean) => void;
      onShadowPreferenceChange?: () => void;
      canOpenMenuFromKeyboard?: () => boolean;
      onExportGameState?: () => void;
      onImportGameState?: () => void;
    },
  ) {
    root.innerHTML = `
      <div class="hud-right-stack">
        <div class="settlement-hud" data-settlement-hud data-fps-panel aria-label="Settlement overview" aria-live="polite">
          <div class="settlement-hud__perf">
            <div
              class="settlement-hud__stat settlement-hud__stat--perf"
              tabindex="0"
              data-tooltip="Frames per second. Turns amber below 60 and gold at 85 or higher."
            >
              <span class="settlement-hud__label">FPS</span>
              <strong class="settlement-hud__value settlement-hud__value--fps" data-stat="fps">--</strong>
            </div>
            <div
              class="settlement-hud__stat settlement-hud__stat--perf"
              tabindex="0"
              data-stat-row="zoom"
              data-tooltip="Camera zoom level. Scroll the mouse wheel to zoom in and out on the map."
            >
              <span class="settlement-hud__label">Zoom</span>
              <strong class="settlement-hud__value settlement-hud__value--zoom" data-stat="zoom">100%</strong>
            </div>
          </div>
          <div class="settlement-hud__body">
            <div
              class="settlement-hud__stat"
              tabindex="0"
              data-resource="timber"
              data-tooltip="Timber in your treasury plus lumber stored at mills and lodges. Building costs spend treasury first, then pull from building storage."
            >
              <span class="settlement-hud__label">Timber</span>
              <strong class="settlement-hud__value" data-stockpile="timber">0</strong>
            </div>
            <div
              class="settlement-hud__stat"
              tabindex="0"
              data-resource="stone"
              data-tooltip="Stone in your treasury plus quarry camp storage. Construction spends treasury first, then quarry storage."
            >
              <span class="settlement-hud__label">Stone</span>
              <strong class="settlement-hud__value" data-stockpile="stone">0</strong>
            </div>
            <div
              class="settlement-hud__stat"
              tabindex="0"
              data-resource="firewood"
              data-tooltip="Firewood held in treasury, woodcutter lodges, and residence stocks combined."
            >
              <span class="settlement-hud__label">Firewood</span>
              <strong class="settlement-hud__value" data-stockpile="firewood">0</strong>
            </div>
            <div
              class="settlement-hud__stat"
              tabindex="0"
              data-resource="population"
              data-tooltip="Total population: starting townsfolk plus residents who have moved into homes."
            >
              <span class="settlement-hud__label">Population</span>
              <strong class="settlement-hud__value" data-stockpile="population">0</strong>
            </div>
            <div
              class="settlement-hud__stat"
              tabindex="0"
              data-resource="housing"
              data-tooltip="Residents housed versus total housing capacity. New homes start empty and attract settlers over time."
            >
              <span class="settlement-hud__label">Housing</span>
              <strong class="settlement-hud__value" data-stockpile="housing">0/0</strong>
              <span class="settlement-hud__sub" data-stockpile="housing-sub">0 vacant</span>
            </div>
            <div
              class="settlement-hud__stat"
              tabindex="0"
              data-resource="labor"
              data-tooltip="Workers free to assign. Labor equals population minus workers already assigned to buildings."
            >
              <span class="settlement-hud__label">Labor</span>
              <strong class="settlement-hud__value" data-stockpile="labor">0</strong>
              <span class="settlement-hud__sub" data-stockpile="labor-sub">available</span>
            </div>
          </div>
        </div>

        <aside class="fp-controls-panel" data-tip-card="fp" data-fp-controls-panel aria-label="Walk mode controls" hidden>
          <header class="road-controls-header">
            <div>
              <p class="road-controls-eyebrow">Explorer</p>
              <h2 class="road-controls-title">Walk mode</h2>
            </div>
          </header>

          <section class="road-controls-help" aria-label="Walk mode shortcuts">
            <h3 class="road-controls-help-title">Controls</h3>
            <ul class="road-controls-list">
              <li><span>Move</span><span class="road-controls-key">WASD</span></li>
              <li><span>Sprint</span><span class="road-controls-key">Shift</span></li>
              <li><span>Jump</span><span class="road-controls-key">Space</span></li>
              <li><span>Crouch</span><span class="road-controls-key">C</span></li>
              <li><span>Free look</span><span class="road-controls-key">Alt</span></li>
              <li><span>Toggle walk</span><span class="road-controls-key">~</span></li>
              <li><span>Exit walk</span><span class="road-controls-key">Esc</span></li>
            </ul>
          </section>
        </aside>

        <aside class="rts-controls-panel" data-tip-card="rts" data-rts-controls-panel aria-label="Camera controls" hidden>
          <header class="road-controls-header">
            <div>
              <p class="road-controls-eyebrow">Strategist</p>
              <h2 class="road-controls-title">Camera</h2>
            </div>
          </header>

          <section class="road-controls-help" aria-label="Camera shortcuts">
            <h3 class="road-controls-help-title">Controls</h3>
            <ul class="road-controls-list">
              <li><span>Pan map</span><span class="road-controls-key">R-drag / WASD</span></li>
              <li><span>Rotate view</span><span class="road-controls-key">MMB / Q E</span></li>
              <li><span>Zoom</span><span class="road-controls-key">Scroll</span></li>
              <li><span>Open menu</span><span class="road-controls-key">Esc</span></li>
              <li><span>Walk mode</span><span class="road-controls-key">~</span></li>
              <li><span>Road tool</span><span class="road-controls-key">R</span></li>
            </ul>
          </section>
        </aside>

        <aside class="road-controls-panel" data-tip-card="road" data-road-controls-panel aria-label="Road placement instructions" hidden>
          <header class="road-controls-header">
            <div>
              <p class="road-controls-eyebrow">Builder</p>
              <h2 class="road-controls-title">Roads</h2>
              <p class="road-controls-status" data-road-status>Road tool off</p>
            </div>
          </header>

          <section class="road-controls-help" aria-label="Road placement shortcuts">
            <h3 class="road-controls-help-title">Controls</h3>
            <ul class="road-controls-list">
              <li><span>Toggle road tool</span><span class="road-controls-key">R</span></li>
              <li><span>Place point</span><span class="road-controls-key">L-click</span></li>
              <li><span>Undo last point</span><span class="road-controls-key">R-click</span></li>
              <li><span>Curve segment</span><span class="road-controls-key">Ctrl + scroll</span></li>
              <li><span>Build road</span><span class="road-controls-key">Hammer or Enter</span></li>
              <li><span>Delete segment</span><span class="road-controls-key">Alt + L-click</span></li>
              <li><span>Undo change</span><span class="road-controls-key">Ctrl + Z</span></li>
              <li><span>Redo change</span><span class="road-controls-key">Ctrl + Y</span></li>
              <li><span>Cancel / exit</span><span class="road-controls-key">Esc</span></li>
            </ul>
          </section>
        </aside>
      </div>

      <div class="builder-status-bar" data-builder-status hidden aria-live="polite"></div>

      <section class="construction-menu" data-build-menu hidden aria-label="Build menu">
        <div class="construction-menu__cards">
          <button type="button" class="construction-card" data-action="lumber-mill" title="Place lumber mill (${formatBuildingCost(getBuildingCost('lumber_mill'))})">
            <img class="construction-card__art" src="${BUILD_CARD_ART.lumber_mill}" alt="" draggable="false" />
            <span class="construction-card__label">Lumber mill</span>
          </button>
          <button type="button" class="construction-card" data-action="stone-quarry" title="Place stonecutter's camp (${formatBuildingCost(getBuildingCost('stone_quarry'))})">
            <img class="construction-card__art" src="${BUILD_CARD_ART.stone_quarry}" alt="" draggable="false" />
            <span class="construction-card__label">Stonecutters</span>
          </button>
          <button type="button" class="construction-card" data-action="reforester" title="Place forester (${formatBuildingCost(getBuildingCost('reforester'))})">
            <img class="construction-card__art" src="${BUILD_CARD_ART.reforester}" alt="" draggable="false" />
            <span class="construction-card__label">Forester</span>
          </button>
          <button type="button" class="construction-card" data-action="woodcutters-lodge" title="Place woodcutter's lodge (${formatBuildingCost(getBuildingCost('woodcutters_lodge'))})">
            <img class="construction-card__art" src="${BUILD_CARD_ART.woodcutters_lodge}" alt="" draggable="false" />
            <span class="construction-card__label">Woodcutter</span>
          </button>
          <button type="button" class="construction-card" data-action="residences" title="Place residences (${formatBuildingCost(residenceZoneCost(1))} each)">
            <img class="construction-card__art" src="${BUILD_CARD_ART.residences}" alt="" draggable="false" />
            <span class="construction-card__label">Residence</span>
          </button>
        </div>
      </section>

      <nav class="construction-dock" data-construction-dock aria-label="Construction tools">
        <button type="button" class="construction-dock-button" data-action="road" data-tooltip="Roads (R)" title="Roads (R)" aria-label="Roads" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 21c4.8-4.8 5.2-12.2 1-18" />
            <path d="M15 21c-2.8-5.7-2.2-11.6 2-18" />
            <path d="M12 6.5h1" />
            <path d="M12 11.5h1" />
            <path d="M12 16.5h1" />
          </svg>
        </button>
        <button type="button" class="construction-dock-button" data-action="build-menu" data-tooltip="Build (B)" title="Build (B)" aria-label="Build menu" aria-expanded="false" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 5.5l4 4" />
            <path d="M12.3 7.7l4-4 3.9 3.9-4 4" />
            <path d="M14.8 10.8L6.4 19.2a2.1 2.1 0 0 1-3-3l8.4-8.4" />
          </svg>
        </button>
        <button type="button" class="construction-dock-button construction-dock-button--text" data-action="help" data-tooltip="Help tips" title="Help tips" aria-label="Toggle help tips" aria-pressed="false">
          <span aria-hidden="true">?</span>
        </button>
        <button type="button" class="construction-dock-button" data-action="settings" data-tooltip="Settings" title="Settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
            <path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" />
          </svg>
        </button>
      </nav>

      <button type="button" class="road-tool-button icon-button floating-build-button" data-action="commit-build" title="Build road (Enter)" aria-label="Build road" disabled hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 5.5l4 4" />
          <path d="M12.3 7.7l4-4 3.9 3.9-4 4" />
          <path d="M14.8 10.8L6.4 19.2a2.1 2.1 0 0 1-3-3l8.4-8.4" />
        </svg>
      </button>

      <div class="burgage-layout-hud" data-burgage-layout-hud hidden aria-label="Residence plot layout">
        <button type="button" class="burgage-layout-hud-button" data-action="burgage-plot-decrease" title="Fewer plots (−)" aria-label="Fewer plots">−</button>
        <div class="burgage-layout-hud-count">
          <strong data-burgage-plot-count>1</strong>
          <span data-burgage-plot-max>plot</span>
        </div>
        <button type="button" class="burgage-layout-hud-button" data-action="burgage-plot-increase" title="More plots (+)" aria-label="More plots">+</button>
        <button type="button" class="burgage-layout-hud-frontage" data-action="burgage-rotate-frontage" title="Rotate frontage (F)" aria-label="Rotate frontage" hidden>
          <span aria-hidden="true">↻</span>
          <span class="burgage-layout-hud-frontage-label" data-burgage-frontage-label>A–B</span>
        </button>
      </div>

      <div class="delete-popup" data-delete-popup hidden>
        <button type="button" data-action="confirm-delete">Remove</button>
        <button type="button" class="ghost-button" data-action="cancel-delete">Cancel</button>
      </div>

      <div class="hud-bottom-right">
        <div class="fps-panel fp-mode-panel" data-fp-mode-panel aria-label="First person mode">
          <div class="fps-stat">
            <strong>~</strong>
            <span>Walk</span>
          </div>
        </div>
      </div>

    `;

    this.root = root;
    window.addEventListener('keydown', this.onKeyDown, true);
    this.gameMenu = new GameMenu(root, {
      onTipsPreferenceChange: () => this.syncContextPanels(),
      onShadowPreferenceChange: () => handlers.onShadowPreferenceChange?.(),
      onOpenChange: handlers.onMenuOpenChange,
      canOpenFromKeyboard: handlers.canOpenMenuFromKeyboard,
      onExportGameState: handlers.onExportGameState,
      onImportGameState: handlers.onImportGameState,
      showButton: false,
    });
    this.unsubscribeTipsPreference = subscribeTipCardsPreference(() => this.syncContextPanels());

    this.roadButton = this.mustButton(root, '[data-action="road"]');
    this.buildMenuButton = this.mustButton(root, '[data-action="build-menu"]');
    this.helpButton = this.mustButton(root, '[data-action="help"]');
    this.settingsButton = this.mustButton(root, '[data-action="settings"]');
    this.lumberMillButton = this.mustButton(root, '[data-action="lumber-mill"]');
    this.reforesterButton = this.mustButton(root, '[data-action="reforester"]');
    this.woodcuttersLodgeButton = this.mustButton(root, '[data-action="woodcutters-lodge"]');
    this.stoneQuarryButton = this.mustButton(root, '[data-action="stone-quarry"]');
    this.residencesButton = this.mustButton(root, '[data-action="residences"]');
    this.buildButton = this.mustButton(root, '[data-action="commit-build"]');
    this.buildMenu = this.mustElement(root, '[data-build-menu]');
    this.burgageLayoutHud = this.mustElement(root, '[data-burgage-layout-hud]');
    this.burgagePlotDecreaseButton = this.mustButton(root, '[data-action="burgage-plot-decrease"]');
    this.burgagePlotIncreaseButton = this.mustButton(root, '[data-action="burgage-plot-increase"]');
    this.burgagePlotCountLabel = this.mustElement(root, '[data-burgage-plot-count]');
    this.burgagePlotMaxLabel = this.mustElement(root, '[data-burgage-plot-max]');
    this.burgageRotateFrontageButton = this.mustButton(root, '[data-action="burgage-rotate-frontage"]');
    this.burgageFrontageLabel = this.mustElement(root, '[data-burgage-frontage-label]');
    this.statusLabel = this.mustElement(root, '[data-road-status]');
    this.deletePopup = this.mustElement(root, '[data-delete-popup]');
    this.removeButton = this.mustButton(root, '[data-action="confirm-delete"]');
    this.cancelDeleteButton = this.mustButton(root, '[data-action="cancel-delete"]');
    this.fpsPanel = this.mustElement(root, '[data-settlement-hud]');
    this.fpsValue = this.mustElement(root, '[data-stat="fps"]');
    this.zoomValue = this.mustElement(root, '[data-stat="zoom"]');
    this.fpModePanel = this.mustElement(root, '[data-fp-mode-panel]');
    this.constructionDock = this.mustElement(root, '[data-construction-dock]');
    this.zoomStat = this.mustElement(root, '[data-stat-row="zoom"]');
    this.builderPanelTitle = this.mustElement(root, '[data-road-controls-panel] .road-controls-title');
    this.builderHelpList = this.mustElement(root, '[data-road-controls-panel] .road-controls-list');
    this.builderStatusBar = this.mustElement(root, '[data-builder-status]');
    this.compassHud = new CompassHud(root);

    this.syncContextPanels();
    this.roadButton.addEventListener('click', () => {
      this.setBuildMenuOpen(false);
      handlers.onOpenRoads();
    });
    this.buildMenuButton.addEventListener('click', () => this.toggleBuildMenu());
    this.helpButton.addEventListener('click', () => this.toggleHelpTips());
    this.settingsButton.addEventListener('click', () => {
      this.setBuildMenuOpen(false);
      this.gameMenu?.toggle();
    });
    this.lumberMillButton.addEventListener('click', () => this.chooseBuildMenuItem(handlers.onToggleLumberMill));
    this.reforesterButton.addEventListener('click', () => this.chooseBuildMenuItem(handlers.onToggleReforester));
    this.woodcuttersLodgeButton.addEventListener('click', () => this.chooseBuildMenuItem(handlers.onToggleWoodcuttersLodge));
    this.stoneQuarryButton.addEventListener('click', () => this.chooseBuildMenuItem(handlers.onToggleStoneQuarry));
    this.residencesButton.addEventListener('click', () => this.chooseBuildMenuItem(handlers.onToggleResidences));
    this.buildButton.addEventListener('click', handlers.onBuildRoad);
    this.buildMenu.addEventListener('mousedown', (event) => event.stopPropagation());
    this.buildMenu.addEventListener('click', (event) => event.stopPropagation());
    this.burgagePlotDecreaseButton.addEventListener('click', () => handlers.onBurgagePlotDecrease?.());
    this.burgagePlotIncreaseButton.addEventListener('click', () => handlers.onBurgagePlotIncrease?.());
    this.burgageRotateFrontageButton.addEventListener('click', () => handlers.onBurgageRotateFrontage?.());
    this.burgageLayoutHud.addEventListener('mousedown', (event) => event.stopPropagation());
    this.burgageLayoutHud.addEventListener('click', (event) => event.stopPropagation());
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
    this.hudMode = stats.mode;
    const roadMode = stats.mode === 'road';
    const lumberMode = stats.mode === 'lumber_mill';
    const reforesterMode = stats.mode === 'reforester';
    const woodcuttersLodgeMode = stats.mode === 'woodcutters_lodge';
    const stoneQuarryMode = stats.mode === 'stone_quarry';
    const residencesMode = stats.mode === 'residences';
    this.roadButton.classList.toggle('is-active', roadMode);
    this.roadButton.setAttribute('aria-pressed', String(roadMode));
    this.lumberMillButton.classList.toggle('is-active', lumberMode);
    this.lumberMillButton.setAttribute('aria-pressed', String(lumberMode));
    this.reforesterButton.classList.toggle('is-active', reforesterMode);
    this.reforesterButton.setAttribute('aria-pressed', String(reforesterMode));
    this.woodcuttersLodgeButton.classList.toggle('is-active', woodcuttersLodgeMode);
    this.woodcuttersLodgeButton.setAttribute('aria-pressed', String(woodcuttersLodgeMode));
    this.stoneQuarryButton.classList.toggle('is-active', stoneQuarryMode);
    this.stoneQuarryButton.setAttribute('aria-pressed', String(stoneQuarryMode));
    this.residencesButton.classList.toggle('is-active', residencesMode);
    this.residencesButton.setAttribute('aria-pressed', String(residencesMode));
    this.buildButton.disabled = !stats.canBuild;
    this.buildButton.classList.toggle('is-ready', stats.canBuild);
    this.buildButton.classList.toggle('has-draft', stats.hasDraft);
    this.statusLabel.textContent = this.describeStatus(stats);
    this.statusLabel.dataset.state = stats.canBuild
      ? 'ready'
      : (roadMode || residencesMode)
        ? (stats.hasDraft ? 'draft' : 'active')
        : 'idle';
    if (this.isBuilderHudMode(stats.mode)) {
      this.builderPanelTitle.textContent = this.describeBuilderTitle(stats.mode);
      this.builderHelpList.innerHTML = this.describeBuilderHelp(stats.mode);
    }
    const statusText = this.describeStatus(stats);
    this.builderStatusBar.textContent = statusText;
    this.builderStatusBar.hidden = !this.isBuilderHudMode(stats.mode);
    this.builderStatusBar.dataset.state = this.statusLabel.dataset.state;
    this.syncContextPanels();
  }

  setBuildButtonPosition(position: { clientX: number; clientY: number } | null, visible: boolean): void {
    if (!visible || !position) {
      if (!this.buildButtonVisible) return;
      this.buildButton.hidden = true;
      this.buildButtonVisible = false;
      this.lastBuildLeft = Number.NaN;
      this.lastBuildTop = Number.NaN;
      return;
    }

    const size = 44;
    const margin = 10;
    const gap = 12;
    const left = Math.round(Math.max(margin, Math.min(window.innerWidth - size - margin, position.clientX + gap)));
    const top = Math.round(Math.max(margin, Math.min(window.innerHeight - size - margin, position.clientY - size - gap)));
    if (this.buildButtonVisible && left === this.lastBuildLeft && top === this.lastBuildTop) return;

    this.buildButton.hidden = false;
    this.buildButtonVisible = true;
    this.lastBuildLeft = left;
    this.lastBuildTop = top;
    this.buildButton.style.left = `${left}px`;
    this.buildButton.style.top = `${top}px`;
  }

  setBurgageLayoutHud(
    position: { clientX: number; clientY: number } | null,
    state: BurgageLayoutHudState | null,
  ): void {
    if (!position || !state) {
      if (!this.burgageLayoutHudVisible) return;
      this.burgageLayoutHud.hidden = true;
      this.burgageLayoutHudVisible = false;
      this.lastHudLeft = Number.NaN;
      this.lastHudTop = Number.NaN;
      return;
    }

    const plotLabel = state.plotCount === 1 ? 'plot' : 'plots';
    const residenceHint = state.residenceCount != null && state.residenceCount !== state.plotCount
      ? ` · ${state.residenceCount} fit`
      : '';
    this.burgagePlotCountLabel.textContent = state.plotCount.toString();
    this.burgagePlotMaxLabel.textContent = `${plotLabel} / ${state.maxPlotCount} max${residenceHint}`;
    this.burgagePlotDecreaseButton.disabled = !state.canDecrease;
    this.burgagePlotIncreaseButton.disabled = !state.canIncrease;
    this.burgageLayoutHud.dataset.state = state.valid ? 'ready' : 'warning';

    const showFrontage = state.canRotateFrontage && state.frontageLabel != null;
    this.burgageRotateFrontageButton.hidden = !showFrontage;
    if (showFrontage) {
      this.burgageFrontageLabel.textContent = state.frontageLabel;
    }

    this.burgageLayoutHud.hidden = false;
    this.burgageLayoutHudVisible = true;

    const width = this.burgageLayoutHud.offsetWidth || 168;
    const height = this.burgageLayoutHud.offsetHeight || 44;
    const margin = 10;
    const left = Math.round(Math.max(margin, Math.min(window.innerWidth - width - margin, position.clientX - width * 0.5)));
    const top = Math.round(Math.max(margin, Math.min(window.innerHeight - height - margin, position.clientY - height - 14)));
    if (left === this.lastHudLeft && top === this.lastHudTop) return;

    this.lastHudLeft = left;
    this.lastHudTop = top;
    this.burgageLayoutHud.style.left = `${left}px`;
    this.burgageLayoutHud.style.top = `${top}px`;
  }

  setFps(fps: number): void {
    const displayFps = Math.min(90, Math.round(fps));
    this.fpsValue.textContent = displayFps.toString();
    this.fpsPanel.classList.toggle('is-low', displayFps < 60);
    this.fpsPanel.classList.toggle('is-fast', displayFps >= 85);
  }

  setZoomPercent(zoomPercent: number): void {
    const displayZoom = Math.max(1, Math.round(zoomPercent));
    this.zoomValue.textContent = `${displayZoom}%`;
  }

  isGameMenuOpen(): boolean {
    return this.gameMenu.isOpen();
  }

  setFirstPersonMode(active: boolean): void {
    this.firstPersonActive = active;
    this.fpModePanel.classList.toggle('is-active', active);
    this.roadTools.hidden = active;
    this.zoomStat.hidden = active;
    this.compassHud.setVisible(active);
    this.syncContextPanels();
  }

  private syncContextPanels(): void {
    const builderActive = this.isBuilderHudMode(this.hudMode);
    const tipHudMode = builderActive ? 'road' : 'idle';
    syncTipCardVisibility(this.root, {
      firstPersonActive: this.firstPersonActive,
      hudMode: tipHudMode,
      builderModeActive: builderActive,
    });
  }

  private isBuilderHudMode(mode: ToolbarStats['mode']): boolean {
    return mode === 'road'
      || mode === 'lumber_mill'
      || mode === 'reforester'
      || mode === 'woodcutters_lodge'
      || mode === 'stone_quarry'
      || mode === 'residences';
  }

  private describeBuilderTitle(mode: ToolbarStats['mode']): string {
    switch (mode) {
      case 'road':
        return 'Roads';
      case 'lumber_mill':
        return 'Lumber mill';
      case 'reforester':
        return 'Reforester';
      case 'woodcutters_lodge':
        return "Woodcutter's lodge";
      case 'stone_quarry':
        return "Stonecutter's camp";
      case 'residences':
        return 'Residences';
      case 'idle':
        return 'Builder';
      default: {
        const unhandled: never = mode;
        return unhandled;
      }
    }
  }

  dispose(): void {
    this.unsubscribeTipsPreference();
    this.gameMenu.dispose();
    this.compassHud.dispose();
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

  private describeBuilderHelp(mode: ToolbarStats['mode']): string {
    switch (mode) {
      case 'road':
        return `
          <li><span>Toggle road tool</span><span class="road-controls-key">R</span></li>
          <li><span>Place point</span><span class="road-controls-key">L-click</span></li>
          <li><span>Undo last point</span><span class="road-controls-key">R-click</span></li>
          <li><span>Build road</span><span class="road-controls-key">Hammer or Enter</span></li>
          <li><span>Cancel / exit</span><span class="road-controls-key">Esc</span></li>
        `;
      case 'residences':
        return `
          <li><span>Frontage start</span><span class="road-controls-key">1st click</span></li>
          <li><span>Frontage end</span><span class="road-controls-key">2nd click</span></li>
          <li><span>Set depth</span><span class="road-controls-key">3rd click</span></li>
          <li><span>Close rectangle</span><span class="road-controls-key">4th click</span></li>
          <li><span>Change plot count</span><span class="road-controls-key">+ / − or on-zone controls</span></li>
          <li><span>Rotate frontage</span><span class="road-controls-key">F</span> <span class="road-controls-hint">(after depth is set)</span></li>
          <li><span>Place residences</span><span class="road-controls-key">Hammer or Enter</span></li>
          <li><span>Cancel / exit</span><span class="road-controls-key">Esc</span></li>
        `;
      case 'lumber_mill':
      case 'reforester':
      case 'woodcutters_lodge':
      case 'stone_quarry':
        return `
          <li><span>Place building</span><span class="road-controls-key">L-click</span></li>
          <li><span>Cancel tool</span><span class="road-controls-key">Esc</span></li>
        `;
      case 'idle':
        return '';
      default: {
        const unhandled: never = mode;
        return unhandled;
      }
    }
  }

  private describeStatus(stats: ToolbarStats): string {
    if (stats.mode === 'lumber_mill') {
      return `Click terrain to place a lumber mill (${formatBuildingCost(getBuildingCost('lumber_mill'))})`;
    }
    if (stats.mode === 'reforester') {
      return `Click terrain to place a reforester (${formatBuildingCost(getBuildingCost('reforester'))})`;
    }
    if (stats.mode === 'woodcutters_lodge') {
      return `Click terrain to place a woodcutter's lodge (${formatBuildingCost(getBuildingCost('woodcutters_lodge'))})`;
    }
    if (stats.mode === 'stone_quarry') {
      return `Click terrain to place a stonecutter's camp (${formatBuildingCost(getBuildingCost('stone_quarry'))})`;
    }
    if (stats.mode === 'residences') {
      return stats.statusDetail ?? 'Click four corners — the 4th click closes the rectangle back to the 1st';
    }
    if (stats.mode !== 'road') return 'Road tool off';
    if (stats.canBuild) return 'Ready to build';
    if (stats.hasDraft) return 'Add more points';
    return 'Click terrain to start';
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
