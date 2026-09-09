import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { hydrateStorage, loadSettings } from "./storage";
import { setEventToPoeSearchInputBox } from "../pathofexile/makeAutoTileSearch";

const container = document.createElement("div");
document.body.appendChild(container);

//const container = document.getElementById("root");

// The '!' operator ensures TypeScript that 'container' is not null
const root = createRoot(container!);

// 스토리지에서 세팅값 읽은 후 화면 진입
void hydrateStorage().then(() => {
    // 검색어 자동 ~ 붙이기는 설정이 켜져 있을 때만 리스너를 단다
    setEventToPoeSearchInputBox(loadSettings().autoAppendTilde);

    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
