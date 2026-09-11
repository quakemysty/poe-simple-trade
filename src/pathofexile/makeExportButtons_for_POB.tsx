import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExportButton, type ExportButtonType } from "./ExportButton";

/**
 * Path of Exile 검색결과 아이템 목록에 POB 영문용 Export 버튼 추가
 */

/** 각 아이템 행에 끼워 넣어 Export 버튼을 담는 컨테이너 class. */
const CONTAINER_CLASS = "pst-export";

/** POE-DB 링크 버튼 보이는 조건 (유니크, 젬) */
const POE_DB_ITEM_SELECTOR = ".middle .item-popup--unique, .middle .item-popup--gem";

type ExportTarget = {
    key: number;
    params: ExportButtonType;
    container: HTMLElement;
};

let nextKey = 0;

export const MakeExportButtons = () => {
    const [targets, setTargets] = useState<ExportTarget[]>([]);

    useEffect(() => {
        let frameId = 0;

        const scanFn = () => {
            frameId = 0;
            const added: ExportTarget[] = [];

            document.querySelectorAll<HTMLElement>(".resultset .row").forEach((row) => {
                const leftDiv = row.querySelector(".left");
                const pathOfExileItemId = row.dataset.id;
                if (
                    !leftDiv ||
                    !pathOfExileItemId ||
                    leftDiv.querySelector(`.${CONTAINER_CLASS}`) // 이미 존재할 경우
                ) {
                    return;
                }

                const makePoeDbLinkButton = row.querySelector(POE_DB_ITEM_SELECTOR) !== null;

                // Export 버튼 동적 삽입
                const container = document.createElement("div");
                container.className = CONTAINER_CLASS;
                leftDiv.appendChild(container);

                added.push({
                    key: nextKey++,
                    params: { pathOfExileItemId, makePoeDbLinkButton },
                    container,
                });
            });

            setTargets((prev) => {
                // 페이지가 다시 그리면서 떼어낸 행의 버튼은 버린다
                const alive = prev.filter((target) => target.container.isConnected);
                if (!added.length && alive.length === prev.length) return prev;

                return [...alive, ...added];
            });
        };

        // DOM 변경이 몰려와도 한 프레임에 한 번만 훑는다
        const requestScan = () => {
            if (!frameId) frameId = requestAnimationFrame(scanFn);
        };

        const observer = new MutationObserver(requestScan);
        observer.observe(document.body, { childList: true, subtree: true });
        requestScan();

        return () => {
            observer.disconnect();
            cancelAnimationFrame(frameId);
            document.querySelectorAll(`.${CONTAINER_CLASS}`).forEach((el) => el.remove());
        };
    }, []);

    return targets.map(({ key, params, container }) =>
        createPortal(<ExportButton {...params} />, container, key),
    );
};
