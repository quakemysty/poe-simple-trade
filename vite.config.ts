//-----------------------------------
//local test
//-----------------------------------
// import react, { reactCompilerPreset } from "@vitejs/plugin-react";
// import babel from "@rolldown/plugin-babel";
// import { defineConfig } from "vite";

// export default defineConfig({
//     plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
// });

//-----------------------------------
// for chrome extension
//-----------------------------------
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";

export default defineConfig({
    plugins: [react(), crx({ manifest })],
    base: "./",
});
