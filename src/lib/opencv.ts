// OpenCV outline detection, via react-native-fast-opencv.
//
// Pipeline (per spec, in this order):
//   grayscale -> Gaussian blur -> threshold (brown carton vs light sheet)
//   -> Canny -> findContours -> largest contour -> approxPolyDP (30-50 pts)
// Then perspective fix with getPerspectiveTransform + warpPerspective.
//
// Runtime note: react-native-fast-opencv only works in an Expo Dev Build,
// never in Expo Go. The native module is loaded with a guarded require() so
// the app still opens without it (camera UI works, detection reports
// 'no-native' instead of crashing at import time). Type-only imports keep
// this file type-checked without touching native code at load.

import * as FileSystem from 'expo-file-system/legacy';
import { applyHomography, orderQuad, resamplePolygon } from './geometry';
import type { OutlinePoint, RectifiedResult } from './types';

declare const require: (id: string) => any;

interface CvModule {
  OpenCV: any;
  Mat: any;
  Point2f: any;
  Point2fVector: any;
  PointVector: any;
  PointVectorOfVectors: any;
  Size: any;
  Scalar: any;
  ColorConversionCodes: any;
  ThresholdTypes: any;
  RetrievalModes: any;
  ContourApproximationModes: any;
  InterpolationFlags: any;
  BorderTypes: any;
  DecompTypes: any;
}

function loadCv(): CvModule | null {
  try {
    const mod = require('react-native-fast-opencv');
    if (mod && mod.OpenCV && typeof mod.OpenCV.cvtColor === 'function') {
      return mod as CvModule;
    }
    return null;
  } catch {
    return null;
  }
}

export function isOpenCvAvailable(): boolean {
  return loadCv() !== null;
}

export type DetectResult = { ok: true; result: RectifiedResult } | { ok: false; reason: string };

const MAX_WORK_WIDTH = 1280;
const TARGET_POINTS = 40;
const MIN_POINTS = 30;
const MAX_POINTS = 50;
const CANNY_LOW = 50;
const CANNY_HIGH = 150;

function stripDataPrefix(base64: string): string {
  return base64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
}

interface Attempt {
  thresh: any;
  edges: any;
  contours: any;
  bestIndex: number;
  bestArea: number;
}

export async function detectAndRectify(
  photoBase64: string,
  originalUri: string,
): Promise<DetectResult> {
  const cv = loadCv();
  if (!cv) {
    return {
      ok: false,
      reason:
        'OpenCV is not linked. Open this app in a Dev Build with "npx expo start --dev-client" (OpenCV does not work in Expo Go).',
    };
  }

  const created: Array<{ release?: () => void }> = [];
  const track = <T extends { release?: () => void }>(o: T): T => {
    if (o) created.push(o);
    return o;
  };
  const releaseAll = () => {
    for (const o of created) {
      try {
        o.release?.();
      } catch {
        // ignore: GC reclaims native memory anyway
      }
    }
    created.length = 0;
  };

  const fail = (reason: string): DetectResult => {
    releaseAll();
    return { ok: false, reason };
  };

  try {
    const clean = stripDataPrefix(photoBase64);
    if (clean.length < 1000) return fail('The photo data is empty. Please retake the photo.');

    const src = track(cv.Mat.createFromBase64(clean));
    if (!src || src.cols <= 0 || src.rows <= 0) {
      return fail('Could not decode the photo. Please retake it.');
    }

    // Downscale wide photos so one-shot detection stays fast. Scaling uses
    // ratios, so absolute pixel size does not affect the DXF.
    let work = src;
    let workW = src.cols;
    let workH = src.rows;
    if (src.cols > MAX_WORK_WIDTH) {
      workW = MAX_WORK_WIDTH;
      workH = Math.max(1, Math.round((src.rows * MAX_WORK_WIDTH) / src.cols));
      const down = track(cv.Mat.create());
      cv.OpenCV.resize(
        src,
        down,
        cv.Size.create(workW, workH),
        0,
        0,
        cv.InterpolationFlags.INTER_LINEAR,
      );
      work = down;
    }

    const gray = track(cv.Mat.create());
    cv.OpenCV.cvtColor(work, gray, cv.ColorConversionCodes.COLOR_BGR2GRAY);

    const blurred = track(cv.Mat.create());
    cv.OpenCV.GaussianBlur(gray, blurred, cv.Size.create(5, 5), 0);

    const minArea = workW * workH * 0.015;

    const runAttempt = (inverted: boolean): Attempt => {
      const threshType = inverted
        ? cv.ThresholdTypes.THRESH_BINARY_INV + cv.ThresholdTypes.THRESH_OTSU
        : cv.ThresholdTypes.THRESH_OTSU;
      const thresh = cv.Mat.create();
      cv.OpenCV.threshold(blurred, thresh, 0, 255, threshType);
      const edges = cv.Mat.create();
      cv.OpenCV.Canny(thresh, edges, CANNY_LOW, CANNY_HIGH);
      const contours = cv.PointVectorOfVectors.create();
      cv.OpenCV.findContours(
        edges,
        contours,
        cv.RetrievalModes.RETR_EXTERNAL,
        cv.ContourApproximationModes.CHAIN_APPROX_SIMPLE,
      );
      let bestIndex = -1;
      let bestArea = 0;
      for (let i = 0; i < contours.length; i++) {
        const area = cv.OpenCV.contourArea(contours.get(i)).value as number;
        if (area > bestArea) {
          bestArea = area;
          bestIndex = i;
        }
      }
      return { thresh, edges, contours, bestIndex, bestArea };
    };

    // Attempt 1: dark carton on a light sheet. Attempt 2: inverted polarity.
    let first = runAttempt(true);
    let second: Attempt | null = null;
    let use: Attempt = first;
    if (first.bestIndex < 0 || first.bestArea < minArea) {
      second = runAttempt(false);
      if (second.bestIndex >= 0 && second.bestArea > first.bestArea) {
        use = second;
      }
    }
    const loser = use === first ? second : first;
    for (const m of [loser?.thresh, loser?.edges, loser?.contours]) {
      try {
        m?.release?.();
      } catch {
        // ignore
      }
    }
    track(use.thresh);
    track(use.edges);
    track(use.contours);

    if (use.bestIndex < 0 || use.bestArea < minArea) {
      return fail(
        'Outline not found. Move the phone straight above the pattern, use a white sheet, add more light, and retake.',
      );
    }

    const largest = use.contours.get(use.bestIndex);
    const perimeter = cv.OpenCV.arcLength(largest, true).value as number;
    if (!(perimeter > 0)) {
      return fail(
        'Outline not found. Move the phone straight above the pattern, use a white sheet, add more light, and retake.',
      );
    }

    // Tune epsilon so the outline keeps 30-50 points and curves stay curved.
    let epsilon = perimeter * 0.008;
    let approxArr: OutlinePoint[] = [];
    let lastEpsilon = epsilon;
    for (let k = 0; k < 12; k++) {
      const approx = track(cv.PointVector.create());
      cv.OpenCV.approxPolyDP(largest, approx, epsilon, true);
      lastEpsilon = epsilon;
      const n = approx.length as number;
      approxArr = (approx.getAll() as Array<{ x: number; y: number }>).map((p) => ({
        x: p.x,
        y: p.y,
      }));
      if (n >= MIN_POINTS && n <= MAX_POINTS) break;
      if (n > MAX_POINTS) epsilon *= 1.35;
      else epsilon *= 0.7;
    }
    if (approxArr.length < 3) {
      return fail(
        'Outline not found. Move the phone straight above the pattern, use a white sheet, add more light, and retake.',
      );
    }
    let outline = approxArr;
    if (outline.length < MIN_POINTS || outline.length > MAX_POINTS) {
      outline = resamplePolygon(outline, TARGET_POINTS);
    }

    // Perspective fix: corners of the outline -> upright rectangle.
    let points = outline;
    let spaceW = workW;
    let spaceH = workH;
    let displayUri = originalUri;
    let usedWarp = false;
    try {
      const [tl, tr, br, bl] = orderQuad(outline);
      const quadW = Math.max(tl.x, tr.x, br.x, bl.x) - Math.min(tl.x, tr.x, br.x, bl.x);
      const quadH = Math.max(tl.y, tr.y, br.y, bl.y) - Math.min(tl.y, tr.y, br.y, bl.y);
      const W = Math.max(1, Math.round(quadW));
      const H = Math.max(1, Math.round(quadH));
      if (W > 20 && H > 20) {
        const srcVec = track(
          cv.Point2fVector.create([
            cv.Point2f.create(tl.x, tl.y),
            cv.Point2f.create(tr.x, tr.y),
            cv.Point2f.create(br.x, br.y),
            cv.Point2f.create(bl.x, bl.y),
          ]),
        );
        const dstVec = track(
          cv.Point2fVector.create([
            cv.Point2f.create(0, 0),
            cv.Point2f.create(W, 0),
            cv.Point2f.create(W, H),
            cv.Point2f.create(0, H),
          ]),
        );
        const M = track(
          cv.OpenCV.getPerspectiveTransform(srcVec, dstVec, cv.DecompTypes.DECOMP_LU),
        );
        const buf = M.toBuffer('float64') as { rows: number; cols: number; buffer: ArrayLike<number> };
        if (buf.rows === 3 && buf.cols === 3 && buf.buffer.length === 9) {
          const h9 = Array.from(buf.buffer);
          const mapped = outline.map((p) => applyHomography(h9, p.x, p.y));
          const warped = track(cv.Mat.create());
          cv.OpenCV.warpPerspective(
            work,
            warped,
            M,
            cv.Size.create(W, H),
            cv.InterpolationFlags.INTER_LINEAR,
            cv.BorderTypes.BORDER_CONSTANT,
            cv.Scalar.create(255, 255, 255),
          );
          let uri: string | null = null;
          try {
            const path = `${FileSystem.cacheDirectory ?? ''}rectified.jpg`;
            warped.saveToFile(path, 'jpeg', 90);
            uri = path;
          } catch {
            try {
              uri = `data:image/jpeg;base64,${warped.toBase64()}`;
            } catch {
              uri = null;
            }
          }
          if (uri) {
            const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
            points = resamplePolygon(
              mapped.map((p) => ({ x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) })),
              Math.min(MAX_POINTS, Math.max(MIN_POINTS, outline.length)),
            );
            spaceW = W;
            spaceH = H;
            displayUri = uri;
            usedWarp = true;
          }
        }
      }
    } catch {
      // Keep the unrectified outline; scaling still works, tilt error stays visible
      // in usedWarp=false for the proof test.
      points = resamplePolygon(outline, Math.min(MAX_POINTS, Math.max(MIN_POINTS, outline.length)));
    }

    const result: RectifiedResult = {
      points,
      spaceW,
      spaceH,
      displayUri,
      usedWarp,
      debug: {
        workW,
        workH,
        contourAreaPx: use.bestArea,
        perimeterPx: perimeter,
        epsilonPx: lastEpsilon,
        pointCount: points.length,
      },
    };
    releaseAll();
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(
      `Outline detection failed (${msg}). Move the phone straight above the pattern, use a white sheet, add more light, and retake.`,
    );
  }
}

/** Apply a row-major 3x3 homography to one point. Plain JS, offline. */
export { applyHomography as applyPerspectiveHomography } from './geometry';
