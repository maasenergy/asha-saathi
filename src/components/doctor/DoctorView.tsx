import React, { useState } from 'react';
import {
  Stethoscope,
  AlertTriangle,
  Users,
  Clock,
  CheckCircle2,
  Send,
  FileText,
  Activity,
  PhoneCall,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Search,
  Filter,
  MapPin,
  Compass,
  Truck,
  X,
  Table as TableIcon,
  LayoutGrid,
  Eye,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useDemo } from '../../context/DemoContext';
import { MotherProfile, VisitRecord, EmergencySosAlert, TransportStatusType } from '../../types';
import { getTranslation } from '../../utils/translations';
import { TestsTrackerCard } from '../common/TestsTrackerCard';
import { AiOfflineBanner } from '../common/AiOfflineBanner';
import { DoctorBirthPlanPanel } from './DoctorBirthPlanPanel';

// Demo-configurable constant for SLA overdue escalation
export const RED_ALERT_SLA_MINUTES = 15;

// Helper to format relative time since a visit or alert
export function formatTimeSince(dateStr?: string): string {
  if (!dateStr) return '--';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diffMs)) return dateStr;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Helper to check if a patient's risk originated strictly from the trend engine or hidden-risk scan
export const isCaughtByTrendOrAi = (patient: MotherProfile): boolean => {
  const latestVisitRuleSeverity = patient.visits[0]?.ruleSeverity || 'GREEN';
  const isRuleNormal = latestVisitRuleSeverity === 'GREEN';
  const hasTrendRisk = Boolean(patient.trendFlags && patient.trendFlags.length > 0);
  const isAiHidden = patient.riskSource === 'AI_HIDDEN' || patient.aiScanResult?.hiddenRisk === true;
  const isTrendSource = patient.riskSource === 'TREND';
  return isRuleNormal && (hasTrendRisk || isAiHidden || isTrendSource);
};

export const DoctorView: React.FC = () => {
  const {
    patients,
    urgentAlerts,
    language,
    acknowledgeVisit,
    respondDoctorAdvice,
    acknowledgeSos,
    updateSosTransportStatus,
    resolveSosAlert,
    state,
    selectedPatient,
    setSelectedPatientId,
  } = useDemo();

  // View mode: 'TABLE' (Cohort Surveillance Table) vs 'DETAIL' (Clinical Case Review & SBAR)
  const [viewMode, setViewMode] = useState<'TABLE' | 'DETAIL'>('TABLE');

  const [activePatientId, setActivePatientId] = useState<string>(
    selectedPatient?.id || patients[0]?.id || ''
  );
  const [filterType, setFilterType] = useState<'ALL' | 'TREND_AI' | 'URGENT' | 'NORMAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Doctor advice form state for visits
  const [adviceText, setAdviceText] = useState('');
  const [isSendingAdvice, setIsSendingAdvice] = useState(false);
  const [adviceSuccess, setAdviceSuccess] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // SOS response modal state (replaces window.prompt)
  const [activeSosModal, setActiveSosModal] = useState<EmergencySosAlert | null>(null);
  const [sosAdviceInput, setSosAdviceInput] = useState('');
  const [sosTransportChoice, setSosTransportChoice] = useState<TransportStatusType>('FAMILY_CALLING_108');

  // Selected patient
  const currentPatient =
    patients.find((p) => p.id === activePatientId) || patients[0];
  const latestVisit: VisitRecord | undefined = currentPatient?.visits[0];

  // Quick preset clinical instructions for visits
  const PRESET_ADVICE = [
    'Emergency transfer to CHC/District Hospital via 108. Maintain left lateral position. ASHA to accompany with mother card.',
    'Urgent referral to PHC for parenteral antihypertensives & eclampsia evaluation. Recheck BP in 15 minutes.',
    'Keep patient calm in quiet dark room. No oral solids. Monitor fetal heart rate. Prepare immediate ambulance dispatch.',
  ];

  // Quick preset clinical instructions for SOS
  const SOS_PRESETS = [
    'Immediate 108 ambulance transfer advised. Keep in left lateral position, keep warm, no oral solids. ASHA to accompany with mother card.',
    'ASHA Sunita to reach residence immediately. Check BP, prepare referral to Navapur PHC. Keep airway clear.',
    'Urgent transfer to Sub-District Hospital / CHC. Prepare emergency obstetric pack and IV line on arrival.',
  ];

  // Handle acknowledge visit
  const handleAcknowledge = (visitId: string) => {
    acknowledgeVisit(visitId, 'Dr. Anand Verma (MO, Navapur PHC)');
  };

  // Handle send visit advice
  const handleSendAdvice = (visitId: string) => {
    if (!adviceText.trim()) {
      setAdviceError('Please enter clinical advice before sending.');
      return;
    }
    setAdviceError(null);
    setIsSendingAdvice(true);
    respondDoctorAdvice(
      visitId,
      {
        message: adviceText.trim(),
        actionPlan: 'Immediate emergency transport & in-person clinical assessment',
        isEmergencyReferral: true,
      },
      'Dr. Anand Verma (MO, Navapur PHC)'
    );
    setIsSendingAdvice(false);
    setAdviceSuccess(true);
    setTimeout(() => setAdviceSuccess(false), 4000);
  };

  // Open SOS response modal
  const handleOpenSosModal = (sos: EmergencySosAlert) => {
    setActiveSosModal(sos);
    setSosAdviceInput(sos.doctorAdvice?.message || SOS_PRESETS[0]);
    setSosTransportChoice(sos.transportStatus || 'FAMILY_CALLING_108');
  };

  // Submit SOS modal response
  const handleSubmitSosResponse = () => {
    if (!activeSosModal) return;

    // Acknowledge & save advice
    acknowledgeSos(
      activeSosModal.id,
      'Dr. Anand Verma (MO, Navapur PHC)',
      sosAdviceInput.trim() ? sosAdviceInput.trim() : undefined
    );

    // Update transport status
    updateSosTransportStatus(
      activeSosModal.id,
      sosTransportChoice,
      'Updated by Dr. Anand Verma'
    );

    setActiveSosModal(null);
  };

  // Filter and sort patients: Default sort = severity descending, then oldest-unacknowledged first
  const sortedPatients = [...patients]
    .filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.village.toLowerCase().includes(searchQuery.toLowerCase());

      const hasRed = p.visits.some((v) => v.finalSeverity === 'RED') || p.overallLevel === 'RED';
      const isTrendAi = isCaughtByTrendOrAi(p);

      if (filterType === 'TREND_AI') return matchesSearch && isTrendAi;
      if (filterType === 'URGENT') return matchesSearch && hasRed;
      if (filterType === 'NORMAL') return matchesSearch && !hasRed && !isTrendAi;
      return matchesSearch;
    })
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { RED: 3, AMBER: 2, GREEN: 1 };
      const aLatest = a.visits[0];
      const bLatest = b.visits[0];
      const aSev = a.overallLevel || aLatest?.finalSeverity || 'GREEN';
      const bSev = b.overallLevel || bLatest?.finalSeverity || 'GREEN';

      // 1. Severity descending (RED > AMBER > GREEN)
      if (sevOrder[aSev] !== sevOrder[bSev]) {
        return sevOrder[bSev] - sevOrder[aSev];
      }

      // 2. Oldest-unacknowledged first
      const aUnack =
        aLatest &&
        (aSev === 'RED' || aSev === 'AMBER') &&
        aLatest.alertStatus !== 'Acknowledged by doctor' &&
        aLatest.alertStatus !== 'Doctor responded';
      const bUnack =
        bLatest &&
        (bSev === 'RED' || bSev === 'AMBER') &&
        bLatest.alertStatus !== 'Acknowledged by doctor' &&
        bLatest.alertStatus !== 'Doctor responded';

      if (aUnack && !bUnack) return -1;
      if (!aUnack && bUnack) return 1;
      if (aUnack && bUnack && aLatest && bLatest) {
        return new Date(aLatest.timestamp).getTime() - new Date(bLatest.timestamp).getTime();
      }

      // 3. Fallback: most recent visit first
      const aTime = aLatest ? new Date(aLatest.timestamp).getTime() : 0;
      const bTime = bLatest ? new Date(bLatest.timestamp).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Clinician Dashboard Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#1E2A4A]">
              Navapur PHC • Clinical Decision Support Console
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Logged in as: <strong className="text-slate-800">Dr. Anand Verma</strong> (Medical Officer) • Sector B
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-semibold border border-slate-200">
            {language === 'hi' ? 'काल्पनिक डेमो डाटाबेस' : 'Demo Synthetic Database'}
          </span>
        </div>
      </div>

      {/* Summary KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Synthetic Mothers */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Synthetic Mothers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-[#1E2A4A]">{patients.length}</span>
              <span className="text-xs text-slate-500">enrolled profiles</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Urgent RED Visits */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between transition ${
            urgentAlerts.totalUrgent > 0
              ? 'bg-red-50/60 border-red-300 text-red-950'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-red-700">
              Urgent RED Case Alerts
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-red-700">
                {urgentAlerts.visits.length}
              </span>
              <span className="text-xs text-red-800">requiring immediate review</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Unacknowledged Alerts */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between transition ${
            urgentAlerts.totalUnacknowledged > 0
              ? 'bg-amber-50/60 border-amber-300 text-amber-950'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-amber-800">
              Unacknowledged Queue
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-amber-900">
                {urgentAlerts.totalUnacknowledged}
              </span>
              <span className="text-xs text-amber-800">pending clinician response</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Live Urgent Alert Feed (Prominent without hiding patient list) */}
      {(urgentAlerts.totalUrgent > 0 || urgentAlerts.sos.length > 0) && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 sm:p-5 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
              <h2 className="text-base sm:text-lg font-bold text-red-950 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span>Live Priority Emergency Feed</span>
              </h2>
            </div>
            <span className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-full">
              {urgentAlerts.totalUrgent} Active Urgent Items
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Urgent Visits */}
            {urgentAlerts.visits.map(({ patient, visit }) => {
              const alertTime = new Date(visit.timestamp).getTime();
              const elapsedMinutes = Math.max(0, Math.floor((Date.now() - alertTime) / (1000 * 60)));
              const elapsedText = elapsedMinutes < 1 ? 'Just now' : `${elapsedMinutes} min ago`;
              const isUnacknowledged =
                visit.alertStatus !== 'Acknowledged by doctor' && visit.alertStatus !== 'Doctor responded';
              const isEscalationOverdue =
                visit.finalSeverity === 'RED' && isUnacknowledged && elapsedMinutes >= RED_ALERT_SLA_MINUTES;

              return (
                <div
                  key={visit.id}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-sm transition ${
                    isEscalationOverdue
                      ? 'bg-red-50/95 border-2 border-red-600 ring-2 ring-red-300'
                      : 'bg-white border-red-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-red-950 text-sm">{patient.name}</span>
                      <span className="text-xs text-slate-500">
                        ({patient.village} • G{patient.gravida}P{patient.para} • {patient.gestationalWeeks} wks)
                      </span>
                      <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        BP {visit.systolicBp}/{visit.diastolicBp} mmHg
                      </span>

                      {/* Visible elapsed-time indicator since alert creation */}
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Created {elapsedText}</span>
                      </span>

                      {/* SLA Escalation Overdue visual flag */}
                      {isEscalationOverdue && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-red-600 text-white px-2.5 py-0.5 rounded-full shadow animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5 text-white" />
                          <span>Escalation Overdue ({elapsedMinutes}m &gt; {RED_ALERT_SLA_MINUTES}m)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-red-800 font-medium">
                      Triggers: {visit.ruleTriggers.join('; ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        visit.alertStatus === 'Doctor responded'
                          ? 'bg-purple-100 text-purple-800'
                          : visit.alertStatus === 'Acknowledged by doctor'
                          ? 'bg-blue-100 text-blue-800'
                          : isEscalationOverdue
                          ? 'bg-red-700 text-white font-extrabold'
                          : 'bg-red-100 text-red-800 animate-pulse'
                      }`}
                    >
                      {visit.alertStatus}
                    </span>

                    <button
                      onClick={() => {
                        setActivePatientId(patient.id);
                        setSelectedPatientId(patient.id);
                        setViewMode('DETAIL');
                      }}
                      className="px-3 py-1.5 bg-[#1E2A4A] hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition"
                    >
                      Open Clinical Case
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Mother SOS alerts */}
            {urgentAlerts.sos.map((sos) => (
              <div
                key={sos.id}
                className="bg-red-600 text-white p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-300 animate-bounce" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight">
                        EMERGENCY SOS: {sos.patientName} pressed SOS Button
                      </h3>
                      <p className="text-xs text-white/90">
                        Triggered: {new Date(sos.timestamp).toLocaleTimeString()} • Status: <strong className="underline">{sos.status}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Address, Landmark and GPS details */}
                  <div className="bg-black/20 p-2.5 rounded-lg text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 text-rose-100">
                      <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="font-semibold">Address:</span>
                      <span>{sos.address || 'House 42, Ward 3, Navapur, Block B'}</span>
                    </div>
                    <div className="pl-5 text-rose-200 text-[11px] flex flex-wrap items-center gap-3">
                      <span>Landmark: {sos.landmark || 'Near Maruti Temple / Gram Panchayat Water Tank'}</span>
                      <span>• GPS: 19.8762° N, 75.3433° E</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded font-bold text-white">
                        Transport: {sos.transportStatus || 'CARE_TEAM_ALERTED'}
                      </span>
                    </div>
                  </div>

                  {sos.doctorAdvice && (
                    <div className="bg-white/10 p-2 rounded-lg text-xs text-white">
                      <strong>Current Advice:</strong> "{sos.doctorAdvice.message}"
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleOpenSosModal(sos)}
                    className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>
                      {sos.status === 'Doctor responded'
                        ? 'Update SOS Advice & Transport'
                        : 'Acknowledge & Send Instructions'}
                    </span>
                  </button>

                  <button
                    onClick={() => resolveSosAlert(sos.id)}
                    className="px-4 py-2 bg-red-900 hover:bg-red-950 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5"
                    title={language === 'hi' ? 'आपातकाल समाप्त और फ़ीड बंद करें' : 'Resolve and close emergency'}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Resolve & Close Emergency</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Mode Navigation Tabs: Cohort Surveillance Table vs Clinical Detail */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              viewMode === 'TABLE'
                ? 'bg-[#1E2A4A] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>📋 Patient Cohort & Trends Table</span>
            <span className="ml-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
              {patients.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('DETAIL')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              viewMode === 'DETAIL'
                ? 'bg-[#1E2A4A] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>🩺 Clinical Case Review & SBAR</span>
            <span className="text-[11px] text-slate-400 font-normal">
              ({currentPatient.name})
            </span>
          </button>
        </div>

        {/* Proactive Risk Surveillance indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-900 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
          <span>Proactive Risk Surveillance Layer: Watching all trajectories</span>
        </div>
      </div>

      {viewMode === 'TABLE' ? (
        /* ========================================================================= */
        /* TAB 1: COHORT SURVEILLANCE TABLE WITH TRENDS COLUMN & CAUGHT BY TREND/AI  */
        /* ========================================================================= */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          {/* Controls: Search & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold font-heading text-lg text-[#1E2A4A] flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-blue-600" />
                <span>Antenatal Patient Cohort • Trend Trajectory Surveillance</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Continuous deterministic trend monitoring flags trajectories before single-visit clinical limits breach.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: `All Mothers (${patients.length})` },
                { id: 'TREND_AI', label: `Caught by Trend/AI (${patients.filter(isCaughtByTrendOrAi).length})` },
                { id: 'URGENT', label: `${language === 'hi' ? 'तुरंत आवश्यक' : 'Urgent'} (${patients.filter((p) => p.visits.some((v) => v.finalSeverity === 'RED') || p.overallLevel === 'RED').length})` },
                { id: 'NORMAL', label: language === 'hi' ? 'सामान्य' : 'Normal' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterType === f.id
                      ? 'bg-[#1E2A4A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by mother name or village..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E2A4A]"
            />
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3.5">Name</th>
                  <th className="py-3 px-3">Gestational Week</th>
                  <th className="py-3 px-3">ASHA Worker</th>
                  <th className="py-3 px-3">Rule Trigger</th>
                  <th className="py-3 px-3">Time Since Visit</th>
                  <th className="py-3 px-3.5 bg-amber-50/70 border-x border-amber-200 text-amber-950 font-extrabold">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
                      <span>Trends (↗/↘)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 bg-blue-50/50 border-r border-blue-200 text-blue-950">
                    Acknowledged
                  </th>
                  <th className="py-3 px-3 bg-purple-50/50 border-r border-purple-200 text-purple-950">
                    Advice Sent
                  </th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {sortedPatients.map((patient) => {
                  const latestVisit = patient.visits[0];
                  const ruleSev = latestVisit?.ruleSeverity || 'GREEN';
                  const overallLevel = patient.overallLevel || ruleSev;
                  const caughtByTrendOrAi = isCaughtByTrendOrAi(patient);

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-slate-50/80 transition ${
                        patient.id === activePatientId ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* 1. Severity Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5 ${
                            overallLevel === 'RED'
                              ? 'bg-red-600 text-white'
                              : overallLevel === 'AMBER'
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          <span>{overallLevel}</span>
                        </span>
                      </td>

                      {/* 2. Name & Village */}
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-sm text-[#1E2A4A]">{patient.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {patient.age}y • {patient.village} • G{patient.gravida}P{patient.para}
                        </div>
                      </td>

                      {/* 3. Gestational Week & EDD */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{patient.gestationalWeeks} weeks</span>
                        <div className="text-[10px] text-slate-400">EDD: {patient.edd}</div>
                      </td>

                      {/* 4. ASHA Worker Name */}
                      <td className="py-3 px-3 text-slate-700 font-medium text-xs whitespace-nowrap">
                        {patient.ashaAssigned || 'Sunita Tai (ASHA)'}
                      </td>

                      {/* 5. Specific Rule Trigger Text */}
                      <td className="py-3 px-3 max-w-[220px]">
                        {latestVisit?.ruleTriggers && latestVisit.ruleTriggers.length > 0 ? (
                          <span
                            className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md inline-block max-w-[210px] truncate"
                            title={latestVisit.ruleTriggers.join('; ')}
                          >
                            {latestVisit.ruleTriggers[0]}
                          </span>
                        ) : latestVisit?.systolicBp ? (
                          <span className="text-[11px] text-slate-700 font-semibold">
                            BP {latestVisit.systolicBp}/{latestVisit.diastolicBp} mmHg
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">None</span>
                        )}
                      </td>

                      {/* 6. Time Since Visit */}
                      <td className="py-3 px-3 text-slate-600 font-medium text-[11px] whitespace-nowrap">
                        <Clock className="w-3 h-3 text-slate-400 inline mr-1" />
                        {formatTimeSince(latestVisit?.timestamp)}
                      </td>

                      {/* 7. Trends Column with ↗/↘ Icons & "Caught by trend/AI" Badge */}
                      <td className="py-3 px-3.5 bg-amber-50/40 border-x border-amber-200">
                        <div className="space-y-1">
                          {patient.trendFlags && patient.trendFlags.length > 0 ? (
                            patient.trendFlags.map((flag) => (
                              <div
                                key={flag.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 mr-1 mb-0.5"
                                title={flag.detailEnglish}
                              >
                                <span className="text-sm font-extrabold text-amber-700 shrink-0">
                                  {flag.direction}
                                </span>
                                <span>{flag.labelEnglish}</span>
                                <span className="text-[10px] text-amber-800/80 font-normal">
                                  ({flag.valuesSummary})
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs italic">Normal trajectory</span>
                          )}

                          {caughtByTrendOrAi && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 shadow-xs">
                                <Sparkles className="w-3 h-3 text-purple-700 shrink-0" />
                                <span>Caught by trend/AI</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 8. Acknowledged State (Distinct Column) */}
                      <td className="py-3 px-3 bg-blue-50/20 border-r border-blue-100 whitespace-nowrap">
                        {latestVisit?.acknowledgedAt ||
                        latestVisit?.alertStatus === 'Acknowledged by doctor' ||
                        latestVisit?.alertStatus === 'Doctor responded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Acknowledged</span>
                          </span>
                        ) : ruleSev === 'RED' || overallLevel === 'RED' || ruleSev === 'AMBER' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <Clock className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* 9. Advice Sent State (Distinct Column) */}
                      <td className="py-3 px-3 bg-purple-50/20 border-r border-purple-100 whitespace-nowrap">
                        {latestVisit?.doctorAdvice || latestVisit?.alertStatus === 'Doctor responded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                            <Send className="w-3 h-3 text-purple-600" />
                            <span>Advice Sent</span>
                          </span>
                        ) : ruleSev === 'RED' || overallLevel === 'RED' || ruleSev === 'AMBER' ? (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-amber-200">
                            Not Sent
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* 10. Action */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setActivePatientId(patient.id);
                            setSelectedPatientId(patient.id);
                            setViewMode('DETAIL');
                          }}
                          className="px-3 py-1.5 bg-[#1E2A4A] hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Case</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 2: CLINICAL SPLIT CONSOLE (LEFT ROSTER + RIGHT SBAR & CLINICAL PANEL) */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Synthetic Patient Roster (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold font-heading text-lg text-[#1E2A4A]">
                  Synthetic Patients
                </h2>
                <span className="text-xs text-slate-500">
                  {sortedPatients.length} shown
                </span>
              </div>

              {/* Filter buttons */}
              <div className="flex flex-wrap gap-1 mb-3">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'TREND_AI', label: 'Trend/AI' },
                  { id: 'URGENT', label: 'Urgent' },
                  { id: 'NORMAL', label: 'Normal' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setFilterType(mode.id as any)}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition ${
                      filterType === mode.id
                        ? 'bg-[#1E2A4A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patient..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1E2A4A]"
                />
              </div>

              {/* List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {sortedPatients.map((patient: MotherProfile) => {
                  const isActive = patient.id === activePatientId;
                  const hasRed = patient.visits.some((v: VisitRecord) => v.finalSeverity === 'RED') || patient.overallLevel === 'RED';
                  const caughtByTrendOrAi = isCaughtByTrendOrAi(patient);

                  return (
                    <div
                      key={patient.id}
                      onClick={() => {
                        setActivePatientId(patient.id);
                        setSelectedPatientId(patient.id);
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isActive
                          ? 'border-[#1E2A4A] bg-blue-50/50 shadow-sm ring-1 ring-[#1E2A4A]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-[#1E2A4A]">{patient.name}</h4>
                            {hasRed && (
                              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {patient.age}y • {patient.village} • {patient.gestationalWeeks}w
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              hasRed
                                ? 'bg-red-100 text-red-800'
                                : patient.overallLevel === 'AMBER'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {hasRed
                              ? (language === 'hi' ? 'तुरंत आवश्यक' : 'Urgent')
                              : patient.overallLevel === 'AMBER'
                              ? (language === 'hi' ? 'ध्यान दें' : 'Attention')
                              : (language === 'hi' ? 'सामान्य' : 'Normal')}
                          </span>

                          {caughtByTrendOrAi && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-300">
                              Caught by trend/AI
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Trends tags preview */}
                      {patient.trendFlags && patient.trendFlags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                          {patient.trendFlags.map((flag: any) => (
                            <span
                              key={flag.id}
                              className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded"
                            >
                              {flag.direction} {flag.labelEnglish}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                        <span>Latest BP:</span>
                        <strong>
                          {patient.visits[0]?.systolicBp ?? '--'}/
                          {patient.visits[0]?.diastolicBp ?? '--'} mmHg
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity Timeline Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold font-heading text-sm text-[#1E2A4A] mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-500" />
                <span>Activity Timeline (Audit Log)</span>
              </h3>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {state.activities.map((act) => (
                  <div key={act.id} className="text-xs border-l-2 border-slate-200 pl-3 py-0.5 relative">
                    <span className="w-2 h-2 rounded-full bg-slate-400 absolute -left-[5px] top-1.5"></span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{act.action}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">{act.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Detail Panel & SBAR & Doctor Advice (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Patient Overview Banner */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl font-bold font-heading text-[#1E2A4A]">
                      {currentPatient.name}
                    </h2>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
                      Age: {currentPatient.age}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
                      G{currentPatient.gravida}P{currentPatient.para}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Village: <strong className="text-slate-700">{currentPatient.village}</strong> • Gestational Age:{' '}
                    <strong className="text-slate-700">{currentPatient.gestationalWeeks} Weeks</strong> • EDD:{' '}
                    <strong className="text-slate-700">{currentPatient.edd}</strong> • ASHA:{' '}
                    <strong className="text-slate-700">{currentPatient.ashaAssigned}</strong>
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {latestVisit && (
                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        currentPatient.overallLevel === 'RED'
                          ? 'bg-red-50 border-red-300 text-red-800'
                          : currentPatient.overallLevel === 'AMBER'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>{currentPatient.overallLevel || latestVisit.finalSeverity} OVERALL LEVEL</span>
                    </div>
                  )}

                  {isCaughtByTrendOrAi(currentPatient) && (
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Caught by trend/AI</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Trajectory & Trend Flags banner if detected */}
              {currentPatient.trendFlags && currentPatient.trendFlags.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-amber-700" />
                      <span>Vital Trajectory & Trend Engine Surveillance:</span>
                    </span>
                    {isCaughtByTrendOrAi(currentPatient) && (
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>Caught by trend/AI</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentPatient.trendFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-950 shadow-xs flex items-center gap-1.5"
                      >
                        <span className="text-sm font-extrabold text-amber-700">{flag.direction}</span>
                        <span>{flag.labelEnglish}:</span>
                        <span className="text-[11px] text-slate-700 font-medium">{flag.valuesSummary}</span>
                      </div>
                    ))}
                  </div>
                  {currentPatient.riskSource === 'AI_HIDDEN' && (
                    <p className="text-[11px] text-purple-900 font-semibold pt-1 border-t border-amber-200/60">
                      🔍 <strong>Occult fluid retention / pre-eclampsia alert:</strong> All individual visit readings were within standard clinical thresholds, but the combination of steady BP climb and rapid weight gain was caught by the proactive surveillance layer.
                    </p>
                  )}
                </div>
              )}

              {/* Vitals Trend Comparison: Before & After */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Baseline Prior Visit (2 weeks ago)
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-extrabold text-slate-800">
                      {currentPatient.visits[1]?.systolicBp ?? 118}/{currentPatient.visits[1]?.diastolicBp ?? 76} mmHg
                    </span>
                    <span className="text-xs text-emerald-600 font-bold">Normal Range</span>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    latestVisit?.finalSeverity === 'RED'
                      ? 'bg-red-50 border-red-300 text-red-950'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase block text-red-700">
                    Current Open / Confirmed Visit
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-extrabold text-red-700">
                      {latestVisit?.systolicBp ?? '--'}/{latestVisit?.diastolicBp ?? '--'} mmHg
                    </span>
                    {latestVisit?.finalSeverity === 'RED' && (
                      <span className="text-xs bg-red-600 text-white font-bold px-2 py-0.5 rounded">
                        CRITICAL RISE (+42/+34)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* Visit Details & Confirmed Measurements */}
          {latestVisit ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-lg text-[#1E2A4A] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Confirmed Antenatal Record & Clinical Flags</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Recorded: {new Date(latestVisit.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Original ASHA Voice Transcript */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Original ASHA Spoken Transcript:
                </span>
                <p className="text-sm font-serif italic text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                  "{latestVisit.rawTranscript}"
                </p>
              </div>

              {/* Exact Deterministic Rule Flags */}
              <div className="p-3.5 bg-red-50/70 rounded-xl border border-red-200">
                <span className="text-xs font-bold text-red-900 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Deterministic Rule Flags (Non-downgradable):</span>
                </span>
                <ul className="space-y-1 text-xs sm:text-sm font-semibold text-red-950">
                  {latestVisit.ruleTriggers.map((trig, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                      <span>{trig}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Extracted Symptoms & Observations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600 block mb-1">Reported Symptoms:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {latestVisit.symptoms.length > 0 ? (
                      latestVisit.symptoms.map((s, i) => (
                        <span
                          key={i}
                          className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">None reported</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600 block mb-1">Other Observations:</span>
                  <p className="text-slate-700">
                    {latestVisit.otherObservations || 'None noted by ASHA'}
                  </p>
                </div>
              </div>

              {/* AI SBAR Draft Card (clearly labeled) */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-sm text-blue-950">
                      Clinical SBAR Handoff
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                    AI draft—verify against confirmed visit
                  </span>
                </div>

                {latestVisit.aiHandoffDraft?.sbar ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <strong className="text-blue-900 block font-bold">Situation (S):</strong>
                      <p className="text-slate-800 font-medium">
                        {latestVisit.aiHandoffDraft.sbar.situation}
                      </p>
                    </div>
                    <div>
                      <strong className="text-blue-900 block font-bold">Background (B):</strong>
                      <p className="text-slate-800 font-medium">
                        {latestVisit.aiHandoffDraft.sbar.background}
                      </p>
                    </div>
                    <div>
                      <strong className="text-blue-900 block font-bold">Assessment (A):</strong>
                      <p className="text-slate-800 font-medium">
                        {latestVisit.aiHandoffDraft.sbar.assessment}
                      </p>
                    </div>
                    <div>
                      <strong className="text-blue-900 block font-bold">Recommendation (R):</strong>
                      <p className="text-slate-800 font-medium">
                        {latestVisit.aiHandoffDraft.sbar.recommendation}
                      </p>
                    </div>
                  </div>
                ) : latestVisit.isAiFallback ? (
                  <div className="space-y-1">
                    <AiOfflineBanner language="en" />
                    <p className="text-[11px] text-slate-500 px-1">
                      No SBAR draft was generated. Use the confirmed measurements and rule flags above.
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 animate-spin text-blue-500" />
                      <span>Generating AI SBAR handoff from confirmed visit findings...</span>
                    </div>
                    <span className="text-[11px] text-slate-400">(review flags directly)</span>
                  </div>
                )}
              </div>

              {/* Birth Plan Review: approve or change facility */}
              <DoctorBirthPlanPanel key={currentPatient.id} patient={currentPatient} />

              {/* Antenatal Diagnostic & Clinical Tests Status */}
              <TestsTrackerCard
                patientId={currentPatient.id}
                patientName={currentPatient.name}
                tests={currentPatient.tests || []}
                allowEdit={true}
              />

              {/* Doctor Actions: Acknowledge & Send Advice */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Doctor Decision & Action Handoff
                  </span>

                  {/* Acknowledge Button */}
                  {latestVisit.alertStatus === 'Acknowledged by doctor' ||
                  latestVisit.alertStatus === 'Doctor responded' ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Acknowledged at{' '}
                        {latestVisit.acknowledgedAt
                          ? new Date(latestVisit.acknowledgedAt).toLocaleTimeString()
                          : 'now'}
                      </span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(latestVisit.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Acknowledge Urgent Alert</span>
                    </button>
                  )}
                </div>

                {/* Advice Input Box */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Send Written Advice to ASHA & Mother:
                  </label>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5 mb-2">
                    {PRESET_ADVICE.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setAdviceText(preset)}
                        className="text-left w-full text-[11px] p-2 bg-white hover:bg-blue-50 text-slate-800 rounded-lg border border-slate-200 transition"
                      >
                        + "{preset}"
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={adviceText}
                    onChange={(e) => setAdviceText(e.target.value)}
                    placeholder="Enter specific clinical guidance for ASHA and family (e.g. transport instructions, position, precautions)..."
                    className="w-full p-2.5 text-xs text-slate-900 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500">
                      *Advice appears instantly on ASHA and Mother screens.
                    </span>

                    <button
                      disabled={isSendingAdvice || !adviceText.trim()}
                      onClick={() => handleSendAdvice(latestVisit.id)}
                      className="px-4 py-2 bg-[#2F7D4F] hover:bg-[#25653f] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Advice to ASHA & Mother</span>
                    </button>
                  </div>

                  {adviceError && (
                    <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 rounded-lg border border-red-200 font-semibold">
                      {adviceError}
                    </div>
                  )}

                  {adviceSuccess && (
                    <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Doctor advice dispatched successfully to ASHA and Mother views.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                No active visits for this patient yet.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Switch to ASHA role to record a new visit.
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* SOS Clinical Response Modal */}
      {activeSosModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-heading">
                    Respond to Emergency SOS: {activeSosModal.patientName}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Logged: {new Date(activeSosModal.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveSosModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mother Address, Landmark & GPS summary */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <MapPin className="w-4 h-4 text-red-600" />
                <span>Mother's Emergency Location:</span>
              </div>
              <p className="text-slate-800 font-medium pl-5">
                {activeSosModal.address || 'House 42, Ward 3, Navapur, Block B'}
              </p>
              <div className="pl-5 text-slate-500 text-[11px] flex flex-wrap gap-2">
                <span>Landmark: {activeSosModal.landmark || 'Near Maruti Temple / Gram Panchayat Tank'}</span>
                <span>• GPS: 19.8762° N, 75.3433° E</span>
              </div>
            </div>

            {/* Transport Tracking Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Update Transport Status:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    { id: 'FAMILY_CALLING_108', label: 'Family Calling 108' },
                    { id: 'ASHA_DISPATCHED', label: 'ASHA Dispatched to Home' },
                    { id: 'IN_TRANSIT_TO_PHC', label: 'In Transit to PHC/SDH' },
                    { id: 'DISPATCH_CONFIRMED', label: '108 Dispatch Confirmed' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSosTransportChoice(t.id)}
                    className={`py-2 px-2.5 rounded-xl border text-left font-semibold transition text-xs ${
                      sosTransportChoice === t.id
                        ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clinical Advice Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Urgent Instructions for ASHA & Family:
              </label>
              <div className="space-y-1.5">
                {SOS_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSosAdviceInput(preset)}
                    className="w-full text-left p-2 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 text-[11px] text-slate-700 transition"
                  >
                    + "{preset}"
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={sosAdviceInput}
                onChange={(e) => setSosAdviceInput(e.target.value)}
                placeholder="Type urgent instructions..."
                className="w-full p-2.5 text-xs text-slate-900 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveSosModal(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitSosResponse}
                className="py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save, Acknowledge & Send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
