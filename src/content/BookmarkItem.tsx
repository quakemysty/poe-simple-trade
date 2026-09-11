import { type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { loadSettings } from "./storage";
import { poeUtil } from "../pathofexile/poeUtil";
import { ttt } from "../i18n";

export type Bookmark = {
    id: string;
    label: string;
    url: string;
};

/**
 * 폴더 id 를 key 로, 그 폴더 안의 북마크 배열을 value 로 갖는 객체
 */
export type BookmarkMap = Record<string, Bookmark[]>;

type BookmarkProps = {
    bookmark: Bookmark;
    folderId: string;
    index: number;
    onPopupOption: (event: MouseEvent<HTMLElement>, folderId: string, bookmarkId?: string) => void;
    onDeleteBookmark: (folderId: string, bookmarkId: string) => void;
};

export const BookmarkItem = ({
    bookmark,
    folderId,
    index,
    onPopupOption,
    onDeleteBookmark,
}: BookmarkProps) => {
    /**
     * Bookmark Drag&Drop Hook
     *
     * @see https://dndkit.com/react/guides/multiple-sortable-lists
     */
    const { ref, handleRef, isDragSource } = useSortable({
        id: bookmark.id,
        index,
        group: folderId,
        type: "bookmark",
        accept: "bookmark",
    });

    const leagueName = loadSettings().leagueName;
    const searchUrl =
        leagueName && bookmark.url ? poeUtil.getItemSearchUrl(bookmark.url, leagueName) : "";

    /**
     * [Click Event] 북마크 클릭
     */
    const handleBookmarkClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (!leagueName) {
            event.preventDefault();
            alert(ttt("bookmark.leagueNotSet"));
            return;
        }

        if (!bookmark.url) {
            event.preventDefault();
            alert(ttt("bookmark.emptyUrl"));
        }
    };

    return (
        <li
            ref={ref}
            className="pst-bookmark-item"
            data-dragging={isDragSource}
            title={bookmark.label}
        >
            {/* Drag Handle */}
            <span
                ref={handleRef}
                className="pst-drag-handle"
                title={ttt("common.dragToReorder")}
                aria-hidden="true"
            >
                ⠿
            </span>
            {/* Bookmark Name */}
            <a
                className="pst-bookmark-name"
                href={searchUrl || undefined}
                draggable={false}
                onClick={handleBookmarkClick}
            >
                {bookmark.label}
            </a>
            {/* Bookmark Action Icons */}
            <button
                type="button"
                className="pst-btn-bookmark"
                title={ttt("common.options")}
                aria-label={ttt("common.options")}
                onClick={(event) => {
                    event.stopPropagation();
                    onPopupOption(event, folderId, bookmark.id);
                }}
            >
                ⋮
            </button>
            <button
                type="button"
                className="pst-btn-bookmark pst-btn-delete"
                style={{ fontSize: "12px" }}
                title={ttt("common.delete")}
                aria-label={ttt("common.delete")}
                onClick={(event) => {
                    event.stopPropagation();
                    onDeleteBookmark(folderId, bookmark.id);
                }}
            >
                ✖
            </button>
        </li>
    );
};
