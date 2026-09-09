/**
 * Path of Exile 검색결과 아이템 목록에 POB 영문용 Export 버튼 추가
 */
function parseEnglishJsonToText(item) {
    const lines = [];

    const firstProp = item.properties?.[0]?.name || "";
    lines.push(`Item Class: ${firstProp}`);
    lines.push(`Rarity: ${item.rarity}`);
    lines.push(item.name || "");
    lines.push(item.typeLine || "");
    lines.push("--------");

    if (item.properties?.length > 1) {
        const radiusProp = item.properties.find(
            (prop) => prop.name === "Radius" && prop.values?.length,
        );
        if (radiusProp) {
            const val = radiusProp.values[0]?.[0] || "";
            lines.push(`Radius: ${val}`);
        } else {
            const qualityProp = item.properties.slice(1).find((prop) => {
                const name = prop.name.replace(/\[(?:.*?)\|(.*?)\]/g, "$1").replace(/[\[\]]/g, "");
                return name.toLowerCase().startsWith("quality");
            });
            if (qualityProp) {
                const name = qualityProp.name;
                const vals = qualityProp.values.map((v) => v[0]).join(", ");
                lines.push(`${name}: ${vals}`);
            }
        }
    }

    if (item.sockets?.length) {
        const socketStr = item.sockets.map(() => "S").join(" ");
        lines.push(`Sockets: ${socketStr}`);
    }

    if (item.socketedItems?.length) {
        item.socketedItems.forEach((rune) => {
            lines.push(`Rune: ${rune.typeLine || "None"}`);
        });
    } else {
        lines.push("Rune: None");
    }

    lines.push("--------");

    if (item.ilvl) lines.push(`Item Level: ${item.ilvl}`);
    lines.push("--------");

    if (item.implicitMods?.length) {
        lines.push(...item.implicitMods.map(cleanMod).map((m) => `{implicit}${m}`));
        lines.push("--------");
    }

    if (item.enchantMods?.length) {
        lines.push(...item.enchantMods.map(cleanMod).map((m) => `{enchant}${m}`));
    }

    if (item.runeMods?.length) {
        const runeLines = item.runeMods.map(cleanMod);
        runeLines.forEach((line, idx) => {
            runeLines[idx] = `{enchant}{rune}${line}`;
        });
        lines.push(...runeLines);
    }

    lines.push("--------");

    if (item.explicitMods?.length) lines.push(...item.explicitMods.map(explicitModToLine));

    lines.push("--------");

    if (item.corrupted) {
        lines.push("Corrupted");
    }

    return lines.filter(Boolean).join("\n").trim();
}

function cleanMod(mod) {
    return mod;
}

function explicitModToLine(mod) {
    if (typeof mod === "string") return mod;
    if (!mod || typeof mod !== "object") return mod;

    const text = mod.description ?? "";
    const activeFlag = mod.flags && Object.keys(mod.flags).find((k) => mod.flags[k]);

    return activeFlag ? `{${activeFlag}}${text}` : text;
}

function showToast(msg, target) {
    if (!target) target = document.body;

    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.position = "absolute";
    toast.style.background = "#333";
    toast.style.color = "#fff";
    toast.style.padding = "6px 12px";
    toast.style.borderRadius = "4px";
    toast.style.zIndex = "9999";

    let rect;
    try {
        rect = target.getBoundingClientRect();
    } catch {
        rect = { top: window.innerHeight / 2, left: window.innerWidth / 2 };
    }

    toast.style.top = `${rect.top + window.scrollY - 40}px`;
    toast.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

const chromeMessageName =
    window.location.href.indexOf("/trade2") > 0 ? "fetchItemPOE2" : "fetchItemPOE1";

function addExportButtons() {
    const cards = document.querySelectorAll(".resultset .row");

    cards.forEach((card) => {
        const leftDiv = card.querySelector(".left");
        const itemId = card.dataset.id;
        if (!leftDiv || !itemId || card.querySelector(".export-icon")) return;

        const exportBtn = document.createElement("button");
        exportBtn.innerText = "Export";
        exportBtn.className = "export-icon";

        exportBtn.style.display = "block";
        exportBtn.style.margin = "4px auto";
        exportBtn.style.height = "20px";
        exportBtn.style.backgroundColor = "#4CAF50";
        exportBtn.style.color = "#fff";
        exportBtn.style.border = "none";
        exportBtn.style.borderRadius = "4px";
        exportBtn.style.padding = "2px 6px";
        exportBtn.style.fontSize = "12px";
        exportBtn.style.cursor = "pointer";

        exportBtn.addEventListener("click", (event) => {
            chrome.runtime.sendMessage({ action: chromeMessageName, itemId }, (res) => {
                if (res?.success && res.item) {
                    const text = parseEnglishJsonToText(res.item);
                    navigator.clipboard
                        .writeText(text)
                        .then(() =>
                            showToast("Copied to clipboard!", event.currentTarget || exportBtn),
                        )
                        .catch((err) => {
                            console.error("Copy failed:", err);
                            showToast("Copy failed", event.currentTarget || exportBtn);
                        });
                } else {
                    showToast("Item data fetch failed!", event.currentTarget || exportBtn);
                }
            });
        });

        leftDiv.appendChild(exportBtn);
    });
}

const mainObserver = new MutationObserver(() => {
    const resultSet = document.querySelector(".resultset");
    if (resultSet) {
        addExportButtons();

        const listObserver = new MutationObserver(addExportButtons);
        listObserver.observe(resultSet, { childList: true, subtree: false });
    }
});

mainObserver.observe(document.body, { childList: true, subtree: true });
