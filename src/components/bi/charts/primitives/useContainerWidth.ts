import { useState, useEffect, useRef, type RefObject } from "react";

/**
 * Observes the width of a container element via ResizeObserver.
 * Returns 0 until the first measurement.
 * Uses rAF debounce + skip-if-unchanged to prevent resize loops.
 */
export function useContainerWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        for (const entry of entries) {
          const w =
            entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          const rounded = Math.round(w);
          setWidth((prev) => (prev === rounded ? prev : rounded));
        }
      });
    });
    ro.observe(node);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [ref]);

  return width;
}
