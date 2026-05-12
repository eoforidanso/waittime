import { useState, useMemo } from 'react';
import { FlaskConical, Search, X } from 'lucide-react';

interface LabTest {
  name: string;
  value?: string;       // combined if same for both sexes
  male?: string;
  female?: string;
  unit: string;
  notes?: string;
}

interface LabCategory {
  id: string;
  title: string;
  accent: string;
  tests: LabTest[];
}

const LAB_CATEGORIES: LabCategory[] = [
  {
    id: 'fbc',
    title: 'Full Blood Count (FBC)',
    accent: '#f43f5e',
    tests: [
      { name: 'Haemoglobin (Hb)',        male: '130–175',   female: '120–160',  unit: 'g/L' },
      { name: 'Haematocrit (Hct)',        male: '0.40–0.52', female: '0.36–0.47', unit: 'L/L' },
      { name: 'Red Cell Count (RBC)',     male: '4.5–6.5',   female: '3.9–5.6',  unit: '×10¹²/L' },
      { name: 'MCV',                      value: '80–100',   unit: 'fL' },
      { name: 'MCH',                      value: '27–33',    unit: 'pg' },
      { name: 'MCHC',                     value: '315–360',  unit: 'g/L' },
      { name: 'White Cell Count (WBC)',   value: '4.0–11.0', unit: '×10⁹/L' },
      { name: 'Neutrophils',              value: '1.8–7.7',  unit: '×10⁹/L' },
      { name: 'Lymphocytes',              value: '1.0–4.8',  unit: '×10⁹/L' },
      { name: 'Monocytes',               value: '0.2–1.0',  unit: '×10⁹/L' },
      { name: 'Eosinophils',              value: '0.0–0.5',  unit: '×10⁹/L' },
      { name: 'Basophils',               value: '0.0–0.1',  unit: '×10⁹/L' },
      { name: 'Platelets',               value: '150–400',  unit: '×10⁹/L' },
      { name: 'Reticulocytes',           value: '0.2–2.0',  unit: '%',   notes: '25–100 ×10⁹/L' },
    ],
  },
  {
    id: 'ue',
    title: 'Urea & Electrolytes (U&E)',
    accent: '#3b82f6',
    tests: [
      { name: 'Sodium (Na⁺)',            value: '133–146',   unit: 'mmol/L' },
      { name: 'Potassium (K⁺)',          value: '3.5–5.3',   unit: 'mmol/L' },
      { name: 'Chloride (Cl⁻)',          value: '95–108',    unit: 'mmol/L' },
      { name: 'Bicarbonate (HCO₃⁻)',    value: '22–29',     unit: 'mmol/L' },
      { name: 'Urea',                    value: '2.5–7.8',   unit: 'mmol/L' },
      { name: 'Creatinine',              male: '59–104',    female: '45–84',   unit: 'µmol/L' },
      { name: 'eGFR',                    value: '≥ 60',      unit: 'mL/min/1.73m²' },
      { name: 'Uric Acid (Urate)',       male: '200–430',   female: '140–360', unit: 'µmol/L' },
      { name: 'Osmolality',              value: '275–295',   unit: 'mOsm/kg' },
    ],
  },
  {
    id: 'lft',
    title: 'Liver Function Tests (LFTs)',
    accent: '#f59e0b',
    tests: [
      { name: 'Total Bilirubin',         value: '3–17',     unit: 'µmol/L' },
      { name: 'Direct Bilirubin',        value: '0–7',      unit: 'µmol/L' },
      { name: 'ALT',                     value: '7–56',     unit: 'IU/L' },
      { name: 'AST',                     value: '10–40',    unit: 'IU/L' },
      { name: 'ALP',                     value: '30–130',   unit: 'IU/L',  notes: 'Adult; higher in children/pregnancy' },
      { name: 'GGT',                     male: '10–71',    female: '6–42',  unit: 'IU/L' },
      { name: 'Albumin',                 value: '35–50',    unit: 'g/L' },
      { name: 'Total Protein',           value: '60–80',    unit: 'g/L' },
    ],
  },
  {
    id: 'bone',
    title: 'Bone Profile',
    accent: '#e2e8f0',
    tests: [
      { name: 'Calcium (Ca²⁺)',          value: '2.20–2.60', unit: 'mmol/L' },
      { name: 'Corrected Calcium',       value: '2.20–2.60', unit: 'mmol/L', notes: '= Ca + 0.02 × (40 – Albumin)' },
      { name: 'Phosphate (PO₄³⁻)',       value: '0.80–1.45', unit: 'mmol/L' },
      { name: 'Magnesium (Mg²⁺)',        value: '0.75–1.05', unit: 'mmol/L' },
      { name: 'ALP',                     value: '30–130',    unit: 'IU/L' },
    ],
  },
  {
    id: 'glucose',
    title: 'Glucose & Metabolic',
    accent: '#10b981',
    tests: [
      { name: 'Fasting Glucose',         value: '3.9–5.5',   unit: 'mmol/L' },
      { name: 'Random Glucose',          value: '< 11.1',    unit: 'mmol/L', notes: 'Diabetic diagnosis ≥ 11.1' },
      { name: 'HbA1c',                   value: '< 42',      unit: 'mmol/mol', notes: '< 6.0% (IFCC); target < 48 in diabetes' },
      { name: 'Lactate (venous)',         value: '0.5–1.6',   unit: 'mmol/L', notes: 'Arterial: 0.5–1.0' },
      { name: 'Lactate (arterial)',       value: '0.5–1.0',   unit: 'mmol/L', notes: '> 2.0 = significant; > 4.0 = severe' },
      { name: 'Insulin (fasting)',        value: '6–24',      unit: 'mIU/L' },
      { name: 'C-Peptide',               value: '0.5–2.0',   unit: 'µg/L' },
    ],
  },
  {
    id: 'lipids',
    title: 'Lipids',
    accent: '#8b5cf6',
    tests: [
      { name: 'Total Cholesterol',       value: '< 5.0',    unit: 'mmol/L', notes: '< 4.0 if high CVD risk' },
      { name: 'LDL Cholesterol',         value: '< 3.0',    unit: 'mmol/L', notes: '< 1.8 if high CVD risk' },
      { name: 'HDL Cholesterol',         male: '> 1.0',    female: '> 1.2', unit: 'mmol/L' },
      { name: 'Non-HDL Cholesterol',     value: '< 3.8',    unit: 'mmol/L' },
      { name: 'Triglycerides',           value: '< 1.7',    unit: 'mmol/L', notes: 'Fasting; > 5.6 = severe' },
    ],
  },
  {
    id: 'thyroid',
    title: 'Thyroid Function',
    accent: '#06b6d4',
    tests: [
      { name: 'TSH',                     value: '0.4–4.5',   unit: 'mIU/L' },
      { name: 'Free T4 (FT4)',           value: '9.0–19.1',  unit: 'pmol/L' },
      { name: 'Free T3 (FT3)',           value: '2.6–5.7',   unit: 'pmol/L' },
      { name: 'Total T4',                value: '58–154',    unit: 'nmol/L' },
      { name: 'Thyroglobulin',           value: '< 55',      unit: 'µg/L' },
    ],
  },
  {
    id: 'coag',
    title: 'Coagulation',
    accent: '#ef4444',
    tests: [
      { name: 'PT (Prothrombin Time)',   value: '10–14',    unit: 'seconds' },
      { name: 'INR',                     value: '0.8–1.2',  unit: '',  notes: 'Therapeutic (AF/DVT): 2.0–3.0; Mechanical valves: 2.5–3.5' },
      { name: 'APTT',                    value: '23–35',    unit: 'seconds' },
      { name: 'Fibrinogen',              value: '1.8–4.6',  unit: 'g/L' },
      { name: 'D-Dimer',                 value: '< 0.50',   unit: 'mg/L FEU', notes: 'Age-adjusted: age × 0.01 mg/L (> 50 yrs)' },
      { name: 'TT (Thrombin Time)',      value: '14–19',    unit: 'seconds' },
      { name: 'Anti-Xa (LMWH)',         value: '0.6–1.0',  unit: 'IU/mL', notes: 'Treatment dose; prophylaxis: 0.2–0.4' },
    ],
  },
  {
    id: 'cardiac',
    title: 'Cardiac Markers',
    accent: '#f43f5e',
    tests: [
      { name: 'hs-Troponin I',           male: '< 34',     female: '< 16',  unit: 'ng/L', notes: 'Values vary by assay; check local lab reference' },
      { name: 'hs-Troponin T',           value: '< 14',     unit: 'ng/L', notes: 'Roche Elecsys assay' },
      { name: 'CK (Creatine Kinase)',    male: '38–174',   female: '26–140', unit: 'IU/L' },
      { name: 'CK-MB',                   value: '< 25',     unit: 'IU/L', notes: '< 5% of total CK' },
      { name: 'BNP',                     value: '< 100',    unit: 'pg/mL', notes: 'Heart failure: > 400; grey zone: 100–400' },
      { name: 'NT-proBNP (< 75 yrs)',   value: '< 125',    unit: 'pg/mL' },
      { name: 'NT-proBNP (≥ 75 yrs)',   value: '< 450',    unit: 'pg/mL' },
      { name: 'Myoglobin',               male: '28–72',    female: '25–58',  unit: 'µg/L' },
    ],
  },
  {
    id: 'inflam',
    title: 'Inflammatory Markers',
    accent: '#f97316',
    tests: [
      { name: 'CRP',                     value: '< 5',       unit: 'mg/L', notes: 'hs-CRP: < 1.0 low; 1–3 intermediate; > 3 high CVD risk' },
      { name: 'ESR',                     male: '0–15',      female: '0–20',   unit: 'mm/hr', notes: 'Upper limit approx: age/2 (M), (age+10)/2 (F)' },
      { name: 'Procalcitonin (PCT)',     value: '< 0.1',    unit: 'ng/mL', notes: '0.1–0.25 = low infection; > 0.5 = bacterial; > 2.0 = sepsis' },
      { name: 'Serum Ferritin',          male: '20–250',   female: '13–150',  unit: 'µg/L' },
      { name: 'IL-6',                    value: '< 7',       unit: 'pg/mL' },
    ],
  },
  {
    id: 'abg',
    title: 'Arterial Blood Gas (ABG)',
    accent: '#22d3ee',
    tests: [
      { name: 'pH',                      value: '7.35–7.45', unit: '' },
      { name: 'PaO₂',                   value: '11.0–13.0', unit: 'kPa', notes: '(83–98 mmHg); < 8.0 kPa = respiratory failure' },
      { name: 'PaCO₂',                  value: '4.7–6.0',   unit: 'kPa', notes: '(35–45 mmHg)' },
      { name: 'HCO₃⁻',                 value: '22–26',     unit: 'mmol/L' },
      { name: 'Base Excess (BE)',        value: '−2 to +2',  unit: 'mmol/L' },
      { name: 'SaO₂',                   value: '95–100',    unit: '%' },
      { name: 'SpO₂ (target, adults)',  value: '94–98',     unit: '%', notes: 'COPD / at-risk: 88–92%' },
      { name: 'Anion Gap',              value: '8–16',      unit: 'mmol/L', notes: '= Na − (Cl + HCO₃); corrected if albumin low' },
    ],
  },
  {
    id: 'iron',
    title: 'Iron Studies & Haematinics',
    accent: '#a78bfa',
    tests: [
      { name: 'Serum Iron',              male: '11–28',     female: '7–26',    unit: 'µmol/L' },
      { name: 'TIBC',                    value: '45–72',    unit: 'µmol/L' },
      { name: 'Transferrin Saturation', value: '20–45',    unit: '%' },
      { name: 'Ferritin',               male: '20–250',   female: '13–150',   unit: 'µg/L' },
      { name: 'Vitamin B12',            value: '145–569',  unit: 'pmol/L', notes: '(197–771 pg/mL)' },
      { name: 'Folate (serum)',          value: '7.0–45.0', unit: 'nmol/L', notes: '(3.1–19.9 µg/L)' },
      { name: 'Vitamin D (25-OH)',       value: '50–175',   unit: 'nmol/L', notes: 'Deficient < 25; insufficient 25–49' },
    ],
  },
  {
    id: 'urine',
    title: 'Urinalysis (Dipstick)',
    accent: '#fbbf24',
    tests: [
      { name: 'Specific Gravity',        value: '1.003–1.030', unit: '' },
      { name: 'pH',                      value: '4.5–8.0',     unit: '' },
      { name: 'Protein',                 value: 'Negative',    unit: '', notes: 'Trace may be benign' },
      { name: 'Glucose',                 value: 'Negative',    unit: '' },
      { name: 'Ketones',                 value: 'Negative',    unit: '' },
      { name: 'Blood',                   value: 'Negative',    unit: '' },
      { name: 'Leucocytes',              value: 'Negative',    unit: '' },
      { name: 'Nitrites',               value: 'Negative',    unit: '', notes: 'Positive = gram-negative bacteria' },
      { name: 'Bilirubin',              value: 'Negative',    unit: '' },
      { name: 'Urobilinogen',           value: 'Normal',      unit: '', notes: '0.2–1.0 mg/dL' },
      { name: 'Urine Creatinine',        value: '5.3–15.9',   unit: 'mmol/24hr' },
      { name: 'Urine Protein:Creatinine', value: '< 30',      unit: 'mg/mmol', notes: 'Proteinuria ≥ 30; significant ≥ 100' },
    ],
  },
  {
    id: 'csf',
    title: 'CSF (Cerebrospinal Fluid)',
    accent: '#6366f1',
    tests: [
      { name: 'Opening Pressure',        value: '7–18',     unit: 'cmH₂O' },
      { name: 'Appearance',             value: 'Clear/colourless', unit: '' },
      { name: 'Glucose',                 value: '2.5–4.4',  unit: 'mmol/L', notes: '> 60% of plasma glucose' },
      { name: 'Protein',                value: '0.15–0.45', unit: 'g/L' },
      { name: 'White Cells',            value: '0–5',       unit: 'cells/µL', notes: 'All mononuclear' },
      { name: 'Red Cells',              value: '0',         unit: 'cells/µL', notes: 'Traumatic tap may cause false positives' },
    ],
  },
];

export default function LabReference() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LAB_CATEGORIES.map(cat => ({
      ...cat,
      tests: cat.tests.filter(t =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.value ?? '').toLowerCase().includes(q) ||
        (t.unit ?? '').toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q)
      ),
    })).filter(cat => {
      if (activeCategory && cat.id !== activeCategory) return false;
      return cat.tests.length > 0;
    });
  }, [query, activeCategory]);

  const totalTests = LAB_CATEGORIES.reduce((s, c) => s + c.tests.length, 0);

  return (
    <div className="lab-ref-page">
      <div className="page-header">
        <h1><FlaskConical size={26} /> Lab Reference (UK)</h1>
        <p>Normal reference ranges — adult values unless stated. Always verify with your local laboratory.</p>
      </div>

      {/* Search + filter bar */}
      <div className="lab-ref-toolbar">
        <div className="lab-ref-search-wrap">
          <Search size={15} className="lab-ref-search-icon" />
          <input
            type="text"
            className="lab-ref-search"
            placeholder={`Search ${totalTests} tests…`}
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
          <button
            className={`lab-ref-cat-btn${!activeCategory ? ' active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {LAB_CATEGORIES.map(cat => (
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
        <div className="lab-ref-empty">No tests match &ldquo;{query}&rdquo;</div>
      )}

      <div className="lab-ref-grid">
        {filtered.map(cat => (
          <div key={cat.id} className="lab-ref-card">
            <div className="lab-ref-card-header" style={{ borderLeftColor: cat.accent }}>
              <h3 style={{ color: cat.accent }}>{cat.title}</h3>
            </div>
            <table className="lab-ref-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Reference Range</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {cat.tests.map((t, i) => (
                  <tr key={i}>
                    <td className="lab-test-name">
                      {t.name}
                      {t.notes && <span className="lab-note">{t.notes}</span>}
                    </td>
                    <td className="lab-value">
                      {t.value ? (
                        <span className="lab-range">{t.value}</span>
                      ) : (
                        <span className="lab-range-split">
                          <span><span className="lab-sex">♂</span>{t.male}</span>
                          <span><span className="lab-sex">♀</span>{t.female}</span>
                        </span>
                      )}
                    </td>
                    <td className="lab-unit">{t.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="lab-ref-disclaimer">
        Reference ranges are for guidance only and may vary between laboratories and analysers.
        Values sourced from NHS and NICE guidance. Always correlate with clinical context.
      </p>
    </div>
  );
}
