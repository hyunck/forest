import { defineConfig } from 'vite';

// base를 상대 경로로 두어 GitHub Pages(/저장소이름/)를 포함한
// 어떤 정적 호스팅 경로에서도 그대로 열리게 합니다.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true, port: 5173 },
});
