import type { DayNightGrade } from '../world/dayNightPresentation.ts';

export const DEFAULT_DAY_NIGHT_GRADE: DayNightGrade = {
  saturation: 1.02,
  contrast: 1.03,
  warmth: 0.18,
  nightBlue: 0,
  vignette: 0.1,
};

export function applyDayNightGradeUniforms(
  uniforms: Record<string, { value: number }>,
  grade: DayNightGrade,
): void {
  uniforms.saturation.value = grade.saturation;
  uniforms.contrast.value = grade.contrast;
  uniforms.warmth.value = grade.warmth;
  uniforms.nightBlue.value = grade.nightBlue;
  uniforms.vignette.value = grade.vignette;
}
