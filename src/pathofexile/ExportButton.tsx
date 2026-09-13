import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./ExportButton.css";
import { poeUtil } from "./poeUtil";
import { loadSettings } from "../content/storage";

type Toast = {
    message: string;
    top: number;
    left: number;
};

export type ExportButtonType = {
    pathOfExileItemId: string;
    makePoeDbLinkButton: boolean;
};

const TOAST_DURATION = 2000;

/**
 * POB Export 버튼
 */
export const ExportButton = ({ pathOfExileItemId, makePoeDbLinkButton }: ExportButtonType) => {
    const [toast, setToast] = useState<Toast | null>(null);

    useEffect(() => {
        if (!toast) return;

        const timerId = setTimeout(() => setToast(null), TOAST_DURATION);
        return () => clearTimeout(timerId);
    }, [toast]);

    /**
     * 클릭한 버튼 바로 아래에 토스트를 띄운다
     */
    const showToast = (message: string, target: HTMLElement) => {
        const rect = target.getBoundingClientRect();

        setToast({
            message,
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
        });
    };

    /**
     * [Click Event] Export 버튼 클릭 시
     */
    const handleClickExport = async (button: HTMLButtonElement) => {
        const item = await poeUtil.fetchPathOfExileItemInfo(pathOfExileItemId);
        if (!item) {
            showToast("Item data fetch failed!", button);
            return;
        }

        try {
            await navigator.clipboard.writeText(poeUtil.parseItemJsonToPobText(item));
            showToast("Copied to clipboard!", button);
        } catch (err) {
            console.error("Copy failed:", err);
            showToast("Copy failed", button);
        }
    };

    /**
     * [Click Event] PoeDB 버튼 클릭 시 : 아이템 영문 이름으로 PoeDB 페이지를 새 탭에 띄운다
     */
    const handleClickPoeDb = async (button: HTMLButtonElement) => {
        const item = await poeUtil.fetchPathOfExileItemInfo(pathOfExileItemId);
        // 설정 탭에서 언어를 바꾸면 바로 반영되도록 클릭할 때마다 읽는다
        const poeDbUrl = item && poeUtil.getPoeDbUrl(item, loadSettings().language);
        if (!poeDbUrl) {
            showToast("Item data fetch failed!", button);
            return;
        }

        window.open(poeDbUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="pst-export-btns">
            {/* Export 버튼 */}
            <button
                type="button"
                className="pst-export-btn"
                onClick={(event) => void handleClickExport(event.currentTarget)}
            >
                Export
            </button>
            {/* PoeDB 버튼 */}
            {makePoeDbLinkButton && (
                <button
                    type="button"
                    className="pst-export-btn"
                    onClick={(event) => void handleClickPoeDb(event.currentTarget)}
                >
                    PoeDB
                </button>
            )}
            {toast
                ? createPortal(
                      <div className="pst-toast" style={{ top: toast.top, left: toast.left }}>
                          {toast.message}
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
};
