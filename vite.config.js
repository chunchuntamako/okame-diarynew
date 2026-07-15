import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pagesで配信する場合はリポジトリ名に合わせて base を設定してください
  // base: '/okame-diary/',
});
