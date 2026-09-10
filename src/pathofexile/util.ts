/**
 * 주소로 게임 버전 체크
 */
const detectGameType = (): string => (window.location.href.includes("/trade2") ? "poe2" : "poe1");

/**
 * Path of Exlie 아이템 검색 URL 의 제일 마지막 부분만 발췌
 */
const getItemSearchConditionUrl = (): string => {
    const url = document.location.href;
    return url.substring(url.lastIndexOf("/") + 1);
};

/**
 * Path of Exlie 아이템 검색 InputBox 입력값 조회
 */
const getItemSearchInputBoxValue = (): string => {
    const label =
        document.querySelector<HTMLInputElement>("input.multiselect__input")?.value?.trim() ||
        "New Bookmark";
    return label;
};

/**
 * 저장해 둔 Bookmark URL 과 현재 리그로 실제 이동할 주소를 만든다
 */
const getItemSearchUrl = (bookmarkUrl: string, leagueName: string): string => {
    const prefixHostUrl = `${document.location.protocol}//${document.location.host}`;
    const league = encodeURIComponent(leagueName);

    return Util.detectGameType() === "poe1"
        ? `${prefixHostUrl}/trade/search/${league}/${bookmarkUrl}`
        : `${prefixHostUrl}/trade2/search/poe2/${league}/${bookmarkUrl}`;
};

export const Util = {
    detectGameType,
    getItemSearchConditionUrl,
    getItemSearchInputBoxValue,
    getItemSearchUrl: getItemSearchUrl,
};

// /** localStorage 테스트용 */
// const INITIAL_FOLDERS: Folder[] = [
//     { id: "folder-1", name: "폴더-1", gameType: detectGameType(), expanded: false },
//     { id: "folder-2", name: "폴더-2", gameType: detectGameType(), expanded: false },
//     { id: "folder-3", name: "폴더-3", gameType: detectGameType(), expanded: false },
// ];

// const INITIAL_BOOKMARKS: BookmarkMap = {
//     "folder-1": [
//         {
//             id: "bookmark-1",
//             label: "POE1-테스트용-1",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUipOTS4tSkzKSVWq1VHKS8xNVbJSer14xeumGa-XrXnTteTN3BkKr3fOVtJRKqksAEtuWPlm1g6FNzMa387Yo_B6w8q3PSuUdMBGFytZRVfD1CXmpSjpKKVl5pSkFoEkYmtjawFfWzU1ggAAAA",
//         },
//         {
//             id: "bookmark-2",
//             label: "POE2 테스트용-2",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSerV9x-vWhjdzZyi8aVnwZtoOJR2wzmIlq-hqmJrEvBQlHaW0zJyS1CKQRGxtbC0A1nIcimEAAAA",
//         },
//         {
//             id: "bookmark-3",
//             label: "북마크-3",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//     ],
//     "folder-2": [
//         {
//             id: "bookmark-4",
//             label: "북마크-4",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//         {
//             id: "bookmark-5",
//             label: "북마크-5",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//         {
//             id: "bookmark-6",
//             label: "북마크-6",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//     ],
//     "folder-3": [
//         {
//             id: "bookmark-7",
//             label: "북마크-7",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//         {
//             id: "bookmark-8",
//             label: "북마크-8",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//         {
//             id: "bookmark-9",
//             label: "북마크-9",
//             url: "H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1VEqqSxIVbJSer1qxetla15t3PJm7gyFt21b32zYoKQD1lysZBVdDVOWmJeipKOUlplTkloEkoitja0FAMY3oIZkAAAA",
//         },
//     ],
// };
