import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

await build({
  root,
  configFile: false,
  plugins: [react()],
});
