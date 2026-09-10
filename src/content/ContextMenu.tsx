import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ContextMenuItem = {
    key: string;
    label: string;
    onSelect: () => void;
};

type ContextMenuProps = {
    x: number;
    y: number;
    menuItems: ContextMenuItem[];
    onClose: () => void;
};

export const ContextMenu = ({ x, y, menuItems, onClose }: ContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    // 메뉴가 화면 밖으로 나가지 않도록 보정 (paint 전에 실행)
    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        const { width, height } = menu.getBoundingClientRect();
        setPosition({
            x: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
            y: Math.max(4, Math.min(y, window.innerHeight - height - 4)),
        });
    }, [x, y]);

    // 바깥 클릭 / ESC / 스크롤 / 리사이즈 시 닫기
    useEffect(() => {
        const handleMouseDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleMouseDown, true);
        document.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("resize", onClose);
        // 세번째 인자 true : 사이드바 내부 스크롤도 잡기 위해 캡처 단계에서 수신
        window.addEventListener("scroll", onClose, true);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown, true);
            document.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("resize", onClose);
            window.removeEventListener("scroll", onClose, true);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="pst-context-menu"
            role="menu"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            {menuItems.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className="pst-context-menu-item"
                    onClick={() => {
                        // 메뉴를 먼저 닫고(리렌더 후) 실행. prompt 같은 동기 다이얼로그가
                        // 메뉴를 띄워둔 채 화면을 멈추는 것을 막는다.
                        onClose();
                        setTimeout(() => item.onSelect(), 0);
                    }}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
};
