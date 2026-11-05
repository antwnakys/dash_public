import { useEffect, useState } from 'react'

/** Whether the page is scrolled past `threshold`, and whether the last movement was downward. */
export function useScrollState(threshold = 8) {
  const [state, setState] = useState({ scrolled: false, down: false })
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - last
        if (Math.abs(delta) < 4 && y > 0) return
        setState({ scrolled: y > threshold, down: delta > 0 && y > 80 })
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [threshold])
  return state
}
