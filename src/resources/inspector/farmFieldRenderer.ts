import { cropLabel, expectedFieldYield, fieldShapeEfficiency, moistureSuitability } from '../../farming/farmFieldMath.ts';
import type { FarmCrop, InspectableTarget } from '../types.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { hiddenLabor } from './renderInspectableTarget.ts';

const STAGE_LABEL = {
  ploughing: 'Ploughing',
  sowing: 'Sowing',
  growing: 'Growing',
  harvesting: 'Harvesting',
} as const;

const PRIORITY_LABEL = ['Paused', 'Normal', 'High', 'Urgent'] as const;

function cropButton(crop: FarmCrop, current: FarmCrop, disabled: boolean): string {
  return `<button type="button" class="resource-action-button" data-field-crop="${crop}" ${disabled || crop === current ? 'disabled' : ''}>${cropLabel(crop)}</button>`;
}

export function renderFarmFieldInspector(
  target: Extract<InspectableTarget, { kind: 'farm-field' }>,
  _context: InspectorRenderContext,
): InspectorView {
  const { field, farmstead } = target;
  const stageProgress = Math.max(0, Math.min(100, Math.round(field.stageProgress * 100)));
  const expectedYield = expectedFieldYield(field);
  const shape = Math.round(fieldShapeEfficiency(field.corners) * 100);
  const moistureFit = Math.round(moistureSuitability(field.crop, field.moisture) * 100);
  const active = Boolean(farmstead && farmstead.assignedLabor > 0 && field.priority > 0);
  const statusText = !farmstead
    ? 'Orphaned — farmstead missing'
    : field.priority === 0
      ? 'Paused by priority'
      : farmstead.assignedLabor === 0 && field.stage !== 'growing'
        ? 'Waiting for farmstead workers'
        : `${STAGE_LABEL[field.stage]} · ${stageProgress}%`;

  const cropControls = `<div class="inspector-action-panel">
      <p class="resource-inspector-note">Next crop — schedule rotation at any point in the cycle.</p>
      <div class="resource-action-row">${cropButton('rye', field.nextCrop, false)}${cropButton('oats', field.nextCrop, false)}${cropButton('fallow', field.nextCrop, false)}</div>
    </div>`;
  const priorityControls = `<div class="inspector-action-panel">
      <p class="resource-inspector-note">Farmstead work priority</p>
      <div class="resource-action-row">${[0, 1, 2, 3].map((priority) => `<button type="button" class="resource-action-button" data-field-priority="${priority}" ${priority === field.priority ? 'disabled' : ''}>${PRIORITY_LABEL[priority]}</button>`).join('')}</div>
    </div>`;

  return {
    eyebrow: 'Farm field',
    title: `${cropLabel(field.crop)} field`,
    statusText,
    statusState: active || field.stage === 'growing' ? 'active' : 'idle',
    detailsHtml: `
      <li><span>Area</span><span>${Math.round(field.area)} m²</span></li>
      <li><span>Stage</span><span>${STAGE_LABEL[field.stage]} · ${stageProgress}%</span></li>
      <li><span>Next crop</span><span>${cropLabel(field.nextCrop)}</span></li>
      <li><span>Priority</span><span>${PRIORITY_LABEL[field.priority] ?? 'Normal'}</span></li>
      <li><span>Farmstead</span><span>${farmstead ? `${farmstead.assignedLabor} workers · ${Math.round(farmstead.grain)} grain stored` : 'Missing'}</span></li>
      <li><span>Moisture</span><span>${Math.round(field.moisture * 100)}% · ${moistureFit}% crop fit</span></li>
      <li><span>Fertility</span><span>${Math.round(field.fertility * 100)}%</span></li>
      <li><span>Average slope</span><span>${field.averageSlopeDegrees.toFixed(1)}°</span></li>
      <li><span>Shape efficiency</span><span>${shape}%</span></li>
      <li><span>Expected harvest</span><span>${field.crop === 'fallow' ? 'Restores fertility' : `${expectedYield.toFixed(1)} grain`}</span></li>
      <li><span>Last harvest</span><span>${field.harvestCount === 0 ? 'None yet' : `${field.lastYield.toFixed(1)} grain · ${field.harvestCount} total`}</span></li>
    `,
    demolish: { visible: true, label: 'Remove field', hint: 'Clears the field boundary. Worked land is not refunded.' },
    labor: hiddenLabor(),
    supplementalPanelHtml: `${cropControls}${priorityControls}`,
  };
}
