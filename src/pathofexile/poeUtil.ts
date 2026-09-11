import type { Language } from "../content/storage";

/**
 * 주소로 게임 버전 체크
 */
const detectGameType = (): string => (window.location.href.includes("/trade2") ? "poe2" : "poe1");

/**
 * Path of Exlie 아이템 검색 URL 의 제일 마지막 부분만 발췌
 */
const getItemSearchConditionUrl = (): string => {
    const url = document.location.href;
    return url.substring(url.lastIndexOf("/") + 1);
};

/**
 * 저장해 둔 Bookmark URL 과 현재 리그로 실제 이동할 주소를 만든다
 */
const getItemSearchUrl = (bookmarkUrl: string, leagueName: string): string => {
    const prefixHostUrl = `${document.location.protocol}//${document.location.host}`;
    const league = encodeURIComponent(leagueName);

    return detectGameType() === "poe1"
        ? `${prefixHostUrl}/trade/search/${league}/${bookmarkUrl}`
        : `${prefixHostUrl}/trade2/search/poe2/${league}/${bookmarkUrl}`;
};

/**
 * Path of Exile 아이템 데이터 조회 / 변환
 */
type PathOfExileItem = {
    name?: string;
    typeLine?: string;
    rarity?: string;
    ilvl?: number;
    properties?: { name: string; values: [string, number][] }[];
    sockets?: unknown[];
    socketedItems?: { typeLine?: string }[];
    implicitMods?: string[];
    enchantMods?: string[];
    runeMods?: string[];
    explicitMods?: (string | { description?: string; flags?: Record<string, boolean> })[];
    corrupted?: boolean;
};

type FetchItemMessage = {
    action: "fetchItemPOE1" | "fetchItemPOE2";
    itemId: string;
};

type FetchItemResponse = {
    success: boolean;
    item?: PathOfExileItem;
};

const cleanMod = (mod: string): string => mod;

/**
 * Path of Exile trade API 의 아이템 JSON 을 POB(영문) 붙여넣기용 텍스트로 변환
 */
const parseItemJsonToEngText = (item: PathOfExileItem): string => {
    const lines: string[] = [];

    const firstProp = item.properties?.[0]?.name || "";
    lines.push(`Item Class: ${firstProp}`);
    lines.push(`Rarity: ${item.rarity}`);
    lines.push(item.name || "");
    lines.push(item.typeLine || "");
    lines.push("--------");

    if (item.properties && item.properties.length > 1) {
        const radiusProp = item.properties.find(
            (prop) => prop.name === "Radius" && prop.values?.length,
        );
        if (radiusProp) {
            const val = radiusProp.values[0]?.[0] || "";
            lines.push(`Radius: ${val}`);
        } else {
            const qualityProp = item.properties.slice(1).find((prop) => {
                const name = prop.name.replace(/\[(?:.*?)\|(.*?)\]/g, "$1").replace(/[[\]]/g, "");
                return name.toLowerCase().startsWith("quality");
            });
            if (qualityProp) {
                const vals = qualityProp.values.map((v) => v[0]).join(", ");
                lines.push(`${qualityProp.name}: ${vals}`);
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
        lines.push(...item.runeMods.map(cleanMod).map((m) => `{enchant}{rune}${m}`));
    }

    lines.push("--------");

    if (item.explicitMods?.length) {
        lines.push(
            ...item.explicitMods.map((mod) => {
                if (typeof mod === "string") return mod;
                if (!mod) return "";

                const text = mod.description ?? "";
                const activeFlag = mod.flags && Object.keys(mod.flags).find((k) => mod.flags?.[k]);

                return activeFlag ? `{${activeFlag}}${text}` : text;
            }),
        );
    }

    lines.push("--------");

    if (item.corrupted) {
        lines.push("Corrupted");
    }

    return lines.filter(Boolean).join("\n").trim();
};

/**
 * background 에 아이템 상세 조회를 요청한다
 *
 * @see /src/background/background.ts
 */
const fetchPathOfExileItemInfo = async (itemId: string): Promise<PathOfExileItem | undefined> => {
    const action = detectGameType() === "poe2" ? "fetchItemPOE2" : "fetchItemPOE1";

    try {
        const res = await chrome.runtime.sendMessage<FetchItemMessage, FetchItemResponse>({
            action,
            itemId,
        });
        return res?.success ? res.item : undefined;
    } catch {
        // 확장프로그램이 다시 로드돼 background 와 연결이 끊긴 경우 등
        return undefined;
    }
};

/**
 * PoeDB 주소. 영문 이름에서 ' 는 빼고 공백은 _ 로 바꾼다 (예: Atziri's Acuity → Atziris_Acuity).
 * 언어 설정이 한국어면 /kr, 영어면 /us 페이지로 연다
 */
const getPoeDbUrl = (item: PathOfExileItem, language: Language): string | undefined => {
    // 유니크는 name 에, 젬은 name 이 비어 있고 typeLine 에 이름이 있다
    const itemName = (item.name || item.typeLine || "").replace(/<<[^>]*>>/g, "").trim();
    if (!itemName) return undefined;

    const slug = encodeURIComponent(itemName.replaceAll("'", "").replaceAll(" ", "_"));
    const host = detectGameType() === "poe2" ? "poe2db.tw" : "poedb.tw";
    const locale = language === "ko" ? "kr" : "us";
    return `https://${host}/${locale}/${slug}`;
};

/**
 * Path of Exlie 아이템 검색 InputBox 입력값 조회
 */
const getItemSearchInputBoxValue = (): string => {
    // 검색결과의 첫번째 아이템의 헤더
    const searchedItemTitle =
        document.querySelector<HTMLElement>(".item-popup__header-line")?.innerText || "";

    // 사용자가 검색창에 입력한 값
    const searchInputBoxValue = document
        .querySelector<HTMLInputElement>("input.multiselect__input")
        ?.value?.trim()
        .replace("~", "");

    const label = searchedItemTitle || searchInputBoxValue || "New Bookmark";
    return label;
};

export const poeUtil = {
    detectGameType,
    getItemSearchConditionUrl,
    getItemSearchUrl,
    parseItemJsonToEngText,
    fetchPathOfExileItemInfo,
    getPoeDbUrl,
    getItemSearchInputBoxValue,
};
