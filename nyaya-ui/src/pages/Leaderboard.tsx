import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { leaderboardApi } from '../api/client'
import Navbar from '../components/Navbar'

interface Entry {
  rank: number
  user_name: string
  college?: string
  avg_score: number
  sessions_count: number
  best_grade: string
}

const PODIUM_COLORS = ['#C9A84C', '#A8A8A8', '#CD7F32']
const PODIUM_LABELS = ['1st', '2nd', '3rd']
const PODIUM_HEIGHTS = [160, 120, 96]
const GRADE_COLORS: Record<string, string> = { A: '#6DBF8A', B: '#C9A84C', C: '#FFA500', D: '#E07070', F: '#E07070' }

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    leaderboardApi.get(20)
      .then(d => setEntries((d.entries as Entry[]) || []))
      .catch(() => setEntries(MOCK_ENTRIES))
      .finally(() => setLoading(false))
  }, [])

  const top3 = entries.slice(0, 3)

  return (
    <div style={{ minHeight: '100vh', background: '#111' }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 48px' }} className="lb-wrapper">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 40 }} className="lb-header">
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 52, color: '#E8E0D0', fontWeight: 700, lineHeight: 1.05 }}>Leaderboard</h1>
          <p style={{ marginTop: 8, color: '#666', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>Top performers across all NyayaAI courtroom sessions</p>
        </motion.div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#8A8070', fontFamily: 'DM Sans, sans-serif' }}>Loading rankings…</div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
                style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 20, marginBottom: 48 }}
                className="lb-podium">
                {[top3[1], top3[0], top3[2]].map((entry, idx) => {
                  if (!entry) return <div key={idx} style={{ width: 140 }} />
                  const realRank = idx === 0 ? 1 : idx === 1 ? 0 : 2
                  const color = PODIUM_COLORS[realRank]
                  const height = PODIUM_HEIGHTS[realRank]
                  const label = PODIUM_LABELS[realRank]
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, background: `${color}22`, border: `2px solid ${color}`, color }}>
                        {entry.user_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif' }}>{entry.user_name}</div>
                        {entry.college && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{entry.college}</div>}
                        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color }}>{entry.avg_score}</div>
                      </div>
                      <div style={{ width: 120, height, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
                        background: `linear-gradient(180deg, ${color}33, ${color}11)`, border: `1px solid ${color}44` }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 700, color }}>{label}</span>
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
              style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.07)', background: '#161616', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} className="lb-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    {['Rank', 'Name', 'College', 'Avg Score', 'Sessions', 'Top Grade'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '14px 28px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <motion.tr key={i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .03 }}
                      style={{ borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .15s' }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(201,168,76,.04)')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '16px 28px' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', color: i < 3 ? PODIUM_COLORS[i] : '#8A8070' }}>
                          #{e.rank || i + 1}
                        </span>
                      </td>
                      <td style={{ padding: '16px 28px', fontWeight: 600, fontSize: 14, color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif' }}>{e.user_name}</td>
                      <td style={{ padding: '16px 28px', fontSize: 13, color: '#666', fontFamily: 'DM Sans, sans-serif' }}>{e.college || '—'}</td>
                      <td style={{ padding: '16px 28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 100, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${e.avg_score}%`, background: 'linear-gradient(90deg,#C9A84C,#E8C96A)' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif' }}>{e.avg_score}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 28px', fontSize: 13, color: '#8A8070', fontFamily: 'DM Sans, sans-serif' }}>{e.sessions_count}</td>
                      <td style={{ padding: '16px 28px' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: GRADE_COLORS[e.best_grade?.[0]] || '#8A8070' }}>
                          {e.best_grade || '—'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '64px 0', fontSize: 14, color: '#555', fontFamily: 'DM Sans, sans-serif' }}>
                        No entries yet. Be the first!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}

const MOCK_ENTRIES: Entry[] = [
  { rank: 1, user_name: 'Aditi Sharma',  college: 'ADCET',           avg_score: 94, sessions_count: 12, best_grade: 'A'  },
  { rank: 2, user_name: 'Karan Mehta',   college: 'NLU Delhi',       avg_score: 88, sessions_count: 9,  best_grade: 'A-' },
  { rank: 3, user_name: 'Priya Nair',    college: 'GNLU',            avg_score: 82, sessions_count: 7,  best_grade: 'B+' },
  { rank: 4, user_name: 'Sneha Iyer',    college: 'GNLU Gandhinagar',avg_score: 79, sessions_count: 6,  best_grade: 'B+' },
  { rank: 5, user_name: 'Vikram Singh',  college: 'NLU Jodhpur',     avg_score: 75, sessions_count: 5,  best_grade: 'B'  },
]
