import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { CameraScreen, type CapturedPhoto } from './src/screens/CameraScreen';
import { DoneScreen } from './src/screens/DoneScreen';
import { MeasureScreen } from './src/screens/MeasureScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { buildAndSaveDxf } from './src/lib/dxf';
import {
  boundingBox,
  computeScaledPoints,
  makeDemoOutline,
  pixelWidths,
  resamplePolygon,
} from './src/lib/geometry';
import { detectAndRectify } from './src/lib/opencv';
import type { Measurements, RectifiedResult } from './src/lib/types';

type Stage =
  | { name: 'camera' }
  | { name: 'review'; result: RectifiedResult | null; error: string | null; photoUri: string }
  | { name: 'measure'; result: RectifiedResult; measurements: Measurements }
  | {
      name: 'done';
      result: RectifiedResult;
      measurements: Measurements;
      fileName: string;
      uri: string;
    };

const EMPTY: Measurements = { A: 0, B: 0, C: 0, D: 0, E: 0 };

export default function App() {
  const [stage, setStage] = useState<Stage>({ name: 'camera' });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhoto = async (photo: CapturedPhoto) => {
    if (!photo.base64) {
      Alert.alert('Photo error', 'The camera returned no image data. Please retake the photo.');
      return;
    }
    setProcessing(true);
    try {
      const out = await detectAndRectify(photo.base64, photo.uri);
      if (out.ok) {
        setStage({ name: 'review', result: out.result, error: null, photoUri: photo.uri });
      } else {
        setStage({ name: 'review', result: null, error: out.reason, photoUri: photo.uri });
      }
    } finally {
      setProcessing(false);
    }
  };

  /** Demo path: no camera, no OpenCV. For UI testing only, clearly labeled. */
  const handleDemo = () => {
    const W = 900;
    const H = 1200;
    const points = resamplePolygon(makeDemoOutline(W, H), 40);
    setStage({
      name: 'review',
      result: {
        points,
        spaceW: W,
        spaceH: H,
        displayUri: '',
        usedWarp: false,
        debug: {
          workW: W,
          workH: H,
          contourAreaPx: 0,
          perimeterPx: 0,
          epsilonPx: 0,
          pointCount: points.length,
        },
      },
      error: null,
      photoUri: '',
    });
  };

  const handleMeasured = async (m: Measurements, result: RectifiedResult) => {
    setSaving(true);
    try {
      const box = boundingBox(result.points);
      const H = Math.max(1, box.maxY - box.minY);
      const scaled = computeScaledPoints(result.points, H, m);
      const saved = await buildAndSaveDxf(scaled, 'pattern.dxf');
      setStage({ name: 'done', result, measurements: m, fileName: saved.fileName, uri: saved.uri });
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      <StatusBar style="light" />
      {stage.name === 'camera' ? (
        <CameraScreen processing={processing} onPhoto={handlePhoto} onDemo={handleDemo} />
      ) : null}
      {stage.name === 'review' ? (
        <ReviewScreen
          result={stage.result}
          photoUri={stage.photoUri}
          error={stage.error}
          onConfirm={() =>
            stage.result
              ? setStage({ name: 'measure', result: stage.result, measurements: { ...EMPTY } })
              : undefined
          }
          onRetake={() => setStage({ name: 'camera' })}
        />
      ) : null}
      {stage.name === 'measure' ? (
        <MeasureScreen
          displayUri={stage.result.displayUri}
          spaceW={stage.result.spaceW}
          spaceH={stage.result.spaceH}
          points={stage.result.points}
          initial={stage.measurements}
          saving={saving}
          onBackToReview={() =>
            setStage({
              name: 'review',
              result: stage.result,
              error: null,
              photoUri: stage.result.displayUri,
            })
          }
          onDone={(m) => handleMeasured(m, stage.result)}
        />
      ) : null}
      {stage.name === 'done' ? (
        <DoneScreen
          fileName={stage.fileName}
          uri={stage.uri}
          measurements={stage.measurements}
          pointCount={stage.result.points.length}
          pixelLength={boundingBox(stage.result.points).maxY - boundingBox(stage.result.points).minY}
          pixelTopWidth={pixelWidths(stage.result.points).B}
          onNextPiece={() => setStage({ name: 'camera' })}
          onEdit={() =>
            setStage({ name: 'measure', result: stage.result, measurements: stage.measurements })
          }
        />
      ) : null}
    </View>
  );
}
