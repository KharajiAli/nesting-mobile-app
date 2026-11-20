import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line as SvgLine, Polygon } from 'react-native-svg';
import type { LineSeg } from '../lib/geometry';
import type { OutlinePoint } from '../lib/types';

interface Props {
  spaceW: number;
  spaceH: number;
  outline: OutlinePoint[];
  activeLine?: LineSeg | null;
}

/** Green outline + corner dots, with the active red measurement line on top. */
export function OutlineOverlay({ spaceW, spaceH, outline, activeLine }: Props) {
  const w = Math.max(1, spaceW);
  const h = Math.max(1, spaceH);
  const stroke = Math.max(2, w * 0.006);
  return (
    <Svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={StyleSheet.absoluteFill}
    >
      {outline.length > 2 ? (
        <Polygon
          points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stroke}
        />
      ) : null}
      {outline.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={stroke * 0.9} fill="#22c55e" />
      ))}
      {activeLine ? (
        <SvgLine
          x1={activeLine.x1}
          y1={activeLine.y1}
          x2={activeLine.x2}
          y2={activeLine.y2}
          stroke="#ef4444"
          strokeWidth={stroke * 1.4}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}
