import { poeUtil } from "../pathofexile/poeUtil";
import type { Bookmark, BookmarkMap } from "./BookmarkItem";
import type { Folder } from "./FolderItem";
import type { NinjaOverview } from "./PoeNinjaCurrency";

/**
 * Storage 저장 키
 */
const BOOKMARKS_KEY = "pst." + poeUtil.detectGameType() + ".bookmarks";
const SETTINGS_KEY = "pst." + poeUtil.detectGameType() + ".settings";
const CURRENCY_KEY = "pst." + poeUtil.detectGameType() + ".currency";

export type SidebarPosition = "left" | "right";
export type Language = "ko" | "en";

/** 저장 / 내보내기 / 불러오기가 모두 쓰는 북마크 구조 */
export type BookmarkData = {
    folders: Folder[];
    bookmarks: BookmarkMap;
};

export type AppSettings = {
    /** 화면 표시 언어 */
    language: Language;
    /** 설정 탭에서 고르거나 직접 입력한 리그명 */
    leagueName: string;
    autoAppendTilde: boolean;
    sidebarPosition: SidebarPosition;
    /** 플로팅 버튼으로 사이드바를 접어 둔 상태 */
    isSidebarHidden: boolean;
    /** 시세 탭에서 poe.ninja 를 마지막으로 조회한 시각(ms). 조회한 적 없으면 0 */
    currencyRefreshedAt: number;
};

/** 시세 탭 조회 결과. 조회 시각은 AppSettings.currencyRefreshedAt */
export type CurrencyCache = {
    leagueName: string;
    overview: NinjaOverview;
};

const DEFAULT_SETTINGS: AppSettings = {
    language: "ko",
    leagueName: "",
    autoAppendTilde: true,
    sidebarPosition: "left",
    isSidebarHidden: false,
    currencyRefreshedAt: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

/**
 * import 한 Json 유효성 체크
 */
export const parseBookmarkData = (value: unknown): BookmarkData | undefined => {
    if (!isRecord(value)) return undefined;

    const { folders, bookmarks } = value;
    if (!Array.isArray(folders) || !isRecord(bookmarks)) return undefined;

    const parsedFolders: Folder[] = [];
    for (const folder of folders) {
        if (!isRecord(folder)) return undefined;
        if (typeof folder.id !== "string" || typeof folder.name !== "string") return undefined;

        parsedFolders.push({
            id: folder.id,
            name: folder.name,
            gameType: folder.gameType as string,
            expanded: folder.expanded === true,
        });
    }

    const parsedBookmarks: BookmarkMap = {};
    for (const [folderId, list] of Object.entries(bookmarks)) {
        if (!Array.isArray(list)) return undefined;

        const parsedList: Bookmark[] = [];
        for (const bookmark of list) {
            if (!isRecord(bookmark)) return undefined;
            if (
                typeof bookmark.id !== "string" ||
                typeof bookmark.label !== "string" ||
                typeof bookmark.url !== "string"
            ) {
                return undefined;
            }

            parsedList.push({
                id: bookmark.id,
                label: bookmark.label,
                url: bookmark.url,
            });
        }

        parsedBookmarks[folderId] = parsedList;
    }

    return { folders: parsedFolders, bookmarks: parsedBookmarks };
};

/**
 * 저장된 값을 모두 캐시에 올린다. 화면을 그리기 전에 한 번 불러야 한다.
 */
export const hydrateStorage = async (): Promise<void> => {
    try {
        // null 을 넘기면 이 확장의 저장소 전체를 돌려준다
        const stored = await chrome.storage.local.get(null);
        for (const [key, value] of Object.entries(stored)) cache.set(key, value);
    } catch (error) {
        console.warn("[pst] 저장된 값을 읽지 못했습니다.", error);
    }
};

/** 저장된 북마크. 없거나 형식이 깨졌으면 undefined */
export const loadBookmarkData = (): BookmarkData | undefined => {
    return parseBookmarkData(cache.get(BOOKMARKS_KEY));
};

export const saveBookmarkData = (data: BookmarkData) => {
    return writeToStorage(BOOKMARKS_KEY, data);
};

/** 저장된 설정. 값이 없거나 이상하면 항목별로 기본값을 쓴다 */
export const loadSettings = (): AppSettings => {
    const stored = cache.get(SETTINGS_KEY);
    if (!isRecord(stored)) return DEFAULT_SETTINGS;

    return {
        language:
            stored.language === "ko" || stored.language === "en"
                ? stored.language
                : DEFAULT_SETTINGS.language,
        leagueName:
            typeof stored.leagueName === "string" ? stored.leagueName : DEFAULT_SETTINGS.leagueName,
        autoAppendTilde:
            typeof stored.autoAppendTilde === "boolean"
                ? stored.autoAppendTilde
                : DEFAULT_SETTINGS.autoAppendTilde,
        sidebarPosition:
            stored.sidebarPosition === "left" || stored.sidebarPosition === "right"
                ? stored.sidebarPosition
                : DEFAULT_SETTINGS.sidebarPosition,
        isSidebarHidden:
            typeof stored.isSidebarHidden === "boolean"
                ? stored.isSidebarHidden
                : DEFAULT_SETTINGS.isSidebarHidden,
        currencyRefreshedAt:
            typeof stored.currencyRefreshedAt === "number"
                ? stored.currencyRefreshedAt
                : DEFAULT_SETTINGS.currencyRefreshedAt,
    };
};

/**
 * 설정 저장
 */
export const saveSettings = (patch: Partial<AppSettings>) => {
    writeToStorage(SETTINGS_KEY, { ...loadSettings(), ...patch });
};

/** 저장해 둔 시세 조회 결과. 없거나 형식이 깨졌으면 undefined */
export const loadCurrencyCache = (): CurrencyCache | undefined => {
    const stored = cache.get(CURRENCY_KEY);
    if (!isRecord(stored) || typeof stored.leagueName !== "string") return undefined;

    const { overview } = stored;
    if (
        !isRecord(overview) ||
        !isRecord(overview.core) ||
        !Array.isArray(overview.lines) ||
        !Array.isArray(overview.items)
    ) {
        return undefined;
    }

    return stored as CurrencyCache;
};

export const saveCurrencyCache = (data: CurrencyCache) => {
    writeToStorage(CURRENCY_KEY, data);
};

/**
 * 캐시
 */
export const cache = new Map<string, unknown>();

/**
 * 스토리지에 저장
 */
export const writeToStorage = (key: string, value: unknown) => {
    cache.set(key, value);

    chrome.storage.local
        .set({ [key]: value })
        .catch((error: unknown) => console.warn("[pst] 저장에 실패했습니다.", key, error));
};
