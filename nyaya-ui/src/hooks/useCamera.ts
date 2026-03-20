/**
 * useCamera — webcam feed + face-api.js emotion detection
 * face-api.js loaded from CDN via index.html script tag
 * All processing is client-side only. No video data leaves the browser.
 */
import { useEffect, useRef, useState, useCallback } from 'react'

export type Demeanor = 'confident' | 'nervous' | 'uncertain' | 'unknown'

export interface EmotionSnapshot {
  demeanor: Demeanor
  score: number          // 0-100 confidence score
  raw: Record<string, number>
  stressLevel: number    // 0-1 rolling average (fearful+sad+surprised)
}

const EMPTY: EmotionSnapshot = { demeanor: 'unknown', score: 50, raw: {}, stressLevel: 0 }

// Map face-api expressions → courtroom demeanor
function mapDemeanor(exp: Record<string, number>): EmotionSnapshot {
  const confident = (exp.neutral ?? 0) + (exp.happy ?? 0)
  const nervous   = (exp.fearful ?? 0) + (exp.sad ?? 0)
  const uncertain = (exp.surprised ?? 0)
  const stress    = Math.min(1, (exp.fearful ?? 0) + (exp.sad ?? 0) + (exp.surprised ?? 0) * 0.5)

  let demeanor: Demeanor = 'unknown'
  let score = 50
  if (confident > nervous && confident > uncertain) { demeanor = 'confident'; score = Math.round(60 + confident * 40) }
  else if (nervous > uncertain)                      { demeanor = 'nervous';   score = Math.round(20 + (1 - nervous) * 40) }
  else if (uncertain > 0.1)                          { demeanor = 'uncertain'; score = Math.round(40 + (1 - uncertain) * 20) }

  return { demeanor, score: Math.min(100, Math.max(0, score)), raw: exp, stressLevel: stress }
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    faceapi: any
  }
}

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stressHistory = useRef<number[]>([])
  const noFaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [ready, setReady] = useState(false)           // camera + models loaded
  const [permitted, setPermitted] = useState<boolean | null>(null)  // null=unknown
  const [emotion, setEmotion] = useState<EmotionSnapshot>(EMPTY)
  const [roleSwitchPrompt, setRoleSwitchPrompt] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsFailed, setModelsFailed] = useState(false)

  // Load face-api models — try multiple CDNs with a timeout
  // Returns false gracefully if CDN is blocked; Gemini Vision handles demeanor instead
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true
    const fa = window.faceapi
    if (!fa) return false

    const CDNS = [
      'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights',
      'https://unpkg.com/face-api.js@0.22.2/weights',
    ]

    for (const CDN of CDNS) {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        )
        await Promise.race([
          Promise.all([
            fa.nets.tinyFaceDetector.loadFromUri(CDN),
            fa.nets.faceExpressionNet.loadFromUri(CDN),
          ]),
          timeout,
        ])
        setModelsLoaded(true)
        return true
      } catch { continue }
    }
    return false
  }, [modelsLoaded])

  // Start webcam — prefer built-in laptop camera (deviceId index 0)
  const startCamera = useCallback(async () => {
    try {
      // First try: get all video devices and pick the first one (built-in)
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      
      // Built-in webcam is usually the first device listed
      const builtInDevice = videoDevices[0]
      
      const constraints: MediaStreamConstraints = builtInDevice?.deviceId
        ? { video: { deviceId: { exact: builtInDevice.deviceId }, width: 160, height: 120 } }
        : { video: { width: 160, height: 120, facingMode: 'user' } }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPermitted(true)
      return true
    } catch {
      setPermitted(false)
      return false
    }
  }, [])

  // Stop webcam
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (noFaceTimer.current) clearTimeout(noFaceTimer.current)
    setReady(false)
  }, [])

  // Sample expressions every 2s
  const startDetection = useCallback(() => {
    const fa = window.faceapi
    if (!fa || !videoRef.current) return
    if (intervalRef.current) clearInterval(intervalRef.current)

    let noFaceCount = 0

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.paused || video.readyState < 2) return
      try {
        const result = await fa
          .detectSingleFace(video, new fa.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 }))
          .withFaceExpressions()

        if (!result) {
          noFaceCount++
          // 3s with no face (3 × 2s intervals) → role switch prompt
          if (noFaceCount >= 2) {
            if (noFaceTimer.current) clearTimeout(noFaceTimer.current)
            noFaceTimer.current = setTimeout(() => setRoleSwitchPrompt(true), 1000)
          }
          return
        }

        // Face detected — reset no-face counter
        if (noFaceCount >= 2) {
          // Was absent, now back — prompt already shown or will show
        }
        noFaceCount = 0
        if (noFaceTimer.current) clearTimeout(noFaceTimer.current)

        const exp = result.expressions as Record<string, number>
        const snap = mapDemeanor(exp)

        // Rolling stress average (last 5 samples)
        stressHistory.current = [...stressHistory.current.slice(-4), snap.stressLevel]
        const rollingStress = stressHistory.current.reduce((a, b) => a + b, 0) / stressHistory.current.length
        setEmotion({ ...snap, stressLevel: rollingStress })
      } catch { /* ignore frame errors */ }
    }, 2000)
  }, [])

  // Init when enabled
  useEffect(() => {
    if (!enabled) { stopCamera(); return }

    let cancelled = false
    ;(async () => {
      // Start camera first — needed for Gemini Vision even if local models fail
      const camOk = await startCamera()
      if (cancelled || !camOk) return
      // Try local models — if they fail, camera still works for Gemini Vision
      const modelsOk = await loadModels()
      if (cancelled) return
      if (modelsOk) {
        startDetection()
        setReady(true)
      } else {
        setModelsFailed(true)
        setReady(true) // camera is ready, just no local detection
      }
    })()

    return () => { cancelled = true; stopCamera() }
  }, [enabled])

  // Snapshot current emotion (called before submitting argument)
  const snapshotEmotion = useCallback(() => emotion, [emotion])

  // Capture current video frame as base64 JPEG (for Gemini Vision)
  const captureFrame = useCallback((quality = 0.7): string | null => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 160
      canvas.height = video.videoHeight || 120
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      // Mirror to match display (scaleX(-1))
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      // Strip "data:image/jpeg;base64," prefix
      return dataUrl.split(',')[1] ?? null
    } catch { return null }
  }, [])

  return {
    videoRef,
    ready,
    permitted,
    modelsFailed,
    emotion,
    roleSwitchPrompt,
    setRoleSwitchPrompt,
    snapshotEmotion,
    captureFrame,
    stopCamera,
  }
}
