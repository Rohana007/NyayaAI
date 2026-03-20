import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TranscriptMsg } from '../store/session'

const TYPE_STYLES: Record<string, { bg: string; border: string; labelColor: string; glow?: string }> = {
  system:   { bg: 'transparent', border: 'transparent', labelColor: '#8A8070' },
  student:  { bg: 'rgba(201,168,76,.06)', border: 'rgba(201,168,76,.18)', labelColor: '#C9A84C', glow: 'rgba(201,168,76,.04)' },
  judge:    { bg: 'rgba(61,31,10,.5)', border: 'rgba(201,168,76,.25)', labelColor: 'rgba(201,168,76,.8)', glow: 'rgba(201,168,76,.06)' },
  opposing: { bg: 'rgba(192,80,80,.07)', border: 'rgba(192,80,80,.2)', labelColor: '#E07070' },
  bench:    { bg: 'rgba(255,165,0,.07)', border: 'rgba(255,165,0,.3)', labelColor: '#FFA500', glow: 'rgba(255,165,0,.04)' },
  witness:  { bg: 'rgba(74,122,176,.07)', border: 'rgba(74,122,176,.25)', labelColor: '#7AB0D8' },
}

interface Props { messages: TranscriptMsg[]; typing: boolean }

export default function TranscriptPanel({ messages, typing }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, overflowY: 'auto', flex: 1 }}>
      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => {
          const s = TYPE_STYLES[msg.type] || TYPE_STYLES.system
          const isSystem = msg.type === 'system'
          return (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 10, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: .28, ease: [.16,1,.3,1], delay: idx === messages.length - 1 ? 0 : 0 }}
              style={{ borderRadius: 10, padding: isSystem ? '6px 12px' : '10px 14px', lineHeight: 1.55, fontSize: 14,
                background: s.bg, border: `1px solid ${s.border}`,
                textAlign: isSystem ? 'center' : 'left',
                fontStyle: isSystem ? 'italic' : 'normal',
                color: isSystem ? '#555' : '#E8E0D0',
                boxShadow: s.glow ? `0 0 20px ${s.glow}` : 'none',
              }}>
              {msg.label && !isSystem && (
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, color: s.labelColor, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {msg.label}
                </div>
              )}
              <div style={{ fontFamily: 'DM Sans, sans-serif' }}>{msg.text}</div>
              {msg.subtext && (
                <div style={{ fontSize: 12, marginTop: 5, fontStyle: 'italic', color: '#666' }}>{msg.subtext}</div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {typing && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', gap: 5, padding: '10px 14px', borderRadius: 10, background: 'rgba(61,31,10,.4)', border: '1px solid rgba(201,168,76,.15)', width: 'fit-content' }}>
          {[0, .18, .36].map((d, i) => (
            <motion.span key={i} animate={{ y: [0, -4, 0], opacity: [.4, 1, .4] }} transition={{ duration: .8, delay: d, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', display: 'inline-block' }} />
          ))}
        </motion.div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
