import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// okame-diarynew リポジトリのサブパスとして GitHub Pages に公開するための base
// 公開URL: https://chunchuntamako.github.io/okame-diarynew/tomo-notify-web/
export default defineConfig({
  plugins: [react()],
  base: "/okame-diarynew/tomo-notify-web/",
});
