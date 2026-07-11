import type { BuildingState, BurgageZoneState } from '../resources/types.ts';
import { AmbientAudio } from './AmbientAudio.ts';
import { buildSettlementZones, evaluateAmbientRules, type AmbientRuleState } from './ambientRules.ts';

export type AmbientAudioControllerConfig = {
  getCameraTarget: () => { x: number; z: number };
  getOrbitDistance: () => number;
  getBuildings: () => Iterable<BuildingState>;
  getBurgageZones: () => Iterable<BurgageZoneState>;
  unlockElement: HTMLElement;
};

export class AmbientAudioController {
  private readonly audio = new AmbientAudio();
  private readonly config: AmbientAudioControllerConfig;
  private readonly ambientRuleState: AmbientRuleState = { overviewActive: false, villageActive: false };
  private lastAmbientEvalAtMs = 0;
  private lastSettlementSignature = '';
  private settlementZones: ReturnType<typeof buildSettlementZones> = [];
  private running = false;
  private unlocked = false;
  private readonly onUnlock = (): void => {
    if (this.unlocked) return;
    this.unlocked = true;
    this.start();
  };

  constructor(config: AmbientAudioControllerConfig) {
    this.config = config;
    config.unlockElement.addEventListener('pointerdown', this.onUnlock, { capture: true });
    window.addEventListener('keydown', this.onUnlock, { capture: true });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastAmbientEvalAtMs = 0;
  }

  tick(dtSeconds: number): void {
    if (!this.running || !this.audio.getEnabled()) return;
    const nowMs = performance.now();
    if (nowMs - this.lastAmbientEvalAtMs >= 100) {
      this.lastAmbientEvalAtMs = nowMs;
      this.refreshSettlementZones();
      const ambient = evaluateAmbientRules({
        settlementZones: this.settlementZones,
        cameraTarget: this.config.getCameraTarget(),
        orbitDistance: this.config.getOrbitDistance(),
        previous: this.ambientRuleState,
      });
      this.ambientRuleState.overviewActive = ambient.state.overviewActive;
      this.ambientRuleState.villageActive = ambient.state.villageActive;
      this.audio.setAmbientMix({
        baseLayer: ambient.baseLayer,
        overlayLayer: ambient.overlayLayer,
      });
    }
    this.audio.tick(dtSeconds);
  }

  setEnabled(enabled: boolean): void {
    this.audio.setEnabled(enabled);
    if (!enabled) {
      this.running = false;
    } else if (this.unlocked) {
      this.start();
    }
  }

  dispose(): void {
    this.config.unlockElement.removeEventListener('pointerdown', this.onUnlock, { capture: true });
    window.removeEventListener('keydown', this.onUnlock, { capture: true });
    this.audio.dispose();
    this.running = false;
    this.unlocked = false;
  }

  private refreshSettlementZones(): void {
    const buildings = [...this.config.getBuildings()];
    const burgageZones = [...this.config.getBurgageZones()];
    const signature = settlementSignature(buildings, burgageZones);
    if (signature === this.lastSettlementSignature) return;
    this.lastSettlementSignature = signature;
    this.settlementZones = buildSettlementZones(buildings, burgageZones);
  }
}

function settlementSignature(buildings: BuildingState[], burgageZones: BurgageZoneState[]): string {
  const buildingPart = buildings
    .map((building) => `${building.kind}:${building.x.toFixed(2)}:${building.z.toFixed(2)}:${building.workRadius}`)
    .sort()
    .join('|');
  const zonePart = burgageZones
    .map((zone) => (
      `${zone.id}:${zone.cornerA.x.toFixed(2)},${zone.cornerA.z.toFixed(2)}`
      + `-${zone.cornerB.x.toFixed(2)},${zone.cornerB.z.toFixed(2)}`
      + `-${zone.cornerC.x.toFixed(2)},${zone.cornerC.z.toFixed(2)}`
      + `-${zone.cornerD.x.toFixed(2)},${zone.cornerD.z.toFixed(2)}`
    ))
    .sort()
    .join('|');
  return `${buildingPart}§${zonePart}`;
}
