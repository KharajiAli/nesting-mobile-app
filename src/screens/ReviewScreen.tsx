import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OutlineOverlay } from '../components/OutlineOverlay';
import type { RectifiedResult } from '../lib/types';

interface Props {
  result: RectifiedResult | null;
  /** Original photo, shown when detection found nothing. */
  photoUri: string;
  error: string | null;
  onConfirm: () => void;
  onRetake: () => void;
}

export function ReviewScreen({ result, photoUri, error, onConfirm, onRetake }: Props) {
  const shownUri = result?.displayUri || photoUri;
  return (
    <View style={styles.root}>
      <View style={styles.photoWrap}>
        {shownUri ? (
          <Image source={{ uri: shownUri }} style={styles.photo} resizeMode="contain" />
        ) : (
          <View style={styles.demoBox}>
            <Text style={styles.demoText}>DEMO SHAPE (no photo, no OpenCV)</Text>
          </View>
        )}
        {result ? (
          <OutlineOverlay spaceW={result.spaceW} spaceH={result.spaceH} outline={result.points} />
        ) : null}
      </View>
      <View style={styles.footer}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : result ? (
          <Text style={styles.ok}>
            {result.points.length} outline points{result.usedWarp ? ' · perspective fixed' : ' · no warp'}.
            Does the green outline follow the real edges and curves?
          </Text>
        ) : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.secondary} onPress={onRetake}>
            <Text style={styles.secondaryText}>Retake Photo</Text>
          </TouchableOpacity>
          {!error && result ? (
            <TouchableOpacity style={styles.primary} onPress={onConfirm}>
              <Text style={styles.primaryText}>Confirm Outline</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {result && !error ? (
          <Text style={styles.debug}>
            {result.spaceW}×{result.spaceH}px · area {Math.round(result.debug.contourAreaPx)}px²
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  photoWrap: { flex: 1, position: 'relative', margin: 12, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  demoBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1520' },
  demoText: { color: '#7dd3fc', fontWeight: '700', fontSize: 13 },
  footer: { padding: 16, paddingBottom: 28, backgroundColor: '#111' },
  ok: { color: '#bbf7d0', fontSize: 14, marginBottom: 12 },
  error: { color: '#fca5a5', fontSize: 14, marginBottom: 12, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  primary: { flex: 1, backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { flex: 1, backgroundColor: '#374151', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  debug: { color: '#6b7280', fontSize: 12, marginTop: 8, textAlign: 'center' },
});
