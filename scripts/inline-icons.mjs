// dist-html/index.html のアイコン参照を data URI に埋め込み、1ファイルで完結させる
import { readFileSync, writeFileSync } from 'node:fs'
const p = 'dist-html/index.html'
const b64 = (f) => readFileSync(f).toString('base64')
let s = readFileSync(p, 'utf8')
s = s
  .replace('href="./icons/icon.svg"', `href="data:image/svg+xml;base64,${b64('public/icons/icon.svg')}"`)
  .replace('href="./icons/apple-touch-icon.png"', `href="data:image/png;base64,${b64('public/icons/apple-touch-icon.png')}"`)
  .replace(/<link rel="manifest"[^>]*>/, '')
writeFileSync(p, s)
console.log('inlined icons → dist-html/index.html')
