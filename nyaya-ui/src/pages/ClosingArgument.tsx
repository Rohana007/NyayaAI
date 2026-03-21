import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { courtroomApi } from '../api/client'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'

type Phase = 'write' | 'loading' | 'verdict'

interface VerdictData {
  opposing_closing: string
  judge_verdict_speech: string
  verdict: string
  verdict_reasoning: string
  key_finding: string
  sentence_or_order: string
  grade: string
  overall_score: number
}

const VERDICT_COLOR: Record<string, string> = {
  'Acquitted': '#4A9A6A',
  'Convicted': '#D46B6B',
  'Partially Convicted': '#C9A84C',
  'Bail Granted': '#4A7AB0',
  'Bail Denied': '#D46B6B',
  'Case Dismissed': '#8A8070',
}

export default function ClosingArgument() {
  const nav = useNavigate()
  const { sessionId, caseData, role, user } = useSession(
    useShallow(s => ({ sessionId: s.sessionId, caseData: s.caseData, role: s.role, user: s.user }))
  )
  const [phase, setPhase] = useState<Phase>('write')
  const [closing, setClosing] = useState('')
  const [verdict, setVerdict] = useState<VerdictData | null>(null)
  const [err, setErr] = useState('')
  const [stampVisible, setStampVisible] = useState(false)

  if (!caseData || !sessionId) { nav('/dashboard'); return null }

  const myColor = role === 'defence' ? '#6B8FD4' : '#D46B6B'
  const oppName = role === 'defence' ? 'Adv. Priya Sharma (Prosecution)' : 'Adv. Rajan Mehta (Defence)'

  const submit = async () => {
    if (!closing.trim()) return
    setPhase('loading')
    setErr('')
    try {
      const res = await courtroomApi.submitClosing(sessionId, closing)
      setVerdict(res)
      setPhase('verdict')
      setTimeout(() => setStampVisible(true), 1800)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed')
      setPhase('write')
    }
  }

  const verdictColor = verdict ? (VERDICT_COLOR[verdict.verdict] || '#C9A84C') : '#C9A84C'
  const gradeColor = verdict ? ({ A: '#6DBF8A', B: '#C9A84C', C: '#FFA500', D: '#E07070', F: '#E07070' }[verdict.grade?.[0]] || '#8A8070') : '#8A8070'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.6)', borderBottom: '1px solid rgba(255,255,255,.06)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.08em' }}>
          NYAYA<span style={{ color: '#E8E0D0' }}>AI</span>
          <span style={{ marginLeft: 12, fontSize: 11, color: '#555', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.15em' }}>CLOSING ARGUMENTS</span>
        </span>
        <button onClick={() => nav('/courtroom')}
          style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
          ← Back to Court
        </button>
      </div>

      <div style={{ flex: 1, maxWidth: 860, margin: '0 auto', width: '100%', padding: '40px 24px' }}>

        {/* WRITE PHASE */}
        {phase === 'write' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>FINAL PHASE</div>
              <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 44, color: '#E8E0D0', fontWeight: 700, lineHeight: 1.1 }}>Closing Argument</h1>
              <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>{caseData.case_title}</p>
            </div>

            {/* Case summary reminder */}
            <div style={{ borderRadius: 12, padding: 20, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>CHARGES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {caseData.charges?.map((c: { section: string }, i: number) => (
                  <span key={i} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif' }}>{c.section}</span>
                ))}
              </div>
            </div>

            {/* Writing area */}
            <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${myColor}33`, background: 'rgba(6,8,18,.8)' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${myColor}22`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${myColor}22`, border: `1.5px solid ${myColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {role === 'defence' ? '👨‍⚖️' : '⚖'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif' }}>{user?.name ? `Adv. ${user.name}` : 'Adv. [You]'}</div>
                  <div style={{ fontSize: 10, color: myColor, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'} — Closing Argument
                  </div>
                </div>
              </div>
              <textarea value={closing} onChange={e => setClosing(e.target.value)}
                placeholder={`My Lord, in closing, the ${role === 'defence' ? 'defence' : 'prosecution'} submits that…\n\nCite relevant BNS/BNSS/BSA sections, summarise your strongest evidence, and make your final plea.`}
                rows={12}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#E8E0D0', fontSize: 15, padding: '20px', outline: 'none', resize: 'none', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.75 }} />
              <div style={{ padding: '10px 20px', borderTop: `1px solid ${myColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>{closing.length} characters</span>
                <span style={{ fontSize: 11, color: closing.length > 200 ? '#4A9A6A' : '#555', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {closing.length > 200 ? '✓ Good length' : 'Aim for 200+ characters'}
                </span>
              </div>
            </div>

            {err && <div style={{ fontSize: 13, color: '#E07070', textAlign: 'center' }}>{err}</div>}

            <motion.button onClick={submit} disabled={closing.trim().length < 20} whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
              style={{ width: '100%', padding: '18px 0', borderRadius: 12, border: 'none', cursor: closing.trim().length < 20 ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '0.1em',
                background: closing.trim().length < 20 ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg, #C9A84C, #E8C96A)',
                color: closing.trim().length < 20 ? '#444' : '#0e0e0e',
                boxShadow: closing.trim().length >= 20 ? '0 4px 24px rgba(201,168,76,.35)' : 'none' }}>
              ⚖ SUBMIT CLOSING ARGUMENT
            </motion.button>
          </motion.div>
        )}

        {/* LOADING PHASE */}
        {phase === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{ fontSize: 56 }}>⚖</motion.div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: '#C9A84C' }}>The Court is Deliberating</div>
            <div style={{ fontSize: 13, color: '#555', fontFamily: 'DM Sans, sans-serif' }}>Justice Krishnamurthy is reviewing all arguments…</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ opacity: [.3, 1, .3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * .4 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A84C' }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* VERDICT PHASE */}
        {phase === 'verdict' && verdict && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Formal judgment document */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .2 }}
              style={{ borderRadius: 16, overflow: 'hidden', background: '#F5F0E8', boxShadow: '0 32px 80px rgba(0,0,0,.8)', position: 'relative' }}
              className="closing-doc">

              {/* Stamp */}
              <AnimatePresence>
                {stampVisible && (
                  <motion.div initial={{ scale: 3, opacity: 0, rotate: -15 }} animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    style={{ position: 'absolute', top: 40, right: 40, zIndex: 10, width: 120, height: 120, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `4px solid ${verdictColor}`, background: `${verdictColor}18`, boxShadow: `0 0 0 2px ${verdictColor}44` }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', color: verdictColor, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.2 }}>
                        {verdict.verdict.toUpperCase()}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Document header */}
              <div style={{ padding: '32px 40px 20px', borderBottom: '2px solid #D4C9A8', textAlign: 'center' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>IN THE {caseData.court?.toUpperCase()}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{caseData.case_title}</div>
                <div style={{ fontSize: 12, color: '#8A7A5A', fontFamily: 'DM Sans, sans-serif' }}>
                  {caseData.charges?.map((c: { section: string }) => c.section).join(' · ')}
                </div>
              </div>

              {/* Opposing closing */}
              <div style={{ padding: '20px 40px', borderBottom: '1px solid #D4C9A8' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>{oppName} — CLOSING</div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: '#2A2A2A', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic' }}>"{verdict.opposing_closing}"</p>
              </div>

              {/* Judge verdict speech */}
              <div style={{ padding: '20px 40px', borderBottom: '1px solid #D4C9A8', background: 'rgba(201,168,76,.06)' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>HON. JUSTICE R.K. KRISHNAMURTHY</div>
                <p style={{ fontSize: 15, lineHeight: 1.8, color: '#1A1A1A', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>"{verdict.judge_verdict_speech}"</p>
              </div>

              {/* Verdict block */}
              <div style={{ padding: '24px 40px', borderBottom: '1px solid #D4C9A8' }} className="closing-doc">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="closing-doc-verdict">
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6 }}>VERDICT</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 700, color: verdictColor }}>{verdict.verdict}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6 }}>ORDER / SENTENCE</div>
                    <div style={{ fontSize: 13, color: '#2A2A2A', lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>{verdict.sentence_or_order}</div>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div style={{ padding: '20px 40px', borderBottom: '1px solid #D4C9A8' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>REASONING</div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: '#2A2A2A', fontFamily: 'DM Sans, sans-serif' }}>{verdict.verdict_reasoning}</p>
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif' }}>KEY FINDING: </span>
                  <span style={{ fontSize: 13, color: '#2A2A2A', fontFamily: 'DM Sans, sans-serif' }}>{verdict.key_finding}</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: '#8A7A5A', fontFamily: 'DM Sans, sans-serif' }}>
                  Decided under BNS / BNSS / BSA · NyayaAI Simulation
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#8A7A5A', fontFamily: 'Space Grotesk, sans-serif' }}>STUDENT GRADE</div>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: gradeColor }}>{verdict.grade}</div>
                </div>
              </div>
            </motion.div>

            {/* Score summary */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="closing-verdict-grid">
              {[
                { label: 'Overall Score', value: `${verdict.overall_score}/100`, color: '#C9A84C' },
                { label: 'Grade', value: verdict.grade, color: gradeColor },
                { label: 'Verdict', value: verdict.verdict, color: verdictColor },
              ].map(s => (
                <div key={s.label} style={{ borderRadius: 10, padding: '16px 20px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: s.color, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>{s.label}</div>
                </div>
              ))}
            </motion.div>

            {/* Actions */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .7 }}
              style={{ display: 'flex', gap: 12 }} className="closing-actions">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
                onClick={() => nav('/evaluation')}
                style={{ flex: 2, padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em',
                  background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e', boxShadow: '0 4px 20px rgba(201,168,76,.3)' }}>
                📊 Full Evaluation Report
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
                onClick={() => nav('/dashboard')}
                style={{ flex: 1, padding: '14px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
                ← Dashboard
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
