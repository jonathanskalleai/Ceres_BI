import { useState, useEffect, type RefObject } from "react";

/**
 * Observes the width of a container element via ResizeObserver.
 * Returns 0 until the first measurement.
 */
export function useContainerWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w =
          entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setWidth(Math.round(w));
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
