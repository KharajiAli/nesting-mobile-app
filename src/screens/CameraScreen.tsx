import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  base64: string | null;
}

interface Props {
  processing: boolean;
  onPhoto: (photo: CapturedPhoto) => void;
  onDemo: () => void;
}

export function CameraScreen({ processing, onPhoto, onDemo }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Requesting camera access…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera needed</Text>
        <Text style={styles.hint}>Pattern Maker photographs the carton pattern with the back camera.</Text>
        <TouchableOpacity style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    if (busy || processing) return;
    setBusy(true);
    try {
      const shot = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        base64: true,
        exif: false,
      });
      if (shot?.uri) {
        onPhoto({
          uri: shot.uri,
          width: shot.width,
          height: shot.height,
          base64: shot.base64 ?? null,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" flash={flash} />
      {/* Center rectangle guide */}
      <View style={styles.guideWrap} pointerEvents="none">
        <View style={styles.guide}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.guideText}>Put the brown carton inside the frame</Text>
        <Text style={styles.guideSub}>White sheet · phone straight above · good light</Text>
      </View>
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.smallBtn}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
        >
          <Text style={styles.smallText}>{flash === 'off' ? 'Light: off' : 'Light: on'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shutter, (busy || processing) && styles.disabled]}
          onPress={takePhoto}
          disabled={busy || processing}
        >
          {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.shutterText}>Take Photo</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={onDemo}>
          <Text style={styles.smallText}>Demo</Text>
        </TouchableOpacity>
      </View>
      {processing ? (
        <View style={styles.processing}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Finding outline…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#111' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#ccc', fontSize: 14, textAlign: 'center', marginTop: 8 },
  primary: { marginTop: 16, backgroundColor: '#22c55e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  guideWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  guide: { width: '72%', aspectRatio: 3 / 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 6, position: 'relative' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: '#22c55e', borderWidth: 4 },
  tl: { top: -4, left: -4, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: -4, right: -4, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: -4, left: -4, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: -4, right: -4, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  guideText: { color: '#fff', marginTop: 12, fontWeight: '700', textAlign: 'center' },
  guideSub: { color: '#ddd', marginTop: 4, fontSize: 13, textAlign: 'center' },
  controls: {
    position: 'absolute',
    bottom: 34,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  shutter: { backgroundColor: '#22c55e', paddingHorizontal: 34, paddingVertical: 16, borderRadius: 999, minWidth: 170, alignItems: 'center' },
  shutterText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  disabled: { opacity: 0.6 },
  smallBtn: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  smallText: { color: '#fff', fontWeight: '600' },
  processing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: { color: '#fff', marginTop: 10, fontWeight: '700' },
});
