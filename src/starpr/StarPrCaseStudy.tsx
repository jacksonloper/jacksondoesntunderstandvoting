import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ballot } from './allocatedScore.ts'
import { scenarios, type Scenario } from './scenarios.ts'
import { bvLink, fmtNum, fmtWeight, runWithOrder, stars } from './view.ts'
import { Staircase, TotalsChart, WeightsChart, candColor } from './charts.tsx'
import './starpr.css'

const Code = ({ file, line, children }: { file: string; line?: number; children: React.ReactNode }) => (
  <a href={bvLink(file, line)} target="_blank" rel="noreferrer">
    <code>{children}</code>
  </a>
)

function BallotEditor({
  names,
  ballots,
  dropped,
  setBallots,
}: {
  names: string[]
  ballots: Ballot[]
  dropped: ('outOfBounds' | 'abstention' | null)[]
  setBallots: (b: Ballot[]) => void
}) {
  const setScore = (b: number, c: number, v: string) =>
    setBallots(ballots.map((row, i) => (i === b ? row.map((s, j) => (j === c ? (v === '' ? null : +v) : s)) : row)))
  return (
    <div className="table-scroll">
      <table className="ballots">
        <thead>
          <tr>
            <th scope="col">Ballot</th>
            {names.map((n, c) => (
              <th key={c} scope="col">
                <span className="swatch" style={{ background: candColor(c) }} />
                {n}
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ballots.map((row, b) => (
            <tr key={b} className={dropped[b] ? 'dropped' : ''}>
              <th scope="row">
                #{b + 1}
                {dropped[b] && <span className="badge">{dropped[b] === 'abstention' ? 'ignored: all equal' : 'ignored: out of range'}</span>}
              </th>
              {names.map((n, c) => {
                const v = row[c]
                return (
                  <td key={c}>
                    <select
                      aria-label={`Ballot ${b + 1}, stars for ${n}`}
                      value={v == null ? '' : String(v)}
                      onChange={(e) => setScore(b, c, e.target.value)}
                      className="score"
                      style={{ ['--fill' as string]: candColor(c), ['--amt' as string]: `${((v ?? 0) / 5) * 55}%` }}
                    >
                      <option value="">–</option>
                      {[0, 1, 2, 3, 4, 5].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                )
              })}
              <td className="row-actions">
                <button title="Duplicate this ballot" aria-label={`Duplicate ballot ${b + 1}`} onClick={() => setBallots([...ballots.slice(0, b + 1), [...row], ...ballots.slice(b + 1)])}>
                  ⧉
                </button>
                <button title="Delete this ballot" aria-label={`Delete ballot ${b + 1}`} onClick={() => setBallots(ballots.filter((_, i) => i !== b))}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StarPrCaseStudy() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id)
  const [names, setNames] = useState(scenarios[0].candidates)
  const [ballots, setBallots] = useState<Ballot[]>(scenarios[0].ballots)
  const [seats, setSeats] = useState(scenarios[0].nWinners)
  const [order, setOrder] = useState(scenarios[0].candidates.map((_, i) => i))
  const [round, setRound] = useState(0)
  const [showSpend, setShowSpend] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const editorRef = useRef<HTMLElement>(null)

  const result = useMemo(() => runWithOrder(names, ballots, seats, order), [names, ballots, seats, order])
  const r = Math.min(round, result.rounds.length - 1)
  const rd = result.rounds[r]

  // Animate each round: show weights as they were, then let the spend happen.
  useEffect(() => {
    setShowSpend(false)
    const t = setTimeout(() => setShowSpend(true), 450)
    return () => clearTimeout(t)
  }, [r, result])

  useEffect(() => {
    if (!playing) return
    if (r >= result.rounds.length - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setRound(r + 1), 2600)
    return () => clearTimeout(t)
  }, [playing, r, result.rounds.length])

  const load = (s: Scenario, scroll = false) => {
    setScenarioId(s.id)
    setNames(s.candidates)
    setBallots(s.ballots.map((b) => [...b]))
    setSeats(s.nWinners)
    setOrder(s.candidates.map((_, i) => i))
    setRound(0)
    setPlaying(false)
    if (scroll) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const edit = (b: Ballot[]) => {
    setBallots(b)
    setScenarioId('')
  }
  const scenario = scenarios.find((s) => s.id === scenarioId)
  const moveOrder = (k: number, d: number) => {
    const o = [...order]
    ;[o[k], o[k + d]] = [o[k + d], o[k]]
    setOrder(o)
    setScenarioId('')
  }

  const wName = names[rd.winner]
  const V = result.nTallyVotes
  const nDropped = result.nAbstentions + result.nOutOfBoundsVotes
  const roundLogs = (() => {
    // BetterVoting's log lines, split per round
    const out: string[][] = []
    for (const line of result.logs.slice(1)) {
      if (line.startsWith('Round ')) out.push([])
      else out[out.length - 1]?.push(line)
    }
    return out
  })()

  return (
    <article className="article starpr">
      <p className="kicker">Case study 2</p>
      <h1>How BetterVoting counts STAR-PR</h1>
      <p className="lede">
        STAR-PR is the proportional, multi-winner version of STAR voting. Each voter gives every candidate 0–5 stars.
        This page follows, step by step, the exact code BetterVoting runs to turn those stars into several winners.
        Change any ballot and everything below recounts.
      </p>

      <div className="panel code-map">
        <p>
          <strong>Where the code lives.</strong> In BetterVoting’s{' '}
          <Code file="VotingMethodSelecter.ts" line={32}>
            VotingMethodSelecter.ts
          </Code>
          , the method <code>STAR_PR</code> maps to the function <code>AllocatedScore</code>. So BetterVoting’s STAR-PR
          is <em>Allocated Score</em>, and it has <strong>no runoff step</strong>, unlike single-winner STAR. All links
          point at commit <code>{'9ed353f'}</code> of <code>Equal-Vote/bettervoting</code> (4 Nov 2026).
        </p>
        <ul>
          <li>
            <Code file="AllocatedScore.ts" line={21}>
              AllocatedScore()
            </Code>{' '}
            in <code>packages/backend/src/Tabulators/AllocatedScore.ts</code>: the main loop, plus the helpers{' '}
            <Code file="AllocatedScore.ts" line={264}>
              indexOfMax
            </Code>
            ,{' '}
            <Code file="AllocatedScore.ts" line={287}>
              findSplitPoint
            </Code>
            ,{' '}
            <Code file="AllocatedScore.ts" line={254}>
              findWeightOnSplit
            </Code>{' '}
            and{' '}
            <Code file="AllocatedScore.ts" line={225}>
              updateBallotWeights
            </Code>
            .
          </li>
          <li>
            <Code file="Util.ts" line={36}>
              filterInitialVotes
            </Code>
            ,{' '}
            <Code file="Util.ts" line={17}>
              makeBoundsTest
            </Code>{' '}
            and{' '}
            <Code file="Util.ts" line={24}>
              makeAbstentionTest
            </Code>{' '}
            in <code>Util.ts</code>: which ballots are counted.
          </li>
          <li>
            <Code file="shuffleCandidatesForRandomTiebreak.ts">shuffleCandidatesForRandomTiebreak.ts</Code>: the
            tie-break order.
          </li>
        </ul>
      </div>

      {/* ------------------------------------------------------------------ */}
      <section ref={editorRef} className="scroll-target">
        <h2>
          <span className="step-num">1</span>Ballots
        </h2>
        <p>Start from a preset, then change any score. Blank (–) counts as 0.</p>
        <div className="chip-row" role="group" aria-label="Preset elections">
          {scenarios
            .filter((s) => !s.quirk)
            .map((s) => (
              <button key={s.id} className="chip" aria-pressed={scenarioId === s.id} onClick={() => load(s)}>
                {s.title}
              </button>
            ))}
        </div>
        {scenario && <p className="note scenario-blurb">{scenario.blurb}</p>}

        <BallotEditor names={names} ballots={ballots} dropped={result.dropped} setBallots={edit} />
        <div className="editor-actions">
          <button onClick={() => edit([...ballots, names.map(() => 0)])}>+ Add ballot</button>
          <span className="seats" role="group" aria-label="Number of seats">
            Seats:
            <button aria-label="Fewer seats" disabled={seats <= 1} onClick={() => (setSeats(seats - 1), setScenarioId(''))}>
              −
            </button>
            <strong className="mono">{seats}</strong>
            <button aria-label="More seats" disabled={seats >= names.length} onClick={() => (setSeats(seats + 1), setScenarioId(''))}>
              +
            </button>
          </span>
        </div>
        <div className="tie-order">
          <span>
            Tie-break order{' '}
            <span className="note">(BetterVoting shuffles this randomly for each race; see step 3a)</span>:
          </span>
          <ol>
            {order.map((c, k) => (
              <li key={c}>
                <span className="swatch" style={{ background: candColor(c) }} />
                {names[c]}
                <span className="order-btns">
                  <button aria-label={`Move ${names[c]} earlier`} disabled={k === 0} onClick={() => moveOrder(k, -1)}>
                    ↑
                  </button>
                  <button aria-label={`Move ${names[c]} later`} disabled={k === order.length - 1} onClick={() => moveOrder(k, 1)}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <h2>
        <span className="step-num">2</span>Throw out blank-ish ballots, then set the quota
      </h2>
      <p>
        Before counting, <Code file="Util.ts" line={36}>filterInitialVotes</Code> drops two kinds of ballots. A ballot
        with any score outside 0–5 is dropped (<code>makeBoundsTest(0, 5)</code>). So is a ballot where{' '}
        <em>every candidate gets the same score</em>, blanks counting as 0 (<code>makeAbstentionTest(true)</code>).
        That includes a ballot giving everyone 5 stars.
      </p>
      <p>
        Every remaining ballot starts with a <strong>weight of 1</strong>. The <strong>quota</strong> is how much
        ballot weight each winner must use up:
      </p>
      <div className="formula">
        quota = <span title="counted ballots">{V}</span> counted ballots ÷ <span title="seats">{seats}</span> seats ={' '}
        <strong>{fmtWeight(result.quota)}</strong>
        {result.quota.d !== 1n && <> ≈ {fmtNum(result.quota.valueOf())}</>}
      </div>
      <p className="note">
        {nDropped > 0 ? `${nDropped} of ${ballots.length} ballots were ignored. ` : `All ${ballots.length} ballots count. `}
        This is a Hare quota (<code>V / nWinners</code>, line {62}), not a Droop quota. Scores are divided by 5 and
        kept as exact fractions with <code>fraction.js</code>, so “exactly on the split point” below really means
        exactly.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>
        <span className="step-num">3</span>Fill the seats one round at a time
      </h2>
      <p>
        The loop at{' '}
        <Code file="AllocatedScore.ts" line={71}>
          line 71
        </Code>{' '}
        runs once per seat. Each round has three parts: (a) pick the winner, (b) find which ballots “paid” for them,
        and (c) reduce those ballots’ weight.
      </p>

      {result.rounds.length === 0 ? (
        <p className="callout">No rounds to show.</p>
      ) : (
        <div className="round-viewer">
          <div className="round-nav" role="tablist" aria-label="Rounds">
            {result.rounds.map((x, k) => (
              <button
                key={k}
                role="tab"
                aria-selected={k === r}
                className={`round-tab${k === r ? ' active' : ''}`}
                onClick={() => {
                  setPlaying(false)
                  setRound(k)
                }}
              >
                <span>Round {k + 1}</span>
                <span className="round-winner">
                  <span className="swatch" style={{ background: candColor(x.winner) }} />
                  {names[x.winner]}
                </span>
              </button>
            ))}
            <button
              className="play"
              onClick={() => {
                if (playing) setPlaying(false)
                else {
                  if (r >= result.rounds.length - 1) setRound(0)
                  setPlaying(true)
                }
              }}
              aria-label={playing ? 'Pause' : 'Play through the rounds'}
            >
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
          </div>

          <h3>
            3a. Round {r + 1}: total the <em>weighted</em> stars
          </h3>
          <p>
            Each candidate’s score is the sum over ballots of <em>stars × ballot weight</em>. Candidates who already
            won have had their column zeroed (
            <Code file="AllocatedScore.ts" line={106}>
              <>ballot[w] = 0</>
            </Code>
            ), so they show 0. The highest total wins the seat (
            <Code file="AllocatedScore.ts" line={264}>
              indexOfMax
            </Code>
            ).
          </p>
          <TotalsChart result={result} round={r} />
          {rd.ties.length > 1 && (
            <p className="callout">
              <strong>Tie.</strong> {rd.ties.map((t) => names[t]).join(', ')} all have {fmtNum(stars(rd.weightedSums[rd.winner]))}★.
              There is no runoff or score-based tie-breaker: the winner is whichever comes first in the tie-break order
              (<code>sortCandidates</code> by <code>tieBreakOrder</code>). In a real election that order is a seeded
              random shuffle of the candidates, seeded by the number of ballots plus a hash of the race id. Reorder
              the list in step 1 to flip this result.
              {rd.reElected && (
                <>
                  {' '}
                  <strong>
                    And the tie includes candidates who already won, so {wName} is elected a second time.
                  </strong>{' '}
                  See Surprise 1.
                </>
              )}
            </p>
          )}

          <h3>3b. Line the ballots up behind {wName}</h3>
          <p>
            Sort the ballots by the <em>weighted</em> stars they gave {wName}, highest first. Each block below is one
            ballot: its <strong>width is the ballot’s weight</strong> and its height is the weighted stars it gave{' '}
            {wName}. Walk left to right adding up widths until you reach the quota ({fmtNum(result.quota.valueOf())}
            ). The block where you get there sets the <strong>split point</strong> (
            <Code file="AllocatedScore.ts" line={287}>
              findSplitPoint
            </Code>
            ).
          </p>
          <Staircase result={result} round={r} hover={hover} setHover={setHover} showSpend={showSpend} />
          <ul className="round-facts">
            <li>
              Split point: <strong>{fmtNum(stars(rd.splitPoint))}★</strong> (weighted)
            </li>
            <li>
              Weight strictly above it: <strong>{fmtWeight(rd.spentAbove)}</strong>. These ballots are fully spent.
            </li>
            <li>
              Weight exactly on it: <strong>{fmtWeight(rd.weightOnSplit)}</strong>
              {rd.weightOnSplit.valueOf() > 0 && (
                <>
                  {' '}
                  . They share the rest of the quota: each pays (quota − above) ÷ on-split = ({fmtNum(result.quota.valueOf())} −{' '}
                  {fmtNum(rd.spentAbove.valueOf())}) ÷ {fmtNum(rd.weightOnSplit.valueOf())} = <strong>{fmtWeight(rd.spentValue)}</strong> of
                  its weight.
                </>
              )}
            </li>
          </ul>
          {rd.splitPoint.valueOf() === 0 && rd.weightOnSplit.valueOf() > 0 && (
            <p className="callout">
              <strong>The split point is 0 stars.</strong> Fewer than a quota’s worth of weight gave {wName} any stars, so
              the walk runs into the ballots that gave {wName} <em>nothing</em>. Those ballots then pay for {wName} too.
              See Surprise 2.
            </p>
          )}

          <h3>3c. Reweight the ballots</h3>
          <p>
            Ballots above the split go to weight 0. Ballots on it are multiplied by 1 − {fmtWeight(rd.spentValue)}.
            Ballots below it keep their weight. Weights are then clamped to [0, 1] (
            <Code file="AllocatedScore.ts" line={225}>
              updateBallotWeights
            </Code>
            ). The highlighted score in each row is the one this round’s winner received.
          </p>
          <WeightsChart result={result} round={r} ballots={ballots} hover={hover} setHover={setHover} showSpend={showSpend} />
          {rd.clamped && <p className="note">Some weights went below 0 this round and were clamped back to 0.</p>}

          <details className="bv-log">
            <summary>BetterVoting’s own log text for this round</summary>
            <ul>
              {(roundLogs[r] ?? []).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
            <p className="note">
              The port reproduces these strings exactly. The “stars” in these messages are <em>weighted</em> stars, so
              they can be fractional.
            </p>
          </details>
          <div className="round-step">
            <button style={{ visibility: r === 0 ? 'hidden' : undefined }} onClick={() => setRound(r - 1)}>
              ← Round {r}
            </button>
            <button style={{ visibility: r >= result.rounds.length - 1 ? 'hidden' : undefined }} className="primary" onClick={() => setRound(r + 1)}>
              Round {r + 2} →
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      <h2>
        <span className="step-num">4</span>The result
      </h2>
      <ol className="result-list">
        {result.elected.map((c, k) => (
          <li key={k} className={result.rounds[k].reElected ? 'bad' : ''}>
            <span className="swatch" style={{ background: candColor(c) }} />
            <strong>{names[c]}</strong>, round {k + 1}, with {fmtNum(stars(result.rounds[k].weightedSums[c]))} weighted ★
            {result.rounds[k].ties.length > 1 && ' (won a tie-break)'}
            {result.rounds[k].reElected && ' (already elected!)'}
          </li>
        ))}
      </ol>
      {result.other.length > 0 && <p className="note">Not elected: {result.other.map((c) => names[c]).join(', ')}.</p>}

      {/* ------------------------------------------------------------------ */}
      <h2>
        <span className="step-num">5</span>Surprises in the implementation
      </h2>
      <p>Each of these follows directly from the code above. Where there’s an example, the button loads it into step 1.</p>

      <div className="quirk">
        <h3>Surprise 1: a candidate can win two seats (likely a bug)</h3>
        <p>
          <Code file="AllocatedScore.ts" line={264}>
            indexOfMax
          </Code>{' '}
          looks for the highest total across <em>all</em> candidates, including ones already elected, whose totals were
          set to 0. Suppose every unelected candidate also has a weighted total of 0, because the only voters who scored
          them have used up their weight. That happens naturally when the few voters who reach down the ballot are
          also a front-runner’s biggest fans, as in the example below. Then everyone
          ties at 0, the tie-break picks the earliest candidate in tie-break order, and that may be someone who
          already holds a seat. Nothing checks for this, so <code>results.elected</code> contains the same candidate
          twice. Running BetterVoting’s real tabulator confirms it: an election with no ballots at all elects{' '}
          <code>[A, A]</code>, and 11 of the 200 random elections in our test set elect someone twice.
        </p>
        <p className="note">
          Likely fix: exclude elected candidates from <code>indexOfMax</code> (pass <code>remainingCandidates</code>{' '}
          and their sums), and decide what an all-zero round should do.
        </p>
        <button onClick={() => load(scenarios.find((s) => s.id === 'elected-twice')!, true)}>Load the example</button>
      </div>

      <div className="quirk">
        <h3>Surprise 2: voters who gave the winner 0 stars can still pay for them</h3>
        <p>
          The quota must always be filled. If the winner’s supporters together hold less than a quota of weight,{' '}
          <code>findSplitPoint</code> keeps walking into ballots that gave the winner nothing, and the split point
          becomes 0. All those zero-star ballots are then “on the split” and lose weight. In the preset, Xi wins round 1
          with only 2 ballots of support against a quota of 3, so the four ballots that gave Xi 0 stars each lose a
          quarter of their weight. BetterVoting’s log even says that the voters who gave Xi 0 stars are “partially
          represented” by Xi. This is how Allocated Score is usually defined, not a coding slip, but it surprises
          most readers.
        </p>
        <button onClick={() => load(scenarios.find((s) => s.id === 'zero-split')!, true)}>Load the example</button>
      </div>

      <div className="quirk">
        <h3>Surprise 3: ties are a coin flip, with no STAR runoff</h3>
        <p>
          Single-winner STAR has a runoff and a chain of tie-breakers. STAR-PR here has none: equal weighted totals go
          straight to <code>tieBreakOrder</code>, a shuffle seeded by the raw ballot count plus a hash of the race id
          (<code>shuffleCandidatesForRandomTiebreak</code>). The shuffle is repeatable for a fixed set of ballots, but
          one more ballot reshuffles it. And if any elected candidate was part of any tie in any round,{' '}
          <code>tieBreakType</code> is set to <code>'random'</code>.
        </p>
        <button onClick={() => load(scenarios.find((s) => s.id === 'tie')!, true)}>Load the example</button>
      </div>

      <div className="quirk">
        <h3>Surprise 4: an all-5-stars ballot is thrown away, which shrinks the quota</h3>
        <p>
          <code>makeAbstentionTest(true)</code> treats any ballot whose scores are all equal as an abstention. For
          single-winner STAR that changes nothing. In a proportional count, though, those voters also leave{' '}
          <code>V</code>, so the quota shrinks for everyone. Try it: in “Two factions”, add a ballot and set every
          score to 5. It is marked “ignored” and the quota stays 5.
        </p>
      </div>

      <div className="quirk">
        <h3>Surprise 5: the split point uses weighted stars, not raw stars</h3>
        <p>
          Ballots are sorted by <code>weight × score</code>, so a 5-star ballot at half weight (2.5) ranks below a
          fresh 3-star ballot. This matches the usual definition of Allocated Score. The log messages still say
          things like “the 1.5 voters who gave Zed more than 0.75 stars” (round 2 of the zero-split preset), which reads
          oddly when nobody can give 0.75 stars.
        </p>
      </div>

      <div className="quirk minor">
        <h3>Smaller oddities</h3>
        <ul>
          <li>
            A comment at line 55 says rounds keep running after all seats are filled “to determine candidate order”, but
            the loop stops at <code>nWinners</code>. Unelected candidates are ordered by their final-round totals
            instead.
          </li>
          <li>
            Everything is exact fractions, except the sort before <code>findSplitPoint</code>, which compares Fraction
            objects with <code>&lt;</code> (so, as floats) and never returns 0. It doesn’t change results, because only
            the score at the quota crossing matters, not the order among equal scores.
          </li>
          <li>
            With zero counted ballots the quota is 0 and every round is an all-way tie at 0 (see Surprise 1).
          </li>
        </ul>
      </div>

      {/* ------------------------------------------------------------------ */}
      <h2>
        <span className="step-num">6</span>How this page is checked against BetterVoting
      </h2>
      <p>
        The counting on this page runs in your browser, in{' '}
        <a href="https://github.com/jacksonloper/jacksondoesntunderstandvoting/blob/main/src/starpr/allocatedScore.ts">
          <code>src/starpr/allocatedScore.ts</code>
        </a>
        , a line-by-line port that uses BetterVoting’s function names and exact BigInt fractions. Two kinds of tests
        back it up (<code>npm test</code>):
      </p>
      <ul>
        <li>
          <strong>Hand-worked examples</strong>: each preset’s quota, split points, spend fractions and weights are
          written out by hand in <code>tests/starpr.test.ts</code>.
        </li>
        <li>
          <strong>The real tabulator as an oracle</strong>: <code>scripts/bettervoting-oracle</code> copies{' '}
          <code>AllocatedScore.ts</code> and <code>Util.ts</code> from a BetterVoting checkout, runs them on 210
          elections (the presets, edge cases and 200 seeded random ones), and saves the outputs. The port must match
          every winner, tie list, round total, split point and spent weight, and every log line for the
          non-random cases. It also matched on separate spot checks with up to 8,000 ballots and 7 seats.
        </li>
      </ul>
    </article>
  )
}
