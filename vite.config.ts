import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:html` → dist-html/index.html 1枚に全部入り（PWA機能なし）
export default defineConfig(({ mode }) => ({
  base: './',
  build: mode === 'single' ? { outDir: 'dist-html' } : undefined,
  plugins: [
    react(),
    tailwindcss(),
    mode === 'single' && viteSingleFile(),
    VitePWA({
      disable: mode === 'single',
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ジャンプ コレクション',
        short_name: 'ジャンプ蔵書',
        description: '週刊少年ジャンプ 1981–2026 所持管理',
        lang: 'ja',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
}))
