import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Observa a largura de um elemento via ResizeObserver.
 * Equivalente ao `mount.clientWidth` dos call-sites em charts.js.
 * Render só acontece quando width > 0.
 */
export function useElementWidth<T extends HTMLElement>(): [
  React.RefObject<T>,
  number,
] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(entry.contentRect.width)
      }
    })

    observer.observe(el)
    // leitura inicial
    setWidth(el.clientWidth)

    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
