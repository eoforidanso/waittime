import { useState, useMemo } from 'react';
import { Pill, Search, X } from 'lucide-react';

interface DrugEntry {
  name: string;
  routes?: string;
  indications: string;
  dose: string;
  max?: string;
  notes?: string;
  contraindications?: string;
}

interface DrugCategory {
  id: string;
  title: string;
  accent: string;
  drugs: DrugEntry[];
}

const DRUG_CATEGORIES: DrugCategory[] = [
  {
    id: 'resus',
    title: 'Resuscitation',
    accent: '#dc2626',
    drugs: [
      { name: 'Adrenaline (Epinephrine)', routes: 'IV/IO/ET', indications: 'Cardiac arrest (PEA/asystole/VF)', dose: '1 mg IV/IO every 3–5 min', notes: 'First dose in non-shockable rhythms immediately; in VF/pVT after 3rd shock' },
      { name: 'Amiodarone', routes: 'IV/IO', indications: 'Shockable cardiac arrest (VF/pVT)', dose: '300 mg IV bolus after 3rd shock', max: '900 mg/24hr', notes: '150 mg if refractory VF/pVT after 5th shock' },
      { name: 'Lidocaine', routes: 'IV/IO', indications: 'VF/pVT (alternative to amiodarone)', dose: '1–1.5 mg/kg IV bolus', max: '3 mg/kg', notes: 'If amiodarone unavailable' },
      { name: 'Sodium Bicarbonate', routes: 'IV/IO', indications: 'Hyperkalaemia, TCA overdose, pH < 7.1', dose: '1 mmol/kg (1 mL/kg of 8.4%)', notes: 'Not routine in cardiac arrest' },
      { name: 'Calcium Chloride 10%', routes: 'IV/IO', indications: 'Hyperkalaemia, hypocalcaemia, Ca-blocker OD', dose: '10 mL IV over 2–5 min' },
      { name: 'Atropine', routes: 'IV', indications: 'Symptomatic bradycardia', dose: '500 mcg IV, repeat every 3–5 min', max: '3 mg total', notes: 'Not recommended in cardiac arrest' },
    ],
  },
  {
    id: 'analgesia',
    title: 'Analgesia & Sedation',
    accent: '#8b5cf6',
    drugs: [
      { name: 'Morphine', routes: 'IV/IM/SC/PO', indications: 'Moderate–severe pain', dose: 'IV: 2–5 mg q4h; PO: 2.5–10 mg q4h', notes: 'Caution respiratory depression; halve dose in elderly/renal impairment' },
      { name: 'Fentanyl', routes: 'IV/IN', indications: 'Acute severe pain', dose: '1–2 mcg/kg IV; IN: 1.5 mcg/kg', max: '200 mcg', notes: 'Rapid onset; short duration; preferred in haemodynamic instability' },
      { name: 'Ketamine', routes: 'IV/IM', indications: 'Procedural sedation, analgesia', dose: 'Dissociative: 1–2 mg/kg IV; sub-dissociative: 0.1–0.5 mg/kg IV', notes: 'Preserve airway reflexes; consider co-prescribing midazolam' },
      { name: 'Midazolam', routes: 'IV/IM/IN', indications: 'Sedation, procedural, status epilepticus', dose: 'Sedation: 1–2.5 mg IV; seizure: 10 mg IM/IN', notes: 'Caution respiratory depression; have flumazenil available' },
      { name: 'Paracetamol', routes: 'IV/PO/PR', indications: 'Mild–moderate pain, antipyretic', dose: 'IV/PO: 1 g q4–6h', max: '4 g/24hr (2 g if <50 kg or liver disease)', notes: 'Check for hepatic impairment' },
      { name: 'Ibuprofen', routes: 'PO', indications: 'Mild–moderate pain, inflammation', dose: '400 mg TDS with food', max: '2.4 g/24hr', contraindications: 'GI bleed, renal impairment, AKI, asthma (in susceptible)', notes: 'Prescribe PPI cover in at-risk patients' },
      { name: 'Entonox (50% N₂O/O₂)', routes: 'Inhaled', indications: 'Procedural analgesia', dose: 'Self-administered via mask/mouthpiece', notes: 'Avoid in pneumothorax, bowel obstruction, facial injuries, B12 deficiency' },
      { name: 'Tramadol', routes: 'PO/IV', indications: 'Moderate pain', dose: 'PO/IV: 50–100 mg q4–6h', max: '400 mg/24hr', notes: 'Reduce dose in renal/hepatic impairment; serotonin syndrome risk with SSRIs' },
    ],
  },
  {
    id: 'cardiac',
    title: 'Cardiac Emergencies',
    accent: '#ef4444',
    drugs: [
      { name: 'Aspirin', routes: 'PO (chewed)', indications: 'ACS — STEMI/NSTEMI', dose: '300 mg stat loading dose', notes: 'Unless true aspirin allergy (not intolerance)' },
      { name: 'Ticagrelor', routes: 'PO', indications: 'ACS with PCI or NSTEMI', dose: '180 mg loading, then 90 mg BD', notes: 'First-line P2Y12 inhibitor in ACS. Avoid if on anticoagulants without haematology review' },
      { name: 'Clopidogrel', routes: 'PO', indications: 'ACS (if ticagrelor contraindicated)', dose: '300 mg loading, then 75 mg OD', notes: 'Alternative to ticagrelor; may be used in thrombolysis' },
      { name: 'GTN (Glyceryl Trinitrate)', routes: 'SL/IV/Patch', indications: 'ACS chest pain, acute LVF, hypertensive emergency', dose: 'SL: 400–800 mcg; IV: 10–200 mcg/min', contraindications: 'Systolic BP < 90 mmHg, sildenafil/tadalafil use within 24–48hr' },
      { name: 'Metoprolol', routes: 'IV/PO', indications: 'ACS, SVT, AF rate control', dose: 'IV: 5 mg q5 min ×3; PO: 25–100 mg BD', contraindications: 'Cardiogenic shock, HR < 60, AV block II/III, severe asthma' },
      { name: 'Adenosine', routes: 'IV rapid bolus', indications: 'SVT (narrow complex)', dose: '6 mg rapid IV bolus; 12 mg if no response; third dose 18 mg', notes: 'Warn patient of transient chest tightness/flushing; use large vein; avoid in asthma, WPW' },
      { name: 'Furosemide', routes: 'IV/PO', indications: 'Acute pulmonary oedema, fluid overload', dose: 'IV: 40–80 mg; PO: 20–80 mg', notes: 'Adjust for renal function; double if on oral diuretics' },
      { name: 'Alteplase (tPA)', routes: 'IV', indications: 'STEMI (if primary PCI not available), massive PE, acute ischaemic stroke', dose: 'AIS: 0.9 mg/kg (max 90 mg); STEMI: 100 mg over 90 min; PE: 100 mg over 2hr', contraindications: 'Recent surgery/trauma, bleeding risk, stroke history see full criteria', notes: 'Strict contraindication checklist required; have atropine/resuscitation ready' },
    ],
  },
  {
    id: 'respiratory',
    title: 'Respiratory',
    accent: '#06b6d4',
    drugs: [
      { name: 'Salbutamol', routes: 'Nebulised/IV/MDI', indications: 'Acute asthma, COPD exacerbation, hyperkalaemia', dose: 'Neb: 2.5–5 mg q20 min; severe/continuous: 5–10 mg/hr; IV: 3–20 mcg/min; Hyperk: 10–20 mg neb', notes: 'Back-to-back nebulisers in life-threatening asthma' },
      { name: 'Ipratropium Bromide', routes: 'Nebulised', indications: 'Severe asthma, acute COPD', dose: '500 mcg neb q4–6h (or Q20 min in acute severe asthma)', notes: 'Do not use as sole bronchodilator; combine with salbutamol' },
      { name: 'Adrenaline (IM)', routes: 'IM', indications: 'Anaphylaxis', dose: '500 mcg IM (0.5 mL of 1:1000) anterolateral thigh; can repeat every 5 min', notes: 'No absolute contraindications in anaphylaxis. 300 mcg (EpiPen) if auto-injector used' },
      { name: 'Hydrocortisone', routes: 'IV/IM', indications: 'Anaphylaxis, severe asthma, adrenal crisis', dose: 'Anaphylaxis/asthma: 200 mg IV; Adrenal: 100 mg IV', notes: 'Secondary action after adrenaline/salbutamol; onset 4–6 hr' },
      { name: 'Magnesium Sulphate', routes: 'IV', indications: 'Life-threatening/severe asthma, eclampsia, torsades', dose: 'Asthma: 2 g IV over 20 min (single dose); Eclampsia: 4 g loading, 1 g/hr maintenance', notes: 'Monitor DTRs, respiratory rate, and urine output for magnesium toxicity; have calcium gluconate ready' },
      { name: 'Dexamethasone', routes: 'IV/IM/PO', indications: 'Croup, COVID-19 (O₂ requiring), cerebral oedema, anti-emetic', dose: 'Croup: 0.15 mg/kg (PO/IM/IV); Cerebral oedema: 10 mg IV loading, 4 mg q6h; COVID: 6 mg OD', notes: 'Avoid prolonged use without specialist input' },
      { name: 'Heliox (80:20 He:O₂)', routes: 'Inhaled via mask', indications: 'Severe upper airway obstruction, refractory asthma', dose: 'Continuous via tight-fitting mask', notes: 'Reduces airway resistance; not widely available; lowers FiO₂ available' },
    ],
  },
  {
    id: 'neuro',
    title: 'Neurological Emergencies',
    accent: '#a78bfa',
    drugs: [
      { name: 'Lorazepam', routes: 'IV/IM/Buccal', indications: 'Status epilepticus (first-line)', dose: 'IV: 4 mg over 2 min; IM: 4 mg; repeat once after 10 min', notes: 'If IV not available use buccal midazolam or rectal diazepam' },
      { name: 'Phenytoin / Fosphenytoin', routes: 'IV', indications: 'Status epilepticus (2nd line)', dose: 'Phenytoin: 20 mg/kg IV at max 50 mg/min with ECG; Fosphenytoin: 20 mg PE/kg', contraindications: 'Sinoatrial block, 2nd/3rd degree AV block', notes: 'Cardiac monitoring mandatory; extravasation risk with phenytoin; levetiracetam increasingly preferred' },
      { name: 'Levetiracetam', routes: 'IV', indications: 'Status epilepticus (2nd line, preferred alternative)', dose: '60 mg/kg IV (max 4,500 mg) over 10 min', notes: 'Fewer drug interactions and cardiac side effects than phenytoin' },
      { name: 'Mannitol 20%', routes: 'IV', indications: 'Raised ICP, herniation', dose: '0.25–1 g/kg IV over 15–30 min', notes: 'Check osmolality (target osmolar gap < 20); avoid if renal failure' },
      { name: 'Alteplase (AIS)', routes: 'IV', indications: 'Acute ischaemic stroke (within 4.5 hrs)', dose: '0.9 mg/kg (max 90 mg); 10% as bolus, rest over 60 min', contraindications: 'Haemorrhagic stroke, BP > 185/110, recent surgery, anticoagulation, glucose < 2.7 or > 22', notes: 'Must have CT head before giving; call stroke team' },
      { name: 'Thiamine (Pabrinex)', routes: 'IV', indications: "Wernicke's encephalopathy, alcohol-related, malnourished", dose: '2 pairs of ampoules IV TDS for 3–5 days, then 1 pair OD', notes: 'Give BEFORE glucose in suspected Wernicke\'s; anaphylaxis risk — have resus equipment ready' },
      { name: 'Dextrose 10%', routes: 'IV', indications: 'Hypoglycaemia', dose: '150–200 mL IV (equals ≈15–20 g glucose); repeat BM in 15 min', notes: '50% dextrose no longer recommended routinely (extravasation risk); oral glucose if conscious' },
    ],
  },
  {
    id: 'sepsis',
    title: 'Sepsis & Antimicrobials',
    accent: '#f97316',
    drugs: [
      { name: 'Piperacillin-Tazobactam (Tazocin)', routes: 'IV', indications: 'Severe sepsis (broad-spectrum)', dose: '4.5 g IV q6–8h (q6h in severe sepsis)', notes: 'Check allergy; adjust in renal impairment; use with gentamicin in neutropenic sepsis' },
      { name: 'Meropenem', routes: 'IV', indications: 'Life-threatening sepsis, resistant organisms', dose: '1–2 g IV q8h; meningitis: 2 g q8h', notes: 'Reserve for severe/resistant cases per local microbiology guidance' },
      { name: 'Cefuroxime', routes: 'IV/PO', indications: 'CAP, UTI, soft tissue infections', dose: 'IV: 1.5 g TDS; PO: 500 mg BD', notes: 'Caution in penicillin allergy (10% cross-reactivity)' },
      { name: 'Co-amoxiclav (Augmentin)', routes: 'IV/PO', indications: 'CAP, abdominal infections, animal bites', dose: 'IV: 1.2 g TDS; PO: 625 mg TDS', contraindications: 'Previous jaundice/hepatic dysfunction with co-amoxiclav' },
      { name: 'Clarithromycin', routes: 'IV/PO', indications: 'CAP atypicals, skin infections', dose: 'IV/PO: 500 mg BD', notes: 'Significant drug interactions (statins, warfarin, amiodarone); increase QTc risk' },
      { name: 'Metronidazole', routes: 'IV/PO', indications: 'Anaerobic/abdominal/pelvic infections, C. diff', dose: 'IV: 500 mg TDS; PO: 400–500 mg TDS', notes: 'Avoid alcohol during treatment and 48hr after' },
      { name: 'Gentamicin', routes: 'IV', indications: 'Gram-negative sepsis, neutropenic febrile', dose: '5–7 mg/kg once daily (weight-based); reduce in renal impairment', notes: 'Levels and renal function mandatory; ototoxic and nephrotoxic; avoid prolonged courses' },
      { name: 'Noradrenaline', routes: 'IV (via CVC/large bore)', indications: 'Septic shock (vasopressor)', dose: '0.1–2 mcg/kg/min IV infusion, titrated to MAP ≥65', notes: 'First-line vasopressor in septic shock per Surviving Sepsis Campaign; requires ITU care' },
    ],
  },
  {
    id: 'anticoag',
    title: 'Anticoagulation',
    accent: '#f43f5e',
    drugs: [
      { name: 'Enoxaparin (Clexane)', routes: 'SC', indications: 'DVT/PE treatment, ACS', dose: 'Treatment DVT/PE: 1 mg/kg BD (or 1.5 mg/kg OD); ACS NSTEMI: 1 mg/kg BD', notes: 'Adjust dose if eGFR < 30; anti-Xa monitoring in obesity, renal impairment, pregnancy. Avoid if eGFR < 15' },
      { name: 'Unfractionated Heparin', routes: 'IV', indications: 'ACS, massive PE, renal failure, bridge anticoagulation', dose: 'Bolus 5,000 IU, infusion per APTT nomogram (typically 18 IU/kg/hr)', notes: 'Reversible with protamine; frequent APTT monitoring required' },
      { name: 'Rivaroxaban', routes: 'PO', indications: 'DVT/PE treatment, AF, ACS aftercare', dose: 'Acute DVT/PE: 15 mg BD ×21 days, then 20 mg OD; AF: 20 mg OD', contraindications: 'eGFR < 15, pregnancy, active bleeding', notes: 'No routine monitoring; reversal with andexanet alfa' },
      { name: 'Apixaban', routes: 'PO', indications: 'DVT/PE treatment, AF', dose: 'Acute: 10 mg BD ×7 days, then 5 mg BD; AF: 2.5–5 mg BD', contraindications: 'eGFR < 15, active bleeding' },
      { name: 'Warfarin', routes: 'PO', indications: 'AF, mechanical heart valves, DVT/PE (long-term)', dose: 'Variable; target INR 2–3 (2.5–3.5 mechanical valves)', notes: 'Multiple drug interactions; bridging with LMWH until therapeutic INR' },
      { name: 'Protamine Sulphate', routes: 'IV (slow)', indications: 'Reversal of unfractionated heparin', dose: '1 mg per 100 IU heparin in last 2–2.5hr (max 50 mg)', notes: 'Risk of hypotension, bradycardia, anaphylaxis — administer slowly' },
    ],
  },
  {
    id: 'tox',
    title: 'Toxicology / Antidotes',
    accent: '#10b981',
    drugs: [
      { name: 'N-Acetylcysteine (NAC)', routes: 'IV', indications: 'Paracetamol overdose', dose: '150 mg/kg in 200 mL 5% glucose over 1 hr, then 50 mg/kg in 500 mL over 4 hr, then 100 mg/kg in 1L over 16 hr', notes: 'Start if paracetamol level above treatment line at ≥4hr post-ingestion; consult TOXBASE' },
      { name: 'Naloxone', routes: 'IV/IM/IN', indications: 'Opioid reversal', dose: 'IV: 0.4–2 mg; IN/IM: 2 mg; repeat every 2–3 min; infusion if needed', notes: 'Duration shorter than most opioids — monitor for re-narcotisation; titrate to adequate respiration not full reversal' },
      { name: 'Flumazenil', routes: 'IV', indications: 'Benzodiazepine reversal (diagnostic use only)', dose: '0.2 mg IV over 30s; 0.1 mg q60s, max 1 mg', contraindications: 'Known epilepsy on benzodiazepines, mixed TCA overdose', notes: 'NOT for routine use in mixed overdose — can precipitate seizures' },
      { name: 'Glucagon', routes: 'IM/IV', indications: 'Beta-blocker/Ca-channel blocker overdose, hypoglycaemia', dose: 'BB OD: 5–10 mg IV bolus, then 1–5 mg/hr infusion; Hypoglycaemia: 1 mg IM', notes: 'Store in fridge; resus response poor in malnourished patients' },
      { name: 'Digoxin Fab (DigiFab)', routes: 'IV', indications: 'Life-threatening digoxin toxicity', dose: 'Dose in vials based on serum level/dose ingested (consult calculator)', notes: 'Contact National Poisons Information Service (0344 892 0111)' },
      { name: 'Hydroxocobalamin', routes: 'IV', indications: 'Cyanide poisoning (smoke inhalation)', dose: '5 g IV over 15 min', notes: 'Turns urine/skin red; interfere with co-oximetry and creatinine assays' },
      { name: 'Atropine (OP poisoning)', routes: 'IV/IM', indications: 'Organophosphate poisoning', dose: '2 mg IV/IM every 5–10 min until secretions dry', notes: 'Large doses may be required (100+ mg in severe cases); titrate to drying of secretions not HR' },
    ],
  },
  {
    id: 'obstetric',
    title: 'Obstetric Emergencies',
    accent: '#ec4899',
    drugs: [
      { name: 'Oxytocin (Syntocinon)', routes: 'IV/IM', indications: 'PPH — active management of 3rd stage', dose: 'IM: 10 IU stat; PPH infusion: 40 IU in 500 mL NS over 4 hr', notes: 'Causes hypotension if given as IV bolus — slow IV injection or infusion only' },
      { name: 'Tranexamic Acid', routes: 'IV', indications: 'PPH (within 3 hr of delivery), major haemorrhage', dose: '1 g IV over 10 min; repeat 1 g if bleeding continues after 30 min', notes: 'Start as soon as PPH recognised — benefit diminishes after 3 hr' },
      { name: 'Magnesium Sulphate (Eclampsia)', routes: 'IV', indications: 'Pre-eclampsia seizure prophylaxis and treatment', dose: 'Loading: 4 g IV over 5–20 min; maintenance: 1–2 g/hr', notes: 'Monitor RR > 16, UO > 25 mL/hr, DTRs; antidote calcium gluconate 1 g IV' },
      { name: 'Labetalol', routes: 'IV/PO', indications: 'Hypertensive crisis in pregnancy', dose: 'IV: 20 mg slow bolus, repeat 40–80 mg q10 min; max 300 mg; infusion 20–160 mg/hr', contraindications: 'Asthma, severe bradycardia, cardiogenic shock' },
      { name: 'Hydralazine', routes: 'IV', indications: 'Hypertensive emergency in pregnancy', dose: '5 mg IV over 1–2 min, repeat 5–10 mg every 20–30 min; max 20 mg', notes: 'May cause maternal hypotension and fetal distress; monitor CTG' },
    ],
  },
  {
    id: 'paeds',
    title: 'Paediatric Doses (Weight-based)',
    accent: '#3b82f6',
    drugs: [
      { name: 'Adrenaline (Cardiac arrest)', routes: 'IV/IO', indications: 'Paediatric cardiac arrest', dose: '10 mcg/kg IV/IO (0.1 mL/kg of 1:10,000)', notes: 'Repeat every 3–5 min; no upper limit in arrest' },
      { name: 'Adenosine (SVT)', routes: 'IV (rapid flush)', indications: 'SVT in children', dose: '0.1 mg/kg; 0.2 mg/kg if no response; 0.3 mg/kg third dose', max: '12 mg per dose', notes: 'Rapid flush essential; record ECG' },
      { name: 'Atropine (Bradycardia)', routes: 'IV/IO', indications: 'Symptomatic bradycardia, pre-intubation', dose: '20 mcg/kg IV', max: '600 mcg', notes: 'Minimum dose 100 mcg to avoid paradoxical bradycardia' },
      { name: 'Lorazepam (Seizures)', routes: 'IV/IO', indications: 'Status epilepticus in children', dose: '0.1 mg/kg IV/IO', max: '4 mg per dose', notes: 'Can repeat once after 10 min' },
      { name: 'Paracetamol (Paeds)', routes: 'PO/PR/IV', indications: 'Pain, fever', dose: 'PO/PR: 15 mg/kg q4–6h; IV: < 10 kg: 7.5 mg/kg; ≥10 kg: 15 mg/kg', max: '60 mg/kg/day (PO); 60 mg/kg/day IV' },
      { name: 'Ibuprofen (Paeds)', routes: 'PO', indications: 'Pain, fever (≥ 3 months)', dose: '5–10 mg/kg q6–8h', max: '40 mg/kg/day', contraindications: 'Dehydration, eGFR < 30, < 3 months age' },
      { name: 'Salbutamol Neb (Paeds)', routes: 'Nebulised', indications: 'Acute asthma', dose: '< 5yr: 2.5 mg; ≥ 5yr: 5 mg; severe/life-threatening: continuous 5 mg/hr', notes: 'Drive with O₂ at 6–8 L/min' },
      { name: 'Dextrose 10% (Paeds)', routes: 'IV', indications: 'Neonatal/paediatric hypoglycaemia', dose: '2 mL/kg IV bolus (neonate); 2–5 mL/kg older child', notes: 'Recheck BM after 15 min; neonates: target BM ≥ 2.6' },
    ],
  },
];

export default function DrugReference() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DRUG_CATEGORIES.map(cat => ({
      ...cat,
      drugs: cat.drugs.filter(d =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.indications.toLowerCase().includes(q) ||
        (d.dose ?? '').toLowerCase().includes(q) ||
        (d.notes ?? '').toLowerCase().includes(q)
      ),
    })).filter(cat => {
      if (activeCategory && cat.id !== activeCategory) return false;
      return cat.drugs.length > 0;
    });
  }, [query, activeCategory]);

  const totalDrugs = DRUG_CATEGORIES.reduce((s, c) => s + c.drugs.length, 0);

  return (
    <div className="drug-ref-page">
      <div className="page-header">
        <h1><Pill size={26} /> Drug Reference</h1>
        <p>Common ER drug doses &amp; protocols (UK/NHS). Always check current BNF, local guidelines and patient allergies.</p>
      </div>

      <div className="lab-ref-toolbar">
        <div className="lab-ref-search-wrap">
          <Search size={15} className="lab-ref-search-icon" />
          <input
            type="text"
            className="lab-ref-search"
            placeholder={`Search ${totalDrugs} drugs…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="lab-ref-search-clear" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>
        <div className="lab-ref-cat-filters">
          <button className={`lab-ref-cat-btn${!activeCategory ? ' active' : ''}`} onClick={() => setActiveCategory(null)}>All</button>
          {DRUG_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`lab-ref-cat-btn${activeCategory === cat.id ? ' active' : ''}`}
              style={activeCategory === cat.id ? { borderColor: cat.accent, color: cat.accent } : {}}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            >
              {cat.title.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="lab-ref-empty">No drugs match &ldquo;{query}&rdquo;</div>
      )}

      <div className="drug-ref-grid">
        {filtered.map(cat => (
          <div key={cat.id} className="drug-ref-card">
            <div className="drug-ref-card-header" style={{ borderLeftColor: cat.accent }}>
              <h3 style={{ color: cat.accent }}>{cat.title}</h3>
            </div>
            {cat.drugs.map((d, i) => (
              <div key={i} className="drug-entry">
                <div className="drug-name-row">
                  <span className="drug-name">{d.name}</span>
                  {d.routes && <span className="drug-routes">{d.routes}</span>}
                </div>
                <div className="drug-indication">{d.indications}</div>
                <div className="drug-dose-row">
                  <span className="drug-label">Dose:</span>
                  <span className="drug-dose">{d.dose}</span>
                </div>
                {d.max && (
                  <div className="drug-dose-row">
                    <span className="drug-label">Max:</span>
                    <span className="drug-dose drug-max">{d.max}</span>
                  </div>
                )}
                {d.contraindications && (
                  <div className="drug-contra">⚠ {d.contraindications}</div>
                )}
                {d.notes && <div className="drug-notes">{d.notes}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="lab-ref-disclaimer">
        For educational reference only. Always consult the current BNF, drug datasheets, and local hospital formulary.
        Verify patient weight, renal/hepatic function, allergies and interactions before prescribing.
      </p>
    </div>
  );
}
