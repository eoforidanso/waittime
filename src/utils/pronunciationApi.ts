export type GhanaLang = 'tw' | 'gaa' | 'ee';
export type GhanaSpeaker = 'female' | 'male_low' | 'male_high';

/** Maps our short language codes to the Ghana NLP API language codes */
const LANG_API_CODE: Record<GhanaLang, string> = {
  tw: 'twi',
  gaa: 'gaa',
  ee: 'ewe',
};

export const GHANA_LANG_LABELS: Record<GhanaLang, string> = {
  tw: 'Asante Twi',
  gaa: 'Ga',
  ee: 'Ewe',
};

export const GHANA_LANG_DESCRIPTIONS: Record<GhanaLang, string> = {
  tw: 'Twi is spoken by the Akan people of southern Ghana. It is the most widely spoken Ghanaian language, used in media and education.',
  gaa: 'Ga is spoken primarily in the Greater Accra Region. It is the language of the Ga people who are indigenous to the Accra coastline.',
  ee: 'Ewe is spoken in the Volta Region of eastern Ghana and across Togo and Benin. It has a rich tonal structure.',
};

export const GHANA_SPEAKERS: GhanaSpeaker[] = ['female', 'male_low', 'male_high'];

export const GHANA_SPEAKER_LABELS: Record<GhanaSpeaker, string> = {
  female: 'Female',
  male_low: 'Male (Low)',
  male_high: 'Male (High)',
};

/** Play a TTS pronunciation via the Ghana NLP API v2.
 *  Requires VITE_GHANA_NLP_KEY in your .env file.
 *  Falls back to the browser's Web Speech API when the key is absent.
 *  Endpoint: https://translation-api.ghananlp.org/tts/v2/synthesize */
export async function pronounceName(
  text: string,
  language: GhanaLang = 'tw',
  speaker: GhanaSpeaker = 'female',
): Promise<void> {
  const key = import.meta.env.VITE_GHANA_NLP_KEY as string | undefined;
  const hasRealKey = key && key !== 'your_key_here';

  if (!hasRealKey) {
    return browserTTS(text);
  }

  const res = await fetch('https://translation-api.ghananlp.org/tts/v2/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': key,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({ text, language: LANG_API_CODE[language], speaker }),
  });

  if (!res.ok) {
    // API failed — fall back to browser TTS rather than surfacing an error
    return browserTTS(text);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
}

/** Fallback: browser built-in speech synthesis */
function browserTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported in this browser'));
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const speak = () => {
      const voices = synth.getVoices();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.82;
      utt.pitch = 1;

      // Prefer an English voice; fall back to whatever is available
      const engVoice = voices.find(v => v.lang.startsWith('en')) ?? voices[0] ?? null;
      if (engVoice) utt.voice = engVoice;

      // Timeout guard — some browsers never fire onend
      const guard = setTimeout(() => resolve(), 5000);
      utt.onend = () => { clearTimeout(guard); resolve(); };
      utt.onerror = (e) => {
        clearTimeout(guard);
        // 'interrupted' is benign (previous utterance cancelled) — treat as success
        if (e.error === 'interrupted') { resolve(); return; }
        reject(new Error(`Browser TTS error: ${e.error}`));
      };

      synth.speak(utt);
    };

    // Voices may not be loaded yet on first call
    if (synth.getVoices().length > 0) {
      speak();
    } else {
      synth.addEventListener('voiceschanged', speak, { once: true });
      // If voiceschanged never fires (Safari), just proceed after a tick
      setTimeout(() => { if (synth.getVoices().length === 0) speak(); }, 200);
    }
  });
}
