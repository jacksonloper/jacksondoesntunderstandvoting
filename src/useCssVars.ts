import { useEffect, useState } from 'react'

/** Resolve CSS custom properties to concrete colours, re-reading them whenever the theme changes. */
export function useCssVars<K extends string>(names: readonly K[]): Record<K, string> {
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<K, string>
  }
  const [vals, setVals] = useState(read)
  const key = names.join(',')
  useEffect(() => {
    const update = () => setVals(read())
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    update()
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return vals
}
