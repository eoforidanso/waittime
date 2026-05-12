import { useState } from 'react';
import { Volume2, Loader2, VolumeX, Globe, Info, Mic } from 'lucide-react';
import {
  pronounceName, GhanaLang, GhanaSpeaker,
  GHANA_LANG_LABELS, GHANA_LANG_DESCRIPTIONS,
  GHANA_SPEAKER_LABELS, GHANA_SPEAKERS,
} from '../utils/pronunciationApi';

/* ─── Example name groups per language ─── */
const EXAMPLES: Record<GhanaLang, { name: string; meaning?: string }[]> = {
  tw: [
    { name: 'Kofi', meaning: 'Born on Friday (male)' },
    { name: 'Ama', meaning: 'Born on Saturday (female)' },
    { name: 'Kwame', meaning: 'Born on Saturday (male)' },
    { name: 'Akosua', meaning: 'Born on Sunday (female)' },
    { name: 'Abena', meaning: 'Born on Tuesday (female)' },
    { name: 'Kwabena', meaning: 'Born on Tuesday (male)' },
    { name: 'Kweku', meaning: 'Born on Wednesday (male)' },
    { name: 'Esi', meaning: 'Born on Sunday (female)' },
    { name: 'Yaa', meaning: 'Born on Thursday (female)' },
    { name: 'Kofi Boateng', meaning: 'Surname — royalty connotation' },
    { name: 'Agyeman Prempeh' },
    { name: 'Nkrumah' },
  ],
  gaa: [
    { name: 'Nii', meaning: 'Chief / title — male honorific' },
    { name: 'Naa', meaning: 'Queen / title — female honorific' },
    { name: 'Korle', meaning: 'Name of the Korle Lagoon' },
    { name: 'Tetteh', meaning: 'Common Ga surname' },
    { name: 'Laryea', meaning: 'Common Ga surname' },
    { name: 'Okanta' },
    { name: 'Lamptey' },
    { name: 'Quaye' },
    { name: 'Adjei' },
    { name: 'Odoi' },
  ],
  ee: [
    { name: 'Yao', meaning: 'Born on Thursday (male)' },
    { name: 'Ama', meaning: 'Born on Saturday' },
    { name: 'Kafui', meaning: 'Praise God' },
    { name: 'Senyo', meaning: 'Joy' },
    { name: 'Elikem', meaning: 'God lives' },
    { name: 'Dzifa', meaning: 'Peace of mind' },
    { name: 'Mawuli', meaning: 'There is a God' },
    { name: 'Selorm', meaning: 'God has done good things for me' },
    { name: 'Sitsofe' },
    { name: 'Agbemabiese' },
  ],
};

const LANGS: GhanaLang[] = ['tw', 'gaa', 'ee'];

type ItemState = 'idle' | 'loading' | 'error';

export default function Pronunciation() {
  const [lang, setLang] = useState<GhanaLang>('tw');
  const [speaker, setSpeaker] = useState<GhanaSpeaker>('female');
  const [text, setText] = useState('');
  const [mainState, setMainState] = useState<ItemState>('idle');
  const [exampleStates, setExampleStates] = useState<Record<string, ItemState>>({});
  const hasKey = !!import.meta.env.VITE_GHANA_NLP_KEY && import.meta.env.VITE_GHANA_NLP_KEY !== 'your_key_here';

  const playMain = async () => {
    const t = text.trim();
    if (!t || mainState === 'loading') return;
    setMainState('loading');
    try {
      await pronounceName(t, lang, speaker);
      setMainState('idle');
    } catch {
      setMainState('error');
      setTimeout(() => setMainState('idle'), 2500);
    }
  };

  const playExample = async (name: string) => {
    const key = `${lang}-${name}`;
    if (exampleStates[key] === 'loading') return;
    setExampleStates(s => ({ ...s, [key]: 'loading' }));
    try {
      await pronounceName(name, lang, speaker);
      setExampleStates(s => ({ ...s, [key]: 'idle' }));
    } catch {
      setExampleStates(s => ({ ...s, [key]: 'error' }));
      setTimeout(() => setExampleStates(s => ({ ...s, [key]: 'idle' })), 2500);
    }
  };

  return (
    <div className="pron-page">
      {/* Header */}
      <div className="pron-header">
        <Globe size={26} className="pron-header-icon" />
        <div>
          <h1>Name Pronunciation</h1>
          <p>Hear how Ghanaian patient names are pronounced in Twi, Ga, and Ewe</p>
        </div>
      </div>

      {/* API key warning */}
      {!hasKey && (
        <div className="pron-key-warning">
          <Info size={16} />
          <span>
            <strong>Ghana NLP key not configured</strong> — using browser TTS as fallback (English accent).
            For native Twi/Ga/Ewe pronunciation, add <code>VITE_GHANA_NLP_KEY=your_key</code> to <code>.env</code> and restart.
            Get a key at <a href="https://translation.ghananlp.org" target="_blank" rel="noreferrer">translation.ghananlp.org</a>.
          </span>
        </div>
      )}

      <div className="pron-layout">
        {/* Left: input panel */}
        <div className="pron-card pron-input-panel">
          <h3>Try a Name or Phrase</h3>

          {/* Language tabs */}
          <div className="pron-lang-tabs">
            {LANGS.map(l => (
              <button
                key={l}
                className={`pron-lang-tab${lang === l ? ' active' : ''}`}
                onClick={() => setLang(l)}
              >
                {GHANA_LANG_LABELS[l]}
              </button>
            ))}
          </div>

          <p className="pron-lang-desc">{GHANA_LANG_DESCRIPTIONS[lang]}</p>

          {/* Speaker selector */}
          <div className="pron-speaker-row">
            <Mic size={13} className="pron-speaker-icon" />
            <span className="pron-speaker-label">Voice:</span>
            <div className="pron-speaker-tabs">
              {GHANA_SPEAKERS.map(s => (
                <button
                  key={s}
                  className={`pron-speaker-tab${speaker === s ? ' active' : ''}`}
                  onClick={() => setSpeaker(s)}
                >
                  {GHANA_SPEAKER_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="pron-textarea"
            rows={3}
            placeholder={`Enter a name or phrase in ${GHANA_LANG_LABELS[lang]}…`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); playMain(); } }}
          />

          <button
            className={`pron-play-btn${mainState === 'loading' ? ' loading' : mainState === 'error' ? ' error' : ''}`}
            onClick={playMain}
            disabled={!text.trim() || mainState === 'loading' || !hasKey}
          >
            {mainState === 'loading' ? (
              <><Loader2 size={16} className="spin" /> Generating Audio…</>
            ) : mainState === 'error' ? (
              <><VolumeX size={16} /> Unavailable</>
            ) : (
              <><Volume2 size={16} /> Pronounce</>
            )}
          </button>

          <p className="pron-hint">Powered by <strong>Ghana NLP TTS</strong> — audio is generated in real time.</p>
        </div>

        {/* Right: examples panel */}
        <div className="pron-card pron-examples-panel">
          <h3>Common {GHANA_LANG_LABELS[lang]} Names</h3>
          <p className="pron-examples-sub">Click any name to hear its pronunciation</p>

          <div className="pron-examples-grid">
            {EXAMPLES[lang].map(ex => {
              const key = `${lang}-${ex.name}`;
              const s = exampleStates[key] ?? 'idle';
              return (
                <button
                  key={ex.name}
                  className={`pron-example-chip${s !== 'idle' ? ` ${s}` : ''}`}
                  onClick={() => { setText(ex.name); playExample(ex.name); }}
                  disabled={!hasKey}
                  title={ex.meaning}
                >
                  {s === 'loading' ? (
                    <Loader2 size={12} className="spin" />
                  ) : s === 'error' ? (
                    <VolumeX size={12} />
                  ) : (
                    <Volume2 size={12} />
                  )}
                  <span className="pron-chip-name">{ex.name}</span>
                  {ex.meaning && <span className="pron-chip-meaning">{ex.meaning}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day-names reference */}
      {lang === 'tw' && (
        <div className="pron-card pron-daynames">
          <h3>Akan Day Names (Twi)</h3>
          <p className="pron-examples-sub">In Akan culture, names are given based on the day of birth</p>
          <div className="pron-daynames-grid">
            {[
              { day: 'Monday', male: 'Kwadwo / Kojo', female: 'Adwoa' },
              { day: 'Tuesday', male: 'Kwabena', female: 'Abena' },
              { day: 'Wednesday', male: 'Kweku', female: 'Akua' },
              { day: 'Thursday', male: 'Yaw', female: 'Yaa' },
              { day: 'Friday', male: 'Kofi', female: 'Efua' },
              { day: 'Saturday', male: 'Kwame', female: 'Ama' },
              { day: 'Sunday', male: 'Kwasi / Akwasi', female: 'Akosua / Esi' },
            ].map(row => (
              <div key={row.day} className="pron-dayname-row">
                <span className="pron-dayname-day">{row.day}</span>
                <span className="pron-dayname-male">♂ {row.male}</span>
                <span className="pron-dayname-female">♀ {row.female}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lang === 'ee' && (
        <div className="pron-card pron-daynames">
          <h3>Ewe Day Names</h3>
          <p className="pron-examples-sub">The Ewe also use day names — though less strictly than Akan</p>
          <div className="pron-daynames-grid">
            {[
              { day: 'Monday', male: 'Kodzo', female: 'Adzo' },
              { day: 'Tuesday', male: 'Komla', female: 'Abla' },
              { day: 'Wednesday', male: 'Kokou', female: 'Aku' },
              { day: 'Thursday', male: 'Yao', female: 'Yawa' },
              { day: 'Friday', male: 'Kofi', female: 'Afi' },
              { day: 'Saturday', male: 'Komi', female: 'Ami' },
              { day: 'Sunday', male: 'Kossi', female: 'Akossiwa' },
            ].map(row => (
              <div key={row.day} className="pron-dayname-row">
                <span className="pron-dayname-day">{row.day}</span>
                <span className="pron-dayname-male">♂ {row.male}</span>
                <span className="pron-dayname-female">♀ {row.female}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
