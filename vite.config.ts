import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 는 레포 이름 경로 아래에서 서빙하므로 자산을 상대 경로로 참조한다.
  base: './',
  plugins: [react()],
})
