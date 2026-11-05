// Run with: npm test   (Node >= 22.18 runs .ts files directly)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allocatedScore } from '../src/starpr/allocatedScore.ts'
import { Frac } from '../src/starpr/frac.ts'
import { scenarios } from '../src/starpr/scenarios.ts'
import { runWithOrder } from '../src/starpr/view.ts'

const byId = (id: string) => scenarios.find((s) => s.id === id)!
const run = (id: string) => {
  const s = byId(id)
  return allocatedScore(s.candidates, s.ballots, s.nWinners)
}
const stars = (f: Frac) => f.mul(5).valueOf()
const names = (r: ReturnType<typeof allocatedScore>, idx: number[]) => idx.map((i) => r.candidates[i])

// ---------- hand-worked examples (see the case study text for the arithmetic) ----------

test('two factions: quota 5, Allison uses up exactly her five 5-star voters', () => {
  const r = run('two-factions')
  assert.equal(r.quota.toString(), '5')
  assert.deepEqual(r.rounds[0].weightedSums.map(stars), [25, 24, 24, 23]) // A, B, C, D
  assert.deepEqual(names(r, r.elected), ['Allison', 'Doug'])
  const r0 = r.rounds[0]
  assert.equal(r0.splitPoint.toString(), '1') // 5 stars * weight 1
  assert.equal(r0.spentAbove.toString(), '0')
  assert.equal(r0.weightOnSplit.toString(), '5')
  assert.equal(r0.spentValue.toString(), '1')
  assert.deepEqual(r0.weightsAfter.map(String), ['0', '0', '0', '0', '0', '1', '1', '1', '1', '1'])
  assert.deepEqual(r.rounds[1].weightedSums.map(stars), [0, 0, 16, 23])
  // round 2: Doug's 5-star voters (4) are above the split at 3 stars (0.6); the 3-star voter fills the last 1
  assert.equal(r.rounds[1].splitPoint.toString(), '3/5')
  assert.equal(r.rounds[1].spentAbove.toString(), '4')
})

test('fractional surplus: quota 6, eight 5-star voters each keep 1/4', () => {
  const r = run('fractional-surplus')
  assert.equal(r.quota.toString(), '6')
  const r0 = r.rounds[0]
  assert.equal(r0.weightOnSplit.toString(), '8')
  assert.equal(r0.spentValue.toString(), '3/4')
  assert.deepEqual(r0.weightsAfter.slice(0, 8).map(String), Array(8).fill('1/4'))
  assert.deepEqual(r.rounds[1].weightedSums.map(stars), [0, 9.75, 14.75, 18])
})

test('three seats: Mo wins on breadth, the three 4-star ballots share the remaining 2/3 of a quota', () => {
  const r = run('three-seats')
  assert.deepEqual(names(r, r.elected), ['Mo', 'Ana', 'Raj'])
  const r0 = r.rounds[0]
  assert.equal(r0.splitPoint.toString(), '4/5')
  assert.equal(r0.spentAbove.toString(), '1')
  assert.equal(r0.weightOnSplit.toString(), '3')
  assert.equal(r0.spentValue.toString(), '2/3')
  assert.deepEqual(r0.status, ['below', 'below', 'split', 'split', 'above', 'split', 'below', 'below', 'below'])
})

test('zero split: voters who gave the winner 0 stars still lose a quarter of their weight', () => {
  const r = run('zero-split')
  const r0 = r.rounds[0]
  assert.equal(r0.splitPoint.toString(), '0')
  assert.equal(r0.spentAbove.toString(), '2')
  assert.equal(r0.weightOnSplit.toString(), '4')
  assert.equal(r0.spentValue.toString(), '1/4')
  assert.deepEqual(r0.weightsAfter.map(String), ['0', '0', '3/4', '3/4', '3/4', '3/4'])
  assert.deepEqual(names(r, r.elected), ['Xi', 'Zed'])
})

test('tie: first in tie-break order wins, no runoff', () => {
  const r = run('tie')
  assert.deepEqual(r.rounds[0].ties, [0, 1])
  assert.deepEqual(names(r, r.elected), ['Pat'])
  assert.equal(r.tieBreakType, 'random')
  const s = byId('tie')
  const flipped = allocatedScore([s.candidates[1], s.candidates[0], s.candidates[2]], s.ballots.map((b) => [b[1], b[0], b[2]]), 1)
  assert.deepEqual(flipped.elected.map((i) => flipped.candidates[i]), ['Quinn'])
})

test('ballot filtering: all-equal ballots and out-of-range scores are dropped before the quota is set', () => {
  const r = allocatedScore(['A', 'B'], [[5, 5], [null, null], [6, 0], [5, 0], [0, 4]], 1)
  assert.deepEqual(r.dropped, ['abstention', 'abstention', 'outOfBounds', null, null])
  assert.equal(r.quota.toString(), '2')
})

test('quirk: a candidate can be elected twice once every remaining candidate scores zero', () => {
  const r = allocatedScore(['A', 'B', 'C'], [[5, 0, 0], [4, 0, 0]], 3)
  assert.deepEqual(names(r, r.elected), ['A', 'A', 'A'])
  assert.equal(r.rounds[1].reElected, true)
})

test('quirk, board election: an incumbent can take two of three seats', () => {
  const s = byId('elected-twice')
  const r = run('elected-twice')
  assert.equal(r.quota.toString(), '3')
  assert.deepEqual(r.rounds[0].weightedSums.map(stars), [37, 34, 4, 3])
  assert.deepEqual(r.rounds[0].weightsAfter.map(String), ['0', '0', '1', '1', '1', '1', '1', '1', '0'])
  assert.deepEqual(r.rounds[1].weightedSums.map(stars), [0, 23, 0, 0])
  assert.deepEqual(r.rounds[1].weightsAfter.map(String), ['0', '0', '1/3', '1', '1/3', '1/3', '1', '0', '0'])
  assert.deepEqual(r.rounds[2].weightedSums.map(String), ['0', '0', '0', '0'])
  assert.deepEqual(names(r, r.elected), ['Ana', 'Ben', 'Ana'])
  const benFirst = runWithOrder(s.candidates, s.ballots, s.nWinners, [1, 0, 2, 3])
  assert.deepEqual(benFirst.elected.map((i) => s.candidates[i]), ['Ana', 'Ben', 'Ben'])
  const calFirst = runWithOrder(s.candidates, s.ballots, s.nWinners, [2, 0, 1, 3])
  assert.deepEqual(calFirst.elected.map((i) => s.candidates[i]), ['Ana', 'Ben', 'Cal'])
})

// ---------- the port vs. BetterVoting's real tabulator ----------

type OracleCase = {
  id: string
  candidates: string[]
  nWinners: number
  ballots: (number | null)[][]
  output: {
    elected: string[]
    other: string[]
    tied: string[]
    tieBreakType: string
    nTallyVotes: number
    nAbstentions: number
    nOutOfBoundsVotes: number
    weightedScoresByRound: Record<string, number>[]
    splitPoints: number[]
    spentAboves: number[]
    weight_on_splits: number[]
    logs?: string[]
  }
}
const oracle: { bettervotingCommit: string; cases: OracleCase[] } = JSON.parse(
  readFileSync(new URL('../src/starpr/fixtures/bettervoting-oracle.json', import.meta.url), 'utf8'),
)

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

test(`port matches BetterVoting@${oracle.bettervotingCommit.slice(0, 7)} on ${oracle.cases.length} elections`, () => {
  for (const c of oracle.cases) {
    const r = allocatedScore(c.candidates, c.ballots, c.nWinners)
    const o = c.output
    const msg = `case ${c.id}`
    assert.deepEqual(names(r, r.elected), o.elected, msg)
    assert.deepEqual(names(r, r.other), o.other, msg)
    assert.deepEqual(names(r, r.tied), o.tied, msg)
    assert.equal(r.tieBreakType, o.tieBreakType, msg)
    assert.equal(r.nTallyVotes, o.nTallyVotes, msg)
    assert.equal(r.nAbstentions, o.nAbstentions, msg)
    assert.equal(r.nOutOfBoundsVotes, o.nOutOfBoundsVotes, msg)
    assert.equal(r.rounds.length, o.weightedScoresByRound.length, msg)
    r.rounds.forEach((rd, k) => {
      c.candidates.forEach((name, i) => assert.ok(close(stars(rd.weightedSums[i]), o.weightedScoresByRound[k][name]), `${msg} round ${k} ${name}`))
      assert.ok(close(rd.splitPoint.valueOf(), o.splitPoints[k]), `${msg} split ${k}`)
      assert.ok(close(rd.spentAbove.valueOf(), o.spentAboves[k]), `${msg} spentAbove ${k}`)
      assert.ok(close(rd.weightOnSplit.valueOf(), o.weight_on_splits[k]), `${msg} weightOnSplit ${k}`)
    })
    if (o.logs) assert.deepEqual(r.logs, o.logs, msg)
  }
})
