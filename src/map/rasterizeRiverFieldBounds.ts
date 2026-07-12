import type { RiverField } from '../rivers/RiverField.ts';

export type RiverFieldSamplePoint = {
  x: number;
  z: number;
  row: number;
  column: number;
};

export function forEachRiverFieldSample(
  riverField: RiverField,
  resolution: number,
  callback: (point: RiverFieldSamplePoint) => void,
): void {
  const { startX, startZ, spanX, spanZ } = riverField;
  const rowDenominator = Math.max(resolution - 1, 1);
  const columnDenominator = Math.max(resolution - 1, 1);

  for (let row = 0; row < resolution; row++) {
    const z = startZ + (row / rowDenominator) * spanZ;
    for (let column = 0; column < resolution; column++) {
      const x = startX + (column / columnDenominator) * spanX;
      callback({ x, z, row, column });
    }
  }
}

export function mapRiverFieldRowForPlaneGeometry(row: number, resolution: number): number {
  return resolution - 1 - row;
}
