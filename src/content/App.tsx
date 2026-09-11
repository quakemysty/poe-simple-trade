import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { DragDropProvider, type DragEndEvent, type DragOverEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { arrayMove, move } from "@dnd-kit/helpers";
import "./App.css";
import { FolderItem, type Folder } from "./FolderItem";
import type { BookmarkMap } from "./BookmarkItem";
import { ContextMenu } from "./ContextMenu";
import { Settings } from "./Settings";
import { PoeNinjaCurrency } from "./PoeNinjaCurrency";
import {
    loadBookmarkData,
    loadSettings,
    saveBookmarkData as saveBookmarkDataToStorage,
    saveSettings as saveSettingsToStorage,
    type Language,
    type SidebarPosition,
} from "./storage";
import { poeUtil } from "../pathofexile/poeUtil";
import { ttt, type MessageKey } from "../i18n";

/**
 * 컨텍스트 메뉴가 열린 위치와 대상. bookmarkId 가 없으면 폴더가 대상.
 */
type ContextMenuState = {
    x: number;
    y: number;
    folderId: string;
    bookmarkId?: string;
};

const TABS: { key: string; labelKey: MessageKey }[] = [
    { key: "bookmark", labelKey: "tab.bookmark" },
    { key: "currency", labelKey: "tab.currency" },
    { key: "settings", labelKey: "tab.settings" },
];

export const App = () => {
    /* ================================================================ */
    // useState
    /* ================================================================ */
    const [activeTab, setActiveTab] = useState<string>("bookmark"); // 현재 탭페이지

    const [folders, setFolders] = useState<Folder[]>(() => loadBookmarkData()?.folders || []); // 폴더 목록
    const [bookmarks, setBookmarks] = useState<BookmarkMap>(
        () => loadBookmarkData()?.bookmarks || {},
    ); // 폴더별 북마크맵

    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null); // 컨텍스트 메뉴

    const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(
        () => loadSettings().sidebarPosition,
    ); // 사이드바 위치

    const [isSidebarHidden, setIsSidebarHidden] = useState(() => loadSettings().isSidebarHidden); // 사이드바 숨김 여부

    const [language, setLanguage] = useState<Language>(() => loadSettings().language); // 표시 언어

    /* ================================================================ */
    // useEffect
    /* ================================================================ */
    // 폴더/북마크 변경 시 Storage에 저장
    useEffect(() => {
        saveBookmarkDataToStorage({ folders, bookmarks });
    }, [folders, bookmarks]);

    // 사이드바 위치/숨김 변경 시 Storage에 저장
    useEffect(() => {
        saveSettingsToStorage({ sidebarPosition, isSidebarHidden });
    }, [sidebarPosition, isSidebarHidden]);

    /**
     * 사이드바 변경 시 POE 홈페이지의 padding 변경
     */
    useEffect(() => {
        const { classList } = document.body;

        classList.toggle("pst-page-shift", !isSidebarHidden);
        classList.toggle("pst-page-shift-right", !isSidebarHidden && sidebarPosition === "right");

        return () => classList.remove("pst-page-shift", "pst-page-shift-right");
    }, [sidebarPosition, isSidebarHidden]);

    /**
     * 드래그 취소용 스냅샷
     */
    const bookmarksSnapshot = useRef<BookmarkMap>({});

    /* ================================================================ */
    // Event Handlers
    /* ================================================================ */
    /**
     * [Click Event] New Folder
     */
    const handleNewFolder = () => {
        const folderId = `folder-${Date.now()}`;
        const folderName = window.prompt(ttt("folder.promptName"));
        if (!folderName) return;

        setFolders((prev) => [
            ...prev,
            { id: folderId, name: folderName, gameType: poeUtil.detectGameType(), expanded: false },
        ]);
        // 빈 폴더도 드롭 대상이 되려면 BookmarkMap 에 키가 있어야 한다
        setBookmarks((prev) => ({ ...prev, [folderId]: [] }));
    };

    /**
     * [Click Event] New bookmark in Folder
     */
    const handleNewBookmark = (folderId: string, label: string, url: string) => {
        setBookmarks((prev) => ({
            ...prev,
            [folderId]: [
                ...(prev[folderId] ?? []),
                { id: `bookmark-${Date.now()}`, label, url, gameType: poeUtil.detectGameType() },
            ],
        }));
        // 새 북마크가 바로 보이도록 폴더를 펼친다
        setFolders((prev) =>
            prev.map((folder) => (folder.id === folderId ? { ...folder, expanded: true } : folder)),
        );
    };

    /**
     * [Click Event] Toggle folder
     */
    const handleToggleFolder = (folderId: string) => {
        setFolders((prev) =>
            prev.map((folder) =>
                folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder,
            ),
        );
    };

    /**
     * [Click Event] 옵션(⋮) 클릭 : 클릭한 아이콘의 왼쪽 아래에 맞춰 컨텍스트 메뉴를 띄운다
     */
    const handlePopupOption = (
        event: MouseEvent<HTMLElement>,
        folderId: string,
        bookmarkId?: string,
    ) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setContextMenu({ x: rect.left, y: rect.bottom + 2, folderId, bookmarkId });
    };

    /**
     * ContextMenu 의 effect 가 매 렌더마다 재등록되지 않도록 참조를 고정
     */
    const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

    /**
     * [Click Event] 컨텍스트 메뉴 - 북마크 이름 변경
     */
    const handleRenameBookmark = (folderId: string, bookmarkId?: string) => {
        const targetFolder = folders.find((folder) => folder.id === folderId);
        if (!targetFolder) return;

        const targetBookmark = bookmarkId
            ? bookmarks[folderId]?.find((bookmark) => bookmark.id === bookmarkId)
            : undefined;
        if (bookmarkId && !targetBookmark) return;

        const currentName = targetBookmark ? targetBookmark.label : targetFolder.name;
        const inputName = window.prompt(
            targetBookmark ? ttt("bookmark.promptName") : ttt("folder.promptName"),
            currentName,
        );

        // 취소하면 null, 공백만 입력하거나 그대로면 변경하지 않는다
        if (inputName === null) return;
        const nextName = inputName.trim();
        if (!nextName || nextName === currentName) return;

        if (!bookmarkId) {
            setFolders((prev) =>
                prev.map((folder) =>
                    folder.id === folderId ? { ...folder, name: nextName } : folder,
                ),
            );
            return;
        }

        setBookmarks((prev) => ({
            ...prev,
            [folderId]: (prev[folderId] ?? []).map((bookmark) =>
                bookmark.id === bookmarkId ? { ...bookmark, label: nextName } : bookmark,
            ),
        }));
    };

    /**
     * [Click Event] 컨텍스트 메뉴 - "현재 검색으로 대체"
     */
    const handleReplaceBookmarkUrl = () => {
        if (!contextMenu?.bookmarkId) return;
        const folderId = contextMenu.folderId;
        const bookmarkId = contextMenu.bookmarkId;
        const currentUrl = poeUtil.getItemSearchConditionUrl(); // 현재 URL에서 검색 조건 부분만 추출

        setBookmarks((prev) => ({
            ...prev,
            [folderId]: (prev[folderId] ?? []).map((bookmark) =>
                bookmark.id === bookmarkId ? { ...bookmark, url: currentUrl } : bookmark,
            ),
        }));
        setContextMenu(null);

        alert(ttt("bookmark.replacedWithCurrentSearch"));
    };

    /**
     * [Click Event] Delete folder
     */
    const handleDeleteFolder = (folderId: string) => {
        if (!window.confirm(ttt("common.confirmDelete"))) {
            return;
        }

        setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
        setBookmarks((prev) => {
            const next = { ...prev };
            delete next[folderId];
            return next;
        });
    };

    /**
     * [Click Event] Delete bookmark
     */
    const handleDeleteBookmark = (folderId: string, bookmarkId: string) => {
        if (!window.confirm(ttt("common.confirmDelete"))) {
            return;
        }

        setBookmarks((prev) => ({
            ...prev,
            [folderId]: (prev[folderId] ?? []).filter((bookmark) => bookmark.id !== bookmarkId),
        }));
    };

    /**
     * 사이드바 왼쪽/오른쪽 변경 시
     */
    const handleChangeSidebarPosition = (position: SidebarPosition) => {
        setSidebarPosition(position);
    };

    /**
     * 표시 언어 변경 시
     * t() 는 저장소에서 언어를 읽으므로, useEffect 가 아니라 여기서 먼저 저장해야 다시 그릴 때 새 언어가 나온다.
     */
    const handleChangeLanguage = (nextLanguage: Language) => {
        saveSettingsToStorage({ language: nextLanguage });
        setLanguage(nextLanguage);
    };

    /**
     * [Drag Start Event]
     *
     * @see https://dndkit.com/react/guides/multiple-sortable-lists
     */
    const handleDragStart = () => {
        bookmarksSnapshot.current = bookmarks;
    };

    /**
     * [Drag Over Event] 폴더와 북마크 둘다 DragEnd 에서 State 처리시 UI 오류발생. 북마크는 DragOver 에서 State 변경.
     *
     * @see https://dndkit.com/react/guides/multiple-sortable-lists
     */
    const handleDragOver = (event: DragOverEvent) => {
        if (event.operation.source?.type === "bookmark") {
            setBookmarks((prev) => move(prev, event));
        }
    };

    /**
     * [Drag End Event] 폴더는 순서가 계속 요동치지 않도록 드래그가 끝날 때 한 번만 옮긴다
     *
     * @see https://dndkit.com/react/guides/multiple-sortable-lists
     */
    const handleDragEnd = (event: DragEndEvent) => {
        const { source, canceled } = event.operation;

        // 드래그 취소 시
        if (canceled) {
            setBookmarks(bookmarksSnapshot.current); // handleDragOver 에서 옮겨진 상태 롤백

            return;
        }

        if (source?.type !== "folder" || !isSortable(source)) return;

        // 리스트 밖(최하단 빈 영역)에서 놓으면 target 이 null 이라 move() 가 원본을 그대로 반환한다.
        // dnd-kit 이 드래그 중 갱신해 둔 index 로 직접 옮긴다.
        setFolders((prev) => {
            const from = prev.findIndex((folder) => folder.id === source.id);
            const to = source.index;

            if (from === -1 || from === to) return prev;

            return arrayMove(prev, from, to);
        });
    };

    /**
     * 전체 패널 위치,숨김 처리 css
     */
    const layoutClassName = [
        "pst-layout",
        sidebarPosition === "right" ? "is-right" : "",
        isSidebarHidden ? "is-hidden" : "",
    ]
        .filter(Boolean)
        .join(" ");

    // 사이드바 접기/펼치기 플로팅 버튼
    const toggleArrow = (sidebarPosition === "left") !== isSidebarHidden ? "◀" : "▶";
    const toggleLabel = isSidebarHidden ? ttt("sidebar.open") : ttt("sidebar.close");

    return (
        <div className={layoutClassName}>
            {/* 사이드바 접기/펼치기 플로팅 버튼 */}
            <button
                type="button"
                className="pst-toggle"
                aria-expanded={!isSidebarHidden}
                aria-label={toggleLabel}
                title={toggleLabel}
                onClick={() => setIsSidebarHidden((prev) => !prev)}
            >
                {toggleArrow}
            </button>

            <aside className="pst-sidebar">
                <nav className="pst-tabs" role="tablist">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            className={`pst-tab${activeTab === tab.key ? " is-active" : ""}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {ttt(tab.labelKey)}
                        </button>
                    ))}
                </nav>

                {activeTab === "bookmark" ? (
                    // ================================================================
                    // 북마크 탭
                    // ================================================================
                    <div className="pst-panel">
                        <div className="pst-panel-body">
                            <DragDropProvider
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragEnd={handleDragEnd}
                            >
                                <ul className="pst-folder-list">
                                    {folders.map((folder, index) => (
                                        <FolderItem
                                            key={folder.id}
                                            folder={folder}
                                            bookmarks={bookmarks[folder.id] ?? []}
                                            index={index}
                                            onToggleFolder={handleToggleFolder}
                                            onNewBookmark={handleNewBookmark}
                                            onPopupOption={handlePopupOption}
                                            onDeleteFolder={handleDeleteFolder}
                                            onDeleteBookmark={handleDeleteBookmark}
                                        />
                                    ))}
                                </ul>
                            </DragDropProvider>
                        </div>
                        {/* 최하단 footer */}
                        <div className="pst-panel-footer">
                            <button
                                type="button"
                                className="pst-new-folder"
                                onClick={handleNewFolder}
                            >
                                + New Folder
                            </button>
                        </div>
                    </div>
                ) : activeTab === "currency" ? (
                    // ================================================================
                    // 시세 탭
                    // ================================================================
                    <div className="pst-panel">
                        <div className="pst-panel-body">
                            <PoeNinjaCurrency />
                        </div>
                    </div>
                ) : (
                    // ================================================================
                    // 설정 탭
                    // ================================================================
                    <div className="pst-panel">
                        <div className="pst-panel-body">
                            <Settings
                                folders={folders}
                                bookmarks={bookmarks}
                                setFolders={setFolders}
                                setBookmarks={setBookmarks}
                                sidebarPosition={sidebarPosition}
                                onChangeSidebarPosition={handleChangeSidebarPosition}
                                language={language}
                                onChangeLanguage={handleChangeLanguage}
                            />
                        </div>
                    </div>
                )}
            </aside>

            {contextMenu ? (
                // ================================================================
                // 컨텍스트 메뉴 팝업
                // ================================================================
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={handleCloseContextMenu}
                    menuItems={[
                        {
                            key: "rename",
                            label: contextMenu.bookmarkId
                                ? ttt("contextMenu.renameBookmark")
                                : ttt("contextMenu.renameFolder"),
                            onSelect: () =>
                                handleRenameBookmark(contextMenu.folderId, contextMenu.bookmarkId),
                        },
                        // '현재 검색으로 대체' 는 북마크일 때만 보여야 함
                        ...(contextMenu.bookmarkId
                            ? [
                                  {
                                      key: "replace",
                                      label: ttt("contextMenu.replaceWithCurrentSearch"),
                                      onSelect: () => handleReplaceBookmarkUrl(),
                                  },
                              ]
                            : []),
                        {
                            key: "cancel",
                            label: ttt("common.close"),
                            onSelect: () => handleCloseContextMenu(),
                        },
                    ]}
                />
            ) : null}
        </div>
    );
};
