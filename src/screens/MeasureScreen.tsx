import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { OutlineOverlay } from '../components/OutlineOverlay';
import { measurementLines, pixelWidths } from '../lib/geometry';
import type { MeasurementKey, Measurements, OutlinePoint } from '../lib/types';
import { MEASUREMENT_KEYS } from '../lib/types';

const STEPS: Array<{ key: MeasurementKey; title: string; hint: string }> = [
  { key: 'A', title: 'A · Total length', hint: 'Left side, top corner to bottom corner. Measure with a tape.' },
  { key: 'B', title: 'B · Top width', hint: 'Left to right at the top.' },
  { key: 'C', title: 'C · Width at 50%', hint: 'Width halfway down from the top.' },
  { key: 'D', title: 'D · Width at 75%', hint: 'Width three quarters down from the top.' },
  { key: 'E', title: 'E · Bottom width', hint: 'Left to right at the bottom.' },
];

interface Props {
  displayUri: string;
  spaceW: number;
  spaceH: number;
  points: OutlinePoint[];
  initial: Measurements;
  saving: boolean;
  onBackToReview: () => void;
  onDone: (m: Measurements) => void;
}

export function MeasureScreen({
  displayUri,
  spaceW,
  spaceH,
  points,
  initial,
  saving,
  onBackToReview,
  onDone,
}: Props) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<MeasurementKey, string>>({
    A: initial.A > 0 ? String(initial.A) : '',
    B: initial.B > 0 ? String(initial.B) : '',
    C: initial.C > 0 ? String(initial.C) : '',
    D: initial.D > 0 ? String(initial.D) : '',
    E: initial.E > 0 ? String(initial.E) : '',
  });
  const [problem, setProblem] = useState<string | null>(null);

  const lines = useMemo(() => measurementLines(points, spaceW, spaceH), [points, spaceW, spaceH]);
  const px = useMemo(() => pixelWidths(points), [points]);
  const current = STEPS[step];

  const parseCurrent = (): number | null => {
    const v = parseFloat(values[current.key].replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0 || v > 10000) return null;
    return v;
  };

  const goNext = () => {
    const v = parseCurrent();
    if (v === null) {
      setProblem('Type the length in cm, for example 62.5');
      return;
    }
    setProblem(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onDone({
        A: parseFloat(values.A.replace(',', '.')),
        B: parseFloat(values.B.replace(',', '.')),
        C: parseFloat(values.C.replace(',', '.')),
        D: parseFloat(values.D.replace(',', '.')),
        E: parseFloat(values.E.replace(',', '.')),
      });
    }
  };

  const pxHint =
    current.key === 'A'
      ? `Photo: ${Math.round(spaceH)} px tall`
      : `Photo: ${Math.round(
          current.key === 'B' ? px.B : current.key === 'C' ? px.C : current.key === 'D' ? px.D : px.E,
        )} px wide`;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.photoWrap}>
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={styles.photo} resizeMode="contain" />
        ) : (
          <View style={styles.demoBox}>
            <Text style={styles.demoText}>DEMO SHAPE (no photo, no OpenCV)</Text>
          </View>
        )}
        <OutlineOverlay
          spaceW={spaceW}
          spaceH={spaceH}
          outline={points}
          activeLine={lines[current.key]}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.step}>
          Line {current.key} of 5 · step {step + 1}/5
        </Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.hint}>{current.hint}</Text>
        <Text style={styles.px}>{pxHint} (red line, for checking only)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={values[current.key]}
            onChangeText={(t) =>
              setValues((v) => ({ ...v, [current.key]: t }))
            }
            keyboardType="decimal-pad"
            placeholder="cm, e.g. 62.5"
            placeholderTextColor="#6b7280"
            editable={!saving}
          />
          <Text style={styles.unit}>cm</Text>
        </View>
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
        <View style={styles.row}>
          {step > 0 ? (
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => {
                setProblem(null);
                setStep(step - 1);
              }}
              disabled={saving}
            >
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondary} onPress={onBackToReview} disabled={saving}>
              <Text style={styles.secondaryText}>Outline</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.primary} onPress={goNext} disabled={saving}>
            <Text style={styles.primaryText}>
              {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Make DXF' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dots}>
          {MEASUREMENT_KEYS.map((k, i) => (
            <View key={k} style={[styles.dot, i === step ? styles.dotOn : styles.dotOff]} />
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  photoWrap: { flex: 1, position: 'relative', margin: 12, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  demoBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1520' },
  demoText: { color: '#7dd3fc', fontWeight: '700', fontSize: 13 },
  card: { padding: 16, paddingBottom: 28, backgroundColor: '#111' },
  step: { color: '#9ca3af', fontSize: 13, fontWeight: '700' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  hint: { color: '#d1d5db', fontSize: 14, marginTop: 4 },
  px: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  input: {
    flex: 1,
    backgroundColor: '#1f2937',
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  unit: { color: '#9ca3af', fontSize: 18, fontWeight: '700', marginLeft: 10 },
  problem: { color: '#fca5a5', marginTop: 8, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  primary: { flex: 2, backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { flex: 1, backgroundColor: '#374151', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: '#22c55e' },
  dotOff: { backgroundColor: '#374151' },
});
