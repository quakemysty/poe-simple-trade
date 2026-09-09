import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Test_poe_main } from "./Test_poe_main";
import { App } from "./content/App";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Test_poe_main />
        <App />
    </StrictMode>,
);
