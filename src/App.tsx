import './App.css'

type Winner = 'A' | 'B' | 'C'

const roundRobinYee: Winner[] = [
  'A',
  'A',
  'B',
  'B',
  'B',
  'A',
  'B',
  'B',
  'B',
  'B',
  'B',
  'B',
  'B',
  'B',
  'C',
  'B',
  'B',
  'B',
  'B',
  'C',
  'B',
  'B',
  'B',
  'C',
  'C',
]

const irvYee: Winner[] = [
  'A',
  'A',
  'A',
  'C',
  'C',
  'A',
  'A',
  'C',
  'C',
  'C',
  'A',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
]

const ballotProfile = [
  { ranking: '31 voters: A > B > C' },
  { ranking: '30 voters: B > C > A' },
  { ranking: '39 voters: C > B > A' },
]

function App() {
  return (
    <main className="app-shell">
      <header>
        <h1>Voting Case Studies</h1>
        <p>
          Case Study 1: a Yee-diagram-style comparison where Round Robin and IRV
          produce different winners.
        </p>
      </header>

      <section className="case-card">
        <h2>Profile used in this case</h2>
        <ul>
          {ballotProfile.map((item) => (
            <li key={item.ranking}>{item.ranking}</li>
          ))}
        </ul>
        <p>
          Round Robin (pairwise) elects <strong>B</strong> because B beats both
          A and C head-to-head. IRV eliminates B first and elects{' '}
          <strong>C</strong>.
        </p>
      </section>

      <section className="diagram-row" aria-label="Yee diagram comparison">
        <article>
          <h2>Round Robin Yee diagram</h2>
          <div className="yee-grid">
            {roundRobinYee.map((winner, index) => (
              <span key={`rr-${index}`} className={`cell winner-${winner}`}>
                {winner}
              </span>
            ))}
          </div>
        </article>
        <article>
          <h2>IRV Yee diagram</h2>
          <div className="yee-grid">
            {irvYee.map((winner, index) => (
              <span key={`irv-${index}`} className={`cell winner-${winner}`}>
                {winner}
              </span>
            ))}
          </div>
        </article>
      </section>

      <footer className="legend" aria-label="Candidate legend">
        <span className="chip winner-A">A</span>
        <span className="chip winner-B">B</span>
        <span className="chip winner-C">C</span>
        <div>
          A, B, and C are candidate locations in ideological space. Colored
          cells indicate the winner for sampled voter positions.
        </div>
      </footer>
    </main>
  )
}

export default App
