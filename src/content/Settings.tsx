import { useEffect, useState, type ReactNode } from "react";
import type { Folder } from "./FolderItem";
import type { BookmarkMap } from "./BookmarkItem";
import { setEventToPoeSearchInputBox } from "../pathofexile/makeAutoTileSearch";

import {
    loadSettings,
    parseBookmarkData,
    saveSettings,
    type BookmarkData,
    type SidebarPosition,
} from "./storage";
import { Util } from "../pathofexile/util";

const SIDEBAR_POSITIONS: { value: SidebarPosition; label: string }[] = [
    { value: "left", label: "왼쪽" },
    { value: "right", label: "오른쪽" },
];

type SettingFolderProps = {
    name: string;
    children: ReactNode;
};

/**
 * 설정 폴더 한 칸.
 * 접을 수 없이 항상 펼쳐져 있고, 헤더 모양은 북마크 폴더(.pst-folder-item)와 같은 클래스를 쓴다.
 */
const SettingFolder = ({ name, children }: SettingFolderProps) => (
    <li className="pst-folder">
        <div className="pst-folder-item">
            <span className="pst-settings-icon" aria-hidden="true">
                ⚙
            </span>
            <span className="pst-folder-name">{name}</span>
        </div>

        <div className="pst-settings-body">{children}</div>
    </li>
);

type SettingsProps = {
    /* 내보내기에 필요한 현재 북마크 */
    folders: Folder[];
    bookmarks: BookmarkMap;
    /* 불러오기로 북마크 전체를 교체할 때 쓰는 setter (App 의 useState setter 를 그대로 받는다) */
    setFolders: (folders: Folder[]) => void;
    setBookmarks: (bookmarks: BookmarkMap) => void;
    /* 사이드바 위치는 레이아웃에 영향을 주므로 App 이 계속 들고 있는다 */
    sidebarPosition: SidebarPosition;
    onChangeSidebarPosition: (position: SidebarPosition) => void;
};

type LeaguesResponse = {
    success?: unknown;
    leagues?: unknown;
};

export const Settings = ({
    folders,
    bookmarks,
    setFolders,
    setBookmarks,
    sidebarPosition,
    onChangeSidebarPosition,
}: SettingsProps) => {
    // 리그명
    const [leagueName, setLeagueName] = useState(() => loadSettings().leagueName);
    // 선택 목록에 채울 리그들
    const [leagueOptions, setLeagueOptions] = useState<string[]>([]);
    // 검색어 자동 완성(~) 사용 여부
    const [autoAppendTilde, setAutoAppendTilde] = useState(() => loadSettings().autoAppendTilde);
    // 리그 목록 조회 중 표시용
    const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
    // 북마크 import 텍스트박스
    const [importCode, setImportCode] = useState("");

    useEffect(() => {
        saveSettings({ leagueName: leagueName, autoAppendTilde });
    }, [leagueName, autoAppendTilde]);

    /**
     * 리그 목록 조회 : poe.ninja API 조회
     */
    const handleFetchLeagues = async () => {
        setIsLoadingLeagues(true);

        try {
            const response: LeaguesResponse = await chrome.runtime.sendMessage({
                action: "fetchLeagues",
                gameType: Util.detectGameType(),
            });

            if (!response?.success) {
                console.warn("[pst] 리그 목록 조회에 실패했습니다.");
                return;
            }

            const leagueNames: string[] = [];
            (response.leagues as Array<object>).forEach((league) => {
                leagueNames.push((league as { id: string; name: string }).name);
            });
            setLeagueOptions(leagueNames);
        } catch (error) {
            alert("리그 목록을 가져오지 못했습니다");
            console.warn("[pst] 리그 목록을 가져오지 못했습니다.", error);
        } finally {
            setIsLoadingLeagues(false);
        }
    };

    /**
     * [Click Event] 검색어 자동 완성(~) 변경 시
     */
    const handleToggleAutoAppendTilde = (enabled: boolean) => {
        setAutoAppendTilde(enabled);
        setEventToPoeSearchInputBox(enabled);
    };

    /**
     * [Click Event] Export Boomkmark
     */
    const handleExportBookmarks = async () => {
        const code = JSON.stringify({ folders, bookmarks } satisfies BookmarkData, null, 2);

        try {
            await navigator.clipboard.writeText(code);
            window.alert("모든 북마크 코드를 클립보드에 복사했습니다.");
        } catch {
            // 콘텐츠 스크립트에서 클립보드 접근이 막히는 경우가 있어 직접 복사할 수 있게 띄운다
            window.prompt("클립보드 복사에 실패했습니다. 아래 코드를 직접 복사하세요.", code);
        }
    };

    /**
     * [Click Event] Import Boomkmark
     */
    const handleImportBookmarks = () => {
        const trimmed = importCode.trim();
        if (!trimmed) {
            window.alert("불러올 북마크 코드를 입력하세요.");
            return;
        }

        let raw: unknown;
        try {
            raw = JSON.parse(trimmed);
        } catch {
            window.alert("북마크 코드를 해석할 수 없습니다. 복사한 코드를 그대로 붙여넣으세요.");
            return;
        }

        const parsed = parseBookmarkData(raw);
        if (!parsed) {
            window.alert("북마크 코드 형식이 올바르지 않습니다.");
            return;
        }

        if (!window.confirm("현재 북마크를 모두 덮어씁니다. 계속하시겠습니까?")) {
            return;
        }

        setFolders(parsed.folders);
        setBookmarks(parsed.bookmarks);
        // 지워진 폴더의 펼침 상태가 남지 않도록 초기화
        setImportCode("");
    };

    return (
        <ul className="pst-settings-list">
            {/* ============================================================ */}
            {/* League                                                      */}
            {/* ============================================================ */}
            <SettingFolder name="League">
                <input
                    type="text"
                    className="pst-input"
                    value={leagueName}
                    placeholder="리그 조회가 안될경우 직접 입력"
                    aria-label="리그명"
                    onChange={(event) => setLeagueName(event.target.value.trim())}
                />
                {/* 목록과 조회 버튼을 한 줄에 놓는다 */}
                <div className="pst-field-row">
                    {/* 화살표(::after)를 그리기 위한 껍데기 */}
                    <span className="pst-select-wrap">
                        <select
                            className="pst-select"
                            value={leagueOptions.includes(leagueName) ? leagueName : ""}
                            aria-label="리그 목록"
                            onChange={(event) => setLeagueName(event.target.value)}
                        >
                            <option value="">리그를 조회 후 선택하세요.</option>
                            {leagueOptions.map((league) => (
                                <option key={league} value={league}>
                                    {league}
                                </option>
                            ))}
                        </select>
                    </span>
                    <button
                        type="button"
                        className="pst-settings-btn"
                        disabled={isLoadingLeagues}
                        onClick={handleFetchLeagues}
                    >
                        {isLoadingLeagues ? "조회 중" : "조회"}
                    </button>
                </div>
            </SettingFolder>

            {/* ============================================================ */}
            {/* 검색 시 ~ 자동 입력 설정                                     
            {/* ============================================================ */}
            <SettingFolder name="자동 완성 설정">
                <label className="pst-switch">
                    <input
                        type="checkbox"
                        className="pst-switch-input"
                        checked={autoAppendTilde}
                        onChange={(event) => handleToggleAutoAppendTilde(event.target.checked)}
                    />
                    <span className="pst-switch-track" aria-hidden="true">
                        <span className="pst-switch-thumb" />
                    </span>
                    <span>검색어 입력 시 자동으로 ~ 붙이기</span>
                </label>
            </SettingFolder>

            {/* ============================================================ */}
            {/* 사이드바 위치 설정                                          */}
            {/* ============================================================ */}
            <SettingFolder name="사이드바 위치">
                <div className="pst-radio-group" role="radiogroup" aria-label="사이드바 위치">
                    {SIDEBAR_POSITIONS.map((option) => (
                        <label key={option.value} className="pst-radio">
                            <input
                                type="radio"
                                name="pst-sidebar-position"
                                value={option.value}
                                checked={sidebarPosition === option.value}
                                onChange={() => onChangeSidebarPosition(option.value)}
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
            </SettingFolder>

            {/* ============================================================ */}
            {/* 전체 북마크 내보내기                                        */}
            {/* ============================================================ */}
            <SettingFolder name="전체 북마크 내보내기">
                <button type="button" className="pst-settings-btn" onClick={handleExportBookmarks}>
                    모든 북마크 코드 복사
                </button>
            </SettingFolder>

            {/* ============================================================ */}
            {/* 북마크 불러오기                                             */}
            {/* ============================================================ */}
            <SettingFolder name="북마크 불러오기">
                <textarea
                    className="pst-textarea"
                    rows={6}
                    value={importCode}
                    placeholder="북마크 코드를 붙여넣으세요."
                    aria-label="북마크 코드"
                    onChange={(event) => setImportCode(event.target.value)}
                />
                <button type="button" className="pst-settings-btn" onClick={handleImportBookmarks}>
                    북마크 불러오기
                </button>
            </SettingFolder>
        </ul>
    );
};
