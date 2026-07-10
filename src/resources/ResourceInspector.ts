import * as THREE from 'three';
import type { TerrainProjector } from '../terrain/TerrainProjector.ts';
import type { SceneManager } from '../scene/SceneManager.ts';
import { disposeObject3D } from '../utils/dispose.ts';
import { formatResourceAmount } from './yields.ts';
import {
  buildingSalvageRefund,
  formatBuildingCost,
  getBuildingCost,
  residenceZoneCost,
  residenceZoneSalvageRefund,
  STONE_SALVAGE_FRACTION,
  TIMBER_SALVAGE_FRACTION,
} from './buildingEconomy.ts';
import { getBuildingDefinition } from './buildings.ts';
import {
  buildingAcceptsLabor,
  buildingStorageCaps,
  maxAssignableLabor,
  RESIDENCE_FIREWOOD_CAPACITY,
  residenceNeedsStatus,
  type PopulationStats,
  type ResourceTotals,
} from './resourceTotals.ts';
import type { GameState, InspectableTarget } from './types.ts';
import type { WorldQueries } from './WorldQueries.ts';

type ResourceInspectorOptions = {
  domElement: HTMLElement;
  uiRoot: HTMLElement;
  sceneManager: SceneManager;
  terrainProjector: TerrainProjector;
  worldQueries: WorldQueries;
  getState: () => GameState;
  onDemolishBuilding?: (buildingId: string) => void | Promise<void>;
  onDemolishBurgageZone?: (zoneId: string) => void | Promise<void>;
  onAssignBuildingLabor?: (buildingId: string, labor: number) => void | Promise<void>;
  isBlocked: () => boolean;
};

export class ResourceInspector {
  private readonly options: ResourceInspectorOptions;
  private readonly panel: HTMLElement;
  private readonly eyebrow: HTMLElement;
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly detailList: HTMLElement;
  private readonly stockpileRoot: HTMLElement;
  private readonly stockpileValues: Record<'timber' | 'stone' | 'firewood', HTMLElement>;
  private readonly populationValue: HTMLElement;
  private readonly laborValue: HTMLElement;
  private readonly demolishSection: HTMLElement;
  private readonly demolishButton: HTMLButtonElement;
  private readonly demolishHint: HTMLElement;
  private readonly laborSection: HTMLElement;
  private readonly laborCount: HTMLElement;
  private readonly laborHint: HTMLElement;
  private readonly laborDecrease: HTMLButtonElement;
  private readonly laborIncrease: HTMLButtonElement;
  private readonly marker: THREE.Mesh;
  private selectedTarget: InspectableTarget | null = null;
  private selectedX = 0;
  private selectedZ = 0;
  private selectedRadius = 6;
  private populationStats: PopulationStats = { total: 0, assigned: 0, available: 0 };

  constructor(options: ResourceInspectorOptions) {
    this.options = options;

    options.uiRoot.insertAdjacentHTML(
      'beforeend',
      `
      <div class="resource-stockpile-hud" data-resource-stockpile aria-label="Resources">
        <div class="resource-stockpile-item" data-resource="timber">
          <span class="resource-stockpile-label">Timber</span>
          <strong data-stockpile="timber">0</strong>
        </div>
        <div class="resource-stockpile-item" data-resource="stone">
          <span class="resource-stockpile-label">Stone</span>
          <strong data-stockpile="stone">0</strong>
        </div>
        <div class="resource-stockpile-item" data-resource="firewood">
          <span class="resource-stockpile-label">Firewood</span>
          <strong data-stockpile="firewood">0</strong>
        </div>
        <div class="resource-stockpile-item resource-stockpile-item--population" data-resource="population">
          <span class="resource-stockpile-label">Population</span>
          <strong data-stockpile="population">0</strong>
          <span class="resource-stockpile-sub" data-stockpile="labor">0 labor free</span>
        </div>
      </div>

      <aside class="resource-inspector-panel" data-resource-inspector hidden aria-label="Resource inspector">
        <header class="road-controls-header">
          <div>
            <p class="road-controls-eyebrow" data-inspector-eyebrow>Resources</p>
            <h2 class="road-controls-title" data-inspector-title>Select a site</h2>
            <p class="road-controls-status" data-inspector-status>Click terrain to inspect quarries, buildings, residences, or river access.</p>
          </div>
        </header>
        <section class="resource-inspector-details" aria-label="Resource details">
          <ul class="road-controls-list" data-inspector-details></ul>
        </section>
        <section class="resource-inspector-labor" data-inspector-labor hidden aria-label="Labor assignment">
          <div class="resource-inspector-labor-row">
            <span>Assigned labor</span>
            <div class="resource-inspector-labor-controls">
              <button type="button" class="resource-inspector-labor-button" data-action="labor-decrease" aria-label="Decrease labor">−</button>
              <strong data-inspector-labor-count>0</strong>
              <button type="button" class="resource-inspector-labor-button" data-action="labor-increase" aria-label="Increase labor">+</button>
            </div>
          </div>
          <p class="resource-inspector-labor-hint" data-inspector-labor-hint></p>
        </section>
        <section class="resource-inspector-actions" data-inspector-actions hidden aria-label="Building actions">
          <button type="button" class="resource-inspector-demolish" data-action="demolish-building">
            Demolish
          </button>
          <p class="resource-inspector-demolish-hint" data-demolish-hint></p>
        </section>
      </aside>
    `,
    );

    this.panel = this.mustElement(options.uiRoot, '[data-resource-inspector]');
    this.eyebrow = this.mustElement(options.uiRoot, '[data-inspector-eyebrow]');
    this.title = this.mustElement(options.uiRoot, '[data-inspector-title]');
    this.status = this.mustElement(options.uiRoot, '[data-inspector-status]');
    this.detailList = this.mustElement(options.uiRoot, '[data-inspector-details]');
    this.stockpileRoot = this.mustElement(options.uiRoot, '[data-resource-stockpile]');
    this.stockpileValues = {
      timber: this.mustElement(options.uiRoot, '[data-stockpile="timber"]'),
      stone: this.mustElement(options.uiRoot, '[data-stockpile="stone"]'),
      firewood: this.mustElement(options.uiRoot, '[data-stockpile="firewood"]'),
    };
    this.populationValue = this.mustElement(options.uiRoot, '[data-stockpile="population"]');
    this.laborValue = this.mustElement(options.uiRoot, '[data-stockpile="labor"]');
    this.demolishSection = this.mustElement(options.uiRoot, '[data-inspector-actions]');
    this.demolishButton = this.mustButton(options.uiRoot, '[data-action="demolish-building"]');
    this.demolishHint = this.mustElement(options.uiRoot, '[data-demolish-hint]');
    this.laborSection = this.mustElement(options.uiRoot, '[data-inspector-labor]');
    this.laborCount = this.mustElement(options.uiRoot, '[data-inspector-labor-count]');
    this.laborHint = this.mustElement(options.uiRoot, '[data-inspector-labor-hint]');
    this.laborDecrease = this.mustButton(options.uiRoot, '[data-action="labor-decrease"]');
    this.laborIncrease = this.mustButton(options.uiRoot, '[data-action="labor-increase"]');

    this.marker = createSelectionMarker();
    options.sceneManager.selectionGroup.add(this.marker);
    this.marker.visible = false;

    options.domElement.addEventListener('mousedown', this.onPointerDown, { capture: true });
    this.demolishButton.addEventListener('click', this.onDemolishClick);
    this.laborDecrease.addEventListener('click', this.onLaborDecrease);
    this.laborIncrease.addEventListener('click', this.onLaborIncrease);
  }

  private readonly onDemolishClick = (): void => {
    if (!this.selectedTarget) return;
    if (this.selectedTarget.kind === 'building') {
      void this.options.onDemolishBuilding?.(this.selectedTarget.building.id);
      return;
    }
    if (this.selectedTarget.kind === 'residence') {
      void this.options.onDemolishBurgageZone?.(this.selectedTarget.zone.id);
    }
  };

  private readonly onLaborDecrease = (): void => {
    if (this.selectedTarget?.kind !== 'building') return;
    const building = this.selectedTarget.building;
    void this.options.onAssignBuildingLabor?.(building.id, Math.max(0, building.assignedLabor - 1));
  };

  private readonly onLaborIncrease = (): void => {
    if (this.selectedTarget?.kind !== 'building') return;
    const building = this.selectedTarget.building;
    const maxLabor = maxAssignableLabor(building, this.populationStats);
    void this.options.onAssignBuildingLabor?.(building.id, Math.min(maxLabor, building.assignedLabor + 1));
  };

  setHud(totals: ResourceTotals, population: PopulationStats): void {
    this.populationStats = population;
    this.stockpileValues.timber.textContent = Math.round(totals.timber).toString();
    this.stockpileValues.stone.textContent = Math.round(totals.stone).toString();
    this.stockpileValues.firewood.textContent = Math.round(totals.firewood).toString();
    this.populationValue.textContent = population.total.toString();
    this.laborValue.textContent = `${population.available} labor free`;
  }

  selectQuarry(quarryId: string): void {
    const target = this.options.worldQueries.findQuarryTarget(quarryId);
    if (!target) return;
    this.selectTarget(target);
  }

  refreshSelection(): void {
    if (!this.selectedTarget) return;
    const latest = this.options.worldQueries.findInspectableTarget(this.selectedX, this.selectedZ);
    if (!latest) {
      this.clearSelection(false);
      return;
    }
    if (this.selectedTarget.kind === 'building' && latest.kind === 'building' && latest.building.id === this.selectedTarget.building.id) {
      this.selectedTarget = latest;
      this.renderTarget(latest);
      return;
    }
    if (this.selectedTarget.kind === 'residence' && latest.kind === 'residence' && latest.zone.id === this.selectedTarget.zone.id) {
      this.selectedTarget = latest;
      this.renderTarget(latest);
      return;
    }
    if (this.selectedTarget.kind === 'quarry' && latest.kind === 'quarry' && latest.definition.id === this.selectedTarget.definition.id) {
      this.selectedTarget = latest;
      this.renderTarget(latest);
      return;
    }
    if (this.selectedTarget.kind === 'river' && latest.kind === 'river') {
      this.selectedTarget = latest;
      this.renderTarget(latest);
      return;
    }
    this.clearSelection(false);
  }

  dispose(): void {
    this.options.domElement.removeEventListener('mousedown', this.onPointerDown, { capture: true });
    this.demolishButton.removeEventListener('click', this.onDemolishClick);
    this.laborDecrease.removeEventListener('click', this.onLaborDecrease);
    this.laborIncrease.removeEventListener('click', this.onLaborIncrease);
    this.options.sceneManager.selectionGroup.remove(this.marker);
    disposeObject3D(this.marker);
    this.panel.remove();
    this.stockpileRoot.remove();
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    if (this.options.isBlocked()) return;
    if (event.altKey) return;

    const point = this.options.terrainProjector.pick(event.clientX, event.clientY);
    if (!point) return;

    const target = this.options.worldQueries.findInspectableTarget(point.x, point.z);
    if (!target) {
      this.clearSelection(true);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.selectTarget(target);
  };

  private selectTarget(target: InspectableTarget): void {
    this.selectedTarget = target;
    if (target.kind === 'quarry') {
      this.selectedX = target.definition.x;
      this.selectedZ = target.definition.z;
      this.selectedRadius = target.definition.pickRadius * 0.42;
    } else if (target.kind === 'building') {
      this.selectedX = target.building.x;
      this.selectedZ = target.building.z;
      this.selectedRadius = target.building.workRadius * 0.42;
    } else if (target.kind === 'residence') {
      this.selectedX = target.residence.x;
      this.selectedZ = target.residence.z;
      this.selectedRadius = 4.2;
    } else {
      this.selectedX = target.x;
      this.selectedZ = target.z;
      this.selectedRadius = 6;
    }
    this.renderTarget(target);
    this.updateMarker();
    this.panel.hidden = false;
  }

  private clearSelection(hidePanel: boolean): void {
    this.selectedTarget = null;
    this.marker.visible = false;
    this.demolishSection.hidden = true;
    this.laborSection.hidden = true;
    if (hidePanel) this.panel.hidden = true;
  }

  private renderTarget(target: InspectableTarget): void {
    if (target.kind === 'quarry') {
      this.laborSection.hidden = true;
      this.demolishSection.hidden = true;
      const { definition, state } = target;
      this.eyebrow.textContent = 'Quarry';
      this.title.textContent = definition.label;
      this.status.textContent = `${Math.round(state.remaining)} / ${Math.round(state.maxYield)} stone remaining`;
      this.status.dataset.state = state.remaining > 0 ? 'active' : 'idle';

      const nearestRoad = this.options.worldQueries.getNearestRoadNodeDistance(definition.x, definition.z);
      this.detailList.innerHTML = `
        <li><span>Resource</span><span>stone</span></li>
        <li><span>Site ID</span><span>${definition.id}</span></li>
        <li><span>Yield left</span><span>${Math.round(state.remaining)}</span></li>
        <li><span>Nearest road</span><span>${nearestRoad == null ? 'None nearby' : `${nearestRoad.toFixed(1)} m`}</span></li>
      `;
      return;
    }

    if (target.kind === 'building') {
      const { building, matureTrees, stumpTrees, growingTrees } = target;
      const label = this.options.worldQueries.getBuildingLabel(building.kind);
      this.eyebrow.textContent = 'Building';
      this.title.textContent = label;
      const definition = getBuildingDefinition(building.kind);
      const cost = getBuildingCost(building.kind);
      const refund = buildingSalvageRefund(building.kind);
      const caps = buildingStorageCaps(building.kind);
      const acceptsLabor = buildingAcceptsLabor(building.kind);
      const maxLabor = maxAssignableLabor(building, this.populationStats);

      this.demolishSection.hidden = false;
      this.demolishHint.textContent =
        `Salvages about ${refund.timber} timber and ${refund.stone} stone (${Math.round(STONE_SALVAGE_FRACTION * 100)}% stone, ${Math.round(TIMBER_SALVAGE_FRACTION * 100)}% timber of ${formatBuildingCost(cost)}).`;

      if (acceptsLabor) {
        this.laborSection.hidden = false;
        this.laborCount.textContent = building.assignedLabor.toString();
        this.laborHint.textContent = `${this.populationStats.available} workers available (${this.populationStats.total} population, ${this.populationStats.assigned} assigned).`;
        this.laborDecrease.disabled = building.assignedLabor <= 0;
        this.laborIncrease.disabled = building.assignedLabor >= maxLabor;
      } else {
        this.laborSection.hidden = true;
      }

      const storageRows = [
        caps.timber > 0 ? `<li><span>Timber stored</span><span>${Math.round(building.timber)} / ${caps.timber}</span></li>` : '',
        caps.firewood > 0 ? `<li><span>Firewood stored</span><span>${Math.round(building.firewood)} / ${caps.firewood}</span></li>` : '',
        caps.stone > 0 ? `<li><span>Stone stored</span><span>${Math.round(building.stone)} / ${caps.stone}</span></li>` : '',
      ].filter(Boolean).join('');

      const roadAccess = this.options.worldQueries.getRoadAccessLabel(building.x, building.z);
      const roadAccessRow = `<li><span>Road access</span><span>${roadAccess}</span></li>`;

      if (building.kind === 'lumber_mill') {
        const active = building.assignedLabor > 0 && matureTrees > 0;
        this.status.textContent = building.assignedLabor === 0
          ? 'Idle — assign labor to harvest timber'
          : matureTrees > 0
            ? `Harvesting — ${matureTrees} mature trees in range`
            : 'Idle — no mature trees in range';
        this.status.dataset.state = active ? 'active' : 'idle';

        this.detailList.innerHTML = `
        <li><span>Kind</span><span>${building.kind}</span></li>
        <li><span>Build cost</span><span>${formatBuildingCost(cost)}</span></li>
        ${roadAccessRow}
        <li><span>Work radius</span><span>${definition.workRadius} m</span></li>
        <li><span>Mature trees</span><span>${matureTrees}</span></li>
        <li><span>Stumps</span><span>${stumpTrees}</span></li>
        <li><span>Growing saplings</span><span>${growingTrees}</span></li>
        ${storageRows}
      `;
        return;
      }

      if (building.kind === 'woodcutters_lodge') {
        const connectedMills = this.options.worldQueries.getRoadConnectedMills(building);
        const connectedResidences = this.options.worldQueries.getRoadConnectedResidencesForLodge(building);
        const millsWithTimber = connectedMills.filter((mill) => mill.timber > 0).length;
        const onRoad = roadAccess.startsWith('Connected');
        const active = building.assignedLabor > 0 && onRoad && millsWithTimber > 0 && connectedResidences.length > 0;

        if (!onRoad) {
          this.status.textContent = 'Not connected — place near a road and link with paths';
          this.status.dataset.state = 'idle';
        } else if (building.assignedLabor === 0) {
          this.status.textContent = 'Idle — assign labor to process timber into firewood';
          this.status.dataset.state = 'idle';
        } else if (connectedMills.length === 0) {
          this.status.textContent = 'No road-linked lumber mills — connect a mill by road';
          this.status.dataset.state = 'warning';
        } else if (millsWithTimber === 0) {
          this.status.textContent = 'Road-linked mills have no timber yet';
          this.status.dataset.state = 'warning';
        } else if (connectedResidences.length === 0) {
          this.status.textContent = 'No road-linked residences to deliver firewood';
          this.status.dataset.state = 'warning';
        } else if (building.firewood >= caps.firewood) {
          this.status.textContent = 'Storage full — residences cannot accept more yet';
          this.status.dataset.state = 'idle';
        } else if (building.timber <= 0) {
          this.status.textContent = `Pulling timber from ${millsWithTimber} road-linked mill${millsWithTimber === 1 ? '' : 's'}`;
          this.status.dataset.state = 'active';
        } else {
          this.status.textContent = `Processing and delivering to ${connectedResidences.length} road-linked cottage${connectedResidences.length === 1 ? '' : 's'}`;
          this.status.dataset.state = active ? 'active' : 'idle';
        }

        const millSummary = connectedMills.length === 0
          ? 'None'
          : `${connectedMills.length} linked (${millsWithTimber} with timber)`;
        const residenceSummary = connectedResidences.length === 0
          ? 'None'
          : `${connectedResidences.length} linked`;

        this.detailList.innerHTML = `
        <li><span>Kind</span><span>${building.kind}</span></li>
        <li><span>Build cost</span><span>${formatBuildingCost(cost)}</span></li>
        ${roadAccessRow}
        <li><span>Road-linked mills</span><span>${millSummary}</span></li>
        <li><span>Road-linked cottages</span><span>${residenceSummary}</span></li>
        <li><span>Process interval</span><span>${definition.harvestInterval}s</span></li>
        ${storageRows}
      `;
        return;
      }

      if (building.kind === 'stone_quarry') {
        const nearestQuarry = this.options.worldQueries.findNearestQuarryWithRemaining(building.x, building.z, building.workRadius);
        const active = building.assignedLabor > 0 && nearestQuarry != null;
        this.status.textContent = building.assignedLabor === 0
          ? 'Idle — assign labor to extract stone'
          : nearestQuarry
            ? `Extracting — ${Math.round(nearestQuarry.remaining)} stone left at site`
            : 'Idle — no quarry stone in range';
        this.status.dataset.state = active ? 'active' : 'idle';

        this.detailList.innerHTML = `
        <li><span>Kind</span><span>${building.kind}</span></li>
        <li><span>Build cost</span><span>${formatBuildingCost(cost)}</span></li>
        <li><span>Work radius</span><span>${definition.workRadius} m</span></li>
        <li><span>Harvest interval</span><span>${definition.harvestInterval}s</span></li>
        ${storageRows}
      `;
        return;
      }

      this.status.textContent = stumpTrees + growingTrees > 0
        ? `Reforesting — ${stumpTrees} stumps, ${growingTrees} growing`
        : 'Idle — no stumps in range';
      this.status.dataset.state = stumpTrees + growingTrees > 0 ? 'active' : 'draft';

      this.detailList.innerHTML = `
        <li><span>Kind</span><span>${building.kind}</span></li>
        <li><span>Build cost</span><span>${formatBuildingCost(cost)}</span></li>
        <li><span>Work radius</span><span>${definition.workRadius} m</span></li>
        <li><span>Mature trees</span><span>${matureTrees}</span></li>
        <li><span>Stumps</span><span>${stumpTrees}</span></li>
        <li><span>Growing saplings</span><span>${growingTrees}</span></li>
        ${storageRows}
      `;
      return;
    }

    if (target.kind === 'residence') {
      const { residence, zone, residenceCount } = target;
      const cost = residenceZoneCost(residenceCount);
      const refund = residenceZoneSalvageRefund(residenceCount);
      const needs = residenceNeedsStatus(residence);
      this.eyebrow.textContent = 'Residence';
      this.title.textContent = residence.abandoned
        ? 'Abandoned cottage'
        : residenceCount === 1
          ? 'Burgage cottage'
          : `Burgage zone (${residenceCount} cottages)`;
      this.status.textContent = needs.label;
      this.status.dataset.state = needs.state;
      this.demolishSection.hidden = false;
      this.laborSection.hidden = true;
      this.demolishHint.textContent =
        `Removes the whole zone and salvages about ${refund.timber} timber and ${refund.stone} stone (${Math.round(STONE_SALVAGE_FRACTION * 100)}% stone, ${Math.round(TIMBER_SALVAGE_FRACTION * 100)}% timber of ${formatBuildingCost(cost)}).`;

      const nearestRoad = this.options.worldQueries.getNearestRoadNodeDistance(residence.x, residence.z);
      const roadAccess = this.options.worldQueries.getRoadAccessLabel(residence.x, residence.z);
      this.detailList.innerHTML = `
        <li><span>Zone plots</span><span>${zone.plotCount}</span></li>
        <li><span>Cottages</span><span>${residenceCount}</span></li>
        <li><span>Parcel</span><span>#${residence.parcelIndex + 1}</span></li>
        <li><span>Population</span><span>${residence.abandoned ? 0 : residence.population}</span></li>
        <li><span>Firewood stock</span><span>${Math.round(residence.firewoodStock)} / ${RESIDENCE_FIREWOOD_CAPACITY}</span></li>
        <li><span>Road access</span><span>${roadAccess}</span></li>
        <li><span>Build cost</span><span>${formatBuildingCost(cost)}</span></li>
        <li><span>Nearest road</span><span>${nearestRoad == null ? 'None nearby' : `${nearestRoad.toFixed(1)} m`}</span></li>
      `;
      return;
    }

    this.eyebrow.textContent = 'River';
    this.demolishSection.hidden = true;
    this.laborSection.hidden = true;
    this.title.textContent = target.onWater ? 'Open water' : 'River access';
    this.status.textContent = target.onWater
      ? 'Direct water access — useful for mills and wells.'
      : `Shoreline access (${target.shoreDistance.toFixed(1)} m from bank)`;
    this.status.dataset.state = 'active';
    this.detailList.innerHTML = `
      <li><span>Resource</span><span>water</span></li>
      <li><span>On water</span><span>${target.onWater ? 'Yes' : 'No'}</span></li>
      <li><span>Shore distance</span><span>${target.shoreDistance.toFixed(1)} m</span></li>
      <li><span>Stored water</span><span>${formatResourceAmount('water', 0)}</span></li>
    `;
  }

  private updateMarker(): void {
    const y = this.options.sceneManager.terrain.getHeightAt(this.selectedX, this.selectedZ) + 0.35;
    this.marker.scale.set(this.selectedRadius, 1, this.selectedRadius);
    this.marker.position.set(this.selectedX, y, this.selectedZ);
    this.marker.visible = true;
  }

  private mustElement(root: HTMLElement, selector: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing resource inspector element ${selector}`);
    return element;
  }

  private mustButton(root: HTMLElement, selector: string): HTMLButtonElement {
    const element = root.querySelector<HTMLButtonElement>(selector);
    if (!element) throw new Error(`Missing resource inspector button ${selector}`);
    return element;
  }
}

function createSelectionMarker(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.72, 1, 48);
  geometry.rotateX(-Math.PI * 0.5);
  const material = new THREE.MeshBasicMaterial({
    color: 0xd7b463,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Resource selection marker';
  mesh.renderOrder = 12;
  return mesh;
}
