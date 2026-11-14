import { useEffect, useRef, useState, type ReactNode } from "react";

/** A visible, keyboard-accessible horizontal control, even with overlay scrollbars. */
export default function ScrollableTable({ children, label }: { children: ReactNode; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () => {
      const max = element.scrollWidth - element.clientWidth;
      setOverflow(max > 1);
      setPosition(max > 0 ? Math.round(element.scrollLeft / max * 1000) : 0);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, []);

  return <div className="admin-table-region">
    {overflow && <div className="admin-table-control">
      <span aria-hidden="true">←</span>
      <input type="range" aria-label={`Desplazar ${label} horizontalmente`} min="0" max="1000" value={position} onChange={event => {
        const element = container.current;
        if (element) element.scrollLeft = Number(event.target.value) / 1000 * (element.scrollWidth - element.clientWidth);
      }} />
      <span aria-hidden="true">→</span>
      <span className="admin-table-control-label">Desliza para ver más</span>
    </div>}
    <div ref={container} className="admin-table-scroll" tabIndex={0} role="region" aria-label={label}>{children}</div>
  </div>;
}
