import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'
import Navbar from '../components/Navbar'

const ease = [0.16, 1, 0.3, 1] as const

type Tab = 'brief' | 'evidence' | 'witnesses' | 'laws' | 'notes'

const EMOJI_MAP: Record<string, string> = { fir: '📄', forensic: '🔬', cctv: '📹', witness: '👤', medical: '🏥', cdr: '📞' }
const ADM_COLOR: Record<string, string> = { admissible: '#4A9A6A', inadmissible: '#C05050', disputed: '#FFA500' }

export default function PreTrial() {
  const nav = useNavigate()
  const { caseData, role, difficulty, resetRuntime, theme } = useSession(
    useShallow(s => ({ caseData: s.caseData, role: s.role, difficulty: s.difficulty, resetRuntime: s.resetRuntime, theme: s.theme }))
  )
  const [tab, setTab] = useState<Tab>('brief')
  const [notes, setNotes] = useState('')
  const [highlights, setHighlights] = useState<Set<number>>(new Set())
  const [strategy, setStrategy] = useState('')
  const [ready, setReady] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  if (!caseData) { nav('/dashboard'); return null }

  const isLight = theme === 'light'

  // Theme-aware color tokens
  const bg        = isLight ? '#f5f3ee' : 'radial-gradient(ellipse at 50% 0%, #1a1000 0%, #0e0e0e 60%)'
  const cardBg    = isLight ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.03)'
  const cardBorder= isLight ? '1px solid rgba(0,0,0,.1)'  : '1px solid rgba(255,255,255,.07)'
  const textPrimary   = isLight ? '#1a1a1a' : '#E8E0D0'
  const textSecondary = isLight ? '#444'    : '#C8C0B0'
  const textMuted     = isLight ? '#666'    : '#8A8070'
  const tabBg     = isLight ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.03)'
  const tabBorder = isLight ? '1px solid rgba(0,0,0,.08)' : '1px solid rgba(255,255,255,.06)'
  const tabInactive   = isLight ? '#555' : '#555'
  const inputBg   = isLight ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.02)'
  const inputBorder   = isLight ? '1px solid rgba(0,0,0,.12)' : '1px solid rgba(255,255,255,.08)'
  const inputColor    = isLight ? '#1a1a1a' : '#E8E0D0'
  const backBtnColor  = isLight ? '#444' : '#555'
  const backBtnBorder = isLight ? '1px solid rgba(0,0,0,.15)' : '1px solid rgba(255,255,255,.08)'
  const sidebarDivider= isLight ? '1px solid rgba(0,0,0,.08)' : '1px solid rgba(255,255,255,.06)'

  const myColor = role === 'defence' ? '#6B8FD4' : '#D46B6B'
  const brief = role === 'defence' ? caseData.defense_brief : caseData.prosecution_brief

  const toggleHighlight = (i: number) =>
    setHighlights(h => { const n = new Set(h); n.has(i) ? n.delete(i) : n.add(i); return n })

  const enterCourt = () => { resetRuntime(); nav('/courtroom') }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'brief',     label: 'Case Brief',      icon: '📋' },
    { id: 'evidence',  label: 'Evidence',         icon: '🔍' },
    { id: 'witnesses', label: 'Witnesses',         icon: '👤' },
    { id: 'laws',      label: 'Applicable Laws',  icon: '⚖'  },
    { id: 'notes',     label: 'My Notes',          icon: '✏️' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: bg }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 48px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', padding: '4px 12px', borderRadius: 20,
                background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#B8922A', fontFamily: 'Space Grotesk, sans-serif' }}>
                PRE-TRIAL PREPARATION
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', padding: '4px 12px', borderRadius: 20,
                background: `${myColor}18`, border: `1px solid ${myColor}55`, color: myColor, fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                {role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'}
              </span>
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, color: textPrimary, fontWeight: 700, lineHeight: 1.1 }}>
              {caseData.case_title}
            </h1>
            <p style={{ marginTop: 6, fontSize: 13, color: textMuted, fontFamily: 'DM Sans, sans-serif' }}>
              {caseData.court} · {caseData.year} · {difficulty} mode
            </p>
          </div>
          <motion.button onClick={() => setReady(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e', border: 'none', boxShadow: '0 4px 24px rgba(201,168,76,.35)' }}>
            ⚖ ENTER COURTROOM
          </motion.button>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>

          {/* Main panel */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5, delay: .1, ease }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: tabBg, borderRadius: 12, padding: 4, border: tabBorder }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', transition: 'all .2s',
                    background: tab === t.id ? 'rgba(201,168,76,.18)' : 'transparent',
                    color: tab === t.id ? '#B8922A' : tabInactive,
                    boxShadow: tab === t.id ? '0 0 12px rgba(201,168,76,.15)' : 'none' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}>

                {/* BRIEF */}
                {tab === 'brief' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ borderRadius: 12, padding: 24, background: cardBg, border: cardBorder }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#B8922A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>BACKGROUND</div>
                      <p style={{ fontSize: 14, lineHeight: 1.8, color: textSecondary, fontFamily: 'DM Sans, sans-serif' }}>{caseData.background}</p>
                    </div>
                    <div style={{ borderRadius: 12, padding: 24, background: isLight ? `${myColor}0d` : `${myColor}08`, border: `1px solid ${myColor}33` }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: myColor, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>
                        YOUR BRIEF — {role === 'defence' ? 'DEFENCE' : 'PROSECUTION'}
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.8, color: textSecondary, fontFamily: 'DM Sans, sans-serif' }}>{brief}</p>
                    </div>
                    <div style={{ borderRadius: 12, padding: 24, background: cardBg, border: cardBorder }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: textMuted, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>KEY FACTS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {caseData.facts?.map((f: string, i: number) => (
                          <motion.div key={i} whileHover={{ x: 4 }} onClick={() => toggleHighlight(i)}
                            style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'background .2s',
                              background: highlights.has(i) ? 'rgba(201,168,76,.12)' : isLight ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.02)',
                              border: `1px solid ${highlights.has(i) ? 'rgba(201,168,76,.4)' : isLight ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'}` }}>
                            <span style={{ color: highlights.has(i) ? '#B8922A' : textMuted, fontSize: 13, flexShrink: 0 }}>{highlights.has(i) ? '★' : '○'}</span>
                            <span style={{ fontSize: 13, color: highlights.has(i) ? textPrimary : textSecondary, lineHeight: 1.5 }}>{f}</span>
                          </motion.div>
                        ))}
                      </div>
                      {highlights.size > 0 && <div style={{ marginTop: 8, fontSize: 11, color: '#B8922A', fontFamily: 'Space Grotesk, sans-serif' }}>★ {highlights.size} fact{highlights.size > 1 ? 's' : ''} highlighted</div>}
                    </div>
                    <div style={{ borderRadius: 12, padding: 24, background: cardBg, border: cardBorder }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: textMuted, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>CHARGES</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {caseData.charges?.map((c: { section: string; description: string }, i: number) => (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.2)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#B8922A', marginBottom: 2 }}>{c.section}</div>
                            <div style={{ fontSize: 13, color: textSecondary }}>{c.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* EVIDENCE */}
                {tab === 'evidence' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {caseData.evidence_items?.map((ev: { type: string; title: string; admissibility: string; content?: string }, i: number) => {
                      const admColor = ADM_COLOR[ev.admissibility] || '#666'
                      return (
                        <motion.div key={i} whileHover={{ y: -4 }}
                          style={{ borderRadius: 12, padding: 20, background: cardBg, border: `1px solid ${admColor}44`, transition: 'box-shadow .2s' }}>
                          <div style={{ fontSize: 28, marginBottom: 12 }}>{EMOJI_MAP[ev.type] || '📋'}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 6, lineHeight: 1.3 }}>{ev.title}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: admColor,
                            padding: '2px 8px', borderRadius: 4, background: `${admColor}18`, display: 'inline-block', marginBottom: 8 }}>
                            {ev.admissibility}
                          </div>
                          {ev.content && <p style={{ fontSize: 12, color: textMuted, lineHeight: 1.5, marginTop: 8 }}>{ev.content}</p>}
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* WITNESSES */}
                {tab === 'witnesses' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {caseData.key_witnesses?.map((w: { name: string; role: string; testimony_summary?: string }, i: number) => (
                      <motion.div key={i} whileHover={{ x: 4 }}
                        style={{ display: 'flex', gap: 16, padding: 20, borderRadius: 12, background: cardBg, border: cardBorder }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(74,122,176,.15)', border: '2px solid rgba(74,122,176,.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🧑</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 2 }}>{w.name}</div>
                          <div style={{ fontSize: 12, color: '#4A7AB0', marginBottom: 8 }}>{w.role}</div>
                          <p style={{ fontSize: 13, color: textSecondary, lineHeight: 1.6 }}>{w.testimony_summary}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* LAWS */}
                {tab === 'laws' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {caseData.legal_sections?.map((l: { code: string; section: string; title: string }, i: number) => {
                      const codeColor = l.code === 'BNS' ? '#B8922A' : l.code === 'BNSS' ? '#4A7AB0' : '#4A9A6A'
                      return (
                        <motion.div key={i} whileHover={{ y: -2 }}
                          style={{ padding: 16, borderRadius: 10, background: isLight ? `${codeColor}0d` : `${codeColor}08`, border: `1px solid ${codeColor}33` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '2px 8px', borderRadius: 4,
                              background: `${codeColor}22`, color: codeColor, fontFamily: 'Space Grotesk, sans-serif' }}>{l.code}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: codeColor }}>§{l.section}</span>
                          </div>
                          <div style={{ fontSize: 13, color: textPrimary, fontWeight: 600 }}>{l.title}</div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* NOTES */}
                {tab === 'notes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ borderRadius: 12, padding: 20, background: cardBg, border: cardBorder }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: textMuted, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>ARGUMENT STRATEGY</div>
                      <textarea ref={notesRef} value={strategy} onChange={e => setStrategy(e.target.value)}
                        placeholder={`Plan your ${role === 'defence' ? 'defence' : 'prosecution'} strategy here…`}
                        rows={6}
                        style={{ width: '100%', background: inputBg, border: inputBorder, borderRadius: 8, color: inputColor,
                          fontSize: 14, padding: '12px 14px', outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }} />
                    </div>
                    <div style={{ borderRadius: 12, padding: 20, background: cardBg, border: cardBorder }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: textMuted, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>QUICK NOTES</div>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Jot down anything — key dates, names, section numbers…"
                        rows={8}
                        style={{ width: '100%', background: inputBg, border: inputBorder, borderRadius: 8, color: inputColor,
                          fontSize: 13, padding: '12px 14px', outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }} />
                    </div>
                    {(notes || strategy) && (
                      <div style={{ fontSize: 11, color: '#4A9A6A', fontFamily: 'Space Grotesk, sans-serif' }}>
                        ✓ Notes saved locally
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Right sidebar */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5, delay: .15, ease }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Case card */}
            <div style={{ borderRadius: 12, padding: 20, background: cardBg, border: cardBorder }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: textMuted, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>CASE OVERVIEW</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Court',    value: caseData.court },
                  { label: 'Year',     value: caseData.year },
                  { label: 'Type',     value: caseData.case_type },
                  { label: 'Duration', value: caseData.estimated_duration },
                  { label: 'Difficulty', value: difficulty },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: textMuted }}>{r.label}</span>
                    <span style={{ color: textPrimary, fontWeight: 600, textTransform: 'capitalize' }}>{r.value}</span>
                  </div>
                ))}
                {caseData.based_on && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: sidebarDivider }}>
                    <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#B8922A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>BASED ON</div>
                    <div style={{ fontSize: 11, color: textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>{caseData.based_on}</div>
                  </div>
                )}
                {caseData.judge_archetype && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#B8922A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>JUDGE ARCHETYPE</div>
                    <div style={{ fontSize: 12, color: textPrimary, fontWeight: 700 }}>{caseData.judge_archetype}</div>
                    {caseData.judge_archetype_description && (
                      <div style={{ fontSize: 11, color: textSecondary, lineHeight: 1.4, marginTop: 2 }}>{caseData.judge_archetype_description}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Learning objectives */}
            <div style={{ borderRadius: 12, padding: 20, background: cardBg, border: cardBorder }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: textMuted, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>LEARNING OBJECTIVES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {caseData.learning_objectives?.map((o: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                    <span style={{ color: '#B8922A', flexShrink: 0 }}>→</span> {o}
                  </div>
                ))}
              </div>
            </div>

            {/* Highlighted facts */}
            {highlights.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}
                style={{ borderRadius: 12, padding: 20, background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.25)' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#B8922A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>★ HIGHLIGHTED FACTS ({highlights.size})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.from(highlights).map(i => (
                    <div key={i} style={{ fontSize: 12, color: textSecondary, lineHeight: 1.4, paddingLeft: 8, borderLeft: '2px solid rgba(201,168,76,.5)' }}>
                      {caseData.facts?.[i]}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.button onClick={() => setReady(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
              style={{ width: '100%', padding: '16px 0', borderRadius: 12, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700, fontSize: 14, letterSpacing: '0.1em',
                background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e', border: 'none', boxShadow: '0 4px 24px rgba(201,168,76,.3)' }}>
              ⚖ ENTER COURTROOM
            </motion.button>
            <button onClick={() => nav('/dashboard')}
              style={{ width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 13, color: backBtnColor, background: 'transparent', border: backBtnBorder }}>
              ← Back to Dashboard
            </button>
          </motion.div>
        </div>
      </div>

      {/* Ready modal */}
      <AnimatePresence>
        {ready && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: .88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .88, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ maxWidth: 440, width: '90%', borderRadius: 20, padding: 36, background: 'rgba(8,12,24,.98)',
                border: '1px solid rgba(201,168,76,.3)', backdropFilter: 'blur(20px)', textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,.9)' }}>
              <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: 48, marginBottom: 16 }}>⚖</motion.div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, color: '#C9A84C', marginBottom: 8 }}>All Rise</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, marginBottom: 28 }}>
                You are about to enter the courtroom as <strong style={{ color: '#E8E0D0' }}>{role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'}</strong>.<br />
                The session will begin immediately.
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setReady(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)',
                    color: 'rgba(255,255,255,.5)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}>
                  Not Yet
                </button>
                <motion.button onClick={enterCourt} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                  style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em',
                    background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e', boxShadow: '0 4px 20px rgba(201,168,76,.4)' }}>
                  ⚖ Enter Courtroom
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
