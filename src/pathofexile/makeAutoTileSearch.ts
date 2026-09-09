/**
 * Path of Exile 검색어 입력창에 자동으로 ~ 붙이기
 */
const handleEventToPoeSearchInputBox = (event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches("div.multiselect__tags > input")) return;

    // 글자를 넣지 않는 키는 먼저 걸러낸다
    if (
        event.isComposing || // 한글조합중
        event.ctrlKey ||
        [
            "Backspace",
            "Delete",
            "Shift",
            "Home",
            "End",
            "Enter",
            "~",
            "Tab",
            "Control",
            "Alt",
            "Escape",
            "Meta",
            "Fn",
        ].includes(event.key) ||
        event.key.startsWith("Arrow")
    ) {
        return;
    }

    const value = target.value;

    // focusin 시 Text 선택돼있을때.
    // 이번에 누른 글자가 선택된 텍스트를 통째로 지우므로 빈 칸에 새로 치는 것과 같다.
    const isAllSelected =
        value.length > 0 && target.selectionStart === 0 && target.selectionEnd === value.length;

    if (value === "" || isAllSelected) {
        // value 를 넣으면 캐럿이 끝으로 가므로, 뒤이은 기본 동작이 "~" 뒤에 글자를 넣는다
        target.value = "~";
        return;
    }

    if (value.startsWith("~")) return;

    const caret = target.selectionStart ?? value.length;
    target.value = "~" + value;
    target.setSelectionRange(caret + 1, caret + 1);
};

let isEnabled = false;

/**
 * 이벤트 세팅
 */
export const setEventToPoeSearchInputBox = (enabled: boolean) => {
    if (enabled === isEnabled) return;
    isEnabled = enabled;

    if (enabled) {
        document.addEventListener("keydown", handleEventToPoeSearchInputBox, { capture: true });
        return;
    }

    document.removeEventListener("keydown", handleEventToPoeSearchInputBox, { capture: true });
};
