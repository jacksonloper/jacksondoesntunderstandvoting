// Usage: npm install && npx tsx generate.ts /path/to/bettervoting
//
// Copies BetterVoting's STAR-PR tabulator (AllocatedScore.ts + Util.ts) into
// ./vendor, runs it on the preset scenarios plus a batch of seeded random
// elections, and writes inputs + outputs to
// ../../src/starpr/fixtures/bettervoting-oracle.json. The site's tests then
// check the client-side port against that file.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { scenarios } from '../../src/starpr/scenarios'

type Case = { id: string; candidates: string[]; nWinners: number; ballots: (number | null)[][] }

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomCases(n: number): Case[] {
  const rand = mulberry32(20261105)
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const out: Case[] = []
  for (let k = 0; k < n; k++) {
    const nc = int(2, 6)
    const candidates = Array.from({ length: nc }, (_, i) => String.fromCharCode(65 + i))
    const nWinners = int(1, Math.min(4, nc))
    const nb = int(0, 14)
    // a few "factions" so that ballots repeat and exact ties / split points happen
    const factions = Array.from({ length: int(1, 3) }, () => candidates.map(() => int(0, 5)))
    const ballots = Array.from({ length: nb }, () => {
      const r = rand()
      if (r < 0.05) return candidates.map(() => 3) // all-equal -> abstention
      if (r < 0.08) return candidates.map((_, i) => (i === 0 ? 6 : int(0, 5))) // out of bounds
      const base = r < 0.6 ? factions[int(0, factions.length - 1)] : candidates.map(() => int(0, 5))
      return base.map((s) => (rand() < 0.05 ? null : s))
    })
    out.push({ id: `random-${k}`, candidates, nWinners, ballots })
  }
  return out
}

const edgeCases: Case[] = [
  { id: 'edge-no-ballots', candidates: ['A', 'B', 'C'], nWinners: 2, ballots: [] },
  { id: 'edge-more-seats-than-support', candidates: ['A', 'B', 'C'], nWinners: 3, ballots: [[5, 0, 0], [4, 0, 0]] },
  { id: 'edge-seats-equal-candidates', candidates: ['A', 'B'], nWinners: 2, ballots: [[5, 1], [5, 0], [0, 2]] },
  { id: 'edge-voters-lt-winners', candidates: ['Allison', 'Bill', 'Carmen', 'Doug'], nWinners: 3, ballots: [[5, 5, 0, 0], [5, 4, 3, 0]] },
]

async function main() {
  const bvRoot = process.argv[2]
  if (!bvRoot) throw new Error('usage: tsx generate.ts /path/to/bettervoting')
  const tabDir = path.join(bvRoot, 'packages/backend/src/Tabulators')
  const vendor = path.join(__dirname, 'vendor')
  mkdirSync(vendor, { recursive: true })
  for (const f of ['AllocatedScore.ts', 'Util.ts']) copyFileSync(path.join(tabDir, f), path.join(vendor, f))
  let commit = 'unknown'
  try {
    commit = execSync('git rev-parse HEAD', { cwd: bvRoot }).toString().trim()
  } catch {}

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AllocatedScore } = require('./vendor/AllocatedScore')

  const cases: Case[] = [
    ...scenarios.map((s) => ({ id: s.id, candidates: s.candidates, nWinners: s.nWinners, ballots: s.ballots as (number | null)[][] })),
    ...edgeCases,
    ...randomCases(200),
  ]

  const results = cases.map((c) => {
    // Same shape as packages/backend/src/test/TestHelper.ts mapMethodInputs():
    // tieBreakOrder = list index, which is also what production produces after
    // shuffleCandidatesForRandomTiebreak().
    const candidates = c.candidates.map((name, i) => ({ name, id: name, tieBreakOrder: i, votesPreferredOver: {}, winsAgainst: {} }))
    const votes = c.ballots.map((b) => ({ marks: Object.fromEntries(c.candidates.map((n, i) => [n, b[i]])) }))
    let output: unknown
    try {
      const r = AllocatedScore(candidates, votes, c.nWinners)
      const sd = r.summaryData
      output = {
        elected: r.elected.map((x: { name: string }) => x.name),
        other: r.other.map((x: { name: string }) => x.name),
        tied: r.tied.map((x: { name: string }) => x.name),
        tieBreakType: r.tieBreakType,
        nTallyVotes: sd.nTallyVotes,
        nAbstentions: sd.nAbstentions,
        nOutOfBoundsVotes: sd.nOutOfBoundsVotes,
        // weightedScoresByRound is positionally aligned with the (re-ordered)
        // summaryData.candidates, so key it by name
        weightedScoresByRound: sd.weightedScoresByRound.map((round: number[]) =>
          Object.fromEntries(sd.candidates.map((cand: { name: string }, i: number) => [cand.name, round[i]])),
        ),
        splitPoints: sd.splitPoints,
        spentAboves: sd.spentAboves,
        weight_on_splits: sd.weight_on_splits,
        logs: c.id.startsWith("random") ? undefined : r.logs,
      }
    } catch (e) {
      output = { error: String(e) }
    }
    return { ...c, output }
  })

  const outFile = path.join(__dirname, '../../src/starpr/fixtures/bettervoting-oracle.json')
  mkdirSync(path.dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify({ bettervotingCommit: commit, generated: new Date().toISOString().slice(0, 10), cases: results }, null, 0) + '\n')
  console.log(`wrote ${results.length} cases from bettervoting@${commit.slice(0, 7)} to ${path.relative(process.cwd(), outFile)}`)
}

main()
