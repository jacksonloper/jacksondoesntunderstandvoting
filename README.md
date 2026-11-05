# jacksondoesntunderstandvoting

Interactive case studies of voting methods. A static React + TypeScript + Vite site with no backend. It uses hash routing (`#/yee`, `#/star-pr`), so the `dist/` build works on Netlify, GitHub Pages or any static host.

## Case studies

1. **When Round Robin and IRV disagree** (`#/yee`): a live Yee diagram. Drag three candidates around a 2-D opinion space, see where pairwise (Round Robin) and IRV winners differ, and tap any point to see that electorate's full tabulation.
2. **How BetterVoting counts STAR-PR** (`#/star-pr`): a step-by-step walk through BetterVoting's actual STAR-PR (Allocated Score) tabulator, with editable ballots, seats and tie-break order. It shows weighted totals, the split-point "staircase" and ballot reweighting for each round, plus a list of surprising behaviours in the implementation.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Node >= 22.18, runs .ts directly)
npm run build      # static site in dist/
```

## How the STAR-PR port is checked

`src/starpr/allocatedScore.ts` is a line-by-line port of BetterVoting's `packages/backend/src/Tabulators/AllocatedScore.ts` (plus ballot filtering from `Util.ts`). It uses exact BigInt fractions.

- `tests/starpr.test.ts` holds hand-worked examples, and also compares the port against `src/starpr/fixtures/bettervoting-oracle.json`.
- That fixture is produced by running **BetterVoting's own tabulator** on 210 elections: the presets, edge cases and 200 seeded random elections. To regenerate it against a newer BetterVoting:

  ```bash
  cd scripts/bettervoting-oracle
  npm install
  npx tsx generate.ts /path/to/bettervoting
  ```
