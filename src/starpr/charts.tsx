import { useEffect, useRef, useState } from 'react'
import type { Ballot, RoundDetail, StarPrResult } from './allocatedScore.ts'
import { fmtNum, fmtWeight, stars } from './view.ts'

export const candColor = (i: number) => `var(--series-${(i % 8) + 1})`

function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

// ---------------------------------------------------------------------------
// Weighted totals per candidate (one round). Bars are HTML so their heights
// animate with a CSS transition when the round changes.
// ---------------------------------------------------------------------------
export function TotalsChart({ result, round }: { result: StarPrResult; round: number }) {
  const rd = result.rounds[round]
  const max = Math.max(1e-9, ...result.rounds[0].weightedSums.map(stars))
  const electedEarlier = new Map(result.elected.slice(0, round).map((c, k) => [c, k + 1]))
  const tie = rd.ties.length > 1
  return (
    <div className="totals" role="table" aria-label={`Weighted star totals, round ${round + 1}`}>
      {result.candidates.map((name, i) => {
        const v = stars(rd.weightedSums[i])
        const isWinner = rd.winner === i
        const prev = electedEarlier.get(i)
        const tied = tie && rd.ties.includes(i)
        return (
          <div className={`totals-col${isWinner ? ' winner' : ''}${prev ? ' done' : ''}`} key={i} role="row">
            <span className="totals-value" role="cell">
              {fmtNum(v)}
            </span>
            <div className="totals-track">
              <div className="totals-bar" style={{ height: `${(100 * v) / max}%`, background: candColor(i) }} />
            </div>
            <span className="totals-name" role="rowheader">
              {name}
            </span>
            <span className="totals-tag">
              {isWinner && rd.reElected ? 'elected again!' : isWinner ? 'elected' : prev ? `won round ${prev}` : tied ? 'tied' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The "staircase": every counted ballot as a block, sorted by the weighted
// score it gave the round's winner. Width = ballot weight, height = weighted
// stars. Walking right, the quota line marks where enough weight has been
// collected; the block it lands on sets the split point.
// ---------------------------------------------------------------------------
export function Staircase({
  result,
  round,
  hover,
  setHover,
  showSpend,
}: {
  result: StarPrResult
  round: number
  hover: number | null
  setHover: (b: number | null) => void
  showSpend: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const rd = result.rounds[round]
  const V = result.nTallyVotes
  const H = 230
  const pad = { l: 34, r: 12, t: 30, b: 34 }
  const totalW = Math.max(1, V)
  const sx = (w: number) => pad.l + (w / totalW) * (width - pad.l - pad.r)
  const sy = (s: number) => H - pad.b - (s / 5) * (H - pad.t - pad.b)
  const wName = result.candidates[rd.winner]
  const color = candColor(rd.winner)

  const blocks = rd.sortedOrder.reduce<{ b: number; x0: number; w: number; s: number; status: string }[]>((acc, b) => {
    const prev = acc[acc.length - 1]
    const x0 = prev ? prev.x0 + prev.w : 0
    acc.push({ b, x0, w: rd.weightsBefore[b].valueOf(), s: stars(rd.winnerWeightedScores[b]), status: rd.status[b] })
    return acc
  }, [])
  const quota = result.quota.valueOf()
  const split = stars(rd.splitPoint)
  const spentFrac = Math.min(1, Math.max(0, rd.spentValue.valueOf()))
  const xTicks = Array.from({ length: Math.floor(totalW) + 1 }, (_, k) => k).filter((k) => totalW <= 16 || k % Math.ceil(totalW / 12) === 0)

  return (
    <div ref={ref} className="staircase">
      <svg width={width} height={H} role="img" aria-label={`Ballots sorted by the weighted stars they gave ${wName}. The quota of ${fmtNum(quota)} is reached at ${fmtNum(split)} stars.`}>
        {/* y grid + labels */}
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <g key={s}>
            <line x1={pad.l} x2={width - pad.r} y1={sy(s)} y2={sy(s)} className={s === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 6} y={sy(s) + 4} className="tick" textAnchor="end">
              {s}★
            </text>
          </g>
        ))}
        {xTicks.map((k) => (
          <text key={k} x={sx(k)} y={H - pad.b + 15} className="tick" textAnchor="middle">
            {k}
          </text>
        ))}
        <text x={(pad.l + width - pad.r) / 2} y={H - 4} className="axis-title" textAnchor="middle">
          running total of ballot weight →
        </text>

        {/* ballots */}
        {blocks.map(({ b, x0, w, s, status }) => {
          if (w <= 0) return null
          const x = sx(x0)
          const bw = Math.max(0, sx(x0 + w) - x)
          const y = sy(s)
          // ballots that gave the winner 0 stars still show as a thin strip, so their weight is visible
          const h = Math.max(6, sy(0) - y)
          const y2 = sy(0) - h
          const hl = hover === b
          const tip = `Ballot #${result.talliedBallotIndex[b] + 1}: weight ${fmtWeight(rd.weightsBefore[b])}, gives ${wName} ${fmtNum(s)}★ after weighting (${status === 'above' ? 'above the split: fully spent' : status === 'split' ? 'on the split: partly spent' : 'below the split: kept'})`
          return (
            <g key={b} onPointerEnter={() => setHover(b)} onPointerLeave={() => setHover(null)} className={`blk ${status}${hl ? ' hl' : ''}`}>
              <title>{tip}</title>
              {/* hit target the full column height so short blocks are easy to hover */}
              <rect x={x} y={pad.t} width={bw} height={sy(0) - pad.t} fill="transparent" />
              {status === 'below' && <rect x={x} y={y2} width={bw} height={h} className="kept" style={{ transition: 'all .4s' }} />}
              {status === 'above' && (
                <rect x={x} y={y2} width={bw} height={h} style={{ fill: color, opacity: showSpend ? 1 : 0.55, transition: 'opacity .5s' }} />
              )}
              {status === 'split' && (
                <>
                  <rect x={x} y={y2} width={bw} height={h} className="kept" />
                  <rect x={x} y={y2} width={bw * (showSpend ? spentFrac : 0)} height={h} style={{ fill: color, transition: 'width .6s ease' }} />
                  <rect x={x} y={y2} width={bw} height={h} className="split-outline" style={{ stroke: color }} />
                </>
              )}
              {bw > 18 && h > 14 && (
                <text x={x + bw / 2} y={y + 13} className="blk-label" textAnchor="middle">
                  #{result.talliedBallotIndex[b] + 1}
                </text>
              )}
              {hl && <rect x={x} y={y2} width={bw} height={h} className="hl-ring" />}
            </g>
          )
        })}

        {/* quota & split markers */}
        <line x1={sx(quota)} x2={sx(quota)} y1={pad.t - 14} y2={sy(0)} className="quota-line" />
        <text x={Math.min(sx(quota), width - pad.r - 4)} y={pad.t - 18} className="marker-label" textAnchor={sx(quota) > width - 90 ? 'end' : 'middle'}>
          quota = {fmtNum(quota)}
        </text>
        <line x1={pad.l} x2={width - pad.r} y1={sy(split)} y2={sy(split)} className="split-line" />
        <text x={width - pad.r - 4} y={sy(split) - 5} className="marker-label" textAnchor="end">
          split point {fmtNum(split)}★
        </text>
      </svg>
      <p className="legend small">
        <span>
          <span className="swatch" style={{ background: color }} /> spent on {wName}
        </span>
        <span>
          <span className="swatch outline" style={{ borderColor: color }} /> on the split, partly spent
        </span>
        <span>
          <span className="swatch" style={{ background: 'var(--axis)' }} /> kept for later rounds
        </span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ballot weights before -> after the round.
// ---------------------------------------------------------------------------
export function WeightsChart({
  result,
  round,
  ballots,
  hover,
  setHover,
  showSpend,
}: {
  result: StarPrResult
  round: number
  ballots: Ballot[]
  hover: number | null
  setHover: (b: number | null) => void
  showSpend: boolean
}) {
  const rd: RoundDetail = result.rounds[round]
  return (
    <div className="weights">
      {result.talliedBallotIndex.map((orig, b) => {
        const before = rd.weightsBefore[b]
        const after = rd.weightsAfter[b]
        const shown = showSpend ? after : before
                const changed = !before.equals(after)
        return (
          <div
            key={orig}
            className={`wrow${hover === b ? ' hl' : ''}${before.valueOf() === 0 ? ' empty' : ''}`}
            onPointerEnter={() => setHover(b)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="wid">#{orig + 1}</span>
            <span className="wscores" aria-label="scores">
              {result.candidates.map((_, c) => (
                <span key={c} className={`sc${c === rd.winner ? ' win' : ''}`} style={c === rd.winner ? { borderColor: candColor(c) } : undefined}>
                  {ballots[orig][c] ?? '–'}
                </span>
              ))}
            </span>
            <span className="wtrack">
              <span className="wghost" style={{ width: `${before.valueOf() * 100}%` }} />
              <span className="wfill" style={{ width: `${shown.valueOf() * 100}%` }} />
            </span>
            <span className="wval">
              {changed ? (
                <>
                  {fmtWeight(before)} → <strong>{fmtWeight(after)}</strong>
                </>
              ) : (
                fmtWeight(before)
              )}
            </span>
            <span className={`wtag ${before.valueOf() === 0 ? 'none' : after.valueOf() === 0 ? 'above' : changed ? 'split' : 'below'}`}>
              {before.valueOf() === 0 ? 'used up' : after.valueOf() === 0 ? 'fully spent' : changed ? 'partly spent' : 'kept'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
