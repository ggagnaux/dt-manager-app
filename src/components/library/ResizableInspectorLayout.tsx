import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 420;
const MAX_WIDTH = 1200;
const STORAGE_KEY = "dt-manager-inspector-width";

export function ResizableInspectorLayout({ children, className }: {
  children: ReactNode;
  className: string;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(MAX_WIDTH);
  const [preferredWidth, setPreferredWidth] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(stored) && stored >= MIN_WIDTH
        ? Math.min(MAX_WIDTH, stored) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const maxWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, availableWidth));
  const width = Math.min(preferredWidth, maxWidth);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setAvailableWidth(container.clientWidth - 320 - 16);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dragging) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(preferredWidth));
    } catch {
      // Resizing still works when browser storage is unavailable.
    }
  }, [preferredWidth, dragging]);

  function resize(nextWidth: number) {
    setPreferredWidth(Math.max(MIN_WIDTH, Math.min(maxWidth, nextWidth)));
  }

  return (
    <section
      ref={containerRef}
      className={`${className} resizable-inspector-layout${dragging ? " inspector-resizing" : ""}`}
      style={{ "--inspector-width": `${width}px` } as CSSProperties}
    >
      <div
        className="inspector-resize-handle"
        role="separator"
        tabIndex={0}
        aria-label="Resize Inspector"
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={maxWidth}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`${Math.round(width)} pixels wide`}
        title="Drag to resize Inspector. Use arrow keys, or double-click to reset."
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, width };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          resize(dragRef.current.width + dragRef.current.x - event.clientX);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          dragRef.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onDoubleClick={() => resize(DEFAULT_WIDTH)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 40 : 10;
          if (event.key === "ArrowLeft") resize(width + step);
          else if (event.key === "ArrowRight") resize(width - step);
          else if (event.key === "Home") resize(MIN_WIDTH);
          else if (event.key === "End") resize(maxWidth);
          else return;
          event.preventDefault();
        }}
      />
      {children}
    </section>
  );
}
