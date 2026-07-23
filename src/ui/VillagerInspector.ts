import * as THREE from 'three';
import type {
  VillagerInspection,
  VillagerRenderer,
} from '../settlement/VillagerRenderer.ts';
import { disposeObject3D } from '../utils/dispose.ts';

type VillagerInspectorOptions = {
  domElement: HTMLElement;
  uiRoot: HTMLElement;
  camera: THREE.Camera;
  villagers: VillagerRenderer;
  selectionParent: THREE.Group;
  isBlocked: () => boolean;
  onSelectionChange?: (selected: boolean) => void;
};

export class VillagerInspector {
  private readonly options: VillagerInspectorOptions;
  private readonly panel: HTMLElement;
  private readonly name: HTMLElement;
  private readonly eyebrow: HTMLElement;
  private readonly activity: HTMLElement;
  private readonly initials: HTMLElement;
  private readonly occupation: HTMLElement;
  private readonly workplace: HTMLElement;
  private readonly household: HTMLElement;
  private readonly crew: HTMLElement;
  private readonly pace: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly marker: THREE.Mesh;
  private selectedPersonIdentity: string | null = null;

  constructor(options: VillagerInspectorOptions) {
    this.options = options;
    options.uiRoot.insertAdjacentHTML(
      'beforeend',
      `
        <aside class="villager-inspector-panel" data-villager-inspector hidden aria-label="Villager details">
          <header class="villager-inspector-header">
            <div class="villager-inspector-portrait" data-villager-initials aria-hidden="true">—</div>
            <div class="villager-inspector-heading">
              <p class="road-controls-eyebrow" data-villager-eyebrow>Villager</p>
              <h2 class="road-controls-title" data-villager-name>Unnamed villager</h2>
              <p class="road-controls-status" data-villager-activity>Select a villager to see what they are doing.</p>
            </div>
            <button class="villager-inspector-close" type="button" data-villager-close aria-label="Close villager details">×</button>
          </header>
          <section class="villager-inspector-current" aria-label="Current activity">
            <span>Current activity</span>
            <strong data-villager-current>—</strong>
          </section>
          <dl class="villager-inspector-stats">
            <div>
              <dt>Occupation</dt>
              <dd data-villager-occupation>—</dd>
            </div>
            <div>
              <dt>Workplace</dt>
              <dd data-villager-workplace>—</dd>
            </div>
            <div>
              <dt>Household</dt>
              <dd data-villager-household>—</dd>
            </div>
            <div>
              <dt>Crew</dt>
              <dd data-villager-crew>—</dd>
            </div>
            <div>
              <dt>Walking pace</dt>
              <dd data-villager-pace>—</dd>
            </div>
          </dl>
        </aside>
      `,
    );

    this.panel = mustElement(options.uiRoot, '[data-villager-inspector]');
    this.name = mustElement(this.panel, '[data-villager-name]');
    this.eyebrow = mustElement(this.panel, '[data-villager-eyebrow]');
    this.activity = mustElement(this.panel, '[data-villager-activity]');
    this.initials = mustElement(this.panel, '[data-villager-initials]');
    this.occupation = mustElement(this.panel, '[data-villager-occupation]');
    this.workplace = mustElement(this.panel, '[data-villager-workplace]');
    this.household = mustElement(this.panel, '[data-villager-household]');
    this.crew = mustElement(this.panel, '[data-villager-crew]');
    this.pace = mustElement(this.panel, '[data-villager-pace]');
    this.closeButton = mustButton(this.panel, '[data-villager-close]');

    this.marker = createVillagerMarker();
    this.marker.visible = false;
    options.selectionParent.add(this.marker);

    options.domElement.addEventListener('mousedown', this.onPointerDown, { capture: true });
    this.panel.addEventListener('mousedown', stopEventPropagation);
    this.closeButton.addEventListener('click', this.onClose);
  }

  tick(): void {
    if (!this.selectedPersonIdentity) return;
    const inspection = this.options.villagers.inspectVillager(this.selectedPersonIdentity);
    if (!inspection) {
      this.clearSelection();
      return;
    }
    this.render(inspection);
  }

  clearSelection(notify = false): void {
    const hadSelection = this.selectedPersonIdentity !== null;
    this.selectedPersonIdentity = null;
    this.panel.hidden = true;
    this.marker.visible = false;
    if (notify && hadSelection) this.options.onSelectionChange?.(false);
  }

  dispose(): void {
    this.options.domElement.removeEventListener('mousedown', this.onPointerDown, { capture: true });
    this.panel.removeEventListener('mousedown', stopEventPropagation);
    this.closeButton.removeEventListener('click', this.onClose);
    this.marker.removeFromParent();
    disposeObject3D(this.marker);
    this.panel.remove();
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0 || event.altKey || this.options.isBlocked()) return;
    const inspection = this.options.villagers.pickVillager(
      event.clientX,
      event.clientY,
      this.options.camera,
      this.options.domElement,
    );
    if (!inspection) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.selectedPersonIdentity = inspection.personIdentity;
    this.panel.hidden = false;
    this.render(inspection);
    this.options.onSelectionChange?.(true);
  };

  private readonly onClose = (event: MouseEvent): void => {
    event.stopPropagation();
    this.clearSelection(true);
  };

  private render(inspection: VillagerInspection): void {
    this.name.textContent = inspection.name;
    this.eyebrow.textContent = inspection.eyebrow;
    this.activity.textContent = inspection.activity;
    this.activity.dataset.state = inspection.activityState;
    this.initials.textContent = inspection.initials;
    this.occupation.textContent = inspection.occupation;
    this.workplace.textContent = inspection.workplace;
    this.household.textContent = inspection.household;
    this.crew.textContent = inspection.crew;
    this.pace.textContent = inspection.pace;
    this.marker.position.set(
      inspection.position.x,
      inspection.position.y + 2.12,
      inspection.position.z,
    );
    this.marker.rotation.y += 0.035;
    this.marker.visible = inspection.visible;
  }
}

function mustElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing villager inspector element ${selector}`);
  return element;
}

function mustButton(root: ParentNode, selector: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`Missing villager inspector button ${selector}`);
  return element;
}

function stopEventPropagation(event: MouseEvent): void {
  event.stopPropagation();
}

function createVillagerMarker(): THREE.Mesh {
  const geometry = new THREE.OctahedronGeometry(0.2, 0);
  const material = new THREE.MeshBasicMaterial({
    color: 0xe7c878,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const marker = new THREE.Mesh(geometry, material);
  marker.name = 'Selected villager beacon';
  marker.renderOrder = 13;
  return marker;
}
