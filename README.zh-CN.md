# ictree

[English](README.md) · [中文](README.zh-CN.md)

网址会变成一张 QR 模块网格。这棵 3D 树从正上方看**就是**那张网格。

输入网址（可选密码），长出一棵树，再分享出去。打开静态图或动图后，在浏览器里本地识别内容——加密内容无法从地址栏或图片像素里直接读出。

线上： [ictree.canonforgecs.com](https://ictree.canonforgecs.com)

## 创建

1. 输入文字或网址。
2. 可选地设置密码。加锁后的树编码的是 `gv2.` AES-GCM 令牌，不是明文网址。
3. 选择树种（樱花、苹果、柳树、枫树）、季节和样式（植物、马赛克或像素）。
4. 拖动环绕。点按俯视——正上方就是可扫描的码。

叶子和填充只长在**暗模块**上。那些空隙就是码本身。

## 识别

导入静态图或动图，或打开分享链接。识别跑在浏览器里的实时马赛克上，而不是 WebGL 截图。加锁的树会在本地询问密码。

## 分享

| 导出 | 存放内容 |
| --- | --- |
| 复制链接 | `?u=&s=&t=`（加锁时另加 `e=1`） |
| 保存静态图 / 动图 | 载荷只写在容器元数据里。画面保持干净。 |
| 下载二维码 | 另存一张平面马赛克（`ictree-qr.png`） |

会剥掉图片元数据的社交平台无法导入。这是预期行为。

## 开发

纯前端：Vite、React、TypeScript、Three.js。没有后端。

```bash
npm install
npm run dev      # 使用终端打印的 Local URL
npm test
npm run build
```

需要 Node 和 npm。锁文件是 `package-lock.json`。

## 许可

[Apache License 2.0](LICENSE)。Copyright 2026 redPeak5421。见 [NOTICE](NOTICE)。

季节环境音是来自 [BigSoundBank](https://bigsoundbank.com/) 的 CC0 录音；来源列在 `public/audio/SOURCES.txt`。
