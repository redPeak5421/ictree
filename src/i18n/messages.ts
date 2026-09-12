import type { Season } from '../scene/palettes'
import type { TreeSpecies } from '../scene/treeSpecies'

export type Locale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ru' | 'fr'

export const LOCALES: readonly { id: Locale; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh-CN', name: '简体中文' },
  { id: 'zh-TW', name: '繁體中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ru', name: 'Русский' },
  { id: 'fr', name: 'Français' },
]

export interface Messages {
  language: string
  mode: string
  create: string
  reveal: string
  hintOverhead: string
  hintOblique: string
  textOrUrl: string
  password: string
  passwordOptional: string
  unlockPassword: string
  mute: string
  unmute: string
  rainOn: string
  rainOff: string
  season: string
  seasons: Record<Season, string>
  tree: string
  trees: Record<TreeSpecies, string>
  inkStyle: string
  inkStyles: { plants: string; blocks: string; solid: string }
  share: string
  shareGroup: string
  exportGroup: string
  importGroup: string
  copyLink: string
  copied: string
  copyLinkPrompt: string
  downloadQr: string
  saveStill: string
  saveLoop: string
  savingStill: string
  savingLoop: string
  openStill: string
  shareOnX: string
  facebook: string
  whatsapp: string
  scanTree: string
  scanning: string
  holdOverhead: string
  enterPassword: string
  wrongPassword: string
  copyPayload: string
  restoreQr: string
  webglUnavailable: string
  /** Error strings thrown by the share and payload modules, keyed by their English text. */
  errors: Record<string, string>
}

const en: Messages = {
  language: 'Language',
  mode: 'Mode',
  create: 'Create',
  reveal: 'Reveal',
  hintOverhead: 'Tap to come back down',
  hintOblique: 'Drag to turn · Tap to see it from above',
  textOrUrl: 'Text or URL',
  password: 'Password',
  passwordOptional: 'Password (optional)',
  unlockPassword: 'Unlock password',
  mute: 'Mute',
  unmute: 'Unmute',
  rainOn: 'Turn rain on',
  rainOff: 'Turn rain off',
  season: 'Season',
  seasons: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn' },
  tree: 'Tree',
  trees: { cherry: 'Cherry', apple: 'Apple', pine: 'Pine', willow: 'Willow', maple: 'Maple' },
  inkStyle: 'Style',
  inkStyles: { plants: 'Plants', blocks: 'Mosaic', solid: 'Pixel' },
  share: 'Share',
  shareGroup: 'Share',
  exportGroup: 'Export',
  importGroup: 'Import',
  copyLink: 'Copy link',
  copied: 'Copied',
  copyLinkPrompt: 'Copy link',
  downloadQr: 'Download QR',
  saveStill: 'Save still',
  saveLoop: 'Save loop',
  savingStill: 'Saving still…',
  savingLoop: 'Orbiting the tree…',
  openStill: 'Open image',
  shareOnX: 'Share on X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  scanTree: 'Scan tree',
  scanning: 'Scanning…',
  holdOverhead: 'Hold the tree from above, then scan.',
  enterPassword: 'Enter the password, then scan.',
  wrongPassword: 'Wrong password.',
  copyPayload: 'Copy',
  restoreQr: 'Restore QR',
  webglUnavailable: 'WebGL is unavailable. You can still download a scannable QR.',
  errors: {
    'URL is too long for a reliable scan': 'URL is too long for a reliable scan',
    'Password-protected URL is too long': 'Password-protected URL is too long',
    'This image is not an ictree share.': 'This image is not an ictree share.',
    'Need WebGL to save a still.': 'Need WebGL to save a still.',
    'Could not lock the URL': 'Could not lock the URL',
  },
}

const zhCN: Messages = {
  language: '语言',
  mode: '模式',
  create: '创建',
  reveal: '识别',
  hintOverhead: '点按回到地面',
  hintOblique: '拖动旋转 · 点按俯视',
  textOrUrl: '文字或网址',
  password: '密码',
  passwordOptional: '密码（可选）',
  unlockPassword: '解锁密码',
  mute: '静音',
  unmute: '取消静音',
  rainOn: '开启下雨',
  rainOff: '关闭下雨',
  season: '季节',
  seasons: { spring: '春', summer: '夏', autumn: '秋' },
  tree: '树种',
  trees: { cherry: '樱花', apple: '苹果', pine: '松树', willow: '柳树', maple: '枫树' },
  inkStyle: '样式',
  inkStyles: { plants: '植物', blocks: '马赛克', solid: '像素' },
  share: '分享',
  shareGroup: '分享',
  exportGroup: '导出',
  importGroup: '导入',
  copyLink: '复制链接',
  copied: '已复制',
  copyLinkPrompt: '复制链接',
  downloadQr: '下载二维码',
  saveStill: '保存静态图',
  saveLoop: '保存动图',
  savingStill: '正在保存静态图…',
  savingLoop: '正在绕树拍照…',
  openStill: '打开图片',
  shareOnX: '分享到 X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  scanTree: '识别树木',
  scanning: '识别中…',
  holdOverhead: '先俯视这棵树，再识别。',
  enterPassword: '输入密码后再识别。',
  wrongPassword: '密码错误。',
  copyPayload: '复制',
  restoreQr: '恢复二维码',
  webglUnavailable: '当前无法使用 WebGL，你仍可下载可扫描的二维码。',
  errors: {
    'URL is too long for a reliable scan': '网址太长，无法可靠扫描',
    'Password-protected URL is too long': '加密后的网址太长',
    'This image is not an ictree share.': '这张图片不是 ictree 分享图。',
    'Need WebGL to save a still.': '保存静态图需要 WebGL。',
    'Could not lock the URL': '无法加密该网址',
  },
}

const zhTW: Messages = {
  language: '語言',
  mode: '模式',
  create: '建立',
  reveal: '辨識',
  hintOverhead: '點一下回到地面',
  hintOblique: '拖曳旋轉 · 點一下俯視',
  textOrUrl: '文字或網址',
  password: '密碼',
  passwordOptional: '密碼（選填）',
  unlockPassword: '解鎖密碼',
  mute: '靜音',
  unmute: '取消靜音',
  rainOn: '開啟下雨',
  rainOff: '關閉下雨',
  season: '季節',
  seasons: { spring: '春', summer: '夏', autumn: '秋' },
  tree: '樹種',
  trees: { cherry: '櫻花', apple: '蘋果', pine: '松樹', willow: '柳樹', maple: '楓樹' },
  inkStyle: '樣式',
  inkStyles: { plants: '植物', blocks: '馬賽克', solid: '像素' },
  share: '分享',
  shareGroup: '分享',
  exportGroup: '匯出',
  importGroup: '匯入',
  copyLink: '複製連結',
  copied: '已複製',
  copyLinkPrompt: '複製連結',
  downloadQr: '下載 QR Code',
  saveStill: '儲存靜態圖',
  saveLoop: '儲存動圖',
  savingStill: '正在儲存靜態圖…',
  savingLoop: '正在繞樹拍照…',
  openStill: '開啟圖片',
  shareOnX: '分享到 X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  scanTree: '辨識樹木',
  scanning: '辨識中…',
  holdOverhead: '先俯視這棵樹，再辨識。',
  enterPassword: '輸入密碼後再辨識。',
  wrongPassword: '密碼錯誤。',
  copyPayload: '複製',
  restoreQr: '恢復 QR Code',
  webglUnavailable: '目前無法使用 WebGL，你仍可下載可掃描的 QR Code。',
  errors: {
    'URL is too long for a reliable scan': '網址太長，無法可靠掃描',
    'Password-protected URL is too long': '加密後的網址太長',
    'This image is not an ictree share.': '這張圖片不是 ictree 分享圖。',
    'Need WebGL to save a still.': '儲存靜態圖需要 WebGL。',
    'Could not lock the URL': '無法加密該網址',
  },
}

const ja: Messages = {
  language: '言語',
  mode: 'モード',
  create: '作成',
  reveal: '読み取り',
  hintOverhead: 'タップで地上に戻る',
  hintOblique: 'ドラッグで回転 · タップで真上から',
  textOrUrl: 'テキストまたはURL',
  password: 'パスワード',
  passwordOptional: 'パスワード（任意）',
  unlockPassword: '解除パスワード',
  mute: 'ミュート',
  unmute: 'ミュート解除',
  rainOn: '雨を降らせる',
  rainOff: '雨を止める',
  season: '季節',
  seasons: { spring: '春', summer: '夏', autumn: '秋' },
  tree: '樹種',
  trees: { cherry: '桜', apple: 'りんご', pine: '松', willow: '柳', maple: 'もみじ' },
  inkStyle: '表示',
  inkStyles: { plants: '植物', blocks: 'モザイク', solid: 'ピクセル' },
  share: '共有',
  shareGroup: '共有',
  exportGroup: '書き出し',
  importGroup: '読み込み',
  copyLink: 'リンクをコピー',
  copied: 'コピーしました',
  copyLinkPrompt: 'リンクをコピー',
  downloadQr: 'QRをダウンロード',
  saveStill: '静止画を保存',
  saveLoop: 'ループ動画を保存',
  savingStill: '静止画を保存中…',
  savingLoop: '木のまわりを撮影中…',
  openStill: '画像を開く',
  shareOnX: 'Xで共有',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  scanTree: '木を読み取る',
  scanning: '読み取り中…',
  holdOverhead: '木を真上から見てから読み取ってください。',
  enterPassword: 'パスワードを入力してから読み取ってください。',
  wrongPassword: 'パスワードが違います。',
  copyPayload: 'コピー',
  restoreQr: 'QRに戻す',
  webglUnavailable: 'WebGLが使えません。読み取り可能なQRはダウンロードできます。',
  errors: {
    'URL is too long for a reliable scan': 'URLが長すぎて確実に読み取れません',
    'Password-protected URL is too long': 'パスワード付きURLが長すぎます',
    'This image is not an ictree share.': 'この画像は ictree の共有画像ではありません。',
    'Need WebGL to save a still.': '静止画の保存にはWebGLが必要です。',
    'Could not lock the URL': 'URLを暗号化できませんでした',
  },
}

const ru: Messages = {
  language: 'Язык',
  mode: 'Режим',
  create: 'Создать',
  reveal: 'Прочитать',
  hintOverhead: 'Нажмите, чтобы вернуться вниз',
  hintOblique: 'Тяните, чтобы повернуть · Нажмите, чтобы взглянуть сверху',
  textOrUrl: 'Текст или ссылка',
  password: 'Пароль',
  passwordOptional: 'Пароль (необязательно)',
  unlockPassword: 'Пароль для разблокировки',
  mute: 'Выключить звук',
  unmute: 'Включить звук',
  rainOn: 'Включить дождь',
  rainOff: 'Выключить дождь',
  season: 'Сезон',
  seasons: { spring: 'Весна', summer: 'Лето', autumn: 'Осень' },
  tree: 'Дерево',
  trees: { cherry: 'Сакура', apple: 'Яблоня', pine: 'Сосна', willow: 'Ива', maple: 'Клён' },
  inkStyle: 'Вид',
  inkStyles: { plants: 'Растения', blocks: 'Мозаика', solid: 'Пиксели' },
  share: 'Поделиться',
  shareGroup: 'Поделиться',
  exportGroup: 'Экспорт',
  importGroup: 'Импорт',
  copyLink: 'Скопировать ссылку',
  copied: 'Скопировано',
  copyLinkPrompt: 'Скопировать ссылку',
  downloadQr: 'Скачать QR-код',
  saveStill: 'Сохранить кадр',
  saveLoop: 'Сохранить анимацию',
  savingStill: 'Сохраняем кадр…',
  savingLoop: 'Обходим дерево…',
  openStill: 'Открыть изображение',
  shareOnX: 'Поделиться в X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  scanTree: 'Прочитать дерево',
  scanning: 'Читаем…',
  holdOverhead: 'Посмотрите на дерево сверху, затем читайте.',
  enterPassword: 'Введите пароль, затем читайте.',
  wrongPassword: 'Неверный пароль.',
  copyPayload: 'Копировать',
  restoreQr: 'Вернуть QR-код',
  webglUnavailable: 'WebGL недоступен. QR-код для сканирования всё равно можно скачать.',
  errors: {
    'URL is too long for a reliable scan': 'Ссылка слишком длинная для надёжного сканирования',
    'Password-protected URL is too long': 'Ссылка с паролем слишком длинная',
    'This image is not an ictree share.': 'Это изображение — не файл ictree.',
    'Need WebGL to save a still.': 'Для сохранения кадра нужен WebGL.',
    'Could not lock the URL': 'Не удалось защитить ссылку паролем',
  },
}

const fr: Messages = {
  language: 'Langue',
  mode: 'Mode',
  create: 'Créer',
  reveal: 'Lire',
  hintOverhead: 'Touchez pour redescendre',
  hintOblique: 'Glissez pour tourner · Touchez pour voir d\u2019en haut',
  textOrUrl: 'Texte ou URL',
  password: 'Mot de passe',
  passwordOptional: 'Mot de passe (facultatif)',
  unlockPassword: 'Mot de passe de déverrouillage',
  mute: 'Couper le son',
  unmute: 'Activer le son',
  rainOn: 'Faire pleuvoir',
  rainOff: 'Arrêter la pluie',
  season: 'Saison',
  seasons: { spring: 'Printemps', summer: 'Été', autumn: 'Automne' },
  tree: 'Arbre',
  trees: { cherry: 'Cerisier', apple: 'Pommier', pine: 'Pin', willow: 'Saule', maple: 'Érable' },
  inkStyle: 'Style',
  inkStyles: { plants: 'Plantes', blocks: 'Mosaïque', solid: 'Pixels' },
  share: 'Partager',
  shareGroup: 'Partager',
  exportGroup: 'Exporter',
  importGroup: 'Importer',
  copyLink: 'Copier le lien',
  copied: 'Copié',
  copyLinkPrompt: 'Copier le lien',
  downloadQr: 'Télécharger le QR',
  saveStill: 'Enregistrer l\u2019image',
  saveLoop: 'Enregistrer la boucle',
  savingStill: 'Enregistrement…',
  savingLoop: 'Tour de l\u2019arbre…',
  openStill: 'Ouvrir une image',
  shareOnX: 'Partager sur X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  scanTree: 'Lire l\u2019arbre',
  scanning: 'Lecture…',
  holdOverhead: 'Regardez l\u2019arbre d\u2019en haut, puis lisez.',
  enterPassword: 'Saisissez le mot de passe, puis lisez.',
  wrongPassword: 'Mot de passe incorrect.',
  copyPayload: 'Copier',
  restoreQr: 'Restaurer le QR',
  webglUnavailable: 'WebGL est indisponible. Vous pouvez tout de même télécharger un QR lisible.',
  errors: {
    'URL is too long for a reliable scan': 'L\u2019URL est trop longue pour une lecture fiable',
    'Password-protected URL is too long': 'L\u2019URL protégée par mot de passe est trop longue',
    'This image is not an ictree share.': 'Cette image n\u2019est pas une image ictree.',
    'Need WebGL to save a still.': 'WebGL est nécessaire pour enregistrer une image.',
    'Could not lock the URL': 'Impossible de protéger l\u2019URL',
  },
}

export const MESSAGES: Record<Locale, Messages> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ru, fr }

/** Error text from a thrown module error, in the current language when we know it. */
export function translateMessage(messages: Messages, text: string): string {
  return messages.errors[text] ?? text
}
