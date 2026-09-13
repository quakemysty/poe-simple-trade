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
    name?: string; // 아이템명, 젬일경우 빈값
    typeLine?: string; // 아이템Base, 젬일경우 젬이름
    rarity?: string;
    ilvl?: number;
    properties?: { name: string; values: [string, number][] }[]; //
    requirements?: { name: string; values: [string, number][] }[]; //
    sockets?: unknown[];
    socketedItems?: { typeLine?: string }[];
    implicitMods?: { description: string }[];
    enchantMods?: { description: string }[];
    runeMods?: { description: string }[];
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

const cleanMod = (item: { description: string }): string => item.description;

/**
 * Path of Exile trade API 의 아이템 JSON 을 POB(영문) 붙여넣기용 텍스트로 변환
 */
const parseItemJsonToPobText = (item: PathOfExileItem): string => {
    const pobStr: string[] = [];

    pobStr.push(item.name || "");
    pobStr.push(item.typeLine || "");
    if (item.ilvl) pobStr.push(`Item Level: ${item.ilvl}`);

    const levelReq = item.requirements?.find((req) => req.name === "Level");
    if (levelReq?.values?.[0]) {
        pobStr.push(`LevelReq: ${levelReq.values[0][0]}`);
    }

    if (item.properties && item.properties.length > 1) {
        const radiusProp = item.properties.find(
            (prop) => prop.name === "Radius" && prop.values?.length,
        );
        if (radiusProp) {
            const val = radiusProp.values[0]?.[0] || "";
            pobStr.push(`Radius: ${val}`);
        } else {
            const qualityProp = item.properties.find((prop) => prop.name === "[Quality]");
            if (qualityProp?.values?.[0]) {
                pobStr.push(`Quality: ${qualityProp.values[0][0]}`);
            } else {
                pobStr.push("Quality: 0");
            }
        }
    }

    if (item.sockets?.length) {
        const socketStr = item.sockets.map(() => "S").join(" ");
        pobStr.push(`Sockets: ${socketStr}`);
    }

    if (item.socketedItems?.length) {
        item.socketedItems.forEach((rune) => {
            pobStr.push(`Rune: ${rune.typeLine || "None"}`);
        });
    } else {
        pobStr.push("Rune: None");
    }

    pobStr.push("--------");

    if (item.implicitMods?.length) {
        pobStr.push(...item.implicitMods.map(cleanMod).map((m) => `{implicit}${m}`));
    }

    pobStr.push("--------");

    if (item.enchantMods?.length) {
        pobStr.push(...item.enchantMods.map(cleanMod).map((m) => `{enchant}${m}`));
    }

    if (item.runeMods?.length) {
        pobStr.push(...item.runeMods.map(cleanMod).map((m) => `{enchant}{rune}${m}`));
    }

    pobStr.push("--------");

    if (item.explicitMods?.length) {
        pobStr.push(
            ...item.explicitMods.map((mod) => {
                if (typeof mod === "string") return mod;
                if (!mod) return "";

                const text = mod.description ?? "";
                const activeFlag = mod.flags && Object.keys(mod.flags).find((k) => mod.flags?.[k]);

                return activeFlag ? `{${activeFlag}}${text}` : text;
            }),
        );
    }

    pobStr.push("--------");

    if (item.corrupted) {
        pobStr.push("Corrupted");
    }

    return pobStr.join("\n").trim();
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
    parseItemJsonToPobText: parseItemJsonToPobText,
    fetchPathOfExileItemInfo,
    getPoeDbUrl,
    getItemSearchInputBoxValue,
};
