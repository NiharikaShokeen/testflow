import vinext from "vinext";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  server: {
    watch: process.platform === "darwin" ? { useFsEvents: false, usePolling: true } : undefined,
  },
  plugins: [
    vinext(),
    cloudflare({
      configPath: "wrangler.jsonc",
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
    }),
  ],
});
