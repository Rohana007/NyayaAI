/**
 * VoiceMode — Speech-to-text + Text-to-speech
 * Uses Web Speech API (no backend needed, works in Chrome/Edge)
 */
class VoiceMode {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.lang = 'en-IN';
    this.onTranscript = null; // callback(finalText, interimText)
    this.onStateChange = null; // callback(isListening)
    this._supported = false;
    this._init();
  }

  _init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this._supported = true;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (this.onTranscript) this.onTranscript(final, interim);
    };

    this.recognition.onend = () => {
      // Auto-restart if still supposed to be listening (continuous mode can stop on silence)
      if (this.isListening) {
        try { this.recognition.start(); } catch (_) {}
      }
    };

    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'audio-capture') return;
      console.warn('[Voice] Error:', e.error);
      if (e.error === 'not-allowed') {
        this._setListening(false);
        alert('Microphone access denied. Please allow microphone permission and try again.');
      }
    };
  }

  get supported() { return this._supported; }

  start(targetInputId) {
    if (!this._supported) {
      alert('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (this.isListening) return;
    this._targetId = targetInputId;
    this.recognition.lang = this.lang;

    // Wire transcript to input
    this.onTranscript = (final, interim) => {
      const input = document.getElementById(this._targetId);
      if (!input) return;
      // Append final text, show interim as placeholder-style
      if (final) {
        input.value = (input.value + ' ' + final).trim();
        input.dispatchEvent(new Event('input'));
      }
      // Show interim in a ghost span if present
      const ghost = document.getElementById('voiceInterim');
      if (ghost) ghost.textContent = interim ? `…${interim}` : '';
    };

    try {
      this.recognition.start();
      this._setListening(true);
    } catch (e) {
      console.warn('[Voice] Start error:', e);
    }
  }

  stop() {
    if (!this.isListening) return;
    this._setListening(false);
    try { this.recognition.stop(); } catch (_) {}
    const ghost = document.getElementById('voiceInterim');
    if (ghost) ghost.textContent = '';
  }

  toggle(targetInputId) {
    this.isListening ? this.stop() : this.start(targetInputId);
  }

  _setListening(val) {
    this.isListening = val;
    if (this.onStateChange) this.onStateChange(val);
    this._updateUI(val);
  }

  _updateUI(active) {
    const btn = document.getElementById('voiceBtn');
    if (!btn) return;
    if (active) {
      btn.classList.add('voice-active');
      btn.title = 'Stop recording';
      btn.innerHTML = `<span class="voice-pulse"></span> Stop`;
    } else {
      btn.classList.remove('voice-active');
      btn.title = 'Start voice input (English/Hindi)';
      btn.innerHTML = `🎤 Voice`;
    }
  }

  setLang(lang) {
    this.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    if (this.recognition) this.recognition.lang = this.lang;
  }

  // TTS — speak judge/opposing counsel responses aloud
  speak(text, rate = 0.88) {
    if (!this.synthesis || !text) return;
    this.synthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.replace(/\[.*?\]/g, '').trim());
    utt.lang = 'en-IN';
    utt.rate = rate;
    utt.pitch = 0.95;
    // Prefer a deeper voice if available
    const voices = this.synthesis.getVoices();
    const preferred = voices.find(v => v.lang === 'en-IN') ||
                      voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    this.synthesis.speak(utt);
  }

  stopSpeaking() {
    if (this.synthesis) this.synthesis.cancel();
  }
}

// Singleton
const voice = new VoiceMode();
