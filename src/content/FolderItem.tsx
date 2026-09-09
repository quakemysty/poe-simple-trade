import type { MouseEvent } from "react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { useSortable } from "@dnd-kit/react/sortable";
import { BookmarkItem, type Bookmark } from "./BookmarkItem";
import { Util } from "../pathofexile/util";

export type Folder = {
    id: string;
    name: string;
    /** 만들어질 때의 게임 버전. 주소로 정해지며 이후 바뀌지 않는다 */
    gameType: string;
    /** 폴더를 펼쳐 둔 상태인지 */
    expanded: boolean;
};

type FolderProps = {
    folder: Folder;
    bookmarks: Bookmark[];
    index: number;
    onToggleFolder: (folderId: string) => void;
    onNewBookmark: (folderId: string, label: string, url: string) => void;
    onPopupOption: (event: MouseEvent<HTMLElement>, folderId: string, bookmarkId?: string) => void;
    onDeleteFolder: (folderId: string) => void;
    onDeleteBookmark: (folderId: string, bookmarkId: string) => void;
};

export const FolderItem = ({
    folder,
    bookmarks,
    index,
    onToggleFolder,
    onNewBookmark,
    onPopupOption,
    onDeleteFolder,
    onDeleteBookmark,
}: FolderProps) => {
    /**
     * 북마크 추가(+) : 이름과 URL 을 입력받아 넘긴다.
     */
    const handleNewBookmark = () => {
        const label = Util.getItemSearchInputBoxValue();

        const url = Util.getItemSearchConditionUrl(); // 현재 URL에서 검색 조건 부분만 추출

        onNewBookmark(folder.id, label, url);
    };

    // ref       : 폴더 전체(헤더 + 북마크 목록)를 드롭 영역으로 삼는다.
    //             접혀 있거나 비어 있는 폴더에도 북마크를 떨어뜨릴 수 있다.
    // handleRef : 드래그는 핸들(⠿)에서만 시작한다.
    // sourceRef : 끌 때 따라다니는 모양은 헤더 한 줄로 둔다.
    //             (ref 만 쓰면 안쪽 북마크 목록까지 통째로 끌려 보인다)
    // collisionPriority : 북마크끼리의 충돌이 폴더 충돌보다 우선하도록 낮춘다.
    const { ref, handleRef, isDragSource } = useSortable({
        id: folder.id,
        index,
        type: "folder",
        accept: ["folder", "bookmark"],
        collisionPriority: CollisionPriority.Low,
    });

    return (
        <li ref={ref} className="pst-folder" data-dragging={isDragSource}>
            {/* ================================================================ */}
            {/* 폴더 */}
            {/* ================================================================ */}
            <div
                className="pst-folder-item"
                role="button"
                tabIndex={0}
                aria-expanded={folder.expanded}
                onClick={() => onToggleFolder(folder.id)}
            >
                {/* 핸들 클릭이 폴더 펼치기로 이어지지 않도록 막는다 */}
                <span
                    ref={handleRef}
                    className="pst-drag-handle"
                    title="끌어서 순서 변경"
                    aria-hidden="true"
                    onClick={(event) => event.stopPropagation()}
                >
                    ⠿
                </span>
                <span
                    className={`pst-folder-icon${folder.expanded ? " is-expanded" : ""}`}
                    aria-hidden="true"
                >
                    ▶
                </span>
                <span className="pst-folder-name">{folder.name}</span>
                <button
                    type="button"
                    className="pst-btn-bookmark"
                    title="북마크 추가"
                    aria-label="북마크 추가"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleNewBookmark();
                    }}
                >
                    +
                </button>
                <button
                    type="button"
                    className="pst-btn-bookmark"
                    title="옵션"
                    aria-label="옵션"
                    onClick={(event) => {
                        event.stopPropagation();
                        onPopupOption(event, folder.id);
                    }}
                >
                    ⋮
                </button>
                <button
                    type="button"
                    className="pst-btn-bookmark pst-btn-delete"
                    title="폴더 삭제"
                    aria-label="폴더 삭제"
                    onClick={(event) => {
                        event.stopPropagation();
                        onDeleteFolder(folder.id);
                    }}
                >
                    ✖
                </button>
            </div>

            {/* ================================================================ */}
            {/* 북마크 */}
            {/* ================================================================ */}
            {folder.expanded ? (
                <ul className="pst-bookmark-list">
                    {bookmarks.map((bookmark, bookmarkIndex) => (
                        <BookmarkItem
                            key={bookmark.id}
                            bookmark={bookmark}
                            folderId={folder.id}
                            index={bookmarkIndex}
                            onPopupOption={onPopupOption}
                            onDeleteBookmark={onDeleteBookmark}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
};
