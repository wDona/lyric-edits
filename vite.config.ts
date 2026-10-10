import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { api } from "./server/api.ts";

export default defineConfig({
  plugins: [react(), api()],
  // fixed: renders fetch the audio and media back from this server
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
});
