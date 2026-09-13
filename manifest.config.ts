import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "POE Simple Trade",
    version: "1.0.0.2",
    description: "POE1,2 Simple Bookmark for Trading",
    permissions: ["storage", "clipboardWrite"],
    background: { service_worker: "src/background/background.ts", type: "module" },
    host_permissions: [
        "https://www.pathofexile.com/trade*",
        "https://poe.kakaogames.com/trade*",
        "https://www.pathofexile.com/api/*",
        "https://poe.ninja/*",
    ],
    content_scripts: [
        {
            matches: ["https://poe.kakaogames.com/trade*", "https://www.pathofexile.com/trade*"],
            js: ["src/content/content.tsx"],
        },
    ],
});
