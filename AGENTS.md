# Repository Guidelines

Grove is a client-only Vite + React + Three.js app: a URL becomes a QR module grid, and the 3D tree **is** that grid from overhead. Scanability is the ship gate.

## Agent Work Style

Use as much context as the task needs. Do not stop at a thin first draft: complete the change, verify it, and fix the bugs you find.

Prefer **multi-agent / subagent** splits when work can run in parallel — for example core `src`, tests, share/crypto, and scene/scanability — then synthesize. One owner should integrate shared files. After edits, run the checks in [Development Commands](#development-commands) and [Testing & QA](#testing--qa); treat a failing check as unfinished work.

Do not reopen closed product decisions below unless the user asks.

## Project Overview

Type a URL in **Create** (optional password), grow a grove, and share it. **Reveal** imports a still/loop or a locked `?u=` token, then locally scans the live mosaic. Encrypted content is never readable from metadata or the address bar alone.

- Live QR payload is the URL **or** a `gv1.` AES-GCM token — never the share-search string.
- Share files stay visually clean. Payload lives in **container metadata only**.
- Species is a user choice (`t=`): Cherry / Apple / Pine / Willow / Maple.
- Side view should read as a tree/hedge; overhead remains a scannable QR via luma pinning.

Do not copy ICQR / Enzo branding or source.

## Architecture & Data Flow

```
URL / password  →  wrapSecret?  →  encodeGrid (uqr, ECC M)
        ↓
   ModuleGrid   →  buildTree + Grass/Ground   →  WebGL grove
        ↓                                      ↓
   rasterQr + jsQR                      camera pitch
   (Reveal scan / Download QR)          OVERHEAD = π/2 = code
        ↓
   ShareState  →  history.replaceState + still/loop metadata
```

1. `src/main.tsx` mounts `App`. `useTreeState` boots from `parseShareParams(location.search)`.
2. **Create** (200 ms debounce): `payloadError` → `normalizePayload` (https only for hosts, not plain text) → optional `wrapSecret` → `encodeGrid`.
3. **Reveal** re-encodes `payload`. `RevealPanel` calls `scanGrovePayload` (flat mosaic, not the WebGL canvas), then `unwrapSecret` if locked.
4. `TreeCanvas` uses `resolveTreeChoice(payload, tree)` → `buildTree`. Leaves and filler stay on **dark modules only**. Finder ink is grass, luma-pinned.
5. Animated camera/colors live on `scene.current` (`src/scene/sceneState.ts`) and are read in `useFrame`. React holds URL, password, payload, grid, mode, season, tree, error.
6. `buildShareSearch` writes `?u=&s=&t=` plus `e=1` when locked and `m=r` in Reveal. That search string is what still/loop metadata stores.

**Share channels (import majority-vote, first-seen on tie):**

| Write | Where |
| --- | --- |
| PNG `tEXt grove`, private `grVe`, IEND trailer | `exportStill.ts` + `containerMeta.ts` |
| GIF comment | `exportLoop.ts` (`LOOP_DELAY_MS = 180`, 20 frames, max 640, never the overhead frame) |
| JPEG `COM` | import only |

Import (`readStillFile`) reads those channels only. Social JPEG that strips metadata fails with `This image is not a grove still.` Do not add pixel QR / LSB / gifuct to “fix” that.

**Download QR** (`exportPng.ts`) is a separate flat mosaic (`grove-qr.png`). Do not change it when changing still/loop.

## Key Directories

| Path | Role |
| --- | --- |
| `src/app/` | Shell and session state (`App.tsx`, `useTreeState.ts`) |
| `src/qr/` | Encode, classify, contrast, 2D raster |
| `src/scene/` | Tree, grass, ground, camera, palettes, particles |
| `src/share/` | Query params, crypto, still/loop metadata, scan |
| `src/ui/` | Create/Reveal controls, share menu |
| `src/audio/` | Seasonal ambience; default mute |
| `src/styles/` | `tokens.css` + `app.css` (no Tailwind) |
| `.omc/` | Local agent notes. Gitignored; never commit machine paths or session logs |

No `scripts/` directory. No root README.

## Development Commands

```bash
npm install          # lockfile is package-lock.json (npm)
npm run dev          # Vite; use the printed Local URL (often :5173, sometimes :5199)
npm test             # vitest run
npx vitest run path  # one file
npx tsc --noEmit     # same gate as build
npm run build        # tsc --noEmit && vite build
npm run preview      # default :4173
```

There is **no lint / format / coverage / CI script**. After share, crypto, or scene/scanability edits, run `npx tsc --noEmit` and `npx vitest run`. For visual or Create/Reveal work, also check the running app.

Vite has no custom `server.port`. Bind may be IPv6-only (`http://localhost:5199/` works; `http://127.0.0.1:5199/` may not).

## Code Conventions & Common Patterns

**Naming.** camelCase functions, PascalCase components, `SCREAMING_SNAKE` exported constants. English user-facing errors (`TOO_LONG_MESSAGE`, `WRAP_TOO_LONG`, `STILL_NO_CANVAS`, `STILL_ERROR`).

**Types.** TypeScript `strict` + `noUnusedLocals` + `noUnusedParameters`. Unused args must be `_payload` (or removed). Prefer named exports.

**State.** React for discrete UI. `SceneRef` for 60 fps yaw/pitch/colors. Season/palette lerp writes `scene.current.colors` without re-rendering the tree every frame.

**Async.** WebCrypto wrap/unwrap; still/loop use `requestAnimationFrame` + canvas snapshot. Create wrap effect uses a 200 ms timeout and a `cancelled` flag. Decrypt failures return `null` — do not throw.

**Crypto / buffers.** Copy `salt` / `iv` / `cipher` to new `Uint8Array` before SubtleCrypto. For `File` in tests, copy bytes into a real `ArrayBuffer` (`new Uint8Array(n); copy.set(bytes); new File([copy.buffer], …)`).

**Determinism.** `hashString(payload)` seeds layout only. Same payload + tree + season → same tree. Species is **not** hashed from the URL.

**Species / ornaments / cover** (`palettes.ts`, `treeSpecies.ts`):

| Species | Notes |
| --- | --- |
| cherry | Pink spring foliage; blossom; autumn leaves copper |
| apple | Olive autumn leaves; hanging red fruit only in autumn |
| pine | Evergreen needles; no ornaments |
| willow | Drooping crown; hanging withes |
| maple | Autumn yellow; no fruit |

`groundCoverOf`: meadow / flower / dandelion. Finder ink uses `finderInkTones` (foliage family), not a second green QR. Old share links with `p=` still map onto a tree via `LEGACY_PALETTE_TREE`.

**Scan-safe scene.** Dark-module leaves only. Do not plant on light modules to fill side-view gaps — those holes **are** the code. Unlit pale wood. Uniform finder luma (any luma step inside a finder is a hole to jsQR). Finder blades: `FINDER_BLADE_HEIGHT = 1.75`, `FINDER_BLADE_LEAN = 0.42`. Rim/corners gust; finder `gust = 0`. Mosaic dark luma ~`0.418`/`0.428` (structural ~`0.33`). Light modules pin ~`0.78`. Particles/litter fade via `sceneryOpacity`; canopy and lawn stay.

**Errors.** Validate early (`payloadError`, framed search must start with `?`). Skip CRC-bad PNG chunks. Import with no winning channel throws `STILL_ERROR`.

**Editing hazard.** Do not apply mid-file patches to `src/scene/tree.ts`, `grassLayout.ts`, or `TreeFoliage.tsx` from a paginated read. A `Showing lines` footer has truncated those files. Rewrite the whole file from a complete buffer, then `rg "Showing lines" src`.

## Important Files

| File | Why |
| --- | --- |
| `src/app/useTreeState.ts` | Wrap, history, `applyShareState` (always Reveal; locked URL stays `DEFAULT_PAYLOAD`) |
| `src/share/params.ts` | `ShareState = { url, season, tree, locked, mode }` |
| `src/share/secret.ts` | `gv1.` + PBKDF2-SHA256 120000, salt 16, IV 12, `MAX_WRAPPED = 280` |
| `src/share/scanGrove.ts` | `rasterQr` + jsQR `attemptBoth` |
| `src/share/stillEncode.ts` | `GRV1` frame + CRC only (no pixel embed) |
| `src/share/containerMeta.ts` | PNG/GIF/JPEG container read/write; `pickHiddenSearch` |
| `src/share/exportLoop.ts` | Slow orbit GIF; restore camera in `finally` |
| `src/qr/encode.ts` / `contrast.ts` / `raster.ts` | Living and downloadable 2D code |
| `src/scene/tree.ts` / `treeSpecies.ts` / `palettes.ts` | Crown + season/species contracts |
| `src/scene/TreeCanvas.tsx` | `preserveDrawingBuffer` + `data-grove-canvas` (required for Save Still/Loop) |
| `src/ui/RevealPanel.tsx` | Scan + password; no URL field |
| `package.json`, `vite.config.ts`, `tsconfig.json` | Tooling |

## Runtime/Tooling Preferences

- **Runtime:** Node + browser APIs. Not Bun. No `engines` / `packageManager` field.
- **Package manager:** npm (`package-lock.json` lockfileVersion 3). Do not add a second lockfile.
- **Stack:** Vite 6, React 19, TypeScript 7, R3F / three, `uqr`, `jsqr`, `gifenc`.
- **`jsqr` is a production dependency** (`scanGrove.ts`). Keep it in `dependencies`.
- **`gifenc`** has no upstream types; use `src/share/gifenc.d.ts`. Its write-frame API has no comment field — comments are injected as bytes.
- **No** `gifuct-js`, pixel stego, ESLint, Prettier, Tailwind, backend, or env vars (`src/vite-env.d.ts` is Vite client types only).
- Tests run in **Node**. Do not import `downloadStillPng` / `downloadLoopGif` (they need `document`) into unit tests.

## Testing & QA

Vitest 4, `environment: 'node'`, `include: ['src/**/*.test.ts']` only. No `*.test.tsx`, no jsdom, no setup file, no coverage threshold.

```bash
npm test
npx vitest run src/share/secret.test.ts
```

Colocate tests next to the module. Style is `describe` / `it` / `expect` with inline fixtures (tiny PNG/GIF bytes, `File` from copied buffers).

**Contracts to keep green:**

- Wrap hides the URL; wrong password → `null`; scan of a locked grove returns the `gv1.` token, not the plaintext.
- `LOOP_DELAY_MS >= 160` (source is 180).
- Share params: `u/s/t` plus `e`/`m`; leftover `p=` still resolves a tree.
- Import is metadata-only; empty / plain / `> 12MB` files throw `STILL_ERROR`.
- Pink summer canopy is not green-dominant; dark-module luma band stays tight.
- `rasterQr` + jsQR still decodes; 1024px Download QR is not cropped.
- Species from `t=`; crown layers populated; finder blades stay in dark ink.

After **share/crypto**: `src/share/*.test.ts`. After **scene/scanability**: `raster.test.ts`, `scanGrove.test.ts`, `contrast.test.ts`, `tree.test.ts`, `grassLayout.test.ts`, `treeProjection.test.ts` (slow), then the full suite.

Live check: Create wrap → address bar shows `gv1.` + `e=1`; Reveal has no URL box; Scan without password asks for it; Scan with password yields the URL. Overhead should decode; side view should not look like a flat QR.

## Hard Constraints

Do **not** reintroduce:

- Pixel QR, LSB, `paintHiddenQr` / `extractHiddenQr` / `embedStillPayload`, or `gifuct-js`
- `VarietyBar` or `speciesForPayload` as a species resolver
- Encoding `buildShareSearch` into the living grove QR
- Docs the user did not ask for

`applyShareState` must: set Reveal, apply season/tree, reset camera to `VIEW_PITCH` / `VIEW_YAW`, set `url` to `DEFAULT_PAYLOAD` when locked (otherwise the imported URL). Keep `preserveDrawingBuffer` and `[data-grove-canvas]`.
