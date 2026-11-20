# Mobile Pattern Maker - Roadmap and First Prompt

## Goal
Build a mobile app that replaces a full-time PC expert using Adobe Illustrator to make DXF garment patterns for a cloud nesting engine.

The worker pulls out his phone, photographs a brown carton garment pattern laid flat, the app gets only the shape from the photo, then asks the worker for real measurements for each side, scales the shape to real size, and makes a DXF file with real shape and real measurements.

Result that matters: less marker length in the cloud nesting engine. Width is fixed by the fabric, length is the real money waste.

Target users: very small textile businesses in Africa. They have a phone, not a PC. They often work in a basement with no internet.

## Proof focus first
Ali does not want to test anything else until capture is proven possible.

The important flow now is only this:
1. Capture one piece, get the shape at the parameters he wants
2. Move to the next piece
3. When finished, review all pieces
4. Send them to the cloud

Only after proving capture is fully possible, think about the other architecture pieces. No auth, no billing, no admin, no grading yet.

## Tech settled
- Mobile app: Expo, React Native, TypeScript. Not Flutter. Ali does not like Flutter.
- Camera and OpenCV: react-native-fast-opencv with npx expo prebuild. OpenCV runs only in an Expo Dev Build, not in Expo Go.
- Photo, not scan: brown carton is too big for a scanner, small shops have no scanner.
- Offline first: create the full DXF offline on the phone, upload to the cloud only when internet is available.
- Shape detection: OpenCV findContours for the full outline, approxPolyDP for corners. ML Kit Document Scanner is wrong here, it only finds 4 corners and assumes a rectangle, it loses curves.
- Live before, final after: live OpenCV on camera preview is only for guidance, to show the outline and help the worker take a good photo. Final accurate outline is from the high-res photo after taking it.
- Measurements: OpenCV auto-picks 5 lines from the outline. A: total length, left side. B: top width. C: width at 50 percent down. D: width at 75 percent down. E: bottom width. App shows them one by one in red and asks the worker to measure each with a tape and type the number in cm. Do not ask for diagonal or curve length.
- Size engine: simple geometry math, offline in JavaScript. First fix perspective with getPerspectiveTransform and warpPerspective. Then scale: real length divided by pixel length for Y, real width divided by pixel width for X. For taper, use piecewise scaling between the width checkpoints.
- DXF: dxf-writer npm package in JavaScript. DXF is a text file with ENTITIES and a closed LWPOLYLINE with 30 to 50 points in mm, to keep curves curved. Save with expo-file-system as pattern.dxf on the phone, offline.
- Test phone: Android phone at home, available 8pm to 12pm when mom comes back from work. Android is 99 percent of the target market. iPhone is iOS 26.5, backup test with SideStore, 1 app, 7 day expiry, no 99 dollar account needed for Android.
- Builds: EAS Build free plan gives 15 Android and 15 iOS builds a month. First feature needs only 1 Android build. JavaScript edits do not use builds, they reload instantly in the Dev Build with Fast Refresh. A new build is only needed when a native library is added, removed, or upgraded. The 99 dollar Apple Developer account is only needed to install a Dev Build on a real iPhone, and to publish to the App Store later. Android needs no payment.

## Roadmap

### Phase 0: Setup, 1 day
- Create Expo app with TypeScript
- Install expo-dev-client, expo-camera, expo-file-system
- Install react-native-fast-opencv
- Run npx expo prebuild
- Build 1 free Android Dev Build with eas build --platform android --profile development
- Install it on the Android phone at home
- Confirm npx expo start --dev-client reloads JavaScript instantly with no new build

Done when: app opens on the Android phone, camera opens, JavaScript edit shows in 1 to 2 seconds.

### Phase 1: Proof, Capture the shape, the only priority now
- Camera screen with guides: rectangle on screen, worker puts brown carton inside it, on a white sheet, phone straight above, good light
- Live outline: run OpenCV on camera preview frames, draw the outline in green when found, red when not found, to help the worker
- Take photo: on tap, take high-res photo
- Final outline: run OpenCV on the high-res photo, grayscale, blur, threshold brown vs light background, Canny, findContours, pick largest contour, approxPolyDP for corners, keep 30 to 50 points to keep curves
- Show outline: draw the outline on top of the photo, show corners as dots, let the worker confirm it looks right or retake
- Measurements: auto-pick the 5 lines A to E from the outline, show them one by one in red, ask the worker to type each length in cm
- Scaling: apply perspective fix and piecewise scaling from the 5 typed numbers to get real size in cm, then convert to mm
- DXF: use dxf-writer to make a closed LWPOLYLINE DXF, save it offline on the phone
- Proof test: photograph the same brown carton piece 5 times, compare DXF length and widths to real tape measurements. Pass if error is under 5 mm. If over 10 mm, adjust threshold, blur, or add more width checkpoints, do not move to Phase 2.

Done when: 5 photos of the same piece give a DXF with length and widths within 5 mm of the tape, every time.

### Phase 2: Batch flow, after Phase 1 is proven
- Capture list: after one piece is done, button Next Piece, start again
- Piece list screen: show all captured pieces for one style, with name, thumbnail, and status
- Review screen: tap a piece, see photo with outline, see typed measurements, edit a measurement if wrong, delete a piece if bad
- Send: button Send All to Cloud, only enabled when internet is available, shows queue: saved, waiting to upload, uploaded, failed and retry

Done when: worker can capture 5 pieces in a row offline, review them, and send them all at once when online, with no loss.

### Phase 3: Cloud nesting connection, after Phase 2
- Upload DXF plus fabric width to cloud API
- Create a nesting job, poll job status, get back marker length in metres and marker DXF
- Show result on phone: NestFab length vs our length, shorter wins
- This phase needs the cloud engine API contract, do not start it before Phase 1 is proven

### Phase 4: Later, only after proof with real clients
- Grain line: worker draws one arrow for fabric direction after the outline
- Grading: scan each size separately for MVP, grading to other sizes later
- Outline correction: worker drags a point to fix a bad outline
- DXF validation on cloud: check closed polygon, no self-intersection, warn on wrong measurement
- Authentication, billing, teams, admin dashboard
- Do not build any of Phase 4 before Phase 1 is proven and 2 to 3 real small shops say it saves them fabric

## First prompt, copy and paste this to your coding AI

Build an Expo React Native TypeScript app called Pattern Maker, for Android first, offline first, no backend, no auth, no cloud yet.

Tech: Expo SDK, expo-dev-client, expo-camera, expo-file-system, react-native-fast-opencv. Use npx expo prebuild, because OpenCV needs a Dev Build and does not work in Expo Go.

Build only Phase 0 and Phase 1 proof:

1. Create the project with npx create-expo-app pattern-maker --template blank-typescript. Install expo-dev-client, expo-camera, expo-file-system, and react-native-fast-opencv. Run npx expo prebuild.

2. Make one screen: CameraScreen.
- Open the back camera, full screen, with a rectangle guide in the center.
- Add a button Take Photo.
- After taking a photo, run OpenCV on the photo in this order: convert to grayscale, Gaussian blur, threshold to separate brown carton from light background, Canny edge detection, findContours, pick the largest contour, approxPolyDP to find corners, keep 30 to 50 points so curves stay curved.
- Draw the outline on top of the photo in green, draw corners as dots.
- Show two buttons: Confirm Outline, Retake Photo.
- If no contour is found, show a message: outline not found, move phone straight above, use a white sheet, add more light, and retake.

3. After Confirm Outline, show the 5 measurement lines one by one, in red, on top of the photo:
- A: total length, left side, top corner to bottom corner
- B: top width, left to right at the top
- C: width at 50 percent down from the top
- D: width at 75 percent down from the top
- E: bottom width
- For each line, show an input for the length in cm, a Next button, and a Back button. The worker measures with a tape and types the number.
- Do not ask for diagonal or curve length.

4. After all 5 numbers are typed, do the scaling in plain JavaScript, offline:
- Fix perspective with OpenCV getPerspectiveTransform and warpPerspective.
- Scale Y by real length divided by pixel length, scale X by real width divided by pixel width.
- Use piecewise scaling between the width checkpoints so the top stays wide and the bottom stays narrow.
- Convert cm to mm.

5. Make the DXF with dxf-writer:
- Create a closed LWPOLYLINE with the scaled points in mm, in order around the shape.
- Save it with expo-file-system as pattern.dxf in the app documents folder, offline.
- Show a success screen with the file name, the length in cm, the top width in cm, and the number of outline points.

Acceptance criteria:
- App runs on Android in a Dev Build built with eas build --platform android --profile development.
- Photographing a brown carton pattern on a white sheet shows a green outline that follows the real edges and curves.
- Typing the 5 measurements produces a DXF file saved offline on the phone.
- Photographing the same piece 5 times gives a DXF length and widths within 5 mm of the tape measurements.
- JavaScript edits reload instantly with npx expo start --dev-client, with no new EAS build.
- No cloud, no login, no backend in this prompt. Only camera, OpenCV, measurements, scaling, and DXF.
