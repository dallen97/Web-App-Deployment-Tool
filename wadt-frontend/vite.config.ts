import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/wadtapp": {
        target: "http://localhost:8000",
        changeOrigin: false, // keep Host: localhost:5173 so Django sets CSRF cookie for frontend origin
      },
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: false,
      },
    },
  },
});
