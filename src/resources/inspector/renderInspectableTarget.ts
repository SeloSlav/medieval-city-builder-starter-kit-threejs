import type { PopulationStats } from '../resourceTotals.ts';
import type { InspectableTarget } from '../types.ts';
import type { WorldQueries } from '../WorldQueries.ts';
import { renderBuildingInspector } from './buildingRenderer.ts';
import { renderQuarryInspector } from './quarryRenderer.ts';
import { renderResidenceInspector } from './residenceRenderer.ts';
import { renderRiverInspector } from './riverRenderer.ts';

export type InspectorLaborView = {
  visible: boolean;
  count: number;
  hint: string;
  decreaseDisabled: boolean;
  increaseDisabled: boolean;
};

export type InspectorDemolishView = {
  visible: boolean;
  label?: string;
  hint: string;
  secondary?: {
    label: string;
    hint: string;
  };
};

export type InspectorView = {
  eyebrow: string;
  title: string;
  statusText: string;
  statusState: string;
  detailsHtml: string;
  demolish: InspectorDemolishView;
  labor: InspectorLaborView;
};

export type InspectorRenderContext = {
  worldQueries: WorldQueries;
  populationStats: PopulationStats;
};

export function hiddenLabor(): InspectorLaborView {
  return {
    visible: false,
    count: 0,
    hint: '',
    decreaseDisabled: true,
    increaseDisabled: true,
  };
}

export function hiddenDemolish(): InspectorDemolishView {
  return { visible: false, hint: '' };
}

export function renderInspectableTarget(
  target: InspectableTarget,
  context: InspectorRenderContext,
): InspectorView {
  switch (target.kind) {
    case 'quarry':
      return renderQuarryInspector(target, context);
    case 'building':
      return renderBuildingInspector(target, context);
    case 'residence':
      return renderResidenceInspector(target, context);
    case 'river':
      return renderRiverInspector(target);
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
}
