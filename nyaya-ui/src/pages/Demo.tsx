import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { courtroomApi, type DemoTurn } from '../api/client'

type Status = 'idle' | 'loading' | 'playing' | 'done'

const SPEAKER_STYLE: Record<string, { color: string; label: string; icon: string; align: 'left' | 'right' | 'center' }> = {
  system:      { color: '#8A8070', label: 'Court',        icon: '🏛️', align: 'center' },
  judge:       { color: '#C9A84C', label: 'Justice R.K. Krishnamurthy', icon: '⚖', align: 'center' },
  prosecution: { color: '#D46B6B', label: 'Public Prosecutor', icon: '⚡', align: 'right' },
  defence:     { color: '#6B8FD4', label: 'Defence Counsel',   icon: '🛡', align: 'left' },
  objection:   { color: '#FF8C42', label: 'OBJECTION',    icon: '✋', align: 'center' },
  verdict:     { color: '#4A9A6A', label: 'VERDICT',      icon: '🔨', align: 'center' },
}

const CASE_TYPES = ['murder', 'theft', 'cheating', 'bail', 'sexual_assault']

export default function Demo() {
  const nav = useNavigate()
  const [status, setStatus] = useState<Status>('idle')
  const [caseType, setCaseType] = useState('murder')
  const [script, setScript] = useState<{ case_title: string; case_summary: string; turns: DemoTurn[] } | null>(null)
  const [visibleTurns, setVisibleTurns] = useState<DemoTurn[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [objOverlay, setObjOverlay] = useState<{ text: string; ruling: string } | null>(null)
  const [verdictOverlay, setVerdictOverlay] = useState<{ text: string; verdict: string } | null>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const clearTimeouts = () => { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current = [] }

  const loadScript = async () => {
    setStatus('loading')
    try {
      const res = await courtroomApi.getDemoScript(caseType)
      setScript(res)
      setStatus('idle')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to load demo script')
      setStatus('idle')
    }
  }

  const startDemo = () => {
    if (!script) return
    setVisibleTurns([])
    setCurrentIdx(0)
    setObjOverlay(null)
    setVerdictOverlay(null)
    setStatus('playing')
    clearTimeouts()

    script.turns.forEach((turn, i) => {
      const t = setTimeout(() => {
        setVisibleTurns(prev => [...prev, turn])
        setCurrentIdx(i)
        if (turn.speaker === 'objection' && turn.ruling) {
          setObjOverlay({ text: turn.text, ruling: turn.ruling })
          const t2 = setTimeout(() => setObjOverlay(null), 2500)
          timeoutsRef.current.push(t2)
        }
        if (turn.speaker === 'verdict' && turn.verdict) {
          const t3 = setTimeout(() => setVerdictOverlay({ text: turn.text, verdict: turn.verdict! }), 600)
          timeoutsRef.current.push(t3)
        }
        if (i === script.turns.length - 1) {
          const t4 = setTimeout(() => setStatus('done'), 2000)
          timeoutsRef.current.push(t4)
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, turn.delay)
      timeoutsRef.current.push(t)
    })
  }

  const stopDemo = () => { clearTimeouts(); setStatus('idle'); setVisibleTurns([]); setObjOverlay(null); setVerdictOverlay(null) }

  useEffect(() => () => clearTimeouts(), [])

  return (
    <div style={{ minHeight: '100vh', background: '#080a10', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.7)', borderBottom: '1px solid rgba(255,255,255,.06)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.08em' }}>
            NYAYA<span style={{ color: '#E8E0D0' }}>AI</span>
          </span>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>DEMO MODE</span>
          {status === 'playing' && (
            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'rgba(212,60,60,.15)', border: '1px solid rgba(212,60,60,.3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF4444', display: 'block' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#FF6666', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.1em' }}>LIVE DEMO</span>
            </motion.div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {status === 'playing' && (
            <button onClick={stopDemo} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,107,107,.4)', color: '#E07070', background: 'rgba(212,107,107,.1)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
              ■ Stop
            </button>
          )}
          <button onClick={() => nav('/dashboard')} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
            ← Dashboard
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 900, margin: '0 auto', width: '100%', padding: '32px 24px', gap: 24 }}>

        {/* Controls */}
        {status !== 'playing' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ borderRadius: 14, padding: 24, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
            className="demo-controls">
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>CASE TYPE</div>
              <select value={caseType} onChange={e => { setCaseType(e.target.value); setScript(null) }}
                style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#E8E0D0', fontSize: 13, padding: '8px 12px', outline: 'none', cursor: 'pointer' }}>
                {CASE_TYPES.map(t => <option key={t} value={t} style={{ background: '#0A0F1E' }}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 20 }}>
              <motion.button onClick={loadScript} disabled={status === 'loading'} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(201,168,76,.35)', color: '#C9A84C', background: 'rgba(201,168,76,.08)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13 }}>
                {status === 'loading' ? '⏳ Loading…' : '⟳ Generate Script'}
              </motion.button>
              {script && (
                <motion.button onClick={startDemo} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
                    background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e', boxShadow: '0 4px 20px rgba(201,168,76,.3)' }}>
                  ▶ Start Auto-Play
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Script preview */}
        {script && status === 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ borderRadius: 10, padding: '14px 18px', background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C', marginBottom: 4, fontFamily: 'Cormorant Garamond, serif' }}>{script.case_title}</div>
            <div style={{ fontSize: 12, color: '#8A8070' }}>{script.case_summary} · {script.turns.length} turns</div>
          </motion.div>
        )}

        {/* Transcript */}
        {(status === 'playing' || status === 'done' || visibleTurns.length > 0) && (
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', paddingRight: 4 }}>
            <AnimatePresence>
              {visibleTurns.map((turn, i) => {
                const style = SPEAKER_STYLE[turn.speaker] || SPEAKER_STYLE.system
                const isCenter = style.align === 'center'
                const isRight = style.align === 'right'
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    style={{ display: 'flex', justifyContent: isCenter ? 'center' : isRight ? 'flex-end' : 'flex-start' }}>
                    {isCenter ? (
                      <div style={{ maxWidth: 560, textAlign: 'center', padding: '12px 20px', borderRadius: 10,
                        background: turn.speaker === 'verdict' ? `${style.color}18` : turn.speaker === 'objection' ? 'rgba(255,140,66,.1)' : 'rgba(255,255,255,.04)',
                        border: `1px solid ${style.color}33` }}>
                        <div style={{ fontSize: 10, letterSpacing: '0.15em', color: style.color, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>{style.icon} {style.label}</div>
                        <div style={{ fontSize: 14, color: '#E8E0D0', lineHeight: 1.6, fontFamily: turn.speaker === 'judge' ? 'Cormorant Garamond, serif' : 'DM Sans, sans-serif', fontStyle: turn.speaker === 'judge' ? 'italic' : 'normal' }}>{turn.text}</div>
                        {turn.ruling && <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: turn.ruling === 'Sustained' ? '#4A9A6A' : '#D46B6B' }}>{turn.ruling}</div>}
                      </div>
                    ) : (
                      <div style={{ maxWidth: 480, padding: '12px 16px', borderRadius: 12,
                        background: `${style.color}12`, border: `1px solid ${style.color}33`,
                        borderBottomLeftRadius: isRight ? 12 : 4, borderBottomRightRadius: isRight ? 4 : 12 }}>
                        <div style={{ fontSize: 9, letterSpacing: '0.12em', color: style.color, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>{style.icon} {style.label}</div>
                        <div style={{ fontSize: 14, color: '#E8E0D0', lineHeight: 1.6, fontFamily: 'DM Sans, sans-serif' }}>{turn.text}</div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Typing indicator */}
            {status === 'playing' && currentIdx < (script?.turns.length ?? 0) - 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: 8 }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: .6, repeat: Infinity, delay: i * .15 }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }} />
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Done state */}
        {status === 'done' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#C9A84C' }}>Demo Complete</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button onClick={startDemo} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 13,
                  background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e' }}>
                ↺ Replay
              </motion.button>
              <motion.button onClick={() => { setScript(null); setStatus('idle'); setVisibleTurns([]) }} whileHover={{ scale: 1.03 }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
                New Script
              </motion.button>
              <motion.button onClick={() => nav('/dashboard')} whileHover={{ scale: 1.03 }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(201,168,76,.3)', color: '#C9A84C', background: 'rgba(201,168,76,.08)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
                Try Live →
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Objection overlay */}
      <AnimatePresence>
        {objOverlay && (
          <motion.div initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 60, textAlign: 'center', borderRadius: 16, padding: '28px 52px',
              background: 'rgba(10,6,2,.96)', border: '1px solid rgba(255,140,66,.4)', backdropFilter: 'blur(16px)', boxShadow: '0 32px 80px rgba(0,0,0,.9)' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#555', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>OBJECTION</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#FF8C42', marginBottom: 10 }}>{objOverlay.text}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 48, fontWeight: 700, color: objOverlay.ruling === 'Sustained' ? '#6DBF8A' : '#E07070' }}>{objOverlay.ruling}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verdict overlay */}
      <AnimatePresence>
        {verdictOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: .8, y: 24 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              style={{ textAlign: 'center', padding: '48px 64px', borderRadius: 20, background: 'rgba(8,12,24,.98)', border: '1px solid rgba(74,154,106,.3)', boxShadow: '0 40px 100px rgba(0,0,0,.95)' }}>
              <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 1.5, repeat: 2 }} style={{ fontSize: 48, marginBottom: 16 }}>🔨</motion.div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#8A8070', marginBottom: 8 }}>The Court Finds</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 52, fontWeight: 700, color: '#4A9A6A', marginBottom: 16 }}>{verdictOverlay.verdict}</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', maxWidth: 400, lineHeight: 1.6, fontFamily: 'DM Sans, sans-serif' }}>{verdictOverlay.text}</p>
              <motion.button onClick={() => setVerdictOverlay(null)} whileHover={{ scale: 1.03 }}
                style={{ marginTop: 24, padding: '10px 28px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
                Continue
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
