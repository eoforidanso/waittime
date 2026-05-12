import { useState } from 'react';
import { Calculator, Heart, Wind, Brain, Droplets, FlaskConical, Baby, Activity } from 'lucide-react';

type Category = 'all' | 'cardiac' | 'respiratory' | 'neurology' | 'vascular' | 'biochem' | 'paeds' | 'general';

const CATS: { id: Category; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'cardiac',     label: 'Cardiac' },
  { id: 'respiratory', label: 'Respiratory' },
  { id: 'neurology',   label: 'Neurology' },
  { id: 'vascular',    label: 'Vascular' },
  { id: 'biochem',     label: 'Biochemistry' },
  { id: 'paeds',       label: 'Paeds' },
  { id: 'general',     label: 'General' },
];

// ── Shared Result Banner ──────────────────────────────────────────────────
function CalcResult({ score, label, color, sub }: {
  score: string | number;
  label: string;
  color: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
  sub?: string;
}) {
  const map = {
    green:   { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', text: '#34d399' },
    amber:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24' },
    red:     { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  text: '#f87171' },
    blue:    { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa' },
    neutral: { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
  }[color];
  return (
    <div className="mc-result" style={{ background: map.bg, borderColor: map.border }}>
      <div className="mc-result-score" style={{ color: map.text }}>{score}</div>
      <div className="mc-result-label" style={{ color: map.text }}>{label}</div>
      {sub && <div className="mc-result-sub">{sub}</div>}
    </div>
  );
}

// ── Checkbox helper ───────────────────────────────────────────────────────
function Chk({ label, checked, onChange, points }: {
  label: string; checked: boolean;
  onChange: (v: boolean) => void; points?: number;
}) {
  return (
    <label className="mc-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="mc-check-label">{label}</span>
      {points !== undefined && (
        <span className="mc-check-pts">{points > 0 ? `+${points}` : points}</span>
      )}
    </label>
  );
}

// ── Select helper ─────────────────────────────────────────────────────────
function Sel({ label, value, onChange, options, note }: {
  label: string; value: number;
  onChange: (v: number) => void;
  options: { label: string; value: number }[];
  note?: string;
}) {
  return (
    <div className="mc-field">
      <label className="mc-label">{label}{note && <span className="mc-label-note"> ({note})</span>}</label>
      <select className="mc-select" value={value} onChange={e => onChange(Number(e.target.value))}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Number input helper ────────────────────────────────────────────────────
function Num({ label, value, onChange, unit, min, max, step }: {
  label: string; value: string;
  onChange: (v: string) => void;
  unit?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="mc-field">
      <label className="mc-label">{label}{unit && <span className="mc-label-note"> ({unit})</span>}</label>
      <input className="mc-input" type="number" value={value}
        onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step ?? 0.1} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. GCS — Glasgow Coma Scale
// ═══════════════════════════════════════════════════════════════════════════
function GCSCalc() {
  const [eyes,   setEyes]   = useState(4);
  const [verbal, setVerbal] = useState(5);
  const [motor,  setMotor]  = useState(6);
  const total = eyes + verbal + motor;
  const sev = total <= 8 ? { label: 'Severe TBI', color: 'red' as const }
    : total <= 12 ? { label: 'Moderate TBI', color: 'amber' as const }
    : { label: 'Mild / Normal', color: 'green' as const };
  return (
    <div className="mc-card" id="gcs">
      <div className="mc-header" style={{ borderLeftColor: '#8b5cf6' }}>
        <Brain size={16} /><h3>Glasgow Coma Scale (GCS)</h3>
      </div>
      <div className="mc-body">
        <Sel label="Eye Opening" value={eyes} onChange={setEyes} options={[
          { label: '4 — Spontaneous',   value: 4 },
          { label: '3 — To voice',       value: 3 },
          { label: '2 — To pain',        value: 2 },
          { label: '1 — None',           value: 1 },
        ]} />
        <Sel label="Verbal Response" value={verbal} onChange={setVerbal} options={[
          { label: '5 — Oriented',       value: 5 },
          { label: '4 — Confused',       value: 4 },
          { label: '3 — Words only',     value: 3 },
          { label: '2 — Sounds only',    value: 2 },
          { label: '1 — None',           value: 1 },
        ]} />
        <Sel label="Motor Response" value={motor} onChange={setMotor} options={[
          { label: '6 — Obeys commands', value: 6 },
          { label: '5 — Localises pain', value: 5 },
          { label: '4 — Withdrawal',     value: 4 },
          { label: '3 — Flexion (decorticate)', value: 3 },
          { label: '2 — Extension (decerebrate)', value: 2 },
          { label: '1 — None',           value: 1 },
        ]} />
        <CalcResult score={`${total} / 15`} label={sev.label} color={sev.color}
          sub="≤8 = Severe · 9–12 = Moderate · 13–15 = Mild" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  2. CURB-65
// ═══════════════════════════════════════════════════════════════════════════
function Curb65Calc() {
  const [c, setC] = useState(false);
  const [u, setU] = useState(false);
  const [r, setR] = useState(false);
  const [b, setB] = useState(false);
  const [a, setA] = useState(false);
  const score = [c, u, r, b, a].filter(Boolean).length;
  const risk = score <= 1 ? { label: 'Low Risk — Outpatient', color: 'green' as const, sub: '30-day mortality <3%' }
    : score === 2 ? { label: 'Moderate Risk — Hospital', color: 'amber' as const, sub: '30-day mortality ~9%' }
    : { label: 'High Risk — Consider ICU', color: 'red' as const, sub: '30-day mortality up to 40%' };
  return (
    <div className="mc-card" id="curb65">
      <div className="mc-header" style={{ borderLeftColor: '#3b82f6' }}>
        <Wind size={16} /><h3>CURB-65 (Pneumonia)</h3>
      </div>
      <div className="mc-body">
        <Chk label="Confusion (new)" checked={c} onChange={setC} points={1} />
        <Chk label="Urea > 7 mmol/L" checked={u} onChange={setU} points={1} />
        <Chk label="Respiratory rate ≥ 30 / min" checked={r} onChange={setR} points={1} />
        <Chk label="BP < 90 mmHg systolic or ≤ 60 diastolic" checked={b} onChange={setB} points={1} />
        <Chk label="Age ≥ 65 years" checked={a} onChange={setA} points={1} />
        <CalcResult score={score} label={risk.label} color={risk.color} sub={risk.sub} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  3. HEART Score
// ═══════════════════════════════════════════════════════════════════════════
function HEARTCalc() {
  const [h, setH] = useState(0);
  const [e, setE] = useState(0);
  const [age, setAge] = useState(0);
  const [risk, setRisk] = useState(0);
  const [trop, setTrop] = useState(0);
  const score = h + e + age + risk + trop;
  const interp = score <= 3 ? { label: 'Low Risk', color: 'green' as const, sub: '<1% MACE at 6 weeks — consider early discharge' }
    : score <= 6 ? { label: 'Moderate Risk', color: 'amber' as const, sub: '12-17% MACE — admission + observation' }
    : { label: 'High Risk', color: 'red' as const, sub: '>50% MACE — early invasive strategy' };
  return (
    <div className="mc-card" id="heart">
      <div className="mc-header" style={{ borderLeftColor: '#f43f5e' }}>
        <Heart size={16} /><h3>HEART Score (Cardiac Chest Pain)</h3>
      </div>
      <div className="mc-body">
        <Sel label="History" value={h} onChange={setH} options={[
          { label: '0 — Slightly suspicious', value: 0 },
          { label: '1 — Moderately suspicious', value: 1 },
          { label: '2 — Highly suspicious', value: 2 },
        ]} />
        <Sel label="ECG" value={e} onChange={setE} options={[
          { label: '0 — Normal', value: 0 },
          { label: '1 — Non-specific repolarisation', value: 1 },
          { label: '2 — Significant ST deviation', value: 2 },
        ]} />
        <Sel label="Age" value={age} onChange={setAge} options={[
          { label: '0 — < 45 years', value: 0 },
          { label: '1 — 45–64 years', value: 1 },
          { label: '2 — ≥ 65 years', value: 2 },
        ]} />
        <Sel label="Risk Factors" value={risk} onChange={setRisk} options={[
          { label: '0 — No known risk factors', value: 0 },
          { label: '1 — 1–2 risk factors', value: 1 },
          { label: '2 — ≥3 RF or DM or atherosclerosis', value: 2 },
        ]} />
        <Sel label="Troponin" value={trop} onChange={setTrop} options={[
          { label: '0 — ≤ normal limit', value: 0 },
          { label: '1 — 1–3× normal limit', value: 1 },
          { label: '2 — > 3× normal limit', value: 2 },
        ]} />
        <CalcResult score={`${score} / 10`} label={interp.label} color={interp.color} sub={interp.sub} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. NEWS2
// ═══════════════════════════════════════════════════════════════════════════
function NEWS2Calc() {
  const [rr, setRr]     = useState(0);
  const [spo2, setSpo2] = useState(0);
  const [o2, setO2]     = useState(0);
  const [sbp, setSbp]   = useState(0);
  const [hr, setHr]     = useState(0);
  const [cons, setCons] = useState(0);
  const [temp, setTemp] = useState(0);
  const score = rr + spo2 + o2 + sbp + hr + cons + temp;
  const interp = score === 0 ? { label: 'Low Risk', color: 'green' as const, sub: 'Minimum 12-hourly monitoring' }
    : score <= 4 ? { label: 'Low–Medium Risk', color: 'blue' as const, sub: 'Increase monitoring frequency' }
    : score <= 6 ? { label: 'Medium Risk — Urgent Review', color: 'amber' as const, sub: 'Urgent review by ward doctor / escalate' }
    : { label: 'High Risk — Emergency', color: 'red' as const, sub: 'Immediate response — critical care team' };
  return (
    <div className="mc-card" id="news2">
      <div className="mc-header" style={{ borderLeftColor: '#06b6d4' }}>
        <Activity size={16} /><h3>NEWS2 (Early Warning Score)</h3>
      </div>
      <div className="mc-body">
        <Sel label="Respiratory Rate" value={rr} onChange={setRr} note="/min" options={[
          { label: '≤ 8',     value: 3 },
          { label: '9–11',    value: 1 },
          { label: '12–20',   value: 0 },
          { label: '21–24',   value: 2 },
          { label: '≥ 25',    value: 3 },
        ]} />
        <Sel label="SpO₂ (Scale 1)" value={spo2} onChange={setSpo2} note="%" options={[
          { label: '≤ 91',    value: 3 },
          { label: '92–93',   value: 2 },
          { label: '94–95',   value: 1 },
          { label: '≥ 96',    value: 0 },
        ]} />
        <Sel label="Supplemental O₂" value={o2} onChange={setO2} options={[
          { label: 'Air',     value: 0 },
          { label: 'O₂',     value: 2 },
        ]} />
        <Sel label="Systolic BP" value={sbp} onChange={setSbp} note="mmHg" options={[
          { label: '≤ 90',    value: 3 },
          { label: '91–100',  value: 2 },
          { label: '101–110', value: 1 },
          { label: '111–219', value: 0 },
          { label: '≥ 220',   value: 3 },
        ]} />
        <Sel label="Heart Rate" value={hr} onChange={setHr} note="bpm" options={[
          { label: '≤ 40',    value: 3 },
          { label: '41–50',   value: 1 },
          { label: '51–90',   value: 0 },
          { label: '91–110',  value: 1 },
          { label: '111–130', value: 2 },
          { label: '≥ 131',   value: 3 },
        ]} />
        <Sel label="Consciousness" value={cons} onChange={setCons} options={[
          { label: 'Alert (A)',                value: 0 },
          { label: 'New confusion / CVPU (C)', value: 3 },
        ]} />
        <Sel label="Temperature" value={temp} onChange={setTemp} note="°C" options={[
          { label: '≤ 35.0',    value: 3 },
          { label: '35.1–36.0', value: 1 },
          { label: '36.1–38.0', value: 0 },
          { label: '38.1–39.0', value: 1 },
          { label: '≥ 39.1',    value: 2 },
        ]} />
        <CalcResult score={score} label={interp.label} color={interp.color} sub={interp.sub} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. Wells DVT
// ═══════════════════════════════════════════════════════════════════════════
function WellsDVTCalc() {
  const [cancer, setCancer] = useState(false);
  const [paralysis, setParalysis] = useState(false);
  const [bedrest, setBedrest] = useState(false);
  const [tender, setTender] = useState(false);
  const [calf, setCalf] = useState(false);
  const [pitting, setPitting] = useState(false);
  const [collat, setCollat] = useState(false);
  const [prevDvt, setPrevDvt] = useState(false);
  const [altDx, setAltDx] = useState(false);
  const score = [cancer, paralysis, bedrest, tender, calf, pitting, collat, prevDvt]
    .filter(Boolean).length - (altDx ? 2 : 0);
  const interp = score <= 0 ? { label: 'Low Probability', color: 'green' as const, sub: 'DVT unlikely — consider D-dimer' }
    : score <= 2 ? { label: 'Moderate Probability', color: 'amber' as const, sub: 'Do ultrasound / D-dimer' }
    : { label: 'High Probability', color: 'red' as const, sub: 'Proximal ultrasound recommended' };
  return (
    <div className="mc-card" id="wells-dvt">
      <div className="mc-header" style={{ borderLeftColor: '#ec4899' }}>
        <Droplets size={16} /><h3>Wells Score — DVT</h3>
      </div>
      <div className="mc-body">
        <Chk label="Active cancer" checked={cancer} onChange={setCancer} points={1} />
        <Chk label="Paralysis, paresis or recent plaster" checked={paralysis} onChange={setParalysis} points={1} />
        <Chk label="Bedridden ≥3 days or surgery within 4 weeks" checked={bedrest} onChange={setBedrest} points={1} />
        <Chk label="Localised tenderness along deep venous system" checked={tender} onChange={setTender} points={1} />
        <Chk label="Entire leg swollen" checked={calf} onChange={setCalf} points={1} />
        <Chk label="Calf swelling > 3 cm vs asymptomatic side" checked={pitting} onChange={setPitting} points={1} />
        <Chk label="Pitting oedema confined to symptomatic leg" checked={collat} onChange={setCollat} points={1} />
        <Chk label="Collateral superficial veins (non-varicose)" checked={prevDvt} onChange={setPrevDvt} points={1} />
        <Chk label="Alternative diagnosis at least as likely" checked={altDx} onChange={setAltDx} points={-2} />
        <CalcResult score={score} label={interp.label} color={interp.color} sub={interp.sub} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. Wells PE
// ═══════════════════════════════════════════════════════════════════════════
function WellsPECalc() {
  const [dvtSigns,  setDvtSigns]  = useState(false);
  const [peFirst,   setPeFirst]   = useState(false);
  const [hr100,     setHr100]     = useState(false);
  const [immob,     setImmob]     = useState(false);
  const [prevDvtPe, setPrevDvtPe] = useState(false);
  const [haem,      setHaem]      = useState(false);
  const [malig,     setMalig]     = useState(false);
  const score =
    (dvtSigns  ? 3 : 0) + (peFirst   ? 3 : 0) + (hr100 ? 1.5 : 0) +
    (immob     ? 1.5 : 0) + (prevDvtPe ? 1.5 : 0) + (haem ? 1 : 0) + (malig ? 1 : 0);
  const interp = score <= 1 ? { label: 'Low Probability', color: 'green' as const, sub: 'PE unlikely — PERC / D-dimer pathway' }
    : score <= 6 ? { label: 'Moderate Probability', color: 'amber' as const, sub: 'D-dimer or CTPA' }
    : { label: 'High Probability', color: 'red' as const, sub: 'Proceed to CTPA / anticoagulation' };
  return (
    <div className="mc-card" id="wells-pe">
      <div className="mc-header" style={{ borderLeftColor: '#f97316' }}>
        <Wind size={16} /><h3>Wells Score — PE</h3>
      </div>
      <div className="mc-body">
        <Chk label="Clinical signs of DVT" checked={dvtSigns} onChange={setDvtSigns} points={3} />
        <Chk label="PE is #1 diagnosis or equally likely" checked={peFirst} onChange={setPeFirst} points={3} />
        <Chk label="Heart rate > 100 bpm" checked={hr100} onChange={setHr100} />
        <Chk label="Immobilisation ≥ 3 days or surgery within 4 weeks" checked={immob} onChange={setImmob} />
        <Chk label="Previous DVT / PE" checked={prevDvtPe} onChange={setPrevDvtPe} />
        <Chk label="Haemoptysis" checked={haem} onChange={setHaem} points={1} />
        <Chk label="Malignancy (on treatment / treated within 6 months)" checked={malig} onChange={setMalig} points={1} />
        <CalcResult score={score} label={interp.label} color={interp.color} sub={interp.sub} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. Corrected Calcium
// ═══════════════════════════════════════════════════════════════════════════
function CorrectedCalciumCalc() {
  const [ca, setCa]     = useState('');
  const [alb, setAlb]   = useState('');
  const caVal  = parseFloat(ca);
  const albVal = parseFloat(alb);
  const corrected = !isNaN(caVal) && !isNaN(albVal)
    ? +(caVal + 0.02 * (40 - albVal)).toFixed(3) : null;
  const color = corrected === null ? 'neutral' as const
    : corrected < 2.2 ? 'blue' as const
    : corrected > 2.6 ? 'red' as const : 'green' as const;
  const label = corrected === null ? 'Enter values above'
    : corrected < 2.2 ? 'Hypocalcaemia'
    : corrected > 2.6 ? 'Hypercalcaemia' : 'Normal';
  return (
    <div className="mc-card" id="corr-ca">
      <div className="mc-header" style={{ borderLeftColor: '#e2e8f0' }}>
        <FlaskConical size={16} /><h3>Corrected Calcium</h3>
      </div>
      <div className="mc-body">
        <Num label="Measured Calcium" value={ca} onChange={setCa} unit="mmol/L" min={0} max={5} />
        <Num label="Albumin" value={alb} onChange={setAlb} unit="g/L" min={0} max={60} />
        <div className="mc-formula">
          <code>Corrected Ca = Ca + 0.02 × (40 − Albumin)</code>
        </div>
        <CalcResult
          score={corrected !== null ? `${corrected} mmol/L` : '—'}
          label={label} color={color}
          sub="Normal: 2.20–2.60 mmol/L" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  8. Anion Gap
// ═══════════════════════════════════════════════════════════════════════════
function AnionGapCalc() {
  const [na,  setNa]  = useState('');
  const [cl,  setCl]  = useState('');
  const [hco, setHco] = useState('');
  const [alb, setAlb] = useState('');
  const naV = parseFloat(na), clV = parseFloat(cl), hcoV = parseFloat(hco), albV = parseFloat(alb);
  const ag = !isNaN(naV) && !isNaN(clV) && !isNaN(hcoV) ? +(naV - clV - hcoV).toFixed(1) : null;
  const agCorr = ag !== null && !isNaN(albV) ? +(ag + 2.5 * (4 - albV / 10)).toFixed(1) : null;
  const color = ag === null ? 'neutral' as const : ag > 16 ? 'red' as const : 'green' as const;
  const label = ag === null ? 'Enter values above' : ag > 16 ? 'Elevated Anion Gap' : 'Normal Anion Gap';
  return (
    <div className="mc-card" id="anion-gap">
      <div className="mc-header" style={{ borderLeftColor: '#10b981' }}>
        <FlaskConical size={16} /><h3>Anion Gap</h3>
      </div>
      <div className="mc-body">
        <Num label="Sodium (Na⁺)" value={na} onChange={setNa} unit="mmol/L" />
        <Num label="Chloride (Cl⁻)" value={cl} onChange={setCl} unit="mmol/L" />
        <Num label="Bicarbonate (HCO₃⁻)" value={hco} onChange={setHco} unit="mmol/L" />
        <Num label="Albumin (optional)" value={alb} onChange={setAlb} unit="g/L" />
        <div className="mc-formula">
          <code>AG = Na − (Cl + HCO₃) · Normal: 8–16 mmol/L</code>
        </div>
        <CalcResult
          score={ag !== null ? `${ag}${agCorr !== null ? ` (corr: ${agCorr})` : ''}` : '—'}
          label={label} color={color}
          sub={ag !== null && agCorr !== null ? `Albumin-corrected: ${agCorr} mmol/L` : 'Add albumin for corrected AG'} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  9. Cockcroft-Gault eGFR
// ═══════════════════════════════════════════════════════════════════════════
function eGFRCalc() {
  const [age,  setAge]  = useState('');
  const [wt,   setWt]   = useState('');
  const [cr,   setCr]   = useState('');
  const [sex,  setSex]  = useState<'male' | 'female'>('male');
  const ageV = parseFloat(age), wtV = parseFloat(wt), crV = parseFloat(cr);
  const egfr = !isNaN(ageV) && !isNaN(wtV) && !isNaN(crV) && crV > 0
    ? Math.round(((140 - ageV) * wtV * (sex === 'female' ? 0.85 : 1)) / (72 * (crV / 88.4)))
    : null;
  const color = egfr === null ? 'neutral' as const
    : egfr >= 60 ? 'green' as const
    : egfr >= 30 ? 'amber' as const : 'red' as const;
  const ckd = egfr === null ? 'Enter values above'
    : egfr >= 90 ? 'Normal / CKD G1'
    : egfr >= 60 ? 'CKD G2 – Mildly reduced'
    : egfr >= 45 ? 'CKD G3a – Mild–Moderately reduced'
    : egfr >= 30 ? 'CKD G3b – Moderately–Severely reduced'
    : egfr >= 15 ? 'CKD G4 – Severely reduced'
    : 'CKD G5 – Kidney Failure';
  return (
    <div className="mc-card" id="egfr">
      <div className="mc-header" style={{ borderLeftColor: '#06b6d4' }}>
        <FlaskConical size={16} /><h3>eGFR (Cockcroft-Gault)</h3>
      </div>
      <div className="mc-body">
        <Num label="Age" value={age} onChange={setAge} unit="years" min={1} max={120} step={1} />
        <Num label="Weight" value={wt} onChange={setWt} unit="kg" min={1} max={300} />
        <Num label="Serum Creatinine" value={cr} onChange={setCr} unit="µmol/L" min={1} max={2000} step={1} />
        <div className="mc-field">
          <label className="mc-label">Sex</label>
          <div className="mc-radio-group">
            <label className="mc-radio"><input type="radio" checked={sex === 'male'} onChange={() => setSex('male')} /> Male</label>
            <label className="mc-radio"><input type="radio" checked={sex === 'female'} onChange={() => setSex('female')} /> Female</label>
          </div>
        </div>
        <div className="mc-formula">
          <code>((140 − age) × weight × [0.85 if ♀]) / (72 × Cr[mg/dL])</code>
        </div>
        <CalcResult
          score={egfr !== null ? `${egfr} mL/min` : '—'}
          label={ckd} color={color}
          sub="≥60 = Normal · 30–59 = CKD G3 · <30 = Severe" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  10. BMI
// ═══════════════════════════════════════════════════════════════════════════
function BMICalc() {
  const [wt, setWt] = useState('');
  const [ht, setHt] = useState('');
  const wtV = parseFloat(wt), htV = parseFloat(ht);
  const bmi = !isNaN(wtV) && !isNaN(htV) && htV > 0
    ? +(wtV / ((htV / 100) ** 2)).toFixed(1) : null;
  const color = bmi === null ? 'neutral' as const
    : bmi < 18.5 ? 'blue' as const
    : bmi < 25   ? 'green' as const
    : bmi < 30   ? 'amber' as const : 'red' as const;
  const label = bmi === null ? 'Enter values above'
    : bmi < 18.5 ? 'Underweight'
    : bmi < 25   ? 'Normal Weight'
    : bmi < 30   ? 'Overweight'
    : bmi < 35   ? 'Obese Class I'
    : bmi < 40   ? 'Obese Class II' : 'Obese Class III (Morbid)';
  return (
    <div className="mc-card" id="bmi">
      <div className="mc-header" style={{ borderLeftColor: '#f59e0b' }}>
        <Activity size={16} /><h3>BMI Calculator</h3>
      </div>
      <div className="mc-body">
        <Num label="Weight" value={wt} onChange={setWt} unit="kg" min={1} max={500} />
        <Num label="Height" value={ht} onChange={setHt} unit="cm" min={50} max={250} step={1} />
        <div className="mc-formula">
          <code>BMI = Weight (kg) / Height² (m)</code>
        </div>
        <CalcResult score={bmi !== null ? bmi : '—'} label={label} color={color}
          sub="<18.5 Under · 18.5–24.9 Normal · 25–29.9 Over · ≥30 Obese" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  11. Paediatric Weight (APLS)
// ═══════════════════════════════════════════════════════════════════════════
function PaedsWeightCalc() {
  const [ageYr,  setAgeYr]  = useState('');
  const [ageMo,  setAgeMo]  = useState('');
  const yrV = parseFloat(ageYr), moV = parseFloat(ageMo);
  let wt: number | null = null;
  let formula = '';
  if (!isNaN(moV) && ageMo !== '' && moV < 12) {
    wt = +(0.5 * moV + 4).toFixed(1);
    formula = '0.5 × months + 4';
  } else if (!isNaN(yrV) && ageYr !== '') {
    if (yrV >= 1 && yrV <= 5) {
      wt = +(2 * yrV + 8).toFixed(1);
      formula = '(2 × age) + 8 (1–5 years)';
    } else if (yrV <= 12) {
      wt = +(3 * yrV + 7).toFixed(1);
      formula = '(3 × age) + 7 (6–12 years)';
    }
  }
  return (
    <div className="mc-card" id="paeds-wt">
      <div className="mc-header" style={{ borderLeftColor: '#a78bfa' }}>
        <Baby size={16} /><h3>Paediatric Weight (APLS)</h3>
      </div>
      <div className="mc-body">
        <div className="mc-hint">For infants enter months only. For older children enter years.</div>
        <Num label="Age (months, infants &lt;12 months)" value={ageMo} onChange={setAgeMo} unit="months" min={0} max={11} step={1} />
        <Num label="Age (years, children 1–12)" value={ageYr} onChange={setAgeYr} unit="years" min={1} max={12} step={1} />
        {formula && <div className="mc-formula"><code>{formula}</code></div>}
        <CalcResult
          score={wt !== null ? `${wt} kg` : '—'}
          label={wt !== null ? 'Estimated Weight' : 'Enter age above'}
          color={wt !== null ? 'blue' : 'neutral'}
          sub="Estimated — weigh the child when possible" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  12. Alvarado Score (Appendicitis)
// ═══════════════════════════════════════════════════════════════════════════
function AlvaradoCalc() {
  const [migratePain, setMigratePain] = useState(false);
  const [anorexia, setAnorexia]       = useState(false);
  const [nausea, setNausea]           = useState(false);
  const [tenderness, setTenderness]   = useState(false);
  const [rebound, setRebound]         = useState(false);
  const [elevated, setElevated]       = useState(false);
  const [leukocytosis, setLeuko]      = useState(false);
  const [tempRise, setTempRise]       = useState(false);
  const score =
    (migratePain ? 1 : 0) + (anorexia ? 1 : 0) + (nausea ? 1 : 0) +
    (tenderness ? 2 : 0) + (rebound ? 1 : 0) + (elevated ? 2 : 0) +
    (leukocytosis ? 1 : 0) + (tempRise ? 1 : 0);
  const interp = score <= 3 ? { label: 'Low — Unlikely Appendicitis', color: 'green' as const, sub: 'Discharge with safety net' }
    : score <= 6 ? { label: 'Moderate — Possible Appendicitis', color: 'amber' as const, sub: 'Active observation / surgical review' }
    : { label: 'High — Probable Appendicitis', color: 'red' as const, sub: 'Surgical consult / consider theatre' };
  return (
    <div className="mc-card" id="alvarado">
      <div className="mc-header" style={{ borderLeftColor: '#ef4444' }}>
        <Activity size={16} /><h3>Alvarado Score (Appendicitis)</h3>
      </div>
      <div className="mc-body">
        <Chk label="Migration of pain to RIF" checked={migratePain} onChange={setMigratePain} points={1} />
        <Chk label="Anorexia" checked={anorexia} onChange={setAnorexia} points={1} />
        <Chk label="Nausea / Vomiting" checked={nausea} onChange={setNausea} points={1} />
        <Chk label="Tenderness in RIF" checked={tenderness} onChange={setTenderness} points={2} />
        <Chk label="Rebound tenderness" checked={rebound} onChange={setRebound} points={1} />
        <Chk label="Elevated temperature (> 37.3°C)" checked={elevated} onChange={setElevated} points={2} />
        <Chk label="Leukocytosis (WBC > 10 × 10⁹/L)" checked={leukocytosis} onChange={setLeuko} points={1} />
        <Chk label="Left shift (neutrophil predominance)" checked={tempRise} onChange={setTempRise} points={1} />
        <CalcResult score={`${score} / 10`} label={interp.label} color={interp.color} sub={interp.sub} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Calculator registry
// ═══════════════════════════════════════════════════════════════════════════
const CALCS: { id: string; category: Exclude<Category, 'all'>; element: React.ReactNode }[] = [
  { id: 'heart',    category: 'cardiac',     element: <HEARTCalc /> },
  { id: 'news2',    category: 'general',     element: <NEWS2Calc /> },
  { id: 'curb65',   category: 'respiratory', element: <Curb65Calc /> },
  { id: 'wells-pe', category: 'respiratory', element: <WellsPECalc /> },
  { id: 'gcs',      category: 'neurology',   element: <GCSCalc /> },
  { id: 'wells-dvt',category: 'vascular',    element: <WellsDVTCalc /> },
  { id: 'corr-ca',  category: 'biochem',     element: <CorrectedCalciumCalc /> },
  { id: 'anion-gap',category: 'biochem',     element: <AnionGapCalc /> },
  { id: 'egfr',     category: 'biochem',     element: <eGFRCalc /> },
  { id: 'bmi',      category: 'general',     element: <BMICalc /> },
  { id: 'paeds-wt', category: 'paeds',       element: <PaedsWeightCalc /> },
  { id: 'alvarado', category: 'general',     element: <AlvaradoCalc /> },
];

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function MedicalCalculator() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const visible = CALCS.filter(c =>
    activeCategory === 'all' || c.category === activeCategory
  );

  return (
    <div className="medcalc-page">
      <div className="page-header">
        <h1><Calculator size={26} /> Medical Calculators</h1>
        <p>Clinical decision support tools — always correlate with clinical judgement.</p>
      </div>

      {/* Category filter */}
      <div className="medcalc-cats">
        {CATS.map(cat => (
          <button
            key={cat.id}
            className={`medcalc-cat-btn${activeCategory === cat.id ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
            {cat.id !== 'all' && (
              <span className="medcalc-cat-count">
                {CALCS.filter(c => c.category === cat.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Calculator grid */}
      <div className="medcalc-grid">
        {visible.map(c => (
          <div key={c.id}>{c.element}</div>
        ))}
      </div>

      <p className="medcalc-disclaimer">
        These calculators are for clinical decision support only. Always correlate with full clinical assessment.
        Scores do not replace individual patient evaluation or local guidelines.
      </p>
    </div>
  );
}
