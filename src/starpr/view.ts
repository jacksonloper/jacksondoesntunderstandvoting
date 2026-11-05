import { allocatedScore, type Ballot, type StarPrResult } from './allocatedScore.ts'
import { Frac } from './frac.ts'

export const BV_COMMIT = '9ed353fc38a584cfba9c963e2f7ac89bd4fa9d70'
export const bvLink = (file: string, line?: number) =>
  `https://github.com/Equal-Vote/bettervoting/blob/${BV_COMMIT}/packages/backend/src/Tabulators/${file}${line ? `#L${line}` : ''}`

/**
 * Run the tabulator with candidates listed in tie-break order (as production does
 * after shuffleCandidatesForRandomTiebreak) and map every candidate index in the
 * result back to the reader's display order, so colours follow candidates.
 */
export function runWithOrder(names: string[], ballots: Ballot[], seats: number, order: number[]): StarPrResult {
  const r = allocatedScore(
    order.map((i) => names[i]),
    ballots.map((b) => order.map((i) => b[i])),
    seats,
  )
  const back = (k: number) => order[k]
  const unpermute = <T,>(arr: T[]) => {
    const out: T[] = Array(arr.length)
    arr.forEach((v, k) => (out[order[k]] = v))
    return out
  }
  return {
    ...r,
    candidates: names,
    elected: r.elected.map(back),
    other: r.other.map(back),
    tied: r.tied.map(back),
    rounds: r.rounds.map((rd) => ({ ...rd, winner: back(rd.winner), ties: rd.ties.map(back), weightedSums: unpermute(rd.weightedSums) })),
  }
}

/** Ballot weights as friendly fractions when the denominator is small. */
export function fmtWeight(f: Frac) {
  if (f.d === 1n) return f.n.toString()
  if (f.d <= 12n) return `${f.n}/${f.d}`
  return trim(f.valueOf().toFixed(3))
}

export function fmtNum(x: number, digits = 2) {
  return trim(x.toFixed(digits))
}

const trim = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s)

/** weighted score in [0,1] -> stars */
export const stars = (f: Frac) => f.valueOf() * 5
