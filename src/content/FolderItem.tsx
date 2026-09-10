import type { MouseEvent } from "react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { useSortable } from "@dnd-kit/react/sortable";
import { BookmarkItem, type Bookmark } from "./BookmarkItem";
import { Util } from "../pathofexile/util";

export type Folder = {
    id: string;
    name: string;
    /** poe1 or poe2 */
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
     * [Click Event] 북마크 추가 버튼 클릭 시
     */
    const handleNewBookmark = () => {
        const label = Util.getItemSearchInputBoxValue();

        const url = Util.getItemSearchConditionUrl();

        onNewBookmark(folder.id, label, url);
    };

    /**
     * Folder Drag&Drop Hook
     *
     * @see https://dndkit.com/react/guides/multiple-sortable-lists
     */
    const { ref, handleRef, targetRef, isDragSource } = useSortable({
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
            {/* 드롭 판정 영역(targetRef)은 헤더 행으로 제한한다. li 전체를 대상으로 두면 펼쳐진
                북마크 높이까지 포함되어, 낮은 폴더를 높은 폴더 위로 끌 때 스왑 직후에도 포인터가
                상대 영역 안에 남아 자리가 계속 뒤바뀐다(swap loop). */}
            <div
                ref={targetRef}
                className="pst-folder-item"
                role="button"
                tabIndex={0}
                aria-expanded={folder.expanded}
                onClick={() => onToggleFolder(folder.id)}
            >
                {/* Drag Handle */}
                <span
                    ref={handleRef}
                    className="pst-drag-handle"
                    title="끌어서 순서 변경"
                    aria-hidden="true"
                    onClick={(event) => event.stopPropagation()}
                >
                    ⠿
                </span>
                {/* Folder Icon */}
                <span
                    className={`pst-folder-icon${folder.expanded ? " is-expanded" : ""}`}
                    aria-hidden="true"
                >
                    ▶
                </span>
                {/* Folder Name */}
                <span className="pst-folder-name">{folder.name}</span>
                {/* Folder Action Icons */}
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
