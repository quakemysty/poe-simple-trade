//-----------------------------------
// for chrome extension
//-----------------------------------
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
//import manifest from "./public/manifest.json";
import manifest from "./manifest.config";

function watchJson(paths: string[]): Plugin {
    return {
        name: "watch-json",
        configureServer(server) {
            server.watcher.add(paths);
            server.watcher.on("change", (file) => {
                if (!file.endsWith(".json")) return;
                server.ws.send({ type: "custom", event: "ext:json-changed", data: { file } });
                server.config.logger.info(`[watch-json] ${file} reload`);
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), crx({ manifest }), watchJson(["src/locales/*.json", "src/assets/*.json"])],
    base: "./",
    server: {
        port: 5173,
        strictPort: true,
        hmr: { port: 5173 },
    },
});
