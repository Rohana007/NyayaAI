import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'
import type { EvidenceItem } from '../api/client'

const EMOJI_MAP: Record<string, string> = { fir: '📄', forensic: '🔬', cctv: '📹', witness: '👤', medical: '🏥', cdr: '📞' }
const CATEGORIES = ['fir', 'forensic', 'cctv', 'witness', 'medical', 'cdr', 'other']

const CARD_COLORS = ['#F5F0E8', '#FFF8E7', '#F0F5E8', '#EEF0F8', '#F8EEF0']

export default function EvidenceBoard() {
  const nav = useNavigate()
  const { caseData } = useSession(useShallow(s => ({ caseData: s.caseData })))
  const [logged, setLogged] = useState<EvidenceItem[]>([])
  const [form, setForm] = useState({ title: '', type: 'fir', content: '' })

  const allEvidence = [...(caseData?.evidence_items || []), ...logged]

  const pinEvidence = () => {
    if (!form.title.trim()) return
    setLogged(p => [...p, { title: form.title, type: form.type, admissibility: 'conditional', content: form.content }])
    setForm({ title: '', type: 'fir', content: '' })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0A0A' }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ background: 'rgba(10,15,30,.95)', borderColor: 'rgba(201,168,76,.15)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#8A8070' }}>← Back</button>
          <span className="font-serif text-lg tracking-widest" style={{ color: '#C9A84C' }}>Evidence Board</span>
          {caseData && <span className="text-xs px-2 py-0.5 rounded-sm" style={{ background: 'rgba(201,168,76,.1)', color: '#8A8070' }}>{caseData.case_title}</span>}
        </div>
        <span className="text-xs" style={{ color: '#8A8070' }}>{allEvidence.length} items pinned</span>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ background: '#111', borderColor: 'rgba(201,168,76,.1)' }}>
          <div className="p-5">
            <h3 className="font-serif text-base mb-4" style={{ color: '#E8E0D0' }}>Log Evidence</h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: '#666' }}>Title</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Evidence title…" className="nyaya-input" />
              </div>
              <div>
                <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: '#666' }}>Category</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="nyaya-select">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: '#666' }}>Description</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Brief description…" rows={3}
                  className="nyaya-input resize-none" style={{ fontFamily: 'DM Sans, sans-serif' }} />
              </div>
              <button onClick={pinEvidence} className="btn-gold w-full">
                📌 PIN TO BOARD
              </button>
            </div>

            {/* Logged list */}
            {logged.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#666' }}>Logged Evidence</h4>
                <div className="flex flex-col gap-2">
                  {logged.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-sm border text-xs"
                      style={{ background: 'rgba(255,255,255,.02)', borderColor: 'rgba(201,168,76,.1)' }}>
                      <span>{EMOJI_MAP[e.type] || '📋'}</span>
                      <span style={{ color: '#E8E0D0' }}>{e.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cork board */}
        <div className="flex-1 overflow-auto p-6">
          <div className="relative rounded-xl p-6 min-h-full"
            style={{ background: 'linear-gradient(135deg,#4A2E14,#3A2010,#4A2E14)', border: '4px solid #6B4423', boxShadow: 'inset 0 4px 20px rgba(0,0,0,.6), 0 0 40px rgba(0,0,0,.5)' }}>
            {/* Cork texture overlay */}
            <div className="absolute inset-0 rounded-xl opacity-20 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,200,100,.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(200,150,80,.1) 0%, transparent 50%)' }} />

            {allEvidence.length === 0 && (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,.3)' }}>No evidence pinned yet</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.2)' }}>Generate a case to see evidence here</div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-6 relative z-10">
              {allEvidence.map((ev, i) => {
                const angle = ((i * 37 + 7) % 11 - 5) * 1.2
                const cardBg = CARD_COLORS[i % CARD_COLORS.length]
                const admColor = ev.admissibility === 'admissible' ? '#2D7A4A' : ev.admissibility === 'inadmissible' ? '#8B2020' : '#8B6020'

                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, scale: .8, rotate: angle - 5 }}
                    animate={{ opacity: 1, scale: 1, rotate: angle }}
                    whileHover={{ scale: 1.08, rotate: 0, zIndex: 20 }}
                    transition={{ delay: i * .04, type: 'spring', stiffness: 200 }}
                    className="relative w-40 cursor-pointer"
                    style={{ transformOrigin: 'top center' }}>
                    {/* Pin */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full z-10 flex items-center justify-center"
                      style={{ background: admColor, boxShadow: `0 2px 8px ${admColor}88, 0 0 0 2px rgba(255,255,255,.2)` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,.6)' }} />
                    </div>

                    {/* Card */}
                    <div className="rounded-sm p-3.5 shadow-xl"
                      style={{ background: cardBg, boxShadow: '3px 5px 16px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.5)' }}>
                      <div className="text-2xl mb-2">{EMOJI_MAP[ev.type] || '📋'}</div>
                      <div className="text-xs font-bold leading-tight mb-1.5" style={{ color: '#1A1A1A', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
                        {ev.title}
                      </div>
                      <div className="text-xs mb-2" style={{ color: '#666', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>
                        {ev.type.toUpperCase()}
                      </div>
                      {ev.content && (
                        <div className="text-xs leading-relaxed mb-2" style={{ color: '#444', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>
                          {ev.content.substring(0, 80)}{ev.content.length > 80 ? '…' : ''}
                        </div>
                      )}
                      {/* Admissibility stamp */}
                      <div className="inline-block px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wide border"
                        style={{ color: admColor, borderColor: `${admColor}66`, background: `${admColor}18`, fontSize: 9 }}>
                        {ev.admissibility}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
