import { useEffect, useMemo, useRef, useState } from 'react'
import { useCssVars } from '../useCssVars.ts'
import { RANKINGS, computeMaps, gaussianCloud, irv, rankingCounts, roundRobin, type Pt, type YeeMaps } from './yee.ts'
import './yee.css'

const NAMES = ['A', 'B', 'C']
const CLOUD = gaussianCloud(200)
const SERIES = ['series-1', 'series-2', 'series-3'] as const
const COLOR_VARS = [...SERIES, 'surface', 'ink', 'ink-2', 'muted', 'grid'] as const

const PRESETS: { id: string; label: string; cands: Pt[]; spread: number; probe: Pt }[] = [
  {
    id: 'squeeze',
    label: 'Center squeeze',
    cands: [
      { x: 0.3, y: 0.55 },
      { x: 0.5, y: 0.47 },
      { x: 0.7, y: 0.57 },
    ],
    spread: 0.3,
    probe: { x: 0.52, y: 0.58 },
  },
  {
    id: 'triangle',
    label: 'Equilateral',
    cands: [
      { x: 0.5, y: 0.25 },
      { x: 0.28, y: 0.65 },
      { x: 0.72, y: 0.65 },
    ],
    spread: 0.2,
    probe: { x: 0.5, y: 0.5 },
  },
  {
    id: 'clones',
    label: 'Two similar candidates',
    cands: [
      { x: 0.42, y: 0.4 },
      { x: 0.5, y: 0.42 },
      { x: 0.7, y: 0.62 },
    ],
    spread: 0.2,
    probe: { x: 0.5, y: 0.5 },
  },
]

const pct = (n: number, total: number) => (total ? `${Math.round((100 * n) / total)}%` : '–')

// ---------------------------------------------------------------------------
// One map: a canvas with the winner of every electorate centre, plus an SVG
// overlay with draggable candidate markers and the probe crosshair.
// ---------------------------------------------------------------------------
function YeeMap(props: {
  title: string
  grid: Uint8Array
  other: Uint8Array
  n: number
  cands: Pt[]
  probe: Pt
  showDiff: boolean
  colors: Record<(typeof COLOR_VARS)[number], string>
  onMoveCand: (i: number, p: Pt) => void
  onDragState: (dragging: boolean) => void
  onProbe: (p: Pt) => void
}) {
  const { grid, other, n, cands, probe, showDiff, colors } = props
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState(320)
  const drag = useRef<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize(Math.max(120, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.round(size * dpr)
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext('2d')!
    // paint the n×n grid into an offscreen canvas, then scale it up smoothly
    const off = document.createElement('canvas')
    off.width = n
    off.height = n
    const octx = off.getContext('2d')!
    const img = octx.createImageData(n, n)
    const rgb = SERIES.map((s) => hexToRgb(colors[s]))
    for (let k = 0; k < n * n; k++) {
      const [r, g, b] = rgb[grid[k]]
      img.data[4 * k] = r
      img.data[4 * k + 1] = g
      img.data[4 * k + 2] = b
      img.data[4 * k + 3] = 255
    }
    octx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, 0, 0, px, px)
    // soften toward the surface so the markers and hatching read clearly
    ctx.fillStyle = colors.surface
    ctx.globalAlpha = 0.35
    ctx.fillRect(0, 0, px, px)
    ctx.globalAlpha = 1
    if (showDiff) {
      const tile = document.createElement('canvas')
      const t = Math.round(8 * dpr)
      tile.width = t
      tile.height = t
      const tctx = tile.getContext('2d')!
      tctx.strokeStyle = colors.ink
      tctx.globalAlpha = 0.55
      tctx.lineWidth = 1.5 * dpr
      tctx.beginPath()
      tctx.moveTo(0, t)
      tctx.lineTo(t, 0)
      tctx.moveTo(-t / 2, t / 2)
      tctx.lineTo(t / 2, -t / 2)
      tctx.moveTo(t / 2, t + t / 2)
      tctx.lineTo(t + t / 2, t / 2)
      tctx.stroke()
      ctx.fillStyle = ctx.createPattern(tile, 'repeat')!
      const cell = px / n
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++)
          if (grid[j * n + i] !== other[j * n + i])
            ctx.fillRect(Math.floor(i * cell), Math.floor(j * cell), Math.ceil(cell) + 1, Math.ceil(cell) + 1)
    }
  }, [grid, other, n, size, colors, showDiff])

  const toUnit = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)),
      y: Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height)),
    }
  }

  return (
    <figure className="yee-figure">
      <figcaption>{props.title}</figcaption>
      <div className="yee-map" ref={wrapRef}>
        <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden="true" />
        <svg
          ref={svgRef}
          viewBox="0 0 1 1"
          className="yee-overlay"
          role="img"
          aria-label={`${props.title} winner map. Candidates at ${cands.map((c, i) => `${NAMES[i]} (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`).join(', ')}.`}
          onPointerDown={(e) => {
            if (drag.current === null) props.onProbe(toUnit(e))
          }}
          onPointerMove={(e) => {
            if (drag.current !== null) props.onMoveCand(drag.current, toUnit(e))
          }}
          onPointerUp={() => {
            if (drag.current !== null) props.onDragState(false)
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
            props.onDragState(false)
          }}
        >
          <g className="probe" transform={`translate(${probe.x} ${probe.y})`}>
            <circle r={0.03} />
            <line x1={-0.045} x2={0.045} />
            <line y1={-0.045} y2={0.045} />
          </g>
          {cands.map((c, i) => (
            <g
              key={i}
              className="cand"
              transform={`translate(${c.x} ${c.y})`}
              tabIndex={0}
              role="button"
              aria-label={`Candidate ${NAMES[i]}. Drag, or use arrow keys, to move.`}
              onPointerDown={(e) => {
                e.stopPropagation()
                ;(e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId)
                drag.current = i
                props.onDragState(true)
              }}
              onKeyDown={(e) => {
                const d = e.shiftKey ? 0.05 : 0.01
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [-d, 0],
                  ArrowRight: [d, 0],
                  ArrowUp: [0, -d],
                  ArrowDown: [0, d],
                }
                const m = moves[e.key]
                if (!m) return
                e.preventDefault()
                props.onMoveCand(i, {
                  x: Math.min(0.98, Math.max(0.02, c.x + m[0])),
                  y: Math.min(0.98, Math.max(0.02, c.y + m[1])),
                })
              }}
            >
              <circle r={0.07} className="hit" />
              <circle r={0.042} style={{ fill: colors[SERIES[i]] }} />
              <text dy="0.018">{NAMES[i]}</text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.replace(/./g, (c) => c + c) : h
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// ---------------------------------------------------------------------------
// Small horizontal bar row used in the worked example and the probe panel.
// ---------------------------------------------------------------------------
function Bar({ label, value, total, color, strong, struck }: { label: React.ReactNode; value: number; total: number; color: string; strong?: boolean; struck?: boolean }) {
  return (
    <div className={`hbar${strong ? ' strong' : ''}${struck ? ' struck' : ''}`}>
      <span className="hbar-label">{label}</span>
      <span className="hbar-track">
        <span className="hbar-fill" style={{ width: `${total ? (100 * value) / total : 0}%`, background: color }} />
      </span>
      <span className="hbar-value">
        {value} <span className="muted">({pct(value, total)})</span>
      </span>
    </div>
  )
}

function Tabulation({ counts, colors }: { counts: number[]; colors: Record<string, string> }) {
  const total = counts.reduce((a, b) => a + b, 0)
  const rr = roundRobin(counts)
  const ir = irv(counts)
  const col = (i: number) => colors[SERIES[i]]
  const survivors = [0, 1, 2].filter((c) => c !== ir.eliminated)
  return (
    <div className="tab-grid">
      <div>
        <h4>Ballots</h4>
        {RANKINGS.map((r, i) => (
          <Bar key={i} label={r.map((c) => NAMES[c]).join(' > ')} value={counts[i]} total={total} color="var(--axis)" />
        ))}
      </div>
      <div>
        <h4>Round Robin: every head-to-head</h4>
        {[
          [0, 1],
          [0, 2],
          [1, 2],
        ].map(([a, b]) => {
          const w = rr.pref[a][b] >= rr.pref[b][a] ? a : b
          if (rr.pref[a][b] === rr.pref[b][a])
            return (
              <p key={`${a}${b}`} className="pair">
                <span className="swatch" style={{ background: 'var(--axis)' }} />
                {NAMES[a]} and {NAMES[b]} tie, {rr.pref[a][b]}–{rr.pref[b][a]}
              </p>
            )
          return (
            <p key={`${a}${b}`} className="pair">
              <span className="swatch" style={{ background: col(w) }} />
              <strong>{NAMES[w]}</strong> beats {NAMES[w === a ? b : a]}, {Math.max(rr.pref[a][b], rr.pref[b][a])}–
              {Math.min(rr.pref[a][b], rr.pref[b][a])}
            </p>
          )
        })}
        <p className="verdict">
          <span className="swatch" style={{ background: col(rr.winner) }} />
          Round Robin elects <strong>{NAMES[rr.winner]}</strong>
          {rr.condorcet ? ', who beats everyone head-to-head.' : ' (no one beats everyone; most pairwise wins, ties broken by total support).'}
        </p>
      </div>
      <div>
        <h4>IRV: round 1, first choices</h4>
        {[0, 1, 2].map((c) => (
          <Bar key={c} label={NAMES[c]} value={ir.firstPrefs[c]} total={total} color={col(c)} struck={c === ir.eliminated && !ir.majorityRound1} />
        ))}
        {ir.majorityRound1 ? (
          <p className="note">Someone already has a majority, so the later rounds don’t change anything.</p>
        ) : (
          <p className="note">
            {NAMES[ir.eliminated]} has the fewest first choices and is eliminated. Those ballots move to their next choice.
          </p>
        )}
        <h4>IRV: round 2</h4>
        {survivors.map((c) => (
          <Bar key={c} label={NAMES[c]} value={ir.final[c]} total={total} color={col(c)} strong={c === ir.winner} />
        ))}
        <p className="verdict">
          <span className="swatch" style={{ background: col(ir.winner) }} />
          IRV elects <strong>{NAMES[ir.winner]}</strong>.
        </p>
      </div>
    </div>
  )
}

export default function YeeCaseStudy() {
  const colors = useCssVars(COLOR_VARS)
  const [cands, setCands] = useState<Pt[]>(PRESETS[0].cands)
  const [spread, setSpread] = useState(PRESETS[0].spread)
  const [probe, setProbe] = useState<Pt>(PRESETS[0].probe)
  const [dragging, setDragging] = useState(false)
  const [showDiff, setShowDiff] = useState(true)
  const [preset, setPreset] = useState('squeeze')

  // A coarser grid while dragging keeps it smooth on phones.
  const n = dragging ? 56 : 112
  const maps: YeeMaps = useMemo(() => computeMaps(n, cands, CLOUD, spread), [n, cands, spread])
  const probeCounts = useMemo(() => rankingCounts(probe, cands, CLOUD, spread), [probe, cands, spread])
  const disagreeShare = useMemo(() => {
    let d = 0
    for (let k = 0; k < maps.rr.length; k++) if (maps.rr[k] !== maps.irv[k]) d++
    return d / maps.rr.length
  }, [maps])

  const handHeld = [31, 0, 0, 30, 0, 39] // A>B>C, B>C>A, C>B>A

  const moveCand = (i: number, p: Pt) => {
    setPreset('')
    setCands((cs) => cs.map((c, j) => (j === i ? p : c)))
  }

  return (
    <article className="article yee">
      <p className="kicker">Case study 1</p>
      <h1>When Round Robin and IRV disagree</h1>
      <p className="lede">
        Two popular “better than plurality” methods both use ranked ballots. They usually agree. This page shows
        where they don’t, and why: a <em>Yee diagram</em> colours every possible electorate by who would win.
      </p>

      <h2>
        <span className="step-num">1</span>A hand-sized example
      </h2>
      <p>One hundred voters rank three candidates:</p>
      <ul>
        <li>
          31 vote <strong>A &gt; B &gt; C</strong>
        </li>
        <li>
          30 vote <strong>B &gt; C &gt; A</strong>
        </li>
        <li>
          39 vote <strong>C &gt; B &gt; A</strong>
        </li>
      </ul>
      <p>
        <strong>Round Robin</strong> (also called pairwise or Condorcet–Copeland) runs every head-to-head match. B
        beats A 69–31 and beats C 61–39, so B wins. <strong>IRV</strong> (instant runoff) looks only at first
        choices. B has the fewest (30), so B is eliminated first, and those 30 ballots go to C, who then beats A
        69–31.
      </p>
      <div className="panel">
        <Tabulation counts={handHeld} colors={colors} />
      </div>
      <p>
        This is the <em>center squeeze</em>: a candidate everyone ranks second gets few first choices, so IRV drops
        them before their broad support counts.
      </p>

      <h2>
        <span className="step-num">2</span>The same thing in space
      </h2>
      <p>
        Put the candidates on a map of opinions. Pick any spot on the map and imagine an electorate centred there:
        200 voters scattered around it in a bell curve. Each voter ranks candidates by distance, closest first. Colour
        the spot by the winner. Do that for every spot and you get a Yee diagram.
      </p>
      <p>
        <strong>Drag the candidates</strong> to move them. <strong>Tap anywhere</strong> to see that electorate’s
        ballots below. Hatched areas are where the two methods pick different winners.
      </p>

      <div className="yee-controls">
        <div className="chip-row" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={preset === p.id}
              onClick={() => {
                setPreset(p.id)
                setCands(p.cands)
                setSpread(p.spread)
                setProbe(p.probe)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="slider">
          Voter spread <input type="range" min={0.06} max={0.4} step={0.01} value={spread} onChange={(e) => setSpread(+e.target.value)} />
          <span className="mono">{spread.toFixed(2)}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} /> Hatch disagreements
        </label>
      </div>

      <div className="yee-pair">
        {(['Round Robin', 'IRV'] as const).map((title) => (
          <YeeMap
            key={title}
            title={title}
            grid={title === 'IRV' ? maps.irv : maps.rr}
            other={title === 'IRV' ? maps.rr : maps.irv}
            n={maps.n}
            cands={cands}
            probe={probe}
            showDiff={showDiff}
            colors={colors}
            onMoveCand={moveCand}
            onDragState={setDragging}
            onProbe={setProbe}
          />
        ))}
      </div>
      <p className="legend">
        {NAMES.map((nm, i) => (
          <span key={nm}>
            <span className="swatch" style={{ background: colors[SERIES[i]] }} />
            {nm} wins
          </span>
        ))}
        <span>
          <span className="swatch hatch" /> methods disagree ({Math.round(disagreeShare * 100)}% of the map)
        </span>
      </p>

      <h2>
        <span className="step-num">3</span>Look inside one electorate
      </h2>
      <p>
        The crosshair marks the electorate below, centred at ({probe.x.toFixed(2)}, {probe.y.toFixed(2)}). Tap a hatched
        area to find a center squeeze like the one in step 1.
      </p>
      <div className="panel">
        <Tabulation counts={probeCounts} colors={colors} />
      </div>

      <h2>
        <span className="step-num">4</span>What to notice
      </h2>
      <ul>
        <li>
          Round Robin regions are the <em>Voronoi</em> cells of the candidates, up to sampling noise: you win
          wherever you are the closest candidate to the electorate’s center. With a symmetric voter cloud, a
          head-to-head between two candidates is decided by which side of the line halfway between them the center
          falls on, so the closest candidate beats everyone.
        </li>
        <li>
          IRV shrinks the middle candidate’s region. In <em>Center squeeze</em>, B sits between A and C and wins the
          head-to-heads around it. But with both flanks pulling first choices away, B is the first eliminated.
        </li>
        <li>
          Raise the voter spread and the squeeze gets worse: wider electorates put more voters on the flanks. Shrink
          it and the two maps converge, because a tight cluster agrees on its first choice.
        </li>
        <li>
          In <em>Two similar candidates</em>, A and B split the vote that leans their way. Round Robin is unaffected by
          the split, while IRV hands some of their shared territory to C.
        </li>
      </ul>

      <h3>Model details</h3>
      <p className="note">
        Each electorate is the same 200 offsets (a Halton-sequence Gaussian sample, so the map is smooth and
        repeatable) scaled by the spread and centred on the spot. Voters rank by straight-line distance. Round Robin
        elects the candidate with the most head-to-head wins; a cycle (rare here) is broken by total head-to-head
        votes. IRV ties for elimination knock out the later-listed candidate. Maps are computed at 112×112 (56×56
        while you drag).
      </p>
    </article>
  )
}
