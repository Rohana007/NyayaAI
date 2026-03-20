/**
 * useTTS — Web Speech API TTS with a queue so multiple speakers don't cancel each other.
 * In demo mode, prosecution/defence/judge all speak in sequence without interruption.
 */
import { useCallback, useRef, useState } from 'react'

export function useTTS() {
  const [muted, setMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const lastTextRef = useRef<string>('')
  const queueRef = useRef<{ text: string; rate: number; pitch: number }[]>([])
  const playingRef = useRef(false)
  const mutedRef = useRef(false)

  // Keep mutedRef in sync so queue callbacks see latest value
  const syncMuted = (val: boolean) => { mutedRef.current = val }

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis?.getVoices() ?? []
    const priority = [
      voices.find(v => v.lang === 'en-IN'),
      voices.find(v => v.lang.startsWith('en-IN')),
      voices.find(v => v.lang === 'en-GB'),
      voices.find(v => v.lang.startsWith('en')),
    ]
    return priority.find(Boolean) ?? null
  }, [])

  const processQueue = useCallback(() => {
    if (playingRef.current || queueRef.current.length === 0) return
    if (mutedRef.current) { queueRef.current = []; return }

    const item = queueRef.current.shift()!
    playingRef.current = true
    setIsSpeaking(true)

    const utter = new SpeechSynthesisUtterance(item.text)
    utter.lang = 'en-IN'
    utter.rate = item.rate
    utter.pitch = item.pitch
    utter.volume = 1.0

    const doSpeak = () => {
      const voice = pickVoice()
      if (voice) utter.voice = voice
      utter.onend = () => {
        playingRef.current = false
        if (queueRef.current.length === 0) setIsSpeaking(false)
        processQueue()
      }
      utter.onerror = () => {
        playingRef.current = false
        if (queueRef.current.length === 0) setIsSpeaking(false)
        processQueue()
      }
      window.speechSynthesis.speak(utter)
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = () => { doSpeak(); window.speechSynthesis.onvoiceschanged = null }
    }
  }, [pickVoice])

  // speak: enqueue. interrupt=true cancels queue and speaks immediately (for judge interruptions)
  const speak = useCallback((text: string, opts?: { rate?: number; pitch?: number; interrupt?: boolean }) => {
    if (!window.speechSynthesis || !text) return
    lastTextRef.current = text
    if (mutedRef.current) return

    const entry = { text, rate: opts?.rate ?? 0.88, pitch: opts?.pitch ?? 0.95 }

    if (opts?.interrupt) {
      // Cancel everything and speak now
      window.speechSynthesis.cancel()
      queueRef.current = [entry]
      playingRef.current = false
      setIsSpeaking(false)
    } else {
      queueRef.current.push(entry)
    }
    processQueue()
  }, [processQueue])

  const replay = useCallback(() => {
    if (lastTextRef.current) speak(lastTextRef.current, { interrupt: true })
  }, [speak])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    queueRef.current = []
    playingRef.current = false
    setIsSpeaking(false)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m
      syncMuted(next)
      if (next) {
        window.speechSynthesis?.cancel()
        queueRef.current = []
        playingRef.current = false
        setIsSpeaking(false)
      }
      return next
    })
  }, [])

  return { speak, replay, stop, muted, toggleMute, isSpeaking }
}
