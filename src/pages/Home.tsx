interface Study {
  route: string
  number: number
  title: string
  summary: string
}

export default function Home({ studies }: { studies: Study[] }) {
  return (
    <>
      <section className="hero">
        <h1>Voting case studies</h1>
        <p className="lede">
          Small, interactive explanations of how particular voting methods behave, built to be poked at. Each one is
          a single page you can read top to bottom, with ballots you can change.
        </p>
      </section>
      <ol className="study-list">
        {studies.map((s) => (
          <li key={s.route}>
            <a href={`#/${s.route}`} className="study-card">
              <span className="study-num">Case study {s.number}</span>
              <span className="study-title">{s.title}</span>
              <span className="study-summary">{s.summary}</span>
              <span className="study-go" aria-hidden="true">
                Read →
              </span>
            </a>
          </li>
        ))}
      </ol>
    </>
  )
}
