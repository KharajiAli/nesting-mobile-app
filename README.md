# Pattern Maker (Phase 0 + Phase 1 proof)

Offline-first Expo React Native TypeScript app. Photograph a brown carton garment
pattern, get its outline with OpenCV, type 5 tape measurements, get a real-size
DXF saved on the phone. No cloud, no login, no backend.

## Stack

- Expo SDK 58, TypeScript, `expo-dev-client`, `expo-camera`, `expo-file-system`
- `react-native-fast-opencv` (OpenCV, Dev Build only — never Expo Go)
- `react-native-svg` (green outline / red measurement overlay)
- `dxf-writer` (closed LWPOLYLINE DXF in mm, plain JS)
- Scaling: plain JS, offline (`src/lib/geometry.ts`)

## 1. Install

```powershell
npm install
```

## 2. Prebuild (needed once; OpenCV needs native code)

```powershell
npx expo prebuild
```

This creates `android/` and `ios/`. Re-run it only when a native library is
added, removed, or upgraded. JavaScript edits never need it.

## 3. Dev Build for Android

Option A — EAS (1 free build):

```powershell
eas build --platform android --profile development
```

Option B — Codemagic (no EAS account needed):

```powershell
git push   # codemagic.yaml builds app-debug.apk automatically on push to main
```

Install the resulting APK on the test phone.

## 4. Run (Fast Refresh, no rebuild for JS edits)

```powershell
npx expo start --dev-client
```

Scan the QR with the Dev Build, or press `a` for a USB-connected device.
JS edits reload in 1–2 seconds. A new EAS build is only needed when native
deps change.

## Flow

1. **Camera** — back camera, rectangle guide, Take Photo (flash toggle).
2. **OpenCV on the photo** (`src/lib/opencv.ts`): grayscale → Gaussian blur →
   threshold (brown carton vs light sheet, tries inverted OTSU then OTSU) →
   Canny → findContours → largest contour → approxPolyDP tuned to 30–50 pts.
   Then perspective fix (`getPerspectiveTransform` + `warpPerspective`).
3. **Review** — green outline + corner dots over the photo. Confirm or Retake.
   No contour → "outline not found, move the phone straight above, use a white
   sheet, add more light, and retake."
4. **Measure** — lines A–E one by one in red (A length left side, B top width,
   C 50%, D 75%, E bottom). Type each in cm. Back/Next.
5. **Scale + DXF** — Y from A/px-height, X piecewise between B/C/D/E
   checkpoints, cm→mm (`src/lib/geometry.ts`), closed LWPOLYLINE via
   `dxf-writer`, saved as `pattern.dxf` in the app documents folder
   (`src/lib/dxf.ts`, offline).
6. **Success** — file name, length A, top width B, outline point count.

## Proof test (acceptance)

Photograph the same brown carton piece 5 times on a white sheet. Each DXF must
match the tape measurements within 5 mm. If error is over 10 mm, adjust in
`src/lib/opencv.ts`: threshold polarity/order, `CANNY_LOW/HIGH`, `minArea`
(1.5% of image), epsilon tuning, or `MAX_WORK_WIDTH`.

## Demo mode (no camera / no Dev Build)

The `Demo` button on the camera screen walks the measure → scale → DXF flow
with a synthetic 40-point shape. It is clearly labeled and never used for real
pieces.

## Project layout

```
App.tsx                    stage machine: camera → review → measure → done
src/screens/CameraScreen   camera + guide + capture
src/screens/ReviewScreen   photo + green outline + Confirm/Retake
src/screens/MeasureScreen  red lines A–E + cm inputs
src/screens/DoneScreen     success + file info
src/components/OutlineOverlay  SVG outline overlay
src/lib/opencv.ts          detection + perspective fix
src/lib/geometry.ts        measurement lines + piecewise scaling
src/lib/dxf.ts             DXF build + offline save
src/lib/types.ts           shared types
```

## Troubleshooting

- **OpenCV not linked / crash in Expo Go**: expected. Use the Dev Build
  (`npx expo start --dev-client`). The app shows a message instead of crashing.
- **Outline not found**: white sheet, phone parallel above the carton, more
  light, fill the guide rectangle.
- **New native lib added**: `npx expo prebuild` + new `eas build --profile development`.
