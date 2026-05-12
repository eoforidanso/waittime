import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import { getAllRecords, deleteRecord, type DailyRecord, type SerializedTicket } from '../db/patientDB';
import RecordsCharts from '../components/RecordsCharts';
import {
  TRIAGE_COLORS, SERVICE_COLORS, SERVICE_TYPES,
  TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, BREACH_TARGETS,
} from '../types';
import type { Priority, TicketStatus } from '../types';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Users, Clock, AlertTriangle, BedDouble,
  Activity, Stethoscope, BookOpen, Target, Siren, Award, Zap,
  Skull, Database, Calendar, ChevronDown, ChevronUp, Trash2, Save, List, BarChart2,
  CheckCircle2, UserX, Timer, Gauge, Layers, FileDown,
} from 'lucide-react';
import { exportAnalyticsPDF } from '../utils/exportPDF';

// ── Helpers ───────────────────────────────────────────────────────────────
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function avgMin(arr: number[]) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}
function fmtDur(min: number): string {
  if (min <= 0) return '—';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ── Recharts custom glass tooltip ─────────────────────────────────────────
const DarkTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a2035', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 100,
    }}>
      {label && <div style={{ color: '#94a3b8', marginBottom: 5, fontWeight: 700 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#f1f5f9', marginBottom: 2 }}>
          <span style={{ opacity: 0.75 }}>{p.name}: </span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const { state, endOfDay } = useQueue();
  const toast = useToast();

  // ── Patient Records state ───────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'live' | 'records'>('live');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmEndOfDay, setConfirmEndOfDay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordsTab, setRecordsTab] = useState<'charts' | 'list'>('charts');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const printViewRef = useRef<HTMLDivElement>(null);
  // kpisRef lets handleExportPDF read the latest kpis without being in deps
  const kpisRef = useRef<Array<{ label: string; value: string | number; sub: string; color: string }>>([]);

  // handlePrint now delegates to the PDF export so both buttons produce a consistent PDF file
  const handlePrint = useCallback(() => {
    handleExportPDF();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportPDF = useCallback(async () => {
    const container = printViewRef.current;
    if (!container || isExportingPDF) return;

    // Switch to live view so all charts are in DOM
    setActiveView('live');
    setIsExportingPDF(true);
    setPdfProgress(0);

    // Wait for React to render + charts to paint
    await new Promise<void>(res => setTimeout(res, 400));

    const kpiSnapshot = kpisRef.current;
    const reportDate = new Date().toLocaleString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    try {
      await exportAnalyticsPDF(
        container,
        kpiSnapshot,
        reportDate,
        setPdfProgress,
      );
      toast.success('PDF exported', 'Report saved to your downloads folder');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Export failed', 'Could not generate PDF — try again');
    } finally {
      setIsExportingPDF(false);
      setPdfProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExportingPDF]);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    const data = await getAllRecords();
    setRecords(data);
  };

  const handleEndOfDay = async () => {
    if (state.tickets.length === 0) return;
    setSaving(true);
    try {
      await endOfDay();
      await loadRecords();
      toast.success('End of day complete', `${state.tickets.length} records archived`);
      setConfirmEndOfDay(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (date: string) => {
    await deleteRecord(date);
    await loadRecords();
    if (expandedDate === date) setExpandedDate(null);
  };

  const toggleExpand = (date: string) => {
    setExpandedDate(prev => (prev === date ? null : date));
  };

  const formatDate = (dateStr: string) => {
    const dd = new Date(dateStr + 'T00:00:00');
    return dd.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (isoStr: string) => {
    return new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const filterPatients = (patients: SerializedTicket[]) => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase();
    return patients.filter(
      p =>
        p.patientName.toLowerCase().includes(q) ||
        p.ticketNumber.toLowerCase().includes(q) ||
        p.service.toLowerCase().includes(q) ||
        p.priority.toLowerCase().includes(q)
    );
  };

  const d = useMemo(() => {
    const tickets = state.tickets;
    const now = new Date();
    const todayStr = isoDate(now);

    // ── Basic counts ────────────────────────────────────────────────────
    const todayCount = tickets.filter(t => isoDate(new Date(t.createdAt)) === todayStr).length;

    // ── Time performance metrics ────────────────────────────────────────
    // Triage-to-bay (calledAt - triagedAt)
    const waitTimes = tickets
      .filter(t => t.calledAt && t.triagedAt)
      .map(t => (new Date(t.calledAt!).getTime() - new Date(t.triagedAt).getTime()) / 60000);

    // Door-to-triage (triagedAt - createdAt)
    const d2tTimes = tickets
      .filter(t => t.triagedAt && t.createdAt)
      .map(t => (new Date(t.triagedAt).getTime() - new Date(t.createdAt).getTime()) / 60000);

    // Length of stay (completedAt - createdAt)
    const losTimes = tickets
      .filter(t => t.completedAt && t.createdAt)
      .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);

    // ── Breach analysis ─────────────────────────────────────────────────
    const breachable = tickets.filter(t => t.calledAt && t.priority !== 'critical');
    const breached = breachable.filter(t => {
      const w = (new Date(t.calledAt!).getTime() - new Date(t.triagedAt).getTime()) / 60000;
      return w > BREACH_TARGETS[t.priority];
    });
    const breachRate = breachable.length ? Math.round((breached.length / breachable.length) * 100) : 0;

    // ── 7-day volume stacked by acuity ──────────────────────────────────
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(now); dd.setDate(dd.getDate() - (6 - i));
      const ds = isoDate(dd);
      const day = tickets.filter(t => isoDate(new Date(t.createdAt)) === ds);
      return {
        day: dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
        Critical: day.filter(t => t.priority === 'critical').length,
        Emergent: day.filter(t => t.priority === 'emergent').length,
        Urgent: day.filter(t => t.priority === 'urgent').length,
        'Non-urgent': day.filter(t => t.priority === 'non-urgent').length,
      };
    });

    // ── Priority pie ────────────────────────────────────────────────────
    const priPie = (['critical', 'emergent', 'urgent', 'non-urgent'] as Priority[])
      .map(p => ({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        value: tickets.filter(t => t.priority === p).length,
        color: TRIAGE_COLORS[p],
      }))
      .filter(p => p.value > 0);

    // ── Average wait vs NHS target ──────────────────────────────────────
    const waitVsTarget = (['emergent', 'urgent', 'non-urgent'] as Priority[]).map(p => {
      const pts = tickets.filter(t => t.priority === p && t.calledAt && t.triagedAt);
      const waits = pts.map(t =>
        (new Date(t.calledAt!).getTime() - new Date(t.triagedAt).getTime()) / 60000);
      return {
        name: p.charAt(0).toUpperCase() + p.slice(1),
        'Avg Wait': avgMin(waits),
        'NHS Target': BREACH_TARGETS[p],
        fill: TRIAGE_COLORS[p],
      };
    });

    // ── Service utilisation ─────────────────────────────────────────────
    const svcLoad = SERVICE_TYPES.map(s => ({
      name: s.replace('Pediatric ER', 'Peds').replace(' ER', ''),
      Patients: tickets.filter(t => t.service === s).length,
      fill: SERVICE_COLORS[s],
    })).filter(s => s.Patients > 0).sort((a, b) => b.Patients - a.Patients);

    // ── Patient disposition ─────────────────────────────────────────────
    const outcomes = (Object.keys(TICKET_STATUS_LABELS) as TicketStatus[])
      .map(st => ({
        name: TICKET_STATUS_LABELS[st],
        count: tickets.filter(t => t.status === st).length,
        color: TICKET_STATUS_COLORS[st],
      }))
      .filter(o => o.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 9);

    // ── Top presenting complaints ───────────────────────────────────────
    const cmap: Record<string, number> = {};
    tickets.forEach(t => {
      const c = t.chiefComplaint?.trim();
      if (c) cmap[c] = (cmap[c] ?? 0) + 1;
    });
    const topComplaints = Object.entries(cmap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 26 ? name.slice(0, 26) + '…' : name, count }));

    // ── Bed occupancy ───────────────────────────────────────────────────
    const totalBeds = state.counters.reduce((s, c) => s + c.beds, 0);
    const occupied = state.counters.reduce((s, c) => s + c.bedsOccupied, 0);
    const bedOccPct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;
    const bedBySvc = state.counters.map(c => ({
      name: c.service.replace('Pediatric ER', 'Peds').replace(' ER', ''),
      Occupied: c.bedsOccupied,
      Available: c.beds - c.bedsOccupied,
    }));

    // ── Staff metrics ───────────────────────────────────────────────────
    const onDuty = state.nurses.filter(n => n.onDuty).length;
    const physicians = state.nurses.filter(n =>
      n.onDuty && ['Attending Physician', 'Physician Assistant'].includes(n.role)).length;
    const chargeNurses = state.nurses.filter(n => n.role === 'Charge Nurse').length;
    const staffNurses = state.nurses.filter(n => n.role === 'Staff Nurse').length;

    // ── Staffing ratios ─────────────────────────────────────────────────
    const activePatients = tickets.filter(t => t.status === 'waiting' || t.status === 'serving' ||
      t.status === 'results-pending' || t.status === 'awaiting-bed').length;
    const onDutyNurses = state.nurses.filter(n =>
      n.onDuty && ['Staff Nurse', 'Charge Nurse'].includes(n.role)).length;
    const onDutyDoctors = state.nurses.filter(n =>
      n.onDuty && ['Attending Physician', 'Physician Assistant'].includes(n.role)).length;
    // Ratios expressed as patients-per-clinician (–1 = no staff)
    const patientNurseRatio = onDutyNurses > 0
      ? Math.round((activePatients / onDutyNurses) * 10) / 10 : -1;
    const patientDoctorRatio = onDutyDoctors > 0
      ? Math.round((activePatients / onDutyDoctors) * 10) / 10 : -1;

    // ── Daily ER Census (7-day series) ─────────────────────────────────
    const censusSeries = Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(now); dd.setDate(dd.getDate() - (6 - i));
      const ds = isoDate(dd);
      const dayTickets = tickets.filter(t => isoDate(new Date(t.createdAt)) === ds);
      return {
        day: dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
        Census: dayTickets.length,
        Admitted: dayTickets.filter(t => t.status === 'admitted').length,
        Discharged: dayTickets.filter(t => t.status === 'discharged').length,
      };
    });
    const todayCensus = censusSeries[censusSeries.length - 1].Census;
    const avgCensus = Math.round(censusSeries.reduce((s, d) => s + d.Census, 0) / 7);

    // ── Door-to-physician (arrival → bay contact) ───────────────────────
    const d2pTimes = tickets
      .filter(t => t.calledAt && t.createdAt)
      .map(t => (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);
    const avgD2P = avgMin(d2pTimes);
    const d2pByPriority = (['critical', 'emergent', 'urgent', 'non-urgent'] as Priority[]).map(p => {
      const pts = tickets.filter(t => t.priority === p && t.calledAt && t.createdAt);
      const times = pts.map(t =>
        (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);
      return {
        name: p.charAt(0).toUpperCase() + p.slice(1),
        'D2P (min)': avgMin(times),
        Target: BREACH_TARGETS[p],
        fill: TRIAGE_COLORS[p],
      };
    });

    // ── LWBS (Left Without Being Seen) ──────────────────────────────────
    const lwbsCount = tickets.filter(t => t.status === 'no-show' && !t.calledAt).length;
    const lwbsRate = tickets.length > 0 ? Math.round((lwbsCount / tickets.length) * 100) : 0;

    // ── Boarding patients (stuck in results-pending / awaiting-bed) ─────
    const boardingList = tickets.filter(t =>
      t.status === 'results-pending' || t.status === 'awaiting-bed');
    const boarding = boardingList.length;
    const avgBoardTime = avgMin(
      boardingList.filter(t => t.calledAt)
        .map(t => (now.getTime() - new Date(t.calledAt!).getTime()) / 60000));

    // ── Referrals ──────────────────────────────────────────────────────
    const referredCount = tickets.filter(t => t.status === 'referred').length;
    const referralRate = tickets.length > 0
      ? Math.round((referredCount / tickets.length) * 100) : 0;

    // ── Critical response time (triage → bay for critical patients) ─────
    const avgCriticalResponse = avgMin(
      tickets.filter(t => t.priority === 'critical' && t.calledAt && t.triagedAt)
        .map(t => (new Date(t.calledAt!).getTime() - new Date(t.triagedAt).getTime()) / 60000));

    // ── LOS by outcome ─────────────────────────────────────────────────
    const losByOutcome = [
      { name: 'Discharged', fill: '#10b981',
        LOS: avgMin(tickets.filter(t => t.status === 'discharged' && t.completedAt)
          .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000)) },
      { name: 'Admitted', fill: '#ec4899',
        LOS: avgMin(tickets.filter(t => t.status === 'admitted' && t.completedAt)
          .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000)) },
      { name: 'Referred', fill: '#06b6d4',
        LOS: avgMin(tickets.filter(t => t.status === 'referred' && t.completedAt)
          .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000)) },
    ].filter(x => x.LOS > 0);

    // ── Throughput (patients completed per hour today) ──────────────────
    const completedToday = tickets.filter(t =>
      t.completedAt && isoDate(new Date(t.completedAt)) === todayStr).length;
    const hoursElapsed = Math.max(1, now.getHours() + now.getMinutes() / 60);
    const throughputPerHour = Math.round((completedToday / hoursElapsed) * 10) / 10;

    // ── Shift volume ───────────────────────────────────────────────────
    const shiftData = (
      [
        { shift: 'Day', label: '07:00–15:00', from: 7, to: 15 },
        { shift: 'Evening', label: '15:00–23:00', from: 15, to: 23 },
        { shift: 'Night', label: '23:00–07:00', from: 23, to: 7 },
      ] as Array<{ shift: string; label: string; from: number; to: number }>
    ).map(({ shift, label, from, to }) => ({
      shift,
      label,
      Patients: tickets.filter(t => {
        const h = new Date(t.createdAt).getHours();
        return from < to ? (h >= from && h < to) : (h >= from || h < to);
      }).length,
    }));

    // ── Service × Acuity matrix ────────────────────────────────────────
    const servicePriorityMix = SERVICE_TYPES.map(s => {
      const st = tickets.filter(t => t.service === s);
      return {
        name: s.replace('Pediatric ER', 'Peds').replace(' ER', ''),
        Critical: st.filter(t => t.priority === 'critical').length,
        Emergent: st.filter(t => t.priority === 'emergent').length,
        Urgent: st.filter(t => t.priority === 'urgent').length,
        'Non-urgent': st.filter(t => t.priority === 'non-urgent').length,
        total: st.length,
      };
    }).filter(x => x.total > 0);

    // ── Teaching hospital metrics ───────────────────────────────────────
    const highAcuity = tickets.filter(t => t.priority === 'critical' || t.priority === 'emergent').length;
    const acuityIdx = tickets.length > 0 ? Math.round((highAcuity / tickets.length) * 100) : 0;
    const admitted = tickets.filter(t => t.status === 'admitted').length;
    const discharged = tickets.filter(t => t.status === 'discharged').length;
    const admitRate = (admitted + discharged) > 0
      ? Math.round((admitted / (admitted + discharged)) * 100) : 0;
    const noShowRate = tickets.length > 0
      ? Math.round((tickets.filter(t => t.status === 'no-show').length / tickets.length) * 100) : 0;
    const deceasedCount = tickets.filter(t => t.status === 'deceased').length;
    const deathRate = tickets.length > 0
      ? Math.round((deceasedCount / tickets.length) * 100 * 10) / 10 : 0;
    const uniqueComplaints = Object.keys(cmap).length;

    // ── Age demographics ────────────────────────────────────────────────
    const ageGroups = [
      { name: 'Paeds (0–17)', count: tickets.filter(t => t.age != null && t.age < 18).length, fill: '#3b82f6' },
      { name: 'Adult (18–40)', count: tickets.filter(t => t.age != null && t.age >= 18 && t.age < 41).length, fill: '#10b981' },
      { name: 'Adult (41–65)', count: tickets.filter(t => t.age != null && t.age >= 41 && t.age < 66).length, fill: '#f59e0b' },
      { name: 'Elderly (65+)', count: tickets.filter(t => t.age != null && t.age >= 66).length, fill: '#ef4444' },
    ].filter(g => g.count > 0);

    // ── Hourly arrival heatmap (last 7 days) ────────────────────────────
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000);
    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      Arrivals: tickets.filter(t => {
        const cd = new Date(t.createdAt);
        return cd >= sevenDaysAgo && cd.getHours() === h;
      }).length,
    }));

    // ── Escalations ─────────────────────────────────────────────────────
    const openEsc = state.escalationLog.filter(e => !e.resolved).length;
    const critEsc = state.escalationLog.filter(e => !e.resolved && e.severity === 'critical').length;
    const totalEsc = state.escalationLog.length;

    // ── Ambulance ───────────────────────────────────────────────────────
    const ambTotal = state.ambulances.length;
    const ambArrived = state.ambulances.filter(a => a.status === 'arrived').length;

    return {
      total: tickets.length, todayCount,
      waiting: tickets.filter(t => t.status === 'waiting').length,
      serving: tickets.filter(t => t.status === 'serving').length,
      avgWait: avgMin(waitTimes), avgD2T: avgMin(d2tTimes), avgLOS: avgMin(losTimes),
      breachRate, breachCount: breached.length,
      last7, priPie, waitVsTarget, svcLoad, outcomes, topComplaints,
      totalBeds, occupied, bedOccPct, bedBySvc,
      onDuty, physicians, chargeNurses, staffNurses,
      highAcuity, acuityIdx, admitted, discharged, admitRate, noShowRate, deceasedCount, deathRate, uniqueComplaints,
      ageGroups, hourlyData,
      openEsc, critEsc, totalEsc,
      ambTotal, ambArrived,
      patientNurseRatio, patientDoctorRatio,
      todayCensus, avgCensus, censusSeries,
      activePatients, onDutyNurses, onDutyDoctors,
      avgD2P, d2pByPriority,
      lwbsCount, lwbsRate,
      boarding, avgBoardTime,
      referredCount, referralRate,
      avgCriticalResponse,
      losByOutcome,
      completedToday, throughputPerHour,
      shiftData, servicePriorityMix,
    };
  }, [state]);

  // ── KPI cards ────────────────────────────────────────────────────────────
  const kpis = [
    {
      icon: <Users size={20} />, label: 'Total Patients',
      value: d.total, sub: `${d.todayCount} registered today`, color: '#3b82f6',
    },
    {
      icon: <Clock size={20} />, label: 'Avg Triage → Bay',
      value: fmtDur(d.avgWait), sub: `Door → Triage: ${fmtDur(d.avgD2T)}`, color: '#10b981',
    },
    {
      icon: <Activity size={20} />, label: 'Avg Length of Stay',
      value: fmtDur(d.avgLOS), sub: `${d.waiting} currently waiting`, color: '#8b5cf6',
    },
    {
      icon: <AlertTriangle size={20} />, label: 'Breach Rate',
      value: `${d.breachRate}%`, sub: `${d.breachCount} breached target`,
      color: d.breachRate > 20 ? '#ef4444' : '#f59e0b',
    },
    {
      icon: <BedDouble size={20} />, label: 'Bed Occupancy',
      value: `${d.bedOccPct}%`, sub: `${d.occupied}/${d.totalBeds} beds in use`,
      color: d.bedOccPct > 85 ? '#ef4444' : '#10b981',
    },
    {
      icon: <Stethoscope size={20} />, label: 'Staff On Duty',
      value: d.onDuty, sub: `${d.physicians} physicians active`, color: '#f59e0b',
    },
    {
      icon: <Activity size={20} />, label: 'Daily ER Census',
      value: d.todayCensus,
      sub: `7-day avg: ${d.avgCensus} patients/day`,
      color: '#06b6d4',
    },
    {
      icon: <Skull size={20} />, label: 'Death Rate',
      value: `${d.deathRate}%`, sub: `${d.deceasedCount} deceased of ${d.total}`,
      color: d.deathRate > 0 ? '#ef4444' : '#10b981',
    },
    {
      icon: <Timer size={20} />, label: 'Door-to-Physician',
      value: fmtDur(d.avgD2P), sub: 'Avg arrival to first bay contact',
      color: '#10b981',
    },
    {
      icon: <UserX size={20} />, label: 'LWBS Rate',
      value: `${d.lwbsRate}%`, sub: `${d.lwbsCount} left without being seen`,
      color: d.lwbsRate > 5 ? '#ef4444' : d.lwbsRate > 2 ? '#f59e0b' : '#10b981',
    },
    {
      icon: <Layers size={20} />, label: 'Boarding Patients',
      value: d.boarding,
      sub: d.avgBoardTime > 0 ? `Avg ${fmtDur(d.avgBoardTime)} in limbo` : 'Awaiting bed / results',
      color: d.boarding > 5 ? '#ef4444' : d.boarding > 0 ? '#f59e0b' : '#10b981',
    },
    {
      icon: <Gauge size={20} />, label: 'Throughput',
      value: `${d.throughputPerHour}/hr`, sub: `${d.completedToday} completed today`,
      color: '#8b5cf6',
    },
  ];

  // Keep ref in sync so handleExportPDF always reads current KPIs
  kpisRef.current = kpis.map(k => ({
    label: k.label,
    value: k.value,
    sub: k.sub,
    color: k.color,
  }));

  return (
    <div
      className="analytics-page"
      ref={printViewRef}
      data-print-date={new Date().toLocaleString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })}
    >
      {/* ── Header ── */}
      <div className="page-header">
        <div className="analytics-header-row">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={26} /> ER Analytics &amp; Insights
          </h1>
          <div className="analytics-header-actions">
            <button
              type="button"
              className="analytics-export-btn"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              title="Download analytics report as PDF"
            >
              <FileDown size={16} />
              {isExportingPDF
                ? pdfProgress > 0 ? `${pdfProgress}%…` : 'Generating…'
                : 'Export PDF'}
            </button>
          </div>
        </div>
        <p className="analytics-subheader">
          Live clinical governance and performance metrics for quality improvement and teaching.
        </p>
      </div>

      {/* ── KPI Strip ── */}
      <div className="analytics-kpi-row">
        {kpis.map(k => (
          <div key={k.label} className="analytics-kpi-card">
            <div className="akpi-icon" style={{ color: k.color, background: k.color + '18' }}>
              {k.icon}
            </div>
            <div className="akpi-body">
              <div className="akpi-value" style={{ color: k.color }}>{k.value}</div>
              <div className="akpi-label">{k.label}</div>
              <div className="akpi-sub">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── View Tabs ── */}
      <div className="records-tabs" style={{ marginBottom: 18 }}>
        <button
          className={`records-tab ${activeView === 'live' ? 'active' : ''}`}
          onClick={() => setActiveView('live')}
        >
          <TrendingUp size={16} /> Live Analytics
        </button>
        <button
          className={`records-tab ${activeView === 'records' ? 'active' : ''}`}
          onClick={() => setActiveView('records')}
        >
          <Database size={16} /> Patient Records
        </button>
      </div>

      {/* ── Live Analytics View ── */}
      <div className={activeView === 'live' ? '' : 'analytics-view-hidden'}>

      {/* ── Row 1: 7-day volume + Priority pie ── */}
      <div className="analytics-row analytics-row-3-2">
        <div className="analytics-card">
          <h3>📈 7-Day Patient Volume by Acuity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.last7} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Critical" stackId="1"
                stroke="#dc2626" fill="#dc262628" strokeWidth={2} />
              <Area type="monotone" dataKey="Emergent" stackId="1"
                stroke="#f97316" fill="#f9731618" strokeWidth={2} />
              <Area type="monotone" dataKey="Urgent" stackId="1"
                stroke="#f59e0b" fill="#f59e0b18" strokeWidth={2} />
              <Area type="monotone" dataKey="Non-urgent" stackId="1"
                stroke="#10b981" fill="#10b98114" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-card">
          <h3>🎯 Acuity Mix</h3>
          {d.priPie.length === 0 ? (
            <div className="analytics-empty">No patient data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={185}>
                <PieChart>
                  <Pie data={d.priPie} cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    dataKey="value" paddingAngle={3}>
                    {d.priPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="analytics-legend">
                {d.priPie.map(p => (
                  <div key={p.name} className="al-item">
                    <span className="al-dot" style={{ background: p.color }} />
                    <span>{p.name}</span>
                    <strong>{p.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Wait vs Target + Service load ── */}
      <div className="analytics-row analytics-row-equal">
        <div className="analytics-card">
          <h3>⏱ Avg Wait vs NHS Target (minutes)</h3>
          {d.waitVsTarget.every(w => w['Avg Wait'] === 0) ? (
            <div className="analytics-empty">No closed tickets yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={d.waitVsTarget} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="m" />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Avg Wait" radius={[4, 4, 0, 0]}>
                  {d.waitVsTarget.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
                <Bar dataKey="NHS Target" fill="rgba(255,255,255,0.13)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-card">
          <h3>🏥 Service Utilisation</h3>
          {d.svcLoad.length === 0 ? (
            <div className="analytics-empty">No service data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={d.svcLoad} layout="vertical"
                margin={{ top: 5, right: 14, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8' }} width={82} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="Patients" radius={[0, 4, 4, 0]}>
                  {d.svcLoad.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 3: Top complaints + Disposition ── */}
      <div className="analytics-row analytics-row-equal">
        <div className="analytics-card">
          <h3>📋 Top Presenting Complaints</h3>
          {d.topComplaints.length === 0 ? (
            <div className="analytics-empty">No chief complaint data recorded yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={235}>
              <BarChart data={d.topComplaints} layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }} width={145} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-card">
          <h3>📊 Patient Disposition</h3>
          {d.outcomes.length === 0 ? (
            <div className="analytics-empty">No outcome data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.outcomes} layout="vertical"
                  margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fontSize: 10, fill: '#94a3b8' }} width={115} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {d.outcomes.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="analytics-stat-row">
                <div className="asr-item">
                  <span>Admit Rate</span>
                  <strong style={{ color: '#ec4899' }}>{d.admitRate}%</strong>
                </div>
                <div className="asr-item">
                  <span>No-Show Rate</span>
                  <strong style={{ color: '#ef4444' }}>{d.noShowRate}%</strong>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 4: Bed occupancy + Age demographics ── */}
      <div className="analytics-row analytics-row-equal">
        <div className="analytics-card">
          <h3>🛏 Bed Occupancy by Service</h3>
          <ResponsiveContainer width="100%" height={205}>
            <BarChart data={d.bedBySvc} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Occupied" stackId="a" fill="#ef4444" />
              <Bar dataKey="Available" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-card">
          <h3>👥 Age Demographics</h3>
          {d.ageGroups.length === 0 ? (
            <div className="analytics-empty">Age data not recorded yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={205}>
              <BarChart data={d.ageGroups} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {d.ageGroups.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 5: Hourly arrival heatmap ── */}
      <div className="analytics-row">
        <div className="analytics-card analytics-card-full">
          <h3>🕐 Hourly Arrival Pattern — Last 7 Days</h3>
          <p className="analytics-chart-hint">
            Identifies peak demand windows for staffing and resource planning.
          </p>
          <ResponsiveContainer width="100%" height={155}>
            <BarChart data={d.hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="Arrivals" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 6: LOS by outcome + Door-to-physician by acuity ── */}
      <div className="analytics-row analytics-row-equal">
        <div className="analytics-card">
          <h3>⏳ Avg Length of Stay by Outcome</h3>
          <p className="analytics-chart-hint">Highlights where patient pathways diverge — admitted patients typically have longer stays.</p>
          {d.losByOutcome.length === 0 ? (
            <div className="analytics-empty">No completed patient data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={195}>
              <BarChart data={d.losByOutcome} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="m" />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="LOS" radius={[4, 4, 0, 0]}>
                  {d.losByOutcome.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-card">
          <h3>🚨 Door-to-Physician Time by Acuity (min)</h3>
          <p className="analytics-chart-hint">Arrival to first bay contact vs triage target. Critical patients should reach zero.</p>
          {d.d2pByPriority.every(r => r['D2P (min)'] === 0) ? (
            <div className="analytics-empty">No closed tickets yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={195}>
              <BarChart data={d.d2pByPriority} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="m" />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="D2P (min)" radius={[4, 4, 0, 0]}>
                  {d.d2pByPriority.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
                <Bar dataKey="Target" fill="rgba(255,255,255,0.12)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 7: Service × Acuity Matrix ── */}
      <div className="analytics-row">
        <div className="analytics-card analytics-card-full">
          <h3>🔬 Service Area × Acuity Matrix</h3>
          <p className="analytics-chart-hint">
            Acuity breakdown per service area — reveals where critical and emergent cases concentrate for resource planning.
          </p>
          {d.servicePriorityMix.length === 0 ? (
            <div className="analytics-empty">No service data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.servicePriorityMix} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Critical" stackId="a" fill="#dc2626" />
                <Bar dataKey="Emergent" stackId="a" fill="#f97316" />
                <Bar dataKey="Urgent" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Non-urgent" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 8: Shift volume analysis ── */}
      <div className="analytics-row">
        <div className="analytics-card analytics-card-full">
          <h3>🔄 Shift Volume &amp; Throughput</h3>
          <p className="analytics-chart-hint">
            Patient arrivals per shift — informs staffing allocation and handover planning.
          </p>
          <div className="shift-analysis-grid">
            {d.shiftData.map((s, i) => {
              const icons = ['☀️', '🌆', '🌙'];
              const colors = ['#f59e0b', '#ef4444', '#8b5cf6'];
              const max = Math.max(...d.shiftData.map(x => x.Patients), 1);
              return (
                <div key={s.shift} className="shift-card">
                  <div className="shift-icon">{icons[i]}</div>
                  <div className="shift-name">{s.shift} Shift</div>
                  <div className="shift-label">{s.label}</div>
                  <div className="shift-count" style={{ color: colors[i] }}>{s.Patients}</div>
                  <div className="shift-bar-track">
                    <div
                      className="shift-bar-fill"
                      style={{ width: `${Math.round((s.Patients / max) * 100)}%`, background: colors[i] }}
                    />
                  </div>
                  <div className="shift-sub">patients arrived</div>
                </div>
              );
            })}
            <div className="shift-card shift-card--throughput">
              <div className="shift-icon"><Gauge size={22} color="#10b981" /></div>
              <div className="shift-name">Throughput</div>
              <div className="shift-label">Today so far</div>
              <div className="shift-count" style={{ color: '#10b981' }}>{d.throughputPerHour}</div>
              <div className="shift-sub">patients / hour</div>
              <div className="shift-meta">{d.completedToday} completed of {d.todayCensus} registered today</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Teaching Hospital Insights ── */}
      <div className="analytics-teaching-panel">
        <div className="atp-header">
          <BookOpen size={20} />
          <span>Teaching Hospital Insights</span>
          <span className="atp-sub">
            Clinical governance, education quality and QI indicators
          </span>
        </div>

        <div className="atp-grid">
          {/* Case Complexity */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#ef4444', background: '#ef444418' }}>
              <Zap size={20} />
            </div>
            <div className="atp-val">{d.acuityIdx}%</div>
            <div className="atp-lab">Case Complexity Index</div>
            <div className="atp-hint">% critical + emergent presentations</div>
          </div>

          {/* Learning cases */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#f59e0b', background: '#f59e0b18' }}>
              <Award size={20} />
            </div>
            <div className="atp-val">{d.highAcuity}</div>
            <div className="atp-lab">Learning Cases</div>
            <div className="atp-hint">High-acuity cases — ideal teaching material</div>
          </div>

          {/* Diagnostic breadth */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#8b5cf6', background: '#8b5cf618' }}>
              <Target size={20} />
            </div>
            <div className="atp-val">{d.uniqueComplaints}</div>
            <div className="atp-lab">Diagnostic Breadth</div>
            <div className="atp-hint">Unique chief complaints — training diversity</div>
          </div>

          {/* Admission rate */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#ec4899', background: '#ec489918' }}>
              <Stethoscope size={20} />
            </div>
            <div className="atp-val">{d.admitRate}%</div>
            <div className="atp-lab">Admission Rate</div>
            <div className="atp-hint">Admitted ÷ (admitted + discharged)</div>
          </div>

          {/* Supervision ratio */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#3b82f6', background: '#3b82f618' }}>
              <Users size={20} />
            </div>
            <div className="atp-val">
              {d.chargeNurses > 0 ? `1:${Math.round(d.staffNurses / d.chargeNurses)}` : '—'}
            </div>
            <div className="atp-lab">Supervision Ratio</div>
            <div className="atp-hint">Staff nurses per charge nurse on roster</div>
          </div>

          {/* Ambulance compliance */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#06b6d4', background: '#06b6d418' }}>
              <Activity size={20} />
            </div>
            <div className="atp-val">
              {d.ambTotal > 0 ? `${Math.round((d.ambArrived / d.ambTotal) * 100)}%` : '—'}
            </div>
            <div className="atp-lab">Amb. Arrival Rate</div>
            <div className="atp-hint">{d.ambArrived} of {d.ambTotal} dispatched arrived</div>
          </div>

          {/* Open escalations */}
          <div className="atp-metric">
            <div
              className="atp-metric-icon"
              style={{
                color: d.openEsc > 0 ? '#ef4444' : '#10b981',
                background: d.openEsc > 0 ? '#ef444418' : '#10b98118',
              }}
            >
              <Siren size={20} />
            </div>
            <div className="atp-val" style={{ color: d.openEsc > 0 ? '#ef4444' : undefined }}>
              {d.openEsc}
            </div>
            <div className="atp-lab">Open Escalations</div>
            <div className="atp-hint">{d.critEsc} critical · {d.totalEsc} total logged</div>
          </div>

          {/* Breach summary */}
          <div className="atp-metric">
            <div
              className="atp-metric-icon"
              style={{
                color: d.breachRate > 20 ? '#ef4444' : '#10b981',
                background: d.breachRate > 20 ? '#ef444418' : '#10b98118',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div className="atp-val" style={{ color: d.breachRate > 20 ? '#ef4444' : undefined }}>
              {d.breachRate}%
            </div>
            <div className="atp-lab">4-Hour Breach</div>
            <div className="atp-hint">{d.breachCount} patients exceeded target time</div>
          </div>

          {/* Patient : Nurse ratio */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{
              color: d.patientNurseRatio > 6 ? '#ef4444' : d.patientNurseRatio > 4 ? '#f59e0b' : '#10b981',
              background: d.patientNurseRatio > 6 ? '#ef444418' : d.patientNurseRatio > 4 ? '#f59e0b18' : '#10b98118',
            }}>
              <Users size={20} />
            </div>
            <div className="atp-val" style={{ color: d.patientNurseRatio > 6 ? '#ef4444' : d.patientNurseRatio > 4 ? '#f59e0b' : undefined }}>
              {d.patientNurseRatio < 0 ? '—' : `${d.patientNurseRatio}:1`}
            </div>
            <div className="atp-lab">Patient : Nurse Ratio</div>
            <div className="atp-hint">{d.activePatients} active pts · {d.onDutyNurses} nurses on duty{d.patientNurseRatio > 6 ? ' ⚠ High load' : ''}</div>
          </div>

          {/* Patient : Doctor ratio */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{
              color: d.patientDoctorRatio > 15 ? '#ef4444' : d.patientDoctorRatio > 10 ? '#f59e0b' : '#10b981',
              background: d.patientDoctorRatio > 15 ? '#ef444418' : d.patientDoctorRatio > 10 ? '#f59e0b18' : '#10b98118',
            }}>
              <Stethoscope size={20} />
            </div>
            <div className="atp-val" style={{ color: d.patientDoctorRatio > 15 ? '#ef4444' : d.patientDoctorRatio > 10 ? '#f59e0b' : undefined }}>
              {d.patientDoctorRatio < 0 ? '—' : `${d.patientDoctorRatio}:1`}
            </div>
            <div className="atp-lab">Patient : Doctor Ratio</div>
            <div className="atp-hint">{d.activePatients} active pts · {d.onDutyDoctors} physicians/PAs on duty{d.patientDoctorRatio > 15 ? ' ⚠ High load' : ''}</div>
          </div>

          {/* Daily ER Census */}
          <div className="atp-metric atp-metric--wide">
            <div className="atp-census-header">
              <div className="atp-metric-icon" style={{ color: '#06b6d4', background: '#06b6d418' }}>
                <Calendar size={20} />
              </div>
              <div className="atp-census-meta">
                <div className="atp-val" style={{ color: '#06b6d4' }}>{d.todayCensus}</div>
                <div className="atp-lab">Today's ER Census</div>
                <div className="atp-hint">7-day avg {d.avgCensus} pts/day · {d.admitted} admitted · {d.discharged} discharged today</div>
              </div>
            </div>
            <div className="atp-census-chart">
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={d.censusSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Census" fill="#06b6d4" radius={[3,3,0,0]} />
                  <Bar dataKey="Admitted" fill="#ec4899" radius={[3,3,0,0]} />
                  <Bar dataKey="Discharged" fill="#10b981" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Critical response time */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{
              color: d.avgCriticalResponse > 0 && d.avgCriticalResponse <= 5 ? '#10b981' : d.avgCriticalResponse > 10 ? '#ef4444' : '#f59e0b',
              background: d.avgCriticalResponse > 0 && d.avgCriticalResponse <= 5 ? '#10b98118' : d.avgCriticalResponse > 10 ? '#ef444418' : '#f59e0b18',
            }}>
              <Timer size={20} />
            </div>
            <div className="atp-val">
              {d.avgCriticalResponse > 0 ? fmtDur(d.avgCriticalResponse) : '—'}
            </div>
            <div className="atp-lab">Critical Response</div>
            <div className="atp-hint">Avg triage → bay for critical pts · target: immediate</div>
          </div>

          {/* LWBS rate */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{
              color: d.lwbsRate > 5 ? '#ef4444' : d.lwbsRate > 2 ? '#f59e0b' : '#10b981',
              background: d.lwbsRate > 5 ? '#ef444418' : d.lwbsRate > 2 ? '#f59e0b18' : '#10b98118',
            }}>
              <UserX size={20} />
            </div>
            <div className="atp-val" style={{ color: d.lwbsRate > 5 ? '#ef4444' : undefined }}>
              {d.lwbsRate}%
            </div>
            <div className="atp-lab">LWBS Rate</div>
            <div className="atp-hint">{d.lwbsCount} left without being seen{d.lwbsRate > 5 ? ' ⚠ Review wait times' : ''}</div>
          </div>

          {/* Referral rate */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#06b6d4', background: '#06b6d418' }}>
              <Activity size={20} />
            </div>
            <div className="atp-val">{d.referralRate}%</div>
            <div className="atp-lab">Referral Rate</div>
            <div className="atp-hint">{d.referredCount} patients transferred / referred out</div>
          </div>

          {/* Boarding patients */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{
              color: d.boarding > 5 ? '#ef4444' : d.boarding > 0 ? '#f59e0b' : '#10b981',
              background: d.boarding > 5 ? '#ef444418' : d.boarding > 0 ? '#f59e0b18' : '#10b98118',
            }}>
              <Layers size={20} />
            </div>
            <div className="atp-val" style={{ color: d.boarding > 5 ? '#ef4444' : d.boarding > 0 ? '#f59e0b' : undefined }}>
              {d.boarding}
            </div>
            <div className="atp-lab">Boarding Patients</div>
            <div className="atp-hint">{d.avgBoardTime > 0 ? `Avg ${fmtDur(d.avgBoardTime)} in limbo` : 'Results-pending + awaiting bed'}</div>
          </div>

          {/* Throughput */}
          <div className="atp-metric">
            <div className="atp-metric-icon" style={{ color: '#10b981', background: '#10b98118' }}>
              <Gauge size={20} />
            </div>
            <div className="atp-val" style={{ color: '#10b981' }}>{d.throughputPerHour}</div>
            <div className="atp-lab">Throughput /hr</div>
            <div className="atp-hint">{d.completedToday} patients processed today</div>
          </div>

          {/* Death Rate */}
          <div className="atp-metric">
            <div
              className="atp-metric-icon"
              style={{
                color: d.deathRate > 0 ? '#ef4444' : '#10b981',
                background: d.deathRate > 0 ? '#ef444418' : '#10b98118',
              }}
            >
              <Skull size={20} />
            </div>
            <div className="atp-val" style={{ color: d.deathRate > 0 ? '#ef4444' : undefined }}>
              {d.deathRate}%
            </div>
            <div className="atp-lab">Mortality Rate</div>
            <div className="atp-hint">{d.deceasedCount} deceased of {d.total} total patients</div>
          </div>
        </div>
      </div>

      </div>{/* end live analytics */}

      {/* ── Patient Records View ── */}
      {activeView === 'records' && (
        <>
          {/* End of Day Action */}
          <div className="eod-section">
            <div className="eod-info">
              <span className="eod-today">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="eod-count">{state.tickets.length} patients today</span>
            </div>
            {!confirmEndOfDay ? (
              <button
                className="btn-eod"
                onClick={() => setConfirmEndOfDay(true)}
                disabled={state.tickets.length === 0}
              >
                <Save size={16} /> End of Day — Save & Clear
              </button>
            ) : (
              <div className="eod-confirm">
                <span>Save all {state.tickets.length} patient records and clear the queue?</span>
                <button className="btn-eod-yes" onClick={handleEndOfDay} disabled={saving}>
                  {saving ? 'Saving…' : 'Yes, Save & Clear'}
                </button>
                <button className="btn-eod-no" onClick={() => setConfirmEndOfDay(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Sub-tabs: Charts / Records */}
          <div className="records-tabs" style={{ marginBottom: 14 }}>
            <button
              className={`records-tab ${recordsTab === 'charts' ? 'active' : ''}`}
              onClick={() => setRecordsTab('charts')}
            >
              <BarChart2 size={16} /> Historical Charts
            </button>
            <button
              className={`records-tab ${recordsTab === 'list' ? 'active' : ''}`}
              onClick={() => setRecordsTab('list')}
            >
              <List size={16} /> Patient Records
            </button>
          </div>

          {recordsTab === 'charts' && <RecordsCharts records={records} />}

          {recordsTab === 'list' && (
            <>
              <div className="records-search">
                <input
                  type="text"
                  placeholder="Search records by name, ticket #, area, or triage level…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="records-list">
                {records.length === 0 ? (
                  <div className="records-empty">
                    <Database size={48} />
                    <p>No records saved yet. Use "End of Day" to archive today's patients.</p>
                  </div>
                ) : (
                  records.map(record => {
                    const filtered = filterPatients(record.patients);
                    return (
                      <div key={record.id} className="record-card">
                        <div className="record-header" onClick={() => toggleExpand(record.id)}>
                          <div className="record-date">
                            <Calendar size={18} />
                            <strong>{formatDate(record.date)}</strong>
                          </div>
                          <div className="record-summary">
                            <span className="record-stat"><Users size={14} /> {record.totalPatients}</span>
                            <span className="record-stat completed"><CheckCircle2 size={14} /> {record.totalCompleted}</span>
                            <span className="record-stat noshow"><AlertTriangle size={14} /> {record.totalNoShow}</span>
                            <span className="record-stat deceased"><Skull size={14} /> {record.totalDeceased}</span>
                            <span className="record-stat avgwait"><Clock size={14} /> {record.avgWaitTime > 0 ? `${record.avgWaitTime} min avg` : '—'}</span>
                          </div>
                          <div className="record-actions">
                            <button
                              className="btn-icon danger"
                              onClick={e => { e.stopPropagation(); handleDeleteRecord(record.id); }}
                              title="Delete record"
                            >
                              <Trash2 size={16} />
                            </button>
                            {expandedDate === record.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>

                        {expandedDate === record.id && (
                          <div className="record-detail">
                            {filtered.length === 0 ? (
                              <p className="empty-text">No matching patients</p>
                            ) : (
                              <table className="records-table">
                                <thead>
                                  <tr>
                                    <th>Ticket</th>
                                    <th>Patient</th>
                                    <th>Age</th>
                                    <th>Area</th>
                                    <th>Triage</th>
                                    <th>Status</th>
                                    <th>Triaged At</th>
                                    <th>Called At</th>
                                    <th>Completed At</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filtered.map(p => (
                                    <tr key={p.id} className={`status-${p.status}`}>
                                      <td><span className="ticket-badge-sm" style={{ background: SERVICE_COLORS[p.service as keyof typeof SERVICE_COLORS] }}>{p.ticketNumber}</span></td>
                                      <td className="td-name">{p.patientName}</td>
                                      <td>{p.age != null ? `${p.age} yrs` : '—'}</td>
                                      <td>{p.service}</td>
                                      <td>
                                        <span className="triage-tag" style={{ background: TRIAGE_COLORS[p.priority as keyof typeof TRIAGE_COLORS] }}>
                                          {p.priority}
                                        </span>
                                      </td>
                                      <td><span className={`status-tag ${p.status}`}>{p.status}</span></td>
                                      <td>{formatTime(p.triagedAt)}</td>
                                      <td>{p.calledAt ? formatTime(p.calledAt) : '—'}</td>
                                      <td>{p.completedAt ? formatTime(p.completedAt) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <div className="record-saved-at">
                              Saved at {new Date(record.savedAt).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
