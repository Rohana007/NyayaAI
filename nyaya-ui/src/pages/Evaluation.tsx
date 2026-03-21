import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { evaluationApi, type EvaluationData } from '../api/client'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'
import Navbar from '../components/Navbar'

const SCORE_LABELS: Record<string, string> = {
  logic: 'Legal Logic', clarity: 'Clarity', proc: 'Procedure',
  cite: 'Citations', reb: 'Rebuttal',
  legal_accuracy: 'Legal Accuracy', argument_structure: 'Argument Structure',
  evidence_usage: 'Evidence Usage', procedural_compliance: 'Procedural Compliance',
  articulation: 'Articulation',
}

const gradeColor = (g: string) =>
  ({ A: '#6DBF8A', B: '#C9A84C', C: '#FFA500', D: '#E07070', F: '#E07070' }[g?.[0]] || '#8A8070')

export default function Evaluation() {
  const nav = useNavigate()
  const { sessionId, user, clearSession } = useSession(useShallow(s => ({ sessionId: s.sessionId, user: s.user, clearSession: s.clearSession })))
  const [data, setData] = useState<EvaluationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!sessionId) { nav('/dashboard'); return }
    setLoading(true)
    evaluationApi.get(sessionId)
      .then(setData)
      .catch(() =>
        evaluationApi.generate(sessionId)
          .then(setData)
          .catch(e => setErr(e.message))
      )
      .finally(() => setLoading(false))
  }, [sessionId])

  if (!user) { nav('/'); return null }

  const strengths = data?.feedback_points?.filter(f => f.type === 'strength') || []
  const weaknesses = data?.feedback_points?.filter(f => f.type !== 'strength') || []

  return (
    <div style={{ minHeight: '100vh', background: '#111' }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 48px' }} className="eval-wrapper">
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '128px 0', gap: 16 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #C9A84C', borderTopColor: 'transparent' }} />
            <div style={{ fontSize: 13, color: '#8A8070' }}>Loading evaluation…</div>
          </div>
        )}
        {err && <div style={{ textAlign: 'center', padding: '80px 0', fontSize: 13, color: '#E07070' }}>{err}</div>}

        {data && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, color: '#E8E0D0', fontWeight: 700 }}>Session Evaluation</h1>
              <p className="mt-1 text-sm" style={{ color: '#666' }}>BNS / BNSS / BSA compliant assessment</p>
            </div>

            {/* Hero score card */}
            <div className="nyaya-card flex items-center gap-8 eval-hero">
              {/* Big score */}
              <div className="text-center flex-shrink-0">
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 72, color: '#C9A84C', lineHeight: 1 }}>{data.overall_score}</div>
                <div className="text-xs tracking-widest mt-1" style={{ color: '#555' }}>OVERALL SCORE</div>
                <div className="mt-2 inline-block px-4 py-1 rounded-sm font-bold text-2xl"
                  style={{ color: gradeColor(data.grade), background: `${gradeColor(data.grade)}18`, border: `1px solid ${gradeColor(data.grade)}44` }}>
                  {data.grade}
                </div>
              </div>

              <div className="flex-1 border-l pl-8" style={{ borderColor: 'rgba(255,255,255,.07)' }}>
                <div className="font-serif text-lg mb-2" style={{ color: '#C9A84C' }}>{data.verdict}</div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#8A8070' }}>{data.verdict_reasoning}</p>
                <div className="flex gap-5 text-xs">
                  <div>
                    <div className="text-xs tracking-widest uppercase mb-0.5" style={{ color: '#555' }}>Bench Queries</div>
                    <div className="font-bold text-base" style={{ color: '#C9A84C' }}>{data.bench_queries_faced}</div>
                  </div>
                  <div>
                    <div className="text-xs tracking-widest uppercase mb-0.5" style={{ color: '#555' }}>Bias Audit</div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm" style={{ color: data.bias_audit?.passed ? '#6DBF8A' : '#E07070' }}>
                        {data.bias_audit?.passed ? 'PASSED' : 'FAILED'}
                      </span>
                      {data.bias_audit?.passed && (
                        <span className="text-xs px-1.5 py-0.5 rounded-sm font-bold"
                          style={{ background: 'rgba(74,154,106,.2)', color: '#6DBF8A', border: '1px solid rgba(74,154,106,.3)' }}>✓</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="nyaya-card">
              <h2 className="font-serif text-lg mb-5" style={{ color: '#E8E0D0' }}>Score Breakdown</h2>
              <div className="flex flex-col gap-4">
                {Object.entries(data.scores).map(([k, v], i) => (
                  <div key={k} className="flex items-center gap-4">
                    <span className="text-sm w-44 flex-shrink-0" style={{ color: '#8A8070' }}>
                      {SCORE_LABELS[k] || k.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg,#C9A84C,#E8C96A)' }}
                        initial={{ width: 0 }} animate={{ width: `${v}%` }}
                        transition={{ duration: .8, delay: i * .08 }} />
                    </div>
                    <span className="text-sm font-bold w-10 text-right" style={{ color: '#C9A84C' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths + Weaknesses */}
            <div className="grid grid-cols-2 gap-4 eval-sw-grid">
              <div className="nyaya-card">
                <h2 className="font-serif text-base mb-4 flex items-center gap-2" style={{ color: '#6DBF8A' }}>
                  <span>✓</span> Strengths
                </h2>
                {strengths.length === 0 && <p className="text-xs" style={{ color: '#555' }}>No strengths recorded.</p>}
                <div className="flex flex-col gap-3">
                  {strengths.map((f, i) => (
                    <div key={i} className="p-3 rounded-sm border text-xs"
                      style={{ background: 'rgba(74,154,106,.06)', borderColor: 'rgba(74,154,106,.2)' }}>
                      <div className="font-semibold mb-1" style={{ color: '#6DBF8A' }}>{f.point}</div>
                      <div style={{ color: '#8A8070' }}>{f.legal_basis}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="nyaya-card">
                <h2 className="font-serif text-base mb-4 flex items-center gap-2" style={{ color: '#E07070' }}>
                  <span>✗</span> Weaknesses
                </h2>
                {weaknesses.length === 0 && <p className="text-xs" style={{ color: '#555' }}>No weaknesses recorded.</p>}
                <div className="flex flex-col gap-3">
                  {weaknesses.map((f, i) => (
                    <div key={i} className="p-3 rounded-sm border text-xs"
                      style={{ background: 'rgba(192,80,80,.06)', borderColor: 'rgba(192,80,80,.2)' }}>
                      <div className="font-semibold mb-1" style={{ color: '#E07070' }}>{f.point}</div>
                      <div style={{ color: '#8A8070' }}>{f.legal_basis}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Verdict Reasoning card */}
            <div className="nyaya-card">
              <h2 className="font-serif text-base mb-3" style={{ color: '#E8E0D0' }}>Verdict Reasoning</h2>
              <p className="text-sm leading-relaxed" style={{ color: '#8A8070' }}>{data.verdict_reasoning}</p>
            </div>

            {/* Bias Audit card */}
            <div className="nyaya-card flex items-start gap-5">
              <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl"
                style={{ background: data.bias_audit?.passed ? 'rgba(74,154,106,.15)' : 'rgba(192,80,80,.15)', border: `2px solid ${data.bias_audit?.passed ? 'rgba(74,154,106,.4)' : 'rgba(192,80,80,.4)'}` }}>
                {data.bias_audit?.passed ? '✓' : '✗'}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-serif text-base" style={{ color: '#E8E0D0' }}>Bias Audit</h2>
                  <span className="text-xs px-2 py-0.5 rounded-sm font-bold tracking-widest"
                    style={{ background: data.bias_audit?.passed ? 'rgba(74,154,106,.2)' : 'rgba(192,80,80,.2)', color: data.bias_audit?.passed ? '#6DBF8A' : '#E07070', border: `1px solid ${data.bias_audit?.passed ? 'rgba(74,154,106,.4)' : 'rgba(192,80,80,.4)'}` }}>
                    {data.bias_audit?.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <p className="text-sm" style={{ color: '#8A8070' }}>{data.bias_audit?.note || 'No bias detected in your arguments.'}</p>
              </div>
            </div>

            {/* Next steps */}
            {data.next_steps?.length > 0 && (
              <div className="nyaya-card">
                <h2 className="font-serif text-base mb-4" style={{ color: '#E8E0D0' }}>Next Steps</h2>
                <div className="flex flex-col gap-2">
                  {data.next_steps.map((s, i) => (
                    <div key={i} className="flex gap-3 text-sm" style={{ color: '#8A8070' }}>
                      <span style={{ color: '#C9A84C', flexShrink: 0 }}>→</span> {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 closing-actions">
              <button onClick={() => { clearSession(); nav('/dashboard') }} className="btn-gold flex-1">
                ← New Case
              </button>
              <button onClick={() => nav('/leaderboard')} className="btn-outline flex-1">
                🏆 Leaderboard
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
