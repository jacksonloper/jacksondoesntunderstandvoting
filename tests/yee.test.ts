import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RANKINGS, irv, roundRobin, rankingCounts, gaussianCloud } from '../src/yee/yee.ts'

const profile = (entries: [number[], number][]) => {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const [r, n] of entries) counts[RANKINGS.findIndex((x) => x.join() === r.join())] += n
  return counts
}

test('31 A>B>C, 30 B>C>A, 39 C>B>A: Round Robin elects B, IRV elects C', () => {
  const counts = profile([
    [[0, 1, 2], 31],
    [[1, 2, 0], 30],
    [[2, 1, 0], 39],
  ])
  const rr = roundRobin(counts)
  assert.equal(rr.winner, 1)
  assert.equal(rr.condorcet, true)
  assert.deepEqual(rr.pref[1], [69, 0, 61]) // B beats A 69–31 and C 61–39
  const r = irv(counts)
  assert.deepEqual(r.firstPrefs, [31, 30, 39])
  assert.equal(r.eliminated, 1)
  assert.deepEqual(r.final, [31, 0, 69])
  assert.equal(r.winner, 2)
})

test('a voter cloud far from everyone else votes for the nearest candidate under both methods', () => {
  const cloud = gaussianCloud(200)
  const cands = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }]
  const counts = rankingCounts({ x: 0.05, y: 0.05 }, cands, cloud, 0.05)
  assert.equal(roundRobin(counts).winner, 0)
  assert.equal(irv(counts).winner, 0)
  assert.equal(counts.reduce((a, b) => a + b, 0), 200)
})
