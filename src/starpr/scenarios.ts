import type { Ballot } from './allocatedScore.ts'

export interface Scenario {
  id: string
  title: string
  blurb: string
  candidates: string[]
  nWinners: number
  ballots: Ballot[]
  /** shown in the "surprises" section rather than the main preset list */
  quirk?: boolean
}

// Each preset is small enough to work by hand. The first two are copied from
// BetterVoting's own unit tests (packages/backend/src/Tabulators/AllocatedScore.test.ts)
// so readers can line them up against the expected values there.
export const scenarios: Scenario[] = [
  {
    id: 'two-factions',
    title: 'Two factions, two seats',
    blurb:
      'BetterVoting’s “Basic Example” test. Five voters love Allison and Bill, four love Doug and like Carmen. Allison wins round 1 and uses up her five supporters exactly; Doug wins round 2.',
    candidates: ['Allison', 'Bill', 'Carmen', 'Doug'],
    nWinners: 2,
    ballots: [
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 4, 4, 0],
      [0, 0, 0, 3],
      [0, 0, 4, 5],
      [0, 0, 4, 5],
      [0, 0, 4, 5],
      [0, 0, 4, 5],
    ],
  },
  {
    id: 'fractional-surplus',
    title: 'Too many supporters: a fractional surplus',
    blurb:
      'BetterVoting’s “Fractional surplus” test. Allison has eight 5-star supporters but the quota is only 6, so each of those eight keeps 25% of their vote for later rounds.',
    candidates: ['Allison', 'Bill', 'Carmen', 'Doug'],
    nWinners: 2,
    ballots: [
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 5, 1, 0],
      [5, 4, 4, 0],
      [0, 0, 0, 3],
      [0, 0, 4, 5],
      [0, 0, 4, 5],
      [0, 0, 4, 5],
    ],
  },
  {
    id: 'three-seats',
    title: 'Three seats, a broad consensus pick',
    blurb:
      'Nine voters, three seats (quota 3). Everyone likes the moderate Mo a bit, so Mo wins first on total score—and the split point decides who “paid” for Mo.',
    candidates: ['Ana', 'Mo', 'Raj', 'Lee'],
    nWinners: 3,
    ballots: [
      [5, 3, 0, 0],
      [5, 3, 0, 1],
      [5, 4, 0, 0],
      [4, 4, 0, 0],
      [0, 5, 2, 0],
      [0, 4, 5, 0],
      [0, 3, 5, 0],
      [0, 3, 4, 5],
      [1, 2, 0, 5],
    ],
  },
  {
    id: 'zero-split',
    title: 'A winner with less than a quota of fans',
    blurb:
      'Two seats among six voters (quota 3). Only two ballots score Xi, but Xi still has the top total. To fill a full quota, the split point falls to 0 stars—so voters who gave Xi nothing also lose weight.',
    candidates: ['Xi', 'Yara', 'Zed'],
    nWinners: 2,
    ballots: [
      [5, 0, 0],
      [5, 0, 1],
      [0, 3, 1],
      [0, 3, 1],
      [0, 0, 3],
      [0, 1, 3],
    ],
  },
  {
    id: 'tie',
    title: 'An exact tie',
    blurb:
      'Pat and Quinn have identical totals in round 1. BetterVoting does not run a STAR-style runoff here: the tie goes to whoever is earlier in the (randomly shuffled) tie-break order. Reorder the tie-break list to see it flip.',
    candidates: ['Pat', 'Quinn', 'Rue'],
    nWinners: 1,
    ballots: [
      [5, 0, 2],
      [5, 0, 2],
      [0, 5, 3],
      [0, 5, 2],
      [3, 3, 1],
    ],
  },
  {
    id: 'elected-twice',
    title: 'Two seats, two nominees, Alice wins both',
    quirk: true,
    blurb:
      'An uncontested 2-seat race: only Alice and Bob are running. Bob’s only supporters are Alice’s strongest fans, and they are used up electing Alice. In round 2 Alice (zeroed) and Bob both total 0. The tie-for-highest check also scans candidates who already won, so whenever Alice is first in the tie-break order she is elected again.',
    candidates: ['Alice', 'Bob'],
    nWinners: 2,
    ballots: [
      [5, 4],
      [5, 2],
      [4, 0],
      [4, 0],
      [3, 0],
    ],
  },
]
