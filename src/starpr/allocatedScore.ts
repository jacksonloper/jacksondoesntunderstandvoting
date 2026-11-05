// Client-side port of BetterVoting's STAR-PR tabulator.
//
// Source of truth (Equal-Vote/bettervoting, main @ 9ed353f):
//   packages/backend/src/Tabulators/AllocatedScore.ts  -> AllocatedScore(), indexOfMax(),
//                                                          findSplitPoint(), findWeightOnSplit(),
//                                                          updateBallotWeights()
//   packages/backend/src/Tabulators/Util.ts            -> makeBoundsTest(), makeAbstentionTest(),
//                                                          filterInitialVotes(), sortCandidates()
//
// The function and variable names below deliberately mirror the original so the
// two can be read side by side. Differences are purely structural: this version
// records every intermediate value so the case study can draw it.

import { Frac } from './frac.ts'

export const MAX_SCORE = 5

/** One ballot: a score 0..5 (or null for "left blank") per candidate. */
export type Ballot = (number | null | undefined)[]

export type BallotStatus = 'above' | 'split' | 'below'

export interface RoundDetail {
  /** 0-based round number */
  round: number
  /** ballot weights going into this round (one per tallied ballot) */
  weightsBefore: Frac[]
  /** sum over ballots of weight * score/5, per candidate (0..V). Multiply by 5 for "stars". */
  weightedSums: Frac[]
  /** candidate index of the round winner */
  winner: number
  /** every candidate whose weighted sum equalled the max (length > 1 means a tie) */
  ties: number[]
  /** weight * score/5 that each ballot gave the winner this round */
  winnerWeightedScores: Frac[]
  /** ballot indices sorted by winnerWeightedScores, high to low */
  sortedOrder: number[]
  /** the weighted score at which the running total of weight first reached the quota */
  splitPoint: Frac
  /** total weight of ballots strictly above the split point (fully spent) */
  spentAbove: Frac
  /** total weight of ballots exactly on the split point */
  weightOnSplit: Frac
  /** fraction of each split ballot's weight that is spent: (quota - spentAbove) / weightOnSplit */
  spentValue: Frac
  status: BallotStatus[]
  /** ballot weights after reweighting (already clamped to [0, 1]) */
  weightsAfter: Frac[]
  /** true if some weight went negative / above 1 and was clamped */
  clamped: boolean
  /** true if the winner had already been elected in an earlier round (see quirks) */
  reElected: boolean
}

export interface StarPrResult {
  candidates: string[]
  nWinners: number
  /** indices into the input ballots that survived filtering, in order */
  talliedBallotIndex: number[]
  /** per input ballot: why it was dropped, or null if tallied */
  dropped: ('outOfBounds' | 'abstention' | null)[]
  nTallyVotes: number
  nAbstentions: number
  nOutOfBoundsVotes: number
  quota: Frac
  /** candidate indices in election order */
  elected: number[]
  /** candidate indices that were not elected */
  other: number[]
  /** all candidates that were ever part of a tie for first in a round */
  tied: number[]
  tieBreakType: 'none' | 'random'
  rounds: RoundDetail[]
  logs: string[]
}

const rounded = (n: Frac) => Math.round(n.valueOf() * 100) / 100
const percent = (n: Frac) => `${Math.round(n.valueOf() * 100)}%`

/**
 * Util.ts filterInitialVotes() with the two tests AllocatedScore installs:
 *   makeBoundsTest(0, 5)       – any non-null mark outside 0..5 drops the ballot
 *   makeAbstentionTest(true)   – a ballot whose marks are all equal (blank counts as 0) is
 *                                treated as an abstention and dropped
 * Tests run in that order and the first failing one is the reason recorded.
 */
export function filterBallots(ballots: Ballot[], nCandidates: number) {
  const dropped: StarPrResult['dropped'] = []
  const tallied: number[] = []
  ballots.forEach((b, i) => {
    const marks = Array.from({ length: nCandidates }, (_, c) => b[c])
    if (marks.some((m) => m != null && (m < 0 || MAX_SCORE < m))) {
      dropped.push('outOfBounds')
      return
    }
    const zeroed = marks.map((m) => m ?? 0)
    if (zeroed.every((m) => m === zeroed[0])) {
      dropped.push('abstention')
      return
    }
    dropped.push(null)
    tallied.push(i)
  })
  return { dropped, tallied }
}

/**
 * AllocatedScore.ts indexOfMax(). Candidates are assumed to be listed in
 * tie-break order (index 0 wins ties), which is what production guarantees:
 * shuffleCandidatesForRandomTiebreak() shuffles the array and then sets
 * tieBreakOrder = array index, and sortCandidates() then prefers the lowest
 * tieBreakOrder. Note that the scan runs over *all* candidates, including ones
 * already elected (whose sums are zero).
 */
export function indexOfMax(arr: Frac[]) {
  if (arr.length === 0) return { maxIndex: -1, ties: [] as number[] }
  let max = arr[0]
  let maxIndex = 0
  let ties = [0]
  for (let i = 1; i < arr.length; i++) {
    if (max.equals(arr[i])) {
      ties.push(i)
    } else if (arr[i].compare(max) > 0) {
      maxIndex = i
      max = arr[i]
      ties = [i]
    }
  }
  if (ties.length > 1) maxIndex = Math.min(...ties)
  return { maxIndex, ties }
}

/** AllocatedScore.ts findSplitPoint() */
export function findSplitPoint(sortedScores: Frac[], sortedWeights: Frac[], quota: Frac) {
  let cumsum = Frac.ZERO
  for (let k = 0; k < sortedScores.length; k++) {
    cumsum = cumsum.add(sortedWeights[k])
    if (cumsum.compare(quota) >= 0) return sortedScores[k]
  }
  if (sortedScores.length === 0) return Frac.ZERO
  return sortedScores[sortedScores.length - 1]
}

export function allocatedScore(candidates: string[], ballots: Ballot[], nWinners = 3): StarPrResult {
  const C = candidates.length
  const { dropped, tallied } = filterBallots(ballots, C)
  const logs: string[] = []

  // scoresNorm: each tallied ballot's marks divided by MAX_SCORE (blank -> 0)
  const scoresNorm: Frac[][] = tallied.map((bi) =>
    Array.from({ length: C }, (_, c) => new Frac(ballots[bi][c] ?? 0).div(MAX_SCORE)),
  )

  const V = scoresNorm.length
  const quota = new Frac(V).div(nWinners)
  logs.push(
    `${nWinners} winners will represent ${V} voters, so winners will need to represent a quota of ${rounded(quota)} voters each.`,
  )

  let ballotWeights: Frac[] = Array(V).fill(Frac.ONE)
  const elected: number[] = []
  const tied: number[] = []
  const rounds: RoundDetail[] = []
  let remaining = candidates.map((_, i) => i)

  while (elected.length < nWinners) {
    const round = elected.length
    logs.push(`Round ${round + 1} of tabulation...`)
    const weightsBefore = [...ballotWeights]

    // weight the scores and sum them per candidate
    const weightedScores: Frac[][] = scoresNorm.map((ballot, b) => ballot.map((s) => s.mul(ballotWeights[b])))
    const weightedSums: Frac[] = Array.from({ length: C }, (_, c) =>
      weightedScores.reduce((acc, ws) => acc.add(ws[c]), Frac.ZERO),
    )

    const { maxIndex: w, ties } = indexOfMax(weightedSums)
    const reElected = elected.includes(w)
    logs.push(
      `${candidates[w]} is scored highest with ${rounded(weightedSums[w].mul(MAX_SCORE))} stars and is elected!`,
    )
    elected.push(w)
    if (ties.length > 1) logs.push(`${ties.map((t) => candidates[t]).join(' and ')} are tied for the highest scores!`)
    tied.push(...ties)

    // Set all scores for winner to zero (affects future rounds only)
    scoresNorm.forEach((ballot) => {
      ballot[w] = Frac.ZERO
    })
    remaining = remaining.filter((c) => c !== w)

    // cand_df: each ballot's weighted score for the winner and its current weight
    const winnerWeightedScores = weightedScores.map((ws) => ws[w])
    const candWeights = [...ballotWeights]
    const sortedOrder = winnerWeightedScores
      .map((_, i) => i)
      .sort((a, b) => winnerWeightedScores[b].compare(winnerWeightedScores[a]))

    const splitPoint = findSplitPoint(
      sortedOrder.map((i) => winnerWeightedScores[i]),
      sortedOrder.map((i) => candWeights[i]),
      quota,
    )

    let spentAbove = Frac.ZERO
    winnerWeightedScores.forEach((s, i) => {
      if (s.compare(splitPoint) > 0) spentAbove = spentAbove.add(candWeights[i])
    })
    if (spentAbove.valueOf() > 0) {
      logs.push(
        `The ${rounded(spentAbove)} voters who gave ${candidates[w]} more than ${rounded(splitPoint.mul(MAX_SCORE))} stars are fully represented and will be removed from future rounds.`,
      )
      winnerWeightedScores.forEach((s, i) => {
        if (s.compare(splitPoint) > 0) candWeights[i] = Frac.ZERO
      })
    }

    // findWeightOnSplit()
    let weightOnSplit = Frac.ZERO
    winnerWeightedScores.forEach((s, i) => {
      if (s.equals(splitPoint)) weightOnSplit = weightOnSplit.add(candWeights[i])
    })

    const spentValue = weightOnSplit.compare(0) > 0 ? quota.sub(spentAbove).div(weightOnSplit) : Frac.ZERO
    logs.push(
      `The ${rounded(weightOnSplit)} voters who gave ${candidates[w]} ${rounded(splitPoint.mul(MAX_SCORE))} stars are partially represented. ` +
        `${percent(spentValue)} of their remaining vote will go toward ${candidates[w]} and ${percent(Frac.ONE.sub(spentValue))} will be preserved for future rounds.`,
    )

    // updateBallotWeights()
    if (weightOnSplit.compare(0) > 0) {
      winnerWeightedScores.forEach((s, i) => {
        if (s.equals(splitPoint)) candWeights[i] = candWeights[i].mul(Frac.ONE.sub(spentValue))
      })
    }
    let clamped = false
    ballotWeights = candWeights.map((bw) => {
      if (bw.compare(1) > 0) {
        clamped = true
        return Frac.ONE
      }
      if (bw.compare(0) < 0) {
        clamped = true
        return Frac.ZERO
      }
      return bw
    })

    const status: BallotStatus[] = winnerWeightedScores.map((s) => {
      const c = s.compare(splitPoint)
      return c > 0 ? 'above' : c === 0 ? 'split' : 'below'
    })

    rounds.push({
      round,
      weightsBefore,
      weightedSums,
      winner: w,
      ties,
      winnerWeightedScores,
      sortedOrder,
      splitPoint,
      spentAbove,
      weightOnSplit,
      spentValue,
      status,
      weightsAfter: [...ballotWeights],
      clamped,
      reElected,
    })
  }

  return {
    candidates,
    nWinners,
    talliedBallotIndex: tallied,
    dropped,
    nTallyVotes: V,
    nAbstentions: dropped.filter((d) => d === 'abstention').length,
    nOutOfBoundsVotes: dropped.filter((d) => d === 'outOfBounds').length,
    quota,
    elected,
    other: remaining,
    tied,
    tieBreakType: elected.some((e) => tied.includes(e)) ? 'random' : 'none',
    rounds,
    logs,
  }
}
