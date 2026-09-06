# ictree

[English](README.md) · [中文](README.zh-CN.md)

A URL becomes a QR module grid. The 3D tree **is** that grid from overhead.

Type a URL (optional password), grow a tree, and share it. Open a still or loop to reveal the payload in the browser — encrypted content is never readable from the address bar or from image pixels alone.

Live: [ictree.canonforgecs.com](https://ictree.canonforgecs.com)

## Create

1. Enter text or a URL.
2. Optionally set a password. A locked tree encodes a `gv2.` AES-GCM token, not the plaintext URL.
3. Pick a tree (Cherry, Apple, Willow, Maple), a season, and an ink style (plants, mosaic, or pixel).
4. Drag to orbit. Tap to look straight down — that overhead view is the scannable code.

Leaves and filler sit on **dark modules only**. The holes are the code.

## Reveal

Import a still or loop, or open a share link. Scan runs on the live mosaic in the browser, not on a WebGL screenshot. Locked trees ask for the password locally.

## Share

| Export | What it stores |
| --- | --- |
| Copy link | `?u=&s=&t=` (plus `e=1` when locked) |
| Save still / loop | Payload in container metadata only. The picture stays visually clean. |
| Download QR | A separate flat mosaic (`ictree-qr.png`) |

Social sites that strip image metadata will not import. That is expected.

## Develop

Client-only: Vite, React, TypeScript, Three.js. No backend.

```bash
npm install
npm run dev      # use the printed Local URL
npm test
npm run build
```

Node and npm. The lockfile is `package-lock.json`.

## License

[Apache License 2.0](LICENSE). Copyright 2026 redPeak5421. See [NOTICE](NOTICE).

Seasonal ambience is CC0 field recordings from [BigSoundBank](https://bigsoundbank.com/); sources are listed in `public/audio/SOURCES.txt`.
