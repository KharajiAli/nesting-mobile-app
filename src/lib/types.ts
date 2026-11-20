// Shared plain-data types. Everything here is offline, serializable, no native deps.

export interface OutlinePoint {
  x: number;
  y: number;
}

/** Rectified outline + the image it must be drawn on top of. */
export interface RectifiedResult {
  /** Outline points in display-image pixel space, ordered around the shape, 30-50 pts. */
  points: OutlinePoint[];
  /** Pixel size of the display image the points refer to. */
  spaceW: number;
  spaceH: number;
  /** Photo to show: rectified (warped) file when perspective fix worked, else original. */
  displayUri: string;
  /** True when the outline was perspective-rectified with getPerspectiveTransform. */
  usedWarp: boolean;
  debug: {
    workW: number;
    workH: number;
    contourAreaPx: number;
    perimeterPx: number;
    epsilonPx: number;
    pointCount: number;
  };
}

/** The 5 tape measurements, all in cm. */
export interface Measurements {
  /** A: total length, left side, top corner to bottom corner. */
  A: number;
  /** B: top width, left to right at the top. */
  B: number;
  /** C: width at 50% down from the top. */
  C: number;
  /** D: width at 75% down from the top. */
  D: number;
  /** E: bottom width. */
  E: number;
}

export type MeasurementKey = keyof Measurements;

export const MEASUREMENT_KEYS: MeasurementKey[] = ['A', 'B', 'C', 'D', 'E'];
