import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/**
 * Browser Web Speech API, en-US, interim results for live text, no key.
 * Tap to start, tap again to stop. onFinal(transcript) runs once listening ends, with
 * final results only (interim text only feeds the live preview).
 * `supported` turns false when the API is missing or mic permission is denied,
 * so the caller can hide the mic and keep typing.
 */
export function useSpeech(onFinal) {
  const [supported, setSupported] = useState(Boolean(Recognition))
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const recRef = useRef(null)
  const finalRef = useRef('')
  const altRef = useRef([])
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  useEffect(() => () => recRef.current?.abort(), [])

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return
    const rec = new Recognition()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 3
    finalRef.current = ''
    altRef.current = []

    rec.onresult = (e) => {
      const finals = []
      const interim = []
      for (const r of e.results) (r.isFinal ? finals : interim).push(r[0].transcript.trim())
      finalRef.current = finals.join(' ')
      // The engine's other guesses for the whole transcript (alternative k of each final result).
      const done = [...e.results].filter((r) => r.isFinal)
      altRef.current = [1, 2]
        .filter((k) => done.some((r) => r.length > k))
        .map((k) => done.map((r) => (r[k] ?? r[0]).transcript.trim()).join(' '))
        .filter((t) => t && t !== finalRef.current)
      setLive([...finals, ...interim].join(' '))
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        setSupported(false)
      }
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
      setLive('')
      // Only FINAL results are parsed; interim text is just the live preview.
      const transcript = finalRef.current.trim()
      if (transcript) onFinalRef.current?.(transcript, altRef.current)
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      recRef.current = null
      setSupported(false)
    }
  }, [])

  const stop = useCallback(() => recRef.current?.stop(), [])

  return { supported, listening, live, start, stop }
}
