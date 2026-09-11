import { useEffect, useState } from "react";
import "./PoeNinjaCurrency.css";
import {
    loadCurrencyCache,
    loadSettings,
    saveCurrencyCache,
    saveSettings,
    type Language,
} from "./storage";
import { poeUtil } from "../pathofexile/poeUtil";
import { ttt } from "../i18n";
import poe1DbCurrencies from "../assets/poe1db-item-currency.json";
import poe2DbCurrencies from "../assets/poe2db-item-currency.json";

type NinjaItem = {
    id: string;
    name: string;
    image: string;
};

export type NinjaOverview = {
    core: {
        items: NinjaItem[];
        /** primary 1개가 해당 화폐 몇 개인지 (예: poe1 은 { divine: 0.0028 }) */
        rates: Record<string, number>;
        primary: string;
        secondary?: string;
    };
    lines: {
        id: string;
        /** primary 화폐 기준 가치 */
        primaryValue: number | null;
        /** primary 화폐 기준 거래량 */
        volumePrimaryValue?: number | null;
    }[];
    items: NinjaItem[];
};

type FetchCurrencyMessage = {
    action: "fetchPoeNinjaCurrency";
    gameType: string;
    leagueName: string;
};

type FetchCurrencyResponse = {
    success: boolean;
    overview?: NinjaOverview;
};

/**
 * Value 칸 : 아이템 {itemAmount}개 = {coreAmount} [core].
 * itemAmount 가 1 보다 크면 "{coreAmount}/{itemAmount} [core]" 분수로 보여준다.
 */
type CurrencyValue = {
    core: NinjaItem;
    coreAmount: number;
    itemAmount: number;
};

type CurrencyRow = {
    item: NinjaItem;
    /** 정렬 기준인 거래량. 없으면 0 */
    volume: number;
    value?: CurrencyValue;
};

type LoadStatus = "loading" | "done" | "error";

const IMAGE_HOST = "https://web.poecdn.com";

/** poe.ninja 에 부담을 주지 않도록 조회는 10분에 한 번만 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 다시 조회할 수 있을 때까지 남은 시간(ms). 0 이면 지금 조회해도 된다.
 * 같은 리그의 조회 결과가 저장돼 있을 때만 막는다 (설정에서 리그를 바꾸면 바로 조회).
 */
const getRemainingCooldown = (leagueName: string): number => {
    if (loadCurrencyCache()?.leagueName !== leagueName) return 0;

    const elapsed = Date.now() - loadSettings().currencyRefreshedAt;
    // 시계를 뒤로 돌려 elapsed 가 음수가 된 경우는 막지 않는다
    return elapsed >= 0 && elapsed < REFRESH_INTERVAL_MS ? REFRESH_INTERVAL_MS - elapsed : 0;
};

/**
 * poe.ninja 원래 페이지 주소. 리그명은 공백을 빼고 소문자로 쓴다 (예: Runes of Aldur → runesofaldur)
 */
const getPoeNinjaCurrencyUrl = (gameType: string, leagueName: string): string => {
    const league = leagueName.replaceAll(" ", "").toLowerCase();
    return `https://poe.ninja/${gameType}/economy/${league}/currency`;
};

/**
 * background 에 시세 조회를 요청한다
 *
 * @see /src/background/background.ts
 */
const fetchCurrencyOverview = async (leagueName: string): Promise<NinjaOverview | undefined> => {
    const res = await chrome.runtime.sendMessage<FetchCurrencyMessage, FetchCurrencyResponse>({
        action: "fetchPoeNinjaCurrency",
        gameType: poeUtil.detectGameType(),
        leagueName,
    });
    return res?.success ? res.overview : undefined;
};

const EXALTED_ID = "exalted";
/** 목록에서 항상 맨 위에 두는 화폐 (신성한 오브) */
const DIVINE_ID = "divine";

/**
 * 목록에 보이지 않게 하는 화폐 (poe1 카오스 오브, poe2 엑잘티드 오브).
 * Value 칸의 기준 화폐로는 그대로 쓴다
 */
const HIDDEN_ITEM_IDS: Record<string, string> = {
    poe1: "chaos",
    poe2: EXALTED_ID,
};

/**
 * 가치를 어떤 기준 화폐로 보여줄지 고른다 (poe.ninja 와 같은 규칙).
 * primary / secondary 중 비싼 화폐로 1개 이상이면 비싼 화폐, 아니면 싼 화폐로 보여준다.
 * 그래도 1개가 안 되면(예: 1/872 chaos) 더 싼 exalted 로 바꿔서 보여준다.
 */
const getCurrencyValue = (
    overview: NinjaOverview,
    itemId: string,
    primaryValue: number,
): CurrencyValue | undefined => {
    const { items, rates, primary, secondary } = overview.core;

    const valueIn = (coreId: string) =>
        coreId === primary ? primaryValue : primaryValue * (rates[coreId] ?? 0);

    // 아이템 자기 자신(예: Chaos Orb)은 기준 화폐로 쓰지 않는다
    const candidates = [primary, secondary].filter(
        (coreId): coreId is string => !!coreId && coreId !== itemId,
    );
    if (candidates.length === 0) return undefined;

    let coreId = candidates[0];
    if (candidates.length === 2 && secondary) {
        // primary 1개로 secondary 를 1개 미만 살 수 있으면 secondary 가 더 비싸다
        const isSecondaryBigger = (rates[secondary] || 1) < 1;
        const bigger = isSecondaryBigger ? secondary : primary;
        const smaller = isSecondaryBigger ? primary : secondary;
        coreId = valueIn(bigger) > 1 ? bigger : smaller;
    }

    let rate = valueIn(coreId);

    // 1개가 안 되는 값은 exalted 로 바꾼다. rates 가 모두 primary 기준이라
    // valueIn(exalted) 는 chaos 값 × (chaos 대 exalted 교환비) 와 같다 (poe2: 1 chaos ≈ 45 exalted).
    // exalted 가 core 에 없거나(poe1) 지금 화폐보다 비싸면 그대로 둔다
    if (rate < 1 && itemId !== EXALTED_ID && coreId !== EXALTED_ID) {
        const exaltedRate = valueIn(EXALTED_ID);
        if (exaltedRate > rate) {
            coreId = EXALTED_ID;
            rate = exaltedRate;
        }
    }

    const core = items.find((item) => item.id === coreId);
    if (!core || !rate) return undefined;

    // 1 보다 작으면 "1/n [core]" 처럼 분수로 보여준다
    return rate < 1
        ? { core, coreAmount: 1, itemAmount: 1 / rate }
        : { core, coreAmount: rate, itemAmount: 1 };
};

/**
 * API 응답을 화면에 그릴 행으로 바꾼다. 신성한 오브를 맨 위에 두고, 나머지는 거래량(volumePrimaryValue)이 많은 순으로 정렬.
 * 게임별로 숨기는 화폐(HIDDEN_ITEM_IDS)는 뺀다
 */
const toCurrencyRows = (overview: NinjaOverview, gameType: string): CurrencyRow[] => {
    const itemMap = new Map(overview.items.map((item) => [item.id, item]));
    const hiddenItemId = HIDDEN_ITEM_IDS[gameType];
    const rows: CurrencyRow[] = [];

    for (const line of overview.lines) {
        const item = itemMap.get(line.id);
        if (!item || item.id === hiddenItemId) continue;

        rows.push({
            item,
            volume: line.volumePrimaryValue ?? 0,
            value:
                line.primaryValue == null
                    ? undefined
                    : getCurrencyValue(overview, line.id, line.primaryValue),
        });
    }

    return rows.sort((a, b) => {
        if (a.item.id === DIVINE_ID) return -1;
        if (b.item.id === DIVINE_ID) return 1;
        return b.volume - a.volume;
    });
};

/**
 * poe.ninja 와 같은 숫자 축약 (1.2k, 3.4M ...)
 */
const formatAmount = (value: number): string => {
    const abs = Math.abs(value);

    if (abs === 0) return "0";
    // "1/154" 처럼 1 이 자주 나오므로 정수는 소수점 없이
    if (abs < 1e3 && Number.isInteger(value)) return String(value);
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e4) return `${(value / 1e3).toFixed(0)}k`;
    if (abs >= 1e3) {
        const k = value / 1e3;
        return k % 1 === 0 ? `${k.toFixed(0)}k` : `${k.toFixed(1)}k`;
    }
    if (abs >= 10) return value.toFixed(0);
    if (abs >= 0.1) return value.toFixed(1);
    if (abs >= 0.01) return value.toFixed(2);
    return value.toFixed(4);
};

/**
 * poedb 영문 이름(value) → 한글 이름(label)
 */
const KOREAN_NAMES: Record<string, Map<string, string>> = {
    poe1: new Map(poe1DbCurrencies.map((currency) => [currency.value, currency.label])),
    poe2: new Map(poe2DbCurrencies.map((currency) => [currency.value, currency.label])),
};

/**
 * 표시할 화폐 이름. 한국어 설정이면 poedb 의 한글 이름, 없으면 영문 이름 그대로
 */
const getItemName = (item: NinjaItem, gameType: string, language: Language): string => {
    if (language !== "ko") return item.name;

    // poedb value 는 영문 이름에서 ' 를 빼고 공백을 _ 로 바꾼 값 (예: Hinekora's Lock → Hinekoras_Lock)
    const value = item.name.replaceAll("'", "").replaceAll(" ", "_");
    return KOREAN_NAMES[gameType]?.get(value) ?? item.name;
};

/**
 * 검색 비교용 : 대소문자와 공백을 무시한다 (예: "카오스오브" 로 "카오스 오브" 찾기)
 */
const normalizeForSearch = (text: string): string => text.toLowerCase().replace(/\s+/g, "");

const CurrencyIcon = ({ item }: { item: NinjaItem }) => (
    <img
        className="pst-currency-icon"
        src={`${IMAGE_HOST}${item.image}`}
        alt={item.name}
        title={item.name}
        loading="lazy"
    />
);

/** Refresh 버튼 아이콘. 조회 중에는 CSS 로 돌린다 */
const RefreshIcon = () => (
    <svg
        className="pst-currency-refresh-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
    </svg>
);

export const PoeNinjaCurrency = () => {
    const [gameType] = useState(() => poeUtil.detectGameType());
    // 리그는 설정 탭에서 바꾸고, 탭을 옮기면 이 컴포넌트가 새로 그려지므로 처음 한 번만 읽는다
    const [leagueName] = useState(() => loadSettings().leagueName);
    // 언어도 설정 탭에서만 바뀌므로 처음 한 번만 읽는다
    const [language] = useState(() => loadSettings().language);
    // 저장해 둔 같은 리그의 조회 결과가 있으면 먼저 보여준다 (10분이 지났으면 뒤에서 새로 조회)
    const [rows, setRows] = useState<CurrencyRow[]>(() => {
        const cached = loadCurrencyCache();
        return cached?.leagueName === leagueName ? toCurrencyRows(cached.overview, gameType) : [];
    });
    const [status, setStatus] = useState<LoadStatus>(() =>
        getRemainingCooldown(leagueName) > 0 ? "done" : "loading",
    );
    // Refresh 버튼을 누를 때마다 올려서 다시 조회시킨다
    const [reloadCount, setReloadCount] = useState(0);
    // 테이블 검색어
    const [searchKeyword, setSearchKeyword] = useState("");

    /**
     * 시세 조회 : 탭에 들어올 때 + Refresh 클릭 시.
     * 10분 안에 조회한 결과가 있으면 poe.ninja 를 부르지 않는다 (페이지를 새로고침해도 마찬가지)
     */
    useEffect(() => {
        if (!leagueName || getRemainingCooldown(leagueName) > 0) return;

        // 이전 요청의 응답이 늦게 와서 덮어쓰지 않도록
        let isIgnored = false;
        setStatus("loading");

        fetchCurrencyOverview(leagueName)
            .then((overview) => {
                if (isIgnored) return;
                if (!overview) {
                    setStatus("error");
                    return;
                }
                // 조회에 성공했을 때만 시각을 남긴다 (실패하면 바로 다시 시도할 수 있게)
                saveCurrencyCache({ leagueName, overview });
                saveSettings({ currencyRefreshedAt: Date.now() });
                setRows(toCurrencyRows(overview, gameType));
                setStatus("done");
            })
            .catch((error: unknown) => {
                // 확장프로그램이 다시 로드돼 background 와 연결이 끊긴 경우 등
                console.warn("[pst] 시세를 가져오지 못했습니다.", error);
                if (!isIgnored) setStatus("error");
            });

        return () => {
            isIgnored = true;
        };
    }, [gameType, leagueName, reloadCount]);

    /**
     * [Click Event] Refresh : 마지막으로 조회한 뒤 10분이 지나야 다시 조회한다
     */
    const handleRefresh = () => {
        const remaining = getRemainingCooldown(leagueName);

        if (remaining > 0) {
            const remainingMinutes = Math.ceil(remaining / 60000);
            window.alert(ttt("tab.currency.refreshAlert", { minutes: remainingMinutes }));
            return;
        }

        setReloadCount((prev) => prev + 1);
    };

    /**
     * [Click Event] poe.ninja : 같은 리그의 poe.ninja Currency 페이지를 새 탭으로 연다
     */
    const handleOpenPoeNinja = () => {
        window.open(getPoeNinjaCurrencyUrl(gameType, leagueName), "_blank", "noopener,noreferrer");
    };

    if (!leagueName) {
        return <p className="pst-empty">Set a league in the Settings tab first.</p>;
    }

    // 화면에 보이는 이름(한국어면 한글)과 영문 이름 둘 다로 찾는다
    const keyword = normalizeForSearch(searchKeyword);
    const filteredRows = keyword
        ? rows.filter(
              (row) =>
                  normalizeForSearch(getItemName(row.item, gameType, language)).includes(keyword) ||
                  normalizeForSearch(row.item.name).includes(keyword),
          )
        : rows;

    return (
        <div className="pst-currency">
            <div className="pst-currency-toolbar">
                <input
                    type="text"
                    className="pst-input pst-currency-search"
                    value={searchKeyword}
                    placeholder="Search..."
                    aria-label="Search currency"
                    onChange={(event) => setSearchKeyword(event.target.value)}
                />
                <button
                    type="button"
                    className="pst-settings-btn pst-currency-btn"
                    title={`Open ${leagueName} in poe.ninja`}
                    onClick={handleOpenPoeNinja}
                >
                    poe.ninja
                </button>
                <button
                    type="button"
                    className="pst-settings-btn pst-currency-btn pst-currency-refresh"
                    disabled={status === "loading"}
                    title={status === "loading" ? "Loading" : "Refresh"}
                    aria-label={status === "loading" ? "Loading" : "Refresh"}
                    onClick={handleRefresh}
                >
                    <RefreshIcon />
                </button>
            </div>

            {status === "error" ? (
                <p className="pst-empty">Failed to load prices from poe.ninja.</p>
            ) : status === "loading" && rows.length === 0 ? (
                <p className="pst-empty">Loading...</p>
            ) : rows.length === 0 ? (
                <p className="pst-empty">No data for this league.</p>
            ) : filteredRows.length === 0 ? (
                <p className="pst-empty">No matching items.</p>
            ) : (
                <table className="pst-currency-table">
                    <tbody>
                        {filteredRows.map((row) => (
                            <tr key={row.item.id}>
                                <td>
                                    <div className="pst-currency-name">
                                        <CurrencyIcon item={row.item} />
                                        <span>{getItemName(row.item, gameType, language)}</span>
                                    </div>
                                </td>
                                <td>
                                    {row.value ? (
                                        <div className="pst-currency-value">
                                            <span>
                                                {formatAmount(row.value.coreAmount)}
                                                {row.value.itemAmount > 1
                                                    ? ` / ${formatAmount(row.value.itemAmount)}`
                                                    : ""}
                                            </span>
                                            <CurrencyIcon item={row.value.core} />
                                        </div>
                                    ) : (
                                        <span className="pst-currency-dim">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
