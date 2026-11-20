// DXF export with dxf-writer. Plain JS, fully offline.
// The file is a text DXF with ENTITIES and one closed LWPOLYLINE in mm.

import Drawing from 'dxf-writer';
import * as FileSystem from 'expo-file-system/legacy';
import type { OutlinePoint } from './types';

export interface DxfSaveResult {
  uri: string;
  fileName: string;
  chars: number;
}

export async function buildAndSaveDxf(
  pointsMm: OutlinePoint[],
  fileName = 'pattern.dxf',
): Promise<DxfSaveResult> {
  const drawing = new Drawing();
  drawing.setUnits('Millimeters');
  const pts: Array<[number, number]> = pointsMm.map((p) => [round3(p.x), round3(p.y)]);
  drawing.drawPolyline(pts, true);
  const dxf = drawing.toDxfString();

  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!dir) throw new Error('No writable app directory found on this phone.');
  const uri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, dxf);
  return { uri, fileName, chars: dxf.length };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
