import { loadSettings } from "./content/storage";
import ko from "./locales/ko.json";
import enMessages from "./locales/en.json";

/**
 * src/locales/{language}.json
 */
export type MessageKey = keyof typeof ko;

const en: Record<MessageKey, string> = enMessages;

const dictionaries = { ko, en };

/**
 * 메시지 안의 {{이름}} 은 params 의 같은 이름 값으로 바꾼다. params 에 없으면 그대로 둔다
 *
 * @example ttt("tab.currency.refreshAlert", { minutes: 3 })
 */
export const ttt = (key: MessageKey, params?: Record<string, string | number>): string => {
    const message = dictionaries[loadSettings().language][key];
    if (!params) return message;

    return message.replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, name: string) => {
        const value = params[name];
        return value === undefined ? placeholder : String(value);
    });
};
