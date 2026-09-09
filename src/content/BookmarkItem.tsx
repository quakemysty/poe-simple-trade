import { type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { loadSettings } from "./storage";
import { Util } from "../pathofexile/util";

export type Bookmark = {
    id: string;
    label: string;
    url: string;
};

// 폴더 id -> 그 폴더의 북마크 목록.
// @dnd-kit/helpers 의 move() 가 여러 목록 사이의 이동을 처리하려면
// 목록이 이 Record 형태여야 한다. (키가 곧 폴더 = 그룹 식별자)
export type BookmarkMap = Record<string, Bookmark[]>;

/**
 * 저장해 둔 검색 조건과 현재 리그로 실제 이동할 주소를 만든다
 */
const buildSearchUrl = (searchCondition: string, leagueName: string): string => {
    const prefixHostUrl = `${document.location.protocol}//${document.location.host}`;
    const league = encodeURIComponent(leagueName);

    return Util.detectGameType() === "poe1"
        ? `${prefixHostUrl}/trade/search/${league}/${searchCondition}`
        : `${prefixHostUrl}/trade2/search/poe2/${league}/${searchCondition}`;
};

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
    // group 에 폴더 id 를 넣으면 같은 폴더 안에서의 정렬과
    // 다른 폴더로의 이동을 dnd-kit 이 같은 방식으로 처리한다.
    // handleRef 를 지정하면 dnd-kit 이 pointerdown 을 핸들에만 걸어,
    // 드래그는 핸들에서만 시작되고 나머지 영역은 글자 선택 / 클릭에 쓸 수 있다.
    const { ref, handleRef, isDragSource } = useSortable({
        id: bookmark.id,
        index,
        group: folderId,
        type: "bookmark",
        accept: "bookmark",
    });

    // 이동은 <a href> 가 맡는다. 리그가 없거나 주소가 비었으면 href 를 만들지 않는다.
    const leagueName = loadSettings().leagueName;
    const searchUrl = leagueName && bookmark.url ? buildSearchUrl(bookmark.url, leagueName) : "";

    /**
     * 북마크 클릭 이벤트 : 갈 수 없는 상태면 이동을 막고 이유를 알린다
     */
    const handleBookmarkClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (!leagueName) {
            event.preventDefault();
            alert("세팅에서 League 를 설정하세요");
            return;
        }

        if (!bookmark.url) {
            event.preventDefault();
            alert("해당 북마크 URL 이 비었습니다");
        }
    };

    return (
        <li
            ref={ref}
            className="pst-bookmark-item"
            data-dragging={isDragSource}
            title={bookmark.label}
        >
            <span
                ref={handleRef}
                className="pst-drag-handle"
                title="끌어서 순서 변경"
                aria-hidden="true"
            >
                ⠿
            </span>
            {/* draggable={false} : <a> 의 기본 드래그가 dnd-kit 의 정렬 드래그를 가로채지 않도록 */}
            <a
                className="pst-bookmark-name"
                href={searchUrl || undefined}
                draggable={false}
                onClick={handleBookmarkClick}
            >
                {bookmark.label}
            </a>
            <button
                type="button"
                className="pst-btn-bookmark"
                title="옵션"
                aria-label="옵션"
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
                title="삭제"
                aria-label="삭제"
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
