import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession, type ArgMode } from '../store/session'
import { useShallow } from 'zustand/react/shallow'
import { courtroomApi } from '../api/client'

// Speech Recognition type declarations (not in all TS versions)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
}

const MODES: { key: ArgMode; label: string; color: string }[] = [
  { key: 'argue',    label: 'Argue',    color: '#C9A84C' },
  { key: 'rebuttal', label: 'Rebuttal', color: '#E07070' },
  { key: 'motion',   label: 'Motion',   color: '#7AB0D8' },
  { key: 'cite',     label: 'Cite Law', color: '#6DBF8A' },
  { key: 'examine',  label: 'Examine',  color: '#FFA500' },
]
const OBJECTIONS = ['Hearsay','Relevance','Leading Question','Speculation','Badgering','Privilege','Best Evidence']
const PLACEHOLDERS: Record<ArgMode, string> = {
  argue:    'Submit your argument to the court…',
  rebuttal: "Counter the opposing counsel's argument…",
  motion:   'File a procedural motion…',
  cite:     'Cite a precedent or statute (BNS/BNSS/BSA)…',
  examine:  'Ask your question to the witness…',
}

interface Props {
  onSubmit: (text: string) => void
  onObjection: (type: string) => void
  onHint: () => void
  disabled: boolean
  locked: boolean
  showHint: boolean
  evidenceItems?: { title: string; type: string }[]
  sessionId?: string
}

export default function InputArea({ onSubmit, onObjection, onHint, disabled, locked, showHint, evidenceItems, sessionId }: Props) {
  const { argMode, setArgMode, activeWitness } = useSession(useShallow(s => ({ argMode: s.argMode, setArgMode: s.setArgMode, activeWitness: s.activeWitness })))
  const [text, setText] = useState('')
  const [objOpen, setObjOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [interim, setInterim] = useState('')
  const [suggestions, setSuggestions] = useState<{ label: string; text: string; type: string }[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    type SRConstructor = new () => SpeechRecognitionInstance
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-IN'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let fin = '', int = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) fin += t; else int += t
      }
      if (fin) setText(p => (p + ' ' + fin).trim())
      setInterim(int)
    }
    rec.onend = () => { if (voiceOn) { try { rec.start() } catch (_) {} } }
    recognitionRef.current = rec
  }, [])

  const toggleVoice = () => {
    const rec = recognitionRef.current
    if (!rec) { alert('Speech recognition not supported. Use Chrome or Edge.'); return }
    if (voiceOn) { rec.stop(); setVoiceOn(false); setInterim('') }
    else { rec.start(); setVoiceOn(true) }
  }

  const submit = () => {
    const t = text.trim()
    if (!t || disabled || locked) return
    onSubmit(t); setText(''); setInterim(''); setSuggestOpen(false); setSuggestions([])
    if (voiceOn) { recognitionRef.current?.stop(); setVoiceOn(false) }
  }

  const fetchSuggestions = async () => {
    if (!sessionId || suggestLoading) return
    setSuggestLoading(true)
    setSuggestOpen(true)
    try {
      const res = await courtroomApi.suggestArguments(sessionId, argMode)
      setSuggestions(res.options || [])
    } catch {
      setSuggestions([
        { label: 'Challenge evidence admissibility', text: 'My Lord, the electronic evidence lacks the mandatory certificate under BSA Section 63(4) and must be excluded from consideration.', type: 'procedural' },
        { label: 'Cite BNS directly', text: 'My Lord, the prosecution has failed to establish mens rea as required under BNS Section 101. The act does not satisfy the threshold for murder.', type: 'aggressive' },
        { label: 'Attack witness credibility', text: 'My Lord, the eyewitness testimony is inconsistent with the forensic evidence. Under BSA Section 155, this witness is impeachable on prior contradictory statements.', type: 'defensive' },
      ])
    } finally {
      setSuggestLoading(false)
    }
  }

  const activeMode = MODES.find(m => m.key === argMode)!
  const placeholder = argMode === 'examine' && activeWitness ? `Ask your question to ${activeWitness}…` : PLACEHOLDERS[argMode]

  const TYPE_COLOR: Record<string, string> = {
    aggressive: '#E07070', defensive: '#7AB0D8', procedural: '#C9A84C', emotional_appeal: '#9B7FD4'
  }

  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid rgba(201,168,76,.12)', padding: '12px 16px', background: 'linear-gradient(180deg, rgba(10,15,30,.98), rgba(6,8,16,1))' }}>

      {/* ── Argument Suggestion Cards ── */}
      <AnimatePresence>
        {suggestOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.16em', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                💡 Argument Suggestions — pick one or type your own
              </span>
              <button onClick={() => setSuggestOpen(false)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: 14, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
            </div>
            {suggestLoading ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    style={{ flex: 1, height: 64, borderRadius: 8, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.1)' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map((s, i) => {
                  const col = TYPE_COLOR[s.type] || '#C9A84C'
                  return (
                    <motion.button key={i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                      whileHover={{ borderColor: col, background: `${col}12` }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setText(s.text); setSuggestOpen(false); textareaRef.current?.focus() }}
                      style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(255,255,255,.02)', border: `1px solid ${col}33`,
                        transition: 'all .18s', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: col, fontFamily: 'Space Grotesk, sans-serif',
                          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1px 6px',
                          borderRadius: 4, background: `${col}18`, border: `1px solid ${col}33` }}>
                          {s.type.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.8)', fontFamily: 'DM Sans, sans-serif' }}>
                          {s.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {s.text}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {MODES.map(m => (
          <motion.button key={m.key} onClick={() => setArgMode(m.key)} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: `1px solid ${argMode === m.key ? m.color + '55' : 'rgba(255,255,255,.08)'}`, background: argMode === m.key ? m.color + '18' : 'transparent', color: argMode === m.key ? m.color : '#555', cursor: 'pointer', transition: 'all .18s', letterSpacing: '0.03em' }}>
            {m.label}
          </motion.button>
        ))}
      </div>

      {/* Evidence chips */}
      {evidenceItems && evidenceItems.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {evidenceItems.slice(0, 5).map((ev, i) => (
            <motion.button key={i} onClick={() => setText(p => p ? `${p} [Evidence: ${ev.title}]` : `[Evidence: ${ev.title}]`)}
              disabled={locked} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(74,122,176,.3)', color: '#7AB0D8', background: 'rgba(74,122,176,.07)', cursor: 'pointer', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}
              title={ev.title}>
              📎 {ev.title.length > 18 ? ev.title.substring(0, 18) + '…' : ev.title}
            </motion.button>
          ))}
        </div>
      )}

      {/* Textarea + submit */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea ref={textareaRef} id="argue-input" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder={placeholder} disabled={locked} rows={3}
            style={{ width: '100%', resize: 'none', borderRadius: 10, fontSize: 15, padding: '10px 14px', outline: 'none', transition: 'border-color .2s, box-shadow .2s',
              background: locked ? 'rgba(192,80,80,.04)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${locked ? 'rgba(192,80,80,.4)' : 'rgba(201,168,76,.18)'}`,
              color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif',
              boxShadow: text.length > 0 ? `0 0 0 2px ${activeMode.color}18` : 'none',
            }} />
          {interim && (
            <div style={{ position: 'absolute', bottom: 8, left: 14, right: 14, fontSize: 12, fontStyle: 'italic', color: 'rgba(201,168,76,.4)', pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>…{interim}</div>
          )}
        </div>
        <motion.button onClick={submit} disabled={disabled || locked || !text.trim()} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
          style={{ padding: '10px 16px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', borderRadius: 10, border: '1px solid rgba(201,168,76,.45)', background: text.trim() ? 'rgba(201,168,76,.18)' : 'rgba(201,168,76,.06)', color: '#C9A84C', cursor: disabled || locked || !text.trim() ? 'not-allowed' : 'pointer', opacity: disabled || locked || !text.trim() ? .4 : 1, transition: 'all .2s', whiteSpace: 'nowrap' }}>
          Submit ↵
        </motion.button>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {/* Objection */}
        <div style={{ position: 'relative' }}>
          <motion.button onClick={() => setObjOpen(o => !o)} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(192,80,80,.35)', color: '#E07070', background: objOpen ? 'rgba(192,80,80,.12)' : 'rgba(192,80,80,.06)', cursor: 'pointer', transition: 'all .18s' }}>
            ⚡ Objection
          </motion.button>
          <AnimatePresence>
            {objOpen && (
              <motion.div initial={{ opacity: 0, y: 6, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: .96 }} transition={{ duration: .15 }}
                style={{ position: 'absolute', bottom: '100%', marginBottom: 6, left: 0, borderRadius: 10, border: '1px solid rgba(201,168,76,.2)', zIndex: 50, padding: '6px 0', minWidth: 176, background: '#0e0e0e', boxShadow: '0 16px 48px rgba(0,0,0,.7)' }}>
                {OBJECTIONS.map(o => (
                  <motion.button key={o} onClick={() => { onObjection(o); setObjOpen(false) }} whileHover={{ background: 'rgba(192,80,80,.08)', x: 2 }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 13, padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#8A8070', fontFamily: 'DM Sans, sans-serif', transition: 'color .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#E07070')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#8A8070')}>
                    {o}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice */}
        <motion.button onClick={toggleVoice} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
          style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', transition: 'all .18s',
            border: `1px solid ${voiceOn ? 'rgba(192,80,80,.6)' : 'rgba(74,154,106,.4)'}`,
            color: voiceOn ? '#ff6b6b' : '#6DBF8A',
            background: voiceOn ? 'rgba(192,80,80,.12)' : 'rgba(74,154,106,.06)',
            animation: voiceOn ? 'voice-ring 1.2s ease-out infinite' : 'none',
          }}>
          {voiceOn ? '🔴 Stop' : '🎤 Voice'}
        </motion.button>

        {showHint && (
          <motion.button onClick={onHint} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(74,154,106,.3)', color: '#6DBF8A', background: 'rgba(74,154,106,.06)', cursor: 'pointer' }}>
            💡 Hint
          </motion.button>
        )}

        {sessionId && (
          <motion.button onClick={fetchSuggestions} disabled={locked || suggestLoading} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, cursor: locked ? 'not-allowed' : 'pointer',
              border: `1px solid ${suggestOpen ? 'rgba(201,168,76,.5)' : 'rgba(201,168,76,.25)'}`,
              color: suggestOpen ? '#C9A84C' : 'rgba(201,168,76,.6)',
              background: suggestOpen ? 'rgba(201,168,76,.1)' : 'transparent',
              opacity: locked ? 0.4 : 1, transition: 'all .18s' }}>
            {suggestLoading ? '⏳' : '🃏'} Suggest
          </motion.button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 3, width: 60, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <motion.div animate={{ width: `${Math.min(100, (text.length / 1000) * 100)}%` }} transition={{ duration: .1 }}
              style={{ height: '100%', borderRadius: 2, background: text.length > 900 ? '#E07070' : text.length > 700 ? '#FFA500' : '#C9A84C' }} />
          </div>
          <span style={{ fontSize: 12, color: text.length > 900 ? '#E07070' : '#555', fontFamily: 'Space Grotesk, sans-serif', minWidth: 52 }}>{text.length} / 1000</span>
        </div>
      </div>
    </div>
  )
}
