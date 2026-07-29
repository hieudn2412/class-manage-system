import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => {
  if (command !== "serve" || mode !== "development") {
    throw new Error(
      "Production frontend is disabled. Use `npm run dev` for the local development environment.",
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "127.0.0.1",
      port: 4173,
    },
  };
});
