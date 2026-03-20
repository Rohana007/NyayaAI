import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { casesApi, evaluationApi } from '../api/client'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'
import Navbar from '../components/Navbar'

const ease = [0.16, 1, 0.3, 1] as const

const CASE_TYPES = [
  { value: 'murder', label: 'Murder (BNS §103)' },
  { value: 'culpable_homicide', label: 'Culpable Homicide (BNS §105)' },
  { value: 'theft', label: 'Theft & Robbery (BNS §303)' },
  { value: 'cheating', label: 'Cheating (BNS §318)' },
  { value: 'sexual_assault', label: 'Sexual Assault (BNS §63)' },
  { value: 'dowry_death', label: 'Dowry Death (BNS §80)' },
  { value: 'sedition', label: 'Sedition / Terrorism (BNS §147)' },
  { value: 'bail', label: 'Bail Application (BNSS §479)' },
]
const DIFFICULTIES = [
  { value: 'easy', label: 'Beginner — Guided Mode' },
  { value: 'medium', label: 'Intermediate — Balanced' },
  { value: 'hard', label: 'Expert — Strict Procedure' },
]
const COURTS = ['Sessions Court', 'High Court', 'Supreme Court', 'Magistrate Court']
const ROLES = [
  { value: 'defence', label: 'Defence Counsel' },
  { value: 'prosecution', label: 'Public Prosecutor' },
]
const BADGES = [
  { id: 'first_hearing',   label: 'First Hearing',   icon: '🏛️', desc: 'Complete your first session' },
  { id: 'citation_master', label: 'Citation Master', icon: '📚', desc: 'Cite 10+ laws in one session' },
  { id: 'proceduralist',   label: 'Proceduralist',   icon: '⚖️', desc: 'Zero procedural errors' },
  { id: 'objection_ace',   label: 'Objection Ace',   icon: '⚡', desc: '5 sustained objections' },
  { id: 'cross_examiner',  label: 'Cross-Examiner',  icon: '🔍', desc: 'Impeach a witness' },
  { id: 'iron_advocate',   label: 'Iron Advocate',   icon: '🛡️', desc: 'Score 90+ overall' },
  { id: 'full_bench',      label: 'Full Bench',      icon: '👨‍⚖️', desc: 'Complete all 6 rounds' },
]

interface RecentSession { session_id: string; case_title: string; role: string; score: number | null; grade: string | null; bench_queries: number; verdict: string | null; status: string; created_at: string | null }

function AnimatedNumber({ value, suffix = '' }: { value: number | string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const target = typeof value === 'number' ? value : 0
  useEffect(() => {
    if (target === 0) { setDisplay(0); return }
    let start = 0
    const step = target / 40
    const t = setInterval(() => {
      start += step
      if (start >= target) { setDisplay(target); clearInterval(t) }
      else setDisplay(Math.round(start))
    }, 20)
    return () => clearInterval(t)
  }, [target])
  if (typeof value === 'string' && isNaN(Number(value))) return <>{value}</>
  return <>{display}{suffix}</>
}

function MagneticCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 20 })
  const sy = useSpring(y, { stiffness: 200, damping: 20 })

  return (
    <motion.div
      className={className}
      style={{ ...style, x: sx, y: sy }}
      onMouseMove={e => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        x.set(((e.clientX - r.left) / r.width - .5) * 6)
        y.set(((e.clientY - r.top) / r.height - .5) * 6)
      }}
      onMouseLeave={() => { x.set(0); y.set(0) }}
    >
      {children}
    </motion.div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const { user, setSession, resetRuntime, theme } = useSession(
    useShallow(s => ({ user: s.user, setSession: s.setSession, resetRuntime: s.resetRuntime, theme: s.theme }))
  )
  const [form, setForm] = useState({ case_type: 'murder', court_level: 'Sessions Court', complexity: 'moderate', role: 'defence', difficulty: 'easy', agentic_judge: false })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [stats, setStats] = useState({ sessions: 0, avgScore: 0, benchQueries: 0, bestGrade: '—', winRate: 0 })
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [earnedBadges, setEarnedBadges] = useState<string[]>([])
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)
  const radarRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!user) return
    // Fetch skill radar stats
    evaluationApi.skillRadar(user.id)
      .then(d => {
        const vals = Object.values(d.avg_scores) as number[]
        const avg = d.sessions_count && vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
        const gradeMap: Record<number, string> = {}
        // best grade derived from history below
        setStats(prev => ({ ...prev, sessions: d.sessions_count, avgScore: avg, benchQueries: Math.round((d.bench_queries_avg ?? 0) * 10) / 10 }))
        drawRadar(radarRef.current, vals, theme)
        const badges: string[] = []
        if (d.sessions_count >= 1) badges.push('first_hearing')
        if (avg >= 90) badges.push('iron_advocate')
        setEarnedBadges(badges)
        void gradeMap
      })
      .catch(() => drawRadar(radarRef.current, [0, 0, 0, 0, 0], theme))

    // Fetch session history
    casesApi.history(user.id)
      .then(d => {
        setRecentSessions(d.sessions)
        // Derive best grade and win rate from history
        const evaluated = d.sessions.filter(s => s.grade)
        const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F']
        const bestGrade = evaluated.length
          ? evaluated.map(s => s.grade!).sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]
          : '—'
        const wins = d.sessions.filter(s => s.verdict && ['Acquitted', 'Bail Granted', 'Case Dismissed'].includes(s.verdict)).length
        const winRate = d.sessions.length ? Math.round((wins / d.sessions.length) * 100) : 0
        setStats(prev => ({ ...prev, bestGrade, winRate }))
      })
      .catch(() => {})
  }, [user])

  // Redraw radar when theme changes
  useEffect(() => {
    drawRadar(radarRef.current, [0, 0, 0, 0, 0], theme)
  }, [theme])

  const sel = (k: string) => (e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const startCase = async () => {
    setErr(''); setLoading(true)
    try {
      const result = await casesApi.generate(form)
      resetRuntime()
      setSession(result.session_id, result, form.role, form.difficulty)
      nav('/pretrial')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed — is the backend running?')
    } finally { setLoading(false) }
  }

  const STATS_DATA = [
    { label: 'SESSIONS',      value: stats.sessions,     suffix: '' },
    { label: 'AVG SCORE',     value: stats.avgScore,     suffix: '' },
    { label: 'WIN RATE',      value: stats.winRate,      suffix: stats.sessions ? '%' : '' },
    { label: 'BENCH QUERIES', value: stats.benchQueries, suffix: '' },
    { label: 'BEST GRADE',    value: stats.bestGrade,    suffix: '' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: theme === 'light' ? 'transparent' : 'radial-gradient(ellipse at 50% 0%, #1a0e00 0%, #0e0e0e 50%)' }}>      <Navbar />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 48px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, ease }} style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 52, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.05 }}>
            Dashboard
          </h1>
          <p style={{ marginTop: 8, fontSize: 15, color: 'var(--text-muted)' }}>
            Welcome back, <span style={{ color: '#C9A84C', fontWeight: 600 }}>{user?.name}</span>. Here's your courtroom overview.
          </p>
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 20, background: 'rgba(74,154,106,.1)', border: '1px solid rgba(74,154,106,.25)' }}>
              <span className="animate-pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#4A9A6A', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#4A9A6A', fontFamily: 'Space Grotesk, sans-serif' }}>AI ACTIVE</span>
            </div>
            <motion.button onClick={() => nav('/demo')} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'Space Grotesk, sans-serif' }}>
              ▶ DEMO MODE
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18, marginBottom: 32 }}>
          {STATS_DATA.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .07, duration: .5, ease }}
              className="nyaya-stat-card hover-lift">
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 700, color: '#C9A84C', lineHeight: 1 }}>
                <AnimatedNumber value={s.value} suffix={s.suffix} />
              </div>
              <div style={{ marginTop: 10, letterSpacing: '0.1em', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Two col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

          {/* Case form */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2, duration: .6, ease }}
            className="nyaya-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>🏛️ Start New Case</h2>
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 600, background: 'rgba(201,168,76,.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.06em' }}>BNS / BNSS / BSA</span>
            </div>
            <FormField label="Case Type"><select value={form.case_type} onChange={sel('case_type')} className="nyaya-select">{CASE_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Court"><select value={form.court_level} onChange={sel('court_level')} className="nyaya-select">{COURTS.map(c => <option key={c}>{c}</option>)}</select></FormField>
              <FormField label="Role"><select value={form.role} onChange={sel('role')} className="nyaya-select">{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></FormField>
            </div>
            <FormField label="Difficulty"><select value={form.difficulty} onChange={sel('difficulty')} className="nyaya-select">{DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></FormField>

            {/* Agentic toggle */}
            <motion.div whileHover={{ borderColor: 'rgba(201,168,76,.35)' }} onClick={() => setForm(p => ({ ...p, agentic_judge: !p.agentic_judge }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', transition: 'background .2s, border-color .2s',
                background: form.agentic_judge ? 'rgba(201,168,76,.07)' : 'var(--surface)',
                border: `1px solid ${form.agentic_judge ? 'rgba(201,168,76,.3)' : 'var(--border-soft)'}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Agentic Judge Mode</div>
                <div style={{ fontSize: 12, marginTop: 2, color: 'var(--text-muted)' }}>Judge proactively interrupts & challenges</div>
              </div>
              <div style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: form.agentic_judge ? '#C9A84C' : 'var(--border-mid)', transition: 'background .25s', flexShrink: 0 }}>
                <motion.div animate={{ left: form.agentic_judge ? 22 : 2 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
              </div>
            </motion.div>

            <AnimatePresence>{err && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ fontSize: 13, color: '#E07070' }}>{err}</motion.p>}</AnimatePresence>

            <motion.button onClick={startCase} disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: .98 }}
              className="btn-gold" style={{ fontSize: 13, width: '100%', padding: '15px' }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                    Generating Case…
                  </span>
                : '⚖️  GENERATE CASE & PREPARE FOR TRIAL'}
            </motion.button>
          </motion.div>

          {/* Skill Radar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .25, duration: .6, ease }}
            className="nyaya-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>📊 Skill Radar</h2>
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 600, background: 'var(--surface)', color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}>5-AXIS</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas ref={radarRef} width={340} height={320} />
            </div>
          </motion.div>
        </div>

        {/* Badges */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .6, ease }}
          className="nyaya-card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>🏅 Badges</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
            {BADGES.map((b, i) => {
              const earned = earnedBadges.includes(b.id)
              return (
                <motion.div key={b.id} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .35 + i * .05, type: 'spring', stiffness: 300 }}
                  onHoverStart={() => setHoveredBadge(b.id)} onHoverEnd={() => setHoveredBadge(null)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', cursor: 'default' }}>
                  <MagneticCard>
                    <motion.div whileHover={{ scale: 1.12 }} transition={{ type: 'spring', stiffness: 400 }}
                      style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                        background: earned ? 'rgba(201,168,76,.15)' : 'var(--surface)',
                        border: `2px solid ${earned ? 'rgba(201,168,76,.65)' : 'var(--border-mid)'}`,
                        boxShadow: earned ? '0 0 24px rgba(201,168,76,.3)' : 'none',
                        filter: earned ? 'none' : 'grayscale(1) opacity(.4)',
                        transition: 'box-shadow .3s' }}>
                      {b.icon}
                    </motion.div>
                  </MagneticCard>
                  <div style={{ textAlign: 'center', lineHeight: 1.2, color: earned ? '#C9A84C' : 'var(--text-dim)', fontSize: 11, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}>{b.label}</div>
                  <AnimatePresence>
                    {hoveredBadge === b.id && (
                      <motion.div initial={{ opacity: 0, y: 4, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: .95 }} transition={{ duration: .15 }}
                        style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: 6, fontSize: 11, zIndex: 20, background: 'var(--bg3)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--text-secondary)', pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
                        {b.desc}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35, duration: .6, ease }}
          className="nyaya-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Sessions</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}>{recentSessions.length} sessions</span>
          </div>
          {recentSessions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 0', gap: 12 }}>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ fontSize: 40 }}>⚖️</motion.div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No sessions yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Generate a case above to start your first session</div>
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  {['Case', 'Role', 'Score', 'Grade', 'Bench Queries', 'Verdict'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 24px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s, i) => (
                  <motion.tr key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .04 }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'default' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 24px', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{s.case_title}</td>
                    <td style={{ padding: '14px 24px', fontSize: 12, textTransform: 'capitalize', fontWeight: 600, color: s.role === 'defence' ? '#7AB0D8' : '#E07070' }}>{s.role}</td>
                    <td style={{ padding: '14px 24px', fontWeight: 700, fontSize: 14, color: '#C9A84C' }}>{s.score ?? '—'}</td>
                    <td style={{ padding: '14px 24px', fontWeight: 700, fontSize: 14, color: '#6DBF8A' }}>{s.grade ?? '—'}</td>
                    <td style={{ padding: '14px 24px', fontSize: 14, color: '#8A8070' }}>{s.bench_queries}</td>
                    <td style={{ padding: '14px 24px', fontSize: 12, color: s.verdict ? '#C9A84C' : '#555' }}>{s.verdict ?? (s.status === 'active' ? '⚡ In Progress' : '—')}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, color: 'var(--text-muted)', fontSize: 11 }}>{label}</label>
      {children}
    </div>
  )
}

function drawRadar(canvas: HTMLCanvasElement | null, values: number[], theme: 'dark' | 'light' = 'dark') {
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const cx = canvas.width / 2, cy = canvas.height / 2
  const r = Math.min(cx, cy) - 48
  const n = 5
  const isLight = theme === 'light'
  const gridColor = isLight ? 'rgba(160,130,80,.25)' : 'rgba(255,255,255,.12)'
  const labelColor = isLight ? '#9a8060' : '#666'
  const fillColor = isLight ? 'rgba(201,168,76,.18)' : 'rgba(201,168,76,.15)'

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Grid rings
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      const rr = (ring / 4) * r
      i === 0 ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
    }
    ctx.closePath()
    ctx.strokeStyle = gridColor
    ctx.lineWidth = ring === 4 ? 1.5 : 1
    ctx.stroke()
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1; ctx.stroke()
  }

  // Labels
  const labels = ['Legal', 'Argument', 'Evidence', 'Procedure', 'Articulation']
  ctx.font = 'bold 13px Space Grotesk, sans-serif'; ctx.fillStyle = labelColor; ctx.textAlign = 'center'
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    ctx.fillText(labels[i], cx + (r + 34) * Math.cos(a), cy + (r + 34) * Math.sin(a) + 4)
  }

  // Data polygon
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const v = Math.max(0, Math.min(100, values[i] || 0))
    const rr = (v / 100) * r
    i === 0 ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
  }
  ctx.closePath()
  ctx.fillStyle = fillColor; ctx.fill()
  ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 2; ctx.stroke()

  // Dots
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const v = Math.max(0, Math.min(100, values[i] || 0))
    const rr = (v / 100) * r
    ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 4, 0, Math.PI * 2)
    ctx.fillStyle = '#C9A84C'; ctx.fill()
  }
}
