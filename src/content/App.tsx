import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { DragDropProvider, type DragEndEvent, type DragOverEvent } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import "./App.css";
import { FolderItem, type Folder } from "./FolderItem";
import type { BookmarkMap } from "./BookmarkItem";
import { ContextMenu } from "./ContextMenu";
import { Settings } from "./Settings";
import {
    loadBookmarkData,
    loadSettings,
    saveBookmarkData,
    saveSettings,
    type SidebarPosition,
} from "./storage";
import { Util } from "../pathofexile/util";

type TabKey = "bookmark" | "settings";

// 컨텍스트 메뉴가 열린 위치와 대상. bookmarkId 가 없으면 폴더가 대상.
type ContextMenuState = {
    x: number;
    y: number;
    folderId: string;
    bookmarkId?: string;
};

const TABS: { key: TabKey; label: string }[] = [
    { key: "bookmark", label: "북마크" },
    { key: "settings", label: "설정" },
];

export const App = () => {
    const [activeTab, setActiveTab] = useState<TabKey>("bookmark");

    /**
     * 폴더 목록
     */
    const [folders, setFolders] = useState<Folder[]>(() => loadBookmarkData()?.folders || []);
    /**
     * 폴더 하위의 북마크 목록.
     */
    const [bookmarks, setBookmarks] = useState<BookmarkMap>(
        () => loadBookmarkData()?.bookmarks || {},
    );
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    /**
     * 설정 탭 - 사이드바 위치는 레이아웃에 영향을 주므로 App 이 들고 있는다
     */
    const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(
        () => loadSettings().sidebarPosition,
    );
    /**
     * 플로팅 버튼으로 사이드바 전체를 접었는지 여부
     */
    const [isSidebarHidden, setIsSidebarHidden] = useState(() => loadSettings().isSidebarHidden);
    /**
     * 드래그가 취소(ESC)되면 onDragOver 로 미리 반영해 둔 상태를 되돌리기 위한 스냅샷
     */
    const bookmarksSnapshot = useRef<BookmarkMap>({});

    /**
     * 폴더 / 북마크가 바뀔 때마다 저장한다.
     * 추가 · 수정 · 삭제와 불러오기는 물론 드래그로 순서를 바꾼 경우까지 여기 한 곳을 거친다.
     */
    useEffect(() => {
        saveBookmarkData({ folders, bookmarks });
    }, [folders, bookmarks]);

    useEffect(() => {
        saveSettings({ sidebarPosition, isSidebarHidden });
    }, [sidebarPosition, isSidebarHidden]);

    /**
     * 원래 페이지를 사이드바 반대쪽으로 밀어낸다
     */
    useEffect(() => {
        const { classList } = document.body;

        classList.toggle("pst-page-shift", !isSidebarHidden);
        classList.toggle("pst-page-shift-right", !isSidebarHidden && sidebarPosition === "right");

        return () => classList.remove("pst-page-shift", "pst-page-shift-right");
    }, [sidebarPosition, isSidebarHidden]);

    /**
     * New Folder
     */
    const handleNewFolder = () => {
        const folderId = `folder-${Date.now()}`;
        const folderName = window.prompt("폴더 이름을 입력하세요.");
        if (!folderName) return;

        setFolders((prev) => [
            ...prev,
            { id: folderId, name: folderName, gameType: Util.detectGameType(), expanded: false },
        ]);
        // 빈 폴더도 드롭 대상이 되려면 BookmarkMap 에 키가 있어야 한다
        setBookmarks((prev) => ({ ...prev, [folderId]: [] }));
    };

    /**
     * New bookmark in Folder
     */
    const handleNewBookmark = (folderId: string, label: string, url: string) => {
        setBookmarks((prev) => ({
            ...prev,
            [folderId]: [
                ...(prev[folderId] ?? []),
                { id: `bookmark-${Date.now()}`, label, url, gameType: Util.detectGameType() },
            ],
        }));
        // 새 북마크가 바로 보이도록 폴더를 펼친다
        setFolders((prev) =>
            prev.map((folder) => (folder.id === folderId ? { ...folder, expanded: true } : folder)),
        );
    };

    /**
     * Toggle folder
     */
    const handleToggleFolder = (folderId: string) => {
        setFolders((prev) =>
            prev.map((folder) =>
                folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder,
            ),
        );
    };

    /**
     * 옵션(⋮) 클릭 : 클릭한 아이콘의 왼쪽 아래에 맞춰 컨텍스트 메뉴를 띄운다
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
     * 컨텍스트 메뉴 - 북마크 이름 변경
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
            targetBookmark ? "북마크 이름을 입력하세요." : "폴더 이름을 입력하세요.",
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
     * 컨텍스트 메뉴 - "현재 검색으로 대체"
     * 북마크의 URL을 현재 브라우저의 URL로 대체합니다.
     */
    const handleReplaceBookmarkUrl = () => {
        if (!contextMenu?.bookmarkId) return;
        const folderId = contextMenu.folderId;
        const bookmarkId = contextMenu.bookmarkId;
        const currentUrl = Util.getItemSearchConditionUrl(); // 현재 URL에서 검색 조건 부분만 추출

        setBookmarks((prev) => ({
            ...prev,
            [folderId]: (prev[folderId] ?? []).map((bookmark) =>
                bookmark.id === bookmarkId ? { ...bookmark, url: currentUrl } : bookmark,
            ),
        }));
        setContextMenu(null);
    };

    /**
     * Delete folder
     */
    const handleDeleteFolder = (folderId: string) => {
        if (!window.confirm("삭제하시겠습니까?")) {
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
     * Delete bookmark
     */
    const handleDeleteBookmark = (folderId: string, bookmarkId: string) => {
        if (!window.confirm("삭제하시겠습니까?")) {
            return;
        }

        setBookmarks((prev) => ({
            ...prev,
            [folderId]: (prev[folderId] ?? []).filter((bookmark) => bookmark.id !== bookmarkId),
        }));
    };

    // ================================================================
    // 설정 탭
    // ================================================================

    /**
     * 사이드바를 화면 왼쪽 / 오른쪽 중 어디에 붙일지
     */
    const handleChangeSidebarPosition = (position: SidebarPosition) => {
        setSidebarPosition(position);
    };

    // ================================================================
    // 드래그 앤 드랍
    // 배열 / Record 조작은 @dnd-kit/helpers 의 move() 가 전부 처리한다.
    // move() 는 이벤트에서 source / target 과 정렬 인덱스를 읽어
    // 같은 폴더 안에서의 순서 변경과 다른 폴더로의 이동을 함께 계산한다.
    // ================================================================
    const handleDragStart = () => {
        bookmarksSnapshot.current = bookmarks;
    };

    /**
     * 북마크는 드래그하는 동안 바로 옮겨서 놓일 자리를 보여준다
     */
    const handleDragOver = (event: DragOverEvent) => {
        if (event.operation.source?.type === "folder") return;

        setBookmarks((prev) => move(prev, event));
    };

    /**
     * 폴더는 순서가 계속 요동치지 않도록 드래그가 끝날 때 한 번만 옮긴다
     */
    const handleDragEnd = (event: DragEndEvent) => {
        if (event.canceled) {
            // onDragOver 로 미리 반영해 둔 북마크 이동을 되돌린다
            setBookmarks(bookmarksSnapshot.current);
            return;
        }

        if (event.operation.source?.type !== "folder") return;

        setFolders((prev) => move(prev, event));
    };

    const layoutClassName = [
        "pst-layout",
        sidebarPosition === "right" ? "is-right" : "",
        isSidebarHidden ? "is-hidden" : "",
    ]
        .filter(Boolean)
        .join(" ");

    // 화살표는 눌렀을 때 패널이 움직일 방향을 가리킨다
    const toggleArrow = (sidebarPosition === "left") !== isSidebarHidden ? "◀" : "▶";
    const toggleLabel = isSidebarHidden ? "사이드바 열기" : "사이드바 닫기";

    return (
        <div className={layoutClassName}>
            {/* 패널 바깥쪽 모서리에 붙는 플로팅 버튼. 패널을 접어도 화면 가장자리에 남는다 */}
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
                            {tab.label}
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
                        {/* 하단 */}
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
                    items={[
                        {
                            key: "rename",
                            label: contextMenu.bookmarkId ? "북마크 이름 변경" : "폴더명 변경",
                            onSelect: () =>
                                handleRenameBookmark(contextMenu.folderId, contextMenu.bookmarkId),
                        },
                        // '현재 검색으로 대체' 는 북마크일 때만 넣는다
                        ...(contextMenu.bookmarkId
                            ? [
                                  {
                                      key: "replace",
                                      label: "현재 검색으로 대체",
                                      onSelect: () => handleReplaceBookmarkUrl(),
                                  },
                              ]
                            : []),
                        {
                            key: "cancel",
                            label: "닫기",
                            onSelect: () => handleCloseContextMenu(),
                        },
                    ]}
                />
            ) : null}
        </div>
    );
};
