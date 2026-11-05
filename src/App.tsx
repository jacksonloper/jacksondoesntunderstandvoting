import { useEffect, useState } from 'react'
import './App.css'
import Home from './pages/Home.tsx'
import YeeCaseStudy from './yee/YeeCaseStudy.tsx'
import StarPrCaseStudy from './starpr/StarPrCaseStudy.tsx'

// Hash routing (#/star-pr) so the built site works from any static host
// (GitHub Pages, Netlify, a plain folder) with no server-side rewrites.
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || ''
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

type Theme = 'auto' | 'light' | 'dark'

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('theme')
      if (t === 'light' || t === 'dark') return t
    } catch {
      /* storage unavailable */
    }
    return 'auto'
  })
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'auto') delete el.dataset.theme
    else el.dataset.theme = theme
    try {
      if (theme === 'auto') localStorage.removeItem('theme')
      else localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])
  return [theme, setTheme]
}

export const caseStudies = [
  {
    route: 'yee',
    number: 1,
    title: 'When Round Robin and IRV disagree',
    summary:
      'A live Yee diagram: drag three candidates around a 2-D opinion space and watch where pairwise (Round Robin) and instant-runoff voting pick different winners, and why.',
    component: YeeCaseStudy,
  },
  {
    route: 'star-pr',
    number: 2,
    title: 'How BetterVoting counts STAR-PR',
    summary:
      'A step-by-step walk through the exact proportional STAR tabulator BetterVoting runs: quotas, split points, ballot reweighting, ties and a few surprises. Edit the ballots and the count reruns live.',
    component: StarPrCaseStudy,
  },
]

function App() {
  const route = useHashRoute()
  const [theme, setTheme] = useTheme()
  const study = caseStudies.find((c) => c.route === route)
  const Page = study?.component

  useEffect(() => {
    document.title = study ? `${study.title} · Jackson doesn’t understand voting` : 'Jackson doesn’t understand voting'
  }, [study])

  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

  return (
    <>
      <header className="site-header">
        <a href="#/" className="site-title">
          jackson<span>doesn’t</span>understand<span>voting</span>
        </a>
        <button
          className="theme-toggle"
          onClick={() => setTheme(nextTheme[theme])}
          aria-label={`Color theme: ${theme}. Click to change.`}
          title="Switch color theme"
        >
          {theme === 'auto' ? '◐ auto' : theme === 'light' ? '☀ light' : '☾ dark'}
        </button>
      </header>
      <main className="page">{Page ? <Page /> : <Home studies={caseStudies} />}</main>
      <footer className="site-footer">
        Case studies written to help me understand voting methods. Source on{' '}
        <a href="https://github.com/jacksonloper/jacksondoesntunderstandvoting">GitHub</a>.
      </footer>
    </>
  )
}

export default App
