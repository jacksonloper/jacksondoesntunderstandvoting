// Spatial-model machinery for the Yee diagram case study.
//
// A point p in the unit square stands for an electorate centred at p: voters are
// p + spread * z_k for a fixed set of K standard-normal offsets z_k. Every voter
// ranks candidates by Euclidean distance (closest first). We then tabulate that
// electorate with Round Robin (pairwise / Copeland) and with IRV.

export type Pt = { x: number; y: number }

/** Deterministic, evenly spread Gaussian sample (Halton bases 2 and 3 + Box–Muller). */
export function gaussianCloud(k: number): Pt[] {
  const halton = (i: number, b: number) => {
    let f = 1
    let r = 0
    while (i > 0) {
      f /= b
      r += f * (i % b)
      i = Math.floor(i / b)
    }
    return r
  }
  const out: Pt[] = []
  for (let i = 1; i <= k; i++) {
    const u = halton(i, 2)
    const v = halton(i, 3)
    const rad = Math.sqrt(-2 * Math.log(u))
    out.push({ x: rad * Math.cos(2 * Math.PI * v), y: rad * Math.sin(2 * Math.PI * v) })
  }
  return out
}

/** Rankings of 3 candidates, as index lists, in a fixed order. */
export const RANKINGS: number[][] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]
const rankingIndex = (a: number, b: number) => RANKINGS.findIndex((r) => r[0] === a && r[1] === b)
const RANK_LOOKUP: number[][] = [0, 1, 2].map((a) => [0, 1, 2].map((b) => (a === b ? -1 : rankingIndex(a, b))))

/** Count how many voters (out of cloud.length) cast each of the 6 rankings. */
export function rankingCounts(center: Pt, cands: Pt[], cloud: Pt[], spread: number): number[] {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const z of cloud) {
    const vx = center.x + spread * z.x
    const vy = center.y + spread * z.y
    const d0 = (vx - cands[0].x) ** 2 + (vy - cands[0].y) ** 2
    const d1 = (vx - cands[1].x) ** 2 + (vy - cands[1].y) ** 2
    const d2 = (vx - cands[2].x) ** 2 + (vy - cands[2].y) ** 2
    let first: number, second: number
    if (d0 <= d1 && d0 <= d2) {
      first = 0
      second = d1 <= d2 ? 1 : 2
    } else if (d1 <= d2) {
      first = 1
      second = d0 <= d2 ? 0 : 2
    } else {
      first = 2
      second = d0 <= d1 ? 0 : 1
    }
    counts[RANK_LOOKUP[first][second]]++
  }
  return counts
}

export interface PairwiseResult {
  /** pref[a][b] = voters ranking a above b */
  pref: number[][]
  /** pairwise wins per candidate (a tie counts as half) */
  copeland: number[]
  /** sum over opponents of pref[a][b] (a Borda count), used only to break Copeland ties */
  support: number[]
  winner: number
  condorcet: boolean
}

export function roundRobin(counts: number[]): PairwiseResult {
  const pref = [0, 1, 2].map(() => [0, 0, 0])
  RANKINGS.forEach((r, i) => {
    pref[r[0]][r[1]] += counts[i]
    pref[r[0]][r[2]] += counts[i]
    pref[r[1]][r[2]] += counts[i]
  })
  const copeland = [0, 1, 2].map((a) =>
    [0, 1, 2].reduce((s, b) => (a === b ? s : s + (pref[a][b] > pref[b][a] ? 1 : pref[a][b] === pref[b][a] ? 0.5 : 0)), 0),
  )
  const support = [0, 1, 2].map((a) => pref[a].reduce((s, v) => s + v, 0))
  let winner = 0
  for (let c = 1; c < 3; c++) {
    if (copeland[c] > copeland[winner] || (copeland[c] === copeland[winner] && support[c] > support[winner])) winner = c
  }
  return { pref, copeland, support, winner, condorcet: copeland[winner] === 2 }
}

export interface IrvResult {
  firstPrefs: number[]
  eliminated: number
  /** final-round totals for the two survivors (eliminated candidate has 0) */
  final: number[]
  winner: number
  /** true if a candidate had a first-round majority */
  majorityRound1: boolean
}

export function irv(counts: number[]): IrvResult {
  const total = counts.reduce((a, b) => a + b, 0)
  const firstPrefs = [0, 0, 0]
  RANKINGS.forEach((r, i) => (firstPrefs[r[0]] += counts[i]))
  // Eliminate the fewest first preferences; ties eliminate the later-listed candidate.
  let eliminated = 0
  for (let c = 1; c < 3; c++) if (firstPrefs[c] <= firstPrefs[eliminated]) eliminated = c
  const final = [0, 0, 0]
  RANKINGS.forEach((r, i) => {
    const top = r[0] === eliminated ? r[1] : r[0]
    final[top] += counts[i]
  })
  let winner = eliminated === 0 ? 1 : 0
  for (let c = 0; c < 3; c++) if (c !== eliminated && final[c] > final[winner]) winner = c
  const majorityRound1 = firstPrefs.some((f) => f * 2 > total)
  return { firstPrefs, eliminated, final, winner, majorityRound1 }
}

export interface YeeMaps {
  n: number
  rr: Uint8Array
  irv: Uint8Array
}

/** Winner of each method on an n×n grid of electorate centres (row-major, y down). */
export function computeMaps(n: number, cands: Pt[], cloud: Pt[], spread: number): YeeMaps {
  const rr = new Uint8Array(n * n)
  const ir = new Uint8Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const counts = rankingCounts({ x: (i + 0.5) / n, y: (j + 0.5) / n }, cands, cloud, spread)
      rr[j * n + i] = roundRobin(counts).winner
      ir[j * n + i] = irv(counts).winner
    }
  }
  return { n, rr, irv: ir }
}
