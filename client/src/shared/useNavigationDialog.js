import { useEffect, useRef } from 'react'

export function useNavigationDialog(open, onClose, selector) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const panel = document.querySelector(selector)
    if (!panel) return undefined
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    const focusable = () => [...panel.querySelectorAll('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]')].filter((node) => node.getClientRects().length)
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => focusable()[0]?.focus())
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) { event.preventDefault(); return }
      const first = elements[0], last = elements.at(-1)
      if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [open, selector])
}
