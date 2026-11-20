import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Measurements } from '../lib/types';

interface Props {
  fileName: string;
  uri: string;
  measurements: Measurements;
  pointCount: number;
  pixelLength: number;
  pixelTopWidth: number;
  onNextPiece: () => void;
  onEdit: () => void;
}

export function DoneScreen({
  fileName,
  uri,
  measurements,
  pointCount,
  pixelLength,
  pixelTopWidth,
  onNextPiece,
  onEdit,
}: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>✓</Text>
      <Text style={styles.title}>DXF saved offline</Text>
      <View style={styles.card}>
        <Row label="File" value={fileName} />
        <Row label="Folder" value="app documents" />
        <Row label="Length (A)" value={`${measurements.A} cm`} />
        <Row label="Top width (B)" value={`${measurements.B} cm`} />
        <Row label="Outline points" value={String(pointCount)} />
      </View>
      <Text style={styles.path}>{uri}</Text>
      <Text style={styles.debug}>
        Photo: {Math.round(pixelLength)} px tall · {Math.round(pixelTopWidth)} px top width · all
        processing stayed on this phone, no cloud.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.secondary} onPress={onEdit}>
          <Text style={styles.secondaryText}>Edit numbers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={onNextPiece}>
          <Text style={styles.primaryText}>Next Piece</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowLine}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111', padding: 24, justifyContent: 'center' },
  emoji: { color: '#22c55e', fontSize: 64, textAlign: 'center', fontWeight: '800' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  card: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, marginTop: 20 },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#9ca3af', fontSize: 15 },
  value: { color: '#fff', fontSize: 15, fontWeight: '700' },
  path: { color: '#6b7280', fontSize: 11, marginTop: 10, textAlign: 'center' },
  debug: { color: '#6b7280', fontSize: 12, marginTop: 10, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, marginTop: 22 },
  primary: { flex: 2, backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { flex: 1, backgroundColor: '#374151', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
