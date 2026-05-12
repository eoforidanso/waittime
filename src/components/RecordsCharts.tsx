import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import type { DailyRecord } from '../db/patientDB';
import { SERVICE_COLORS, SERVICE_TYPES, TRIAGE_COLORS } from '../types';
import {
  Users, CheckCircle2, AlertTriangle, Skull, Clock, Activity, BarChart2, TrendingUp,
} from 'lucide-react';

const TRIAGE_ORDER = ['critical', 'emergent', 'urgent', 'non-urgent'] as const;

interface Props {
  records: DailyRecord[];
}

// ---- Custom dark glass tooltip ----
const GlassTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map(entry => (
        <div key={entry.name} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

// ---- Pie label renderer ----
const renderPieLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent, name,
}: {
  cx?: number; cy?: number; midAngle?: number;
  innerRadius?: number; outerRadius?: number; percent?: number; name?: string;
}) => {
  if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent || percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ---- Custom legend for pie ----
const PieLegend = ({ items }: { items: { name: string; color: string; value: number }[] }) => (
  <div className="pie-legend">
    {items.map(i => (
      <div key={i.name} className="pie-legend-item">
        <span className="pie-legend-dot" style={{ background: i.color }} />
        <span className="pie-legend-name">{i.name}</span>
        <span className="pie-legend-val">{i.value.toLocaleString()}</span>
      </div>
    ))}
  </div>
);

// ---- Main component ----
export default function RecordsCharts({ records }: Props) {
  const sorted = useMemo(
    () => records.slice().sort((a, b) => a.date.localeCompare(b.date)),
    [records],
  );
  const last30 = sorted.slice(-30);

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // --- Trend chart data ---
  const trendData = useMemo(
    () => last30.map(r => ({
      date: fmtDate(r.date),
      Completed: r.totalCompleted,
      'No-Show': r.totalNoShow,
      Deceased: r.totalDeceased,
      Total: r.totalPatients,
      'Avg Wait (min)': r.avgWaitTime,
      'No-Show %': r.totalPatients > 0 ? parseFloat(((r.totalNoShow / r.totalPatients) * 100).toFixed(1)) : 0,
    })),
    [last30],
  );

  // --- Severity per day ---
  const severityData = useMemo(
    () => last30.map(r => ({
      date: fmtDate(r.date),
      Critical: r.patients.filter(p => p.priority === 'critical').length,
      Emergent: r.patients.filter(p => p.priority === 'emergent').length,
      Urgent: r.patients.filter(p => p.priority === 'urgent').length,
      'Non-Urgent': r.patients.filter(p => p.priority === 'non-urgent').length,
    })),
    [last30],
  );

  // --- Length of stay per day ---
  const losData = useMemo(
    () => last30.map(r => {
      const completed = r.patients.filter(p => p.completedAt && p.createdAt);
      const avgLos = completed.length > 0
        ? Math.round(
          completed.reduce((sum, p) => {
            const los = (new Date(p.completedAt!).getTime() - new Date(p.createdAt).getTime()) / 60000;
            return sum + los;
          }, 0) / completed.length,
        )
        : 0;
      return { date: fmtDate(r.date), 'Avg LOS (min)': avgLos };
    }),
    [last30],
  );

  // --- Area volume per day ---
  const areaVolumeData = useMemo(
    () => last30.map(r => {
      const obj: Record<string, string | number> = { date: fmtDate(r.date) };
      SERVICE_TYPES.forEach(area => {
        obj[area] = r.patients.filter(p => p.service === area).length;
      });
      return obj;
    }),
    [last30],
  );

  // --- All patients across all records ---
  const allPatients = useMemo(() => records.flatMap(r => r.patients), [records]);

  // --- Triage distribution (all time) ---
  const triageDist = useMemo(
    () => TRIAGE_ORDER
      .map(level => ({
        name: level.charAt(0).toUpperCase() + level.slice(1),
        rawName: level,
        value: allPatients.filter(p => p.priority === level).length,
        color: TRIAGE_COLORS[level],
      }))
      .filter(t => t.value > 0),
    [allPatients],
  );

  // --- Area distribution (all time) ---
  const areaDist = useMemo(
    () => SERVICE_TYPES
      .map(area => ({
        name: area,
        value: allPatients.filter(p => p.service === area).length,
        color: SERVICE_COLORS[area],
      }))
      .filter(a => a.value > 0),
    [allPatients],
  );

  // --- KPI totals ---
  const kpi = useMemo(() => {
    const totalPatients = records.reduce((s, r) => s + r.totalPatients, 0);
    const totalCompleted = records.reduce((s, r) => s + r.totalCompleted, 0);
    const totalDeceased = records.reduce((s, r) => s + r.totalDeceased, 0);
    const totalNoShow = records.reduce((s, r) => s + r.totalNoShow, 0);
    const totalDays = records.length;
    // Weighted avg wait
    const waitSum = records.reduce((s, r) => s + r.avgWaitTime * r.totalCompleted, 0);
    const avgWait = totalCompleted > 0 ? Math.round(waitSum / totalCompleted) : 0;
    const avgPerDay = totalDays > 0 ? Math.round(totalPatients / totalDays) : 0;
    const noShowRate = totalPatients > 0 ? ((totalNoShow / totalPatients) * 100).toFixed(1) : '0.0';
    const deceasedRate = totalPatients > 0 ? ((totalDeceased / totalPatients) * 100).toFixed(1) : '0.0';
    const completionRate = totalPatients > 0 ? ((totalCompleted / totalPatients) * 100).toFixed(1) : '0.0';
    // Worst day
    const worstDay = records.reduce<DailyRecord | null>(
      (worst, r) => (!worst || r.totalPatients > worst.totalPatients ? r : worst), null,
    );
    // Avg critical rate
    const criticalPts = allPatients.filter(p => p.priority === 'critical').length;
    const criticalRate = totalPatients > 0 ? ((criticalPts / totalPatients) * 100).toFixed(1) : '0.0';
    return {
      totalPatients, totalCompleted, totalDeceased, totalNoShow, totalDays,
      avgWait, avgPerDay, noShowRate, deceasedRate, completionRate,
      worstDay, criticalRate,
    };
  }, [records, allPatients]);

  if (records.length === 0) {
    return (
      <div className="charts-empty">
        <BarChart2 size={48} />
        <p>No historical data yet. Save an end-of-day report to see analytics.</p>
      </div>
    );
  }

  const axisStyle = { fill: 'rgba(255,255,255,0.45)', fontSize: 11 };
  const gridStyle = { stroke: 'rgba(255,255,255,0.06)' };

  return (
    <div className="records-analytics">

      {/* KPI Row */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi">
          <span className="kpi-icon"><Users size={20} /></span>
          <span className="kpi-value">{kpi.totalPatients.toLocaleString()}</span>
          <span className="kpi-label">Total Patients</span>
          <span className="kpi-sub">{kpi.avgPerDay}/day avg · {kpi.totalDays} days</span>
        </div>
        <div className="analytics-kpi green">
          <span className="kpi-icon"><CheckCircle2 size={20} /></span>
          <span className="kpi-value">{kpi.completionRate}%</span>
          <span className="kpi-label">Completion Rate</span>
          <span className="kpi-sub">{kpi.totalCompleted.toLocaleString()} completed</span>
        </div>
        <div className="analytics-kpi orange">
          <span className="kpi-icon"><AlertTriangle size={20} /></span>
          <span className="kpi-value">{kpi.noShowRate}%</span>
          <span className="kpi-label">No-Show Rate</span>
          <span className="kpi-sub">{kpi.totalNoShow.toLocaleString()} no-shows</span>
        </div>
        <div className="analytics-kpi red">
          <span className="kpi-icon"><Skull size={20} /></span>
          <span className="kpi-value">{kpi.deceasedRate}%</span>
          <span className="kpi-label">Mortality Rate</span>
          <span className="kpi-sub">{kpi.totalDeceased} deceased</span>
        </div>
        <div className="analytics-kpi purple">
          <span className="kpi-icon"><Clock size={20} /></span>
          <span className="kpi-value">{kpi.avgWait} min</span>
          <span className="kpi-label">Avg Wait Time</span>
          <span className="kpi-sub">weighted across all days</span>
        </div>
        <div className="analytics-kpi crimson">
          <span className="kpi-icon"><Activity size={20} /></span>
          <span className="kpi-value">{kpi.criticalRate}%</span>
          <span className="kpi-label">Critical Case Rate</span>
          <span className="kpi-sub">all critical patients</span>
        </div>
        {kpi.worstDay && (
          <div className="analytics-kpi amber">
            <span className="kpi-icon"><TrendingUp size={20} /></span>
            <span className="kpi-value">{kpi.worstDay.totalPatients}</span>
            <span className="kpi-label">Busiest Day</span>
            <span className="kpi-sub">{fmtDate(kpi.worstDay.date)}</span>
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts-grid">

        {/* 1. Daily patient volume stacked bar */}
        <div className="chart-card chart-full">
          <h4><BarChart2 size={16} /> Daily Patient Volume <span className="chart-subtitle">last {last30.length} days — stacked by outcome</span></h4>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={trendData} barCategoryGap="35%" margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip content={<GlassTooltip />} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
              <Bar dataKey="Completed" stackId="a" fill="#10b981" />
              <Bar dataKey="No-Show" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Deceased" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Avg wait time area chart */}
        <div className="chart-card">
          <h4><Clock size={16} /> Avg Wait Time <span className="chart-subtitle">minutes per day</span></h4>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="waitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} unit=" m" />
              <Tooltip content={<GlassTooltip />} />
              <Area
                type="monotone" dataKey="Avg Wait (min)"
                stroke="#6366f1" strokeWidth={2}
                fill="url(#waitGrad)"
                dot={{ fill: '#6366f1', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 3. No-show rate area chart */}
        <div className="chart-card">
          <h4><AlertTriangle size={16} /> No-Show Rate <span className="chart-subtitle">% per day</span></h4>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="noshowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} unit="%" />
              <Tooltip content={<GlassTooltip />} />
              <Area
                type="monotone" dataKey="No-Show %"
                stroke="#f59e0b" strokeWidth={2}
                fill="url(#noshowGrad)"
                dot={{ fill: '#f59e0b', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Triage pie */}
        <div className="chart-card chart-pie">
          <h4><Activity size={16} /> Triage Distribution <span className="chart-subtitle">all time</span></h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={triageDist} cx="50%" cy="50%"
                innerRadius={52} outerRadius={82}
                paddingAngle={3} dataKey="value"
                labelLine={false} label={renderPieLabel}
              >
                {triageDist.map(entry => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<GlassTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <PieLegend items={triageDist} />
        </div>

        {/* 5. Area distribution pie */}
        <div className="chart-card chart-pie">
          <h4><Users size={16} /> Area Distribution <span className="chart-subtitle">all time</span></h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={areaDist} cx="50%" cy="50%"
                innerRadius={52} outerRadius={82}
                paddingAngle={3} dataKey="value"
                labelLine={false} label={renderPieLabel}
              >
                {areaDist.map(entry => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<GlassTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <PieLegend items={areaDist} />
        </div>

        {/* 6. Daily case severity stacked bar */}
        <div className="chart-card chart-full">
          <h4><Activity size={16} /> Daily Case Severity <span className="chart-subtitle">patients by triage level per day</span></h4>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={severityData} barCategoryGap="35%" margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip content={<GlassTooltip />} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
              <Bar dataKey="Critical" stackId="s" fill={TRIAGE_COLORS.critical} />
              <Bar dataKey="Emergent" stackId="s" fill={TRIAGE_COLORS.emergent} />
              <Bar dataKey="Urgent" stackId="s" fill={TRIAGE_COLORS.urgent} />
              <Bar dataKey="Non-Urgent" stackId="s" fill={TRIAGE_COLORS['non-urgent']} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 7. Avg length of stay */}
        <div className="chart-card">
          <h4><TrendingUp size={16} /> Avg Length of Stay <span className="chart-subtitle">minutes (check-in → discharge)</span></h4>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={losData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="losGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} unit=" m" />
              <Tooltip content={<GlassTooltip />} />
              <Area
                type="monotone" dataKey="Avg LOS (min)"
                stroke="#10b981" strokeWidth={2}
                fill="url(#losGrad)"
                dot={{ fill: '#10b981', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 8. Volume by ER area stacked bar */}
        <div className="chart-card chart-full">
          <h4><BarChart2 size={16} /> Volume by ER Area <span className="chart-subtitle">patients per area per day</span></h4>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={areaVolumeData} barCategoryGap="35%" margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip content={<GlassTooltip />} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
              {SERVICE_TYPES.map((area, i) => (
                <Bar
                  key={area} dataKey={area} stackId="area"
                  fill={SERVICE_COLORS[area]}
                  radius={i === SERVICE_TYPES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
