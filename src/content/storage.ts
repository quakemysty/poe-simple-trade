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
/** 북마크 불러오기 방식. 현재 북마크에 이어 붙일지(keep), 지우고 대체할지(replace) */
export type ImportMode = "keep" | "replace";

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
    /** 설정 탭 '북마크 불러오기' 에서 마지막으로 고른 방식 */
    importMode: ImportMode;
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
    importMode: "keep",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

/**
 * 폴더 / 북마크 식별자를 새로 만든다.
 */
export const createUuid = (): string => crypto.randomUUID();

/**
 * 저장된 폴더 / 북마크의 식별자를 읽는다. 둘 다 없으면 undefined
 *
 * 마이그레이션 : 예전 버전은 식별자를 id 로 저장했다. 지금은 uuid 로만 저장하고(toStoredBookmarkData)
 * 읽을 때만 예전 id 를 받아 준다. 예전 데이터도 한 번 읽혀서 다시 저장되는 순간 uuid 로 바뀐다.
 */
const readUuid = (value: Record<string, unknown>): string | undefined => {
    if (typeof value.uuid === "string") return value.uuid;
    if (typeof value.id === "string") return value.id;

    return undefined;
};

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

        const folderUuid = readUuid(folder);
        if (folderUuid === undefined || typeof folder.name !== "string") return undefined;

        parsedFolders.push({
            id: folderUuid,
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

            const bookmarkUuid = readUuid(bookmark);
            if (
                bookmarkUuid === undefined ||
                typeof bookmark.label !== "string" ||
                typeof bookmark.url !== "string"
            ) {
                return undefined;
            }

            parsedList.push({
                id: bookmarkUuid,
                label: bookmark.label,
                url: bookmark.url,
            });
        }

        parsedBookmarks[folderId] = parsedList;
    }

    return { folders: parsedFolders, bookmarks: parsedBookmarks };
};

/**
 * 저장소 / 내보내기 코드에 들어가는 모양으로 바꾼다. 식별자를 id 가 아니라 uuid 로 쓴다.
 *
 * 화면 쪽 타입(Folder, Bookmark)이 id 를 그대로 쓰는 이유 : dnd-kit 의 move() 헬퍼가 항목마다
 * id 프로퍼티를 요구해서(@see /src/content/App.tsx 의 handleDragOver) 메모리에서는 id 를 못 뗀다.
 * 그래서 이름 변경을 저장 경계에서만 한다. 읽는 쪽은 parseBookmarkData 가 되돌린다.
 */
const toStoredBookmarkData = ({ folders, bookmarks }: BookmarkData) => ({
    folders: folders.map(({ id, ...rest }) => ({ uuid: id, ...rest })),
    bookmarks: Object.fromEntries(
        Object.entries(bookmarks).map(([folderId, list]) => [
            folderId,
            list.map(({ id, ...rest }) => ({ uuid: id, ...rest })),
        ]),
    ),
});

/**
 * 불러온 북마크를 현재 북마크 뒤에 이어 붙인다.
 */
export const mergeBookmarkData = (current: BookmarkData, incoming: BookmarkData): BookmarkData => {
    const folders = [...current.folders];
    const bookmarks: BookmarkMap = { ...current.bookmarks };

    for (const folder of incoming.folders) {
        const folderId = createUuid();
        folders.push({ ...folder, id: folderId });

        // 빈 폴더도 드롭 대상이 되려면 BookmarkMap 에 키가 있어야 한다
        bookmarks[folderId] = (incoming.bookmarks[folder.id] ?? []).map((bookmark) => ({
            ...bookmark,
            id: createUuid(),
        }));
    }

    return { folders, bookmarks };
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
    return writeToStorage(BOOKMARKS_KEY, toStoredBookmarkData(data));
};

/** 내보내기 코드. 저장소에 들어가는 것과 같은 모양이라 그대로 다시 불러올 수 있다 */
export const toExportBookmarkData = (data: BookmarkData) => toStoredBookmarkData(data);

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
        importMode:
            stored.importMode === "keep" || stored.importMode === "replace"
                ? stored.importMode
                : DEFAULT_SETTINGS.importMode,
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
