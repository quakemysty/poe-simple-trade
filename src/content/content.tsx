import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { hydrateStorage, loadSettings } from "./storage";
import { setEventToPoeSearchInputBox } from "../pathofexile/makeAutoTileSearch";

const container = document.createElement("div");
document.body.appendChild(container);

// The '!' operator ensures TypeScript that 'container' is not null
const root = createRoot(container!);

/**
 * 크롬 확장프로그램 진입점
 *
 * @see /public/manifest.json 파일의 "content_scripts" 항목 참고
 */
void hydrateStorage().then(() => {
    // '검색어 자동 ~ 붙이기' keydown 이벤트 세팅
    setEventToPoeSearchInputBox(loadSettings().autoAppendTilde);

    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
