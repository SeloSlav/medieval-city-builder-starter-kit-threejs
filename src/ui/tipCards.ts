import { areTipCardsDisabled } from './tipCardsPreference.ts';

export type TipCardId = 'rts' | 'fp' | 'road';

export type TipCardContext = {
  firstPersonActive: boolean;
  hudMode: 'road' | 'idle';
  /** Keep builder instructions visible even when tips are turned off in the menu. */
  builderModeActive?: boolean;
};

export function resolveActiveTipCard(ctx: TipCardContext): TipCardId | null {
  if (ctx.firstPersonActive) return 'fp';
  if (ctx.hudMode === 'road') return 'road';
  return 'rts';
}

/** Show exactly one contextual tip card, or none when tips are disabled. */
export function syncTipCardVisibility(root: ParentNode, ctx: TipCardContext): void {
  const activeId = areTipCardsDisabled() && !ctx.builderModeActive ? null : resolveActiveTipCard(ctx);
  for (const element of root.querySelectorAll<HTMLElement>('[data-tip-card]')) {
    element.hidden = element.dataset.tipCard !== activeId;
  }
}
