import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => {
  const variables =
    command === "serve"
      ? loadEnv(mode, resolve(import.meta.dirname, ".."), "VALES_DEV_")
      : {};
  const backend =
    variables.VALES_DEV_BACKEND_URL?.trim() || "http://127.0.0.1:8080";

  return {
    base: "/app/",
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
    server: {
      proxy: {
        "/api": backend,
        "/login": backend,
        "/logout": backend,
      },
    },
  };
});
