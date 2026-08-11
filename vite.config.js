import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // GitHub Pages の https://TakanoriHosoya.github.io/kakeibo-app/ 配下で配信するため、
  // アセットの参照をサブディレクトリ基準にする（CRA の homepage フィールドの代わり）。
  base: '/kakeibo-app/',

  // ポートを 3000 に固定する。GCP の「承認済みの JavaScript 生成元」に
  // http://localhost:3000 が登録されているため、ここがずれるとローカルでログインできない。
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
});
