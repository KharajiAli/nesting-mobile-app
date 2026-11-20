// Pure-JS geometry: ordering, scanline widths, resampling, piecewise scaling.
// Offline by design. No OpenCV here so scaling stays plain JavaScript.

import type { Measurements, OutlinePoint } from './types';

export interface LineSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Apply a row-major 3x3 homography to one point. */
export function applyHomography(h9: number[], x: number, y: number): OutlinePoint {
  const w = h9[6] * x + h9[7] * y + h9[8];
  const safeW = Math.abs(w) < 1e-9 ? 1e-9 : w;
  return {
    x: (h9[0] * x + h9[1] * y + h9[2]) / safeW,
    y: (h9[3] * x + h9[4] * y + h9[5]) / safeW,
  };
}

/** Order outline points as quad corners: [topLeft, topRight, bottomRight, bottomLeft]. */
export function orderQuad(points: OutlinePoint[]): [OutlinePoint, OutlinePoint, OutlinePoint, OutlinePoint] {
  let tl = points[0];
  let tr = points[0];
  let br = points[0];
  let bl = points[0];
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  for (const p of points) {
    const sum = p.x + p.y;
    const diff = p.x - p.y;
    if (sum < minSum) {
      minSum = sum;
      tl = p;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = p;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = p;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = p;
    }
  }
  return [tl, tr, br, bl];
}

/** Intersect a horizontal scanline with a closed polygon. Returns [leftX, rightX] or null. */
export function polygonWidthAtY(points: OutlinePoint[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    if ((y - p1.y) * (y - p2.y) <= 0 && p1.y !== p2.y) {
      const t = (y - p1.y) / (p2.y - p1.y);
      xs.push(p1.x + t * (p2.x - p1.x));
    }
  }
  if (xs.length < 2) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

export function polyPerimeter(points: OutlinePoint[], closed = true): number {
  let total = 0;
  const n = points.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Evenly resample a closed polygon to exactly n points by arc length. */
export function resamplePolygon(points: OutlinePoint[], n: number): OutlinePoint[] {
  if (points.length === 0) return [];
  if (points.length === n) return points.map((p) => ({ ...p }));
  const total = polyPerimeter(points, true);
  if (total <= 0) return points.map((p) => ({ ...p }));
  const step = total / n;
  const out: OutlinePoint[] = [];
  let acc = 0;
  let target = 0;
  let i = 0;
  // Walk edges, emitting a point every `step` px.
  let prev = points[0];
  out.push({ ...prev });
  while (out.length < n && i < points.length) {
    const next = points[(i + 1) % points.length];
    const edge = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (edge === 0) {
      i++;
      prev = next;
      continue;
    }
    target += step;
    while (acc + edge >= target - 1e-9 && out.length < n) {
      const t = (target - acc) / edge;
      out.push({ x: prev.x + t * (next.x - prev.x), y: prev.y + t * (next.y - prev.y) });
      target += step;
    }
    acc += edge;
    i++;
    prev = next;
  }
  while (out.length < n) out.push({ ...points[out.length % points.length] });
  return out.slice(0, n);
}

/** Width checkpoints with rows inset from the extreme edges, where a scanline
 *  through vertices would measure ~0px and blow up the scale. Floor-clamped. */
function checkedWidths(points: OutlinePoint[]): { B: number; C: number; D: number; E: number } {
  const box = boundingBox(points);
  const span = Math.max(1e-6, box.maxY - box.minY);
  const full = Math.max(1e-6, box.maxX - box.minX);
  const at = (f: number): number => {
    const fi = f === 0 ? 0.02 : f === 1 ? 0.98 : f;
    const w = polygonWidthAtY(points, box.minY + fi * span);
    const px = w ? w[1] - w[0] : full;
    return Math.max(px, 0.05 * full);
  };
  return { B: at(0), C: at(0.5), D: at(0.75), E: at(1) };
}

/** Scanline rows used for the displayed B/E lines (inset like the scaling). */
function checkpointRow(box: { minY: number; maxY: number }, f: number): number {
  const span = box.maxY - box.minY;
  const fi = f === 0 ? 0.02 : f === 1 ? 0.98 : f;
  return box.minY + fi * span;
}
export function boundingBox(points: OutlinePoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * The 5 measurement lines in rectified pixel space, derived from the outline:
 * A: left side top->bottom, B: top width, C: 50% width, D: 75% width, E: bottom width.
 */
export function measurementLines(
  points: OutlinePoint[],
  W: number,
  H: number,
): Record<'A' | 'B' | 'C' | 'D' | 'E', LineSeg> {
  const box = boundingBox(points);
  const at = (f: number): [number, number] => {
    const y = checkpointRow(box, f);
    const w = polygonWidthAtY(points, y);
    if (w) return w;
    return [box.minX, box.maxX];
  };
  const [topL, topR] = at(0);
  const [midL, midR] = at(0.5);
  const [lowL, lowR] = at(0.75);
  const [botL, botR] = at(1);
  void W;
  void H;
  const yTop = checkpointRow(box, 0);
  const yMid = checkpointRow(box, 0.5);
  const yLow = checkpointRow(box, 0.75);
  const yBot = checkpointRow(box, 1);
  return {
    A: { x1: topL, y1: yTop, x2: botL, y2: yBot },
    B: { x1: topL, y1: yTop, x2: topR, y2: yTop },
    C: { x1: midL, y1: yMid, x2: midR, y2: yMid },
    D: { x1: lowL, y1: yLow, x2: lowR, y2: yLow },
    E: { x1: botL, y1: yBot, x2: botR, y2: yBot },
  };
}

/** Pixel widths at the 4 width checkpoints, for on-screen hints. */
export function pixelWidths(points: OutlinePoint[]): { B: number; C: number; D: number; E: number } {
  return checkedWidths(points);
}

/**
 * Scale the rectified outline to real size.
 * - Y: uniform scale from A (real length / pixel height).
 * - X: piecewise scale between the B/C/D/E checkpoints so the top stays wide
 *   and the bottom stays narrow. X is measured from the left edge at each row.
 * - Output in mm, Y-up (top edge has the largest Y), for the DXF.
 */
export function computeScaledPoints(
  points: OutlinePoint[],
  H: number,
  m: Measurements,
): OutlinePoint[] {
  const box = boundingBox(points);
  const spanY = Math.max(1e-6, box.maxY - box.minY);
  const fracs = [0, 0.5, 0.75, 1];
  const cw = checkedWidths(points);
  const realW = [m.B, m.C, m.D, m.E];
  const pixW = [cw.B, cw.C, cw.D, cw.E];
  const scaleY = m.A / Math.max(1e-6, H);

  const scaleAt = (t: number): number => {
    const tc = Math.min(1, Math.max(0, t));
    for (let i = 0; i < fracs.length - 1; i++) {
      if (tc <= fracs[i + 1]) {
        const local = (tc - fracs[i]) / (fracs[i + 1] - fracs[i]);
        const px = pixW[i] + local * (pixW[i + 1] - pixW[i]);
        const rw = realW[i] + local * (realW[i + 1] - realW[i]);
        return rw / Math.max(1e-6, px);
      }
    }
    return realW[realW.length - 1] / pixW[pixW.length - 1];
  };

  return points.map((p) => {
    const t = (p.y - box.minY) / spanY;
    const w = polygonWidthAtY(points, p.y);
    const leftX = w ? w[0] : box.minX;
    const xCm = (p.x - leftX) * scaleAt(t);
    const yCm = (box.maxY - p.y) * scaleY;
    return { x: xCm * 10, y: yCm * 10 };
  });
}

/**
 * Synthetic 40-point trapezoid with slightly curved sides, for testing the
 * measure -> scale -> DXF flow without a camera or a Dev Build. Labeled demo only.
 */
export function makeDemoOutline(W = 900, H = 1200): OutlinePoint[] {
  const pts: OutlinePoint[] = [];
  const N = 10;
  const leftX = (t: number) => W * 0.12 + t * W * 0.1 + Math.sin(t * Math.PI) * W * 0.03;
  const rightX = (t: number) => W * 0.88 - t * W * 0.14 - Math.sin(t * Math.PI) * W * 0.02;
  const yTop = H * 0.04;
  const yBot = H * 0.96;
  // Left side, top -> bottom.
  for (let i = 0; i < N; i++) {
    const t = i / N;
    pts.push({ x: leftX(t), y: yTop + t * (yBot - yTop) });
  }
  // Bottom edge, left -> right (slight outward bow).
  for (let i = 0; i < N; i++) {
    const t = i / N;
    pts.push({
      x: leftX(1) + t * (rightX(1) - leftX(1)),
      y: yBot + Math.sin(t * Math.PI) * H * 0.012,
    });
  }
  // Right side, bottom -> top.
  for (let i = 0; i < N; i++) {
    const t = i / N;
    pts.push({ x: rightX(1 - t), y: yBot - t * (yBot - yTop) });
  }
  // Top edge, right -> left (slight inward bow).
  for (let i = 0; i < N; i++) {
    const t = i / N;
    pts.push({
      x: rightX(0) - t * (rightX(0) - leftX(0)),
      y: yTop - Math.sin(t * Math.PI) * H * 0.01,
    });
  }
  return pts;
}
