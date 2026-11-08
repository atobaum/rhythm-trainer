import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 는 레포 이름 경로 아래에서 서빙하므로 자산을 상대 경로로 참조한다.
  base: './',
  plugins: [
    react(),
    VitePWA({
      // 새 버전은 백그라운드에서 받고, 페이지를 다시 열 때 적용된다. 연습 중 강제 새로고침은 하지 않는다.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rhythm Lab',
        short_name: 'Rhythm Lab',
        description: '악보를 보고 리듬을 탭하며 익히는 연습 앱',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,otf}'],
        // 악보 폰트가 번들에 들어가 기본 한도(2MB)에 가깝다.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
