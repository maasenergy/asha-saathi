import React from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Mic,
  MapPin,
  Calendar,
  Search,
  Activity,
  HeartPulse,
  Info,
} from 'lucide-react';
import { MotherProfile } from '../../types';
import { useDemo } from '../../context/DemoContext';
import { AiOfflineBanner } from '../common/AiOfflineBanner';

interface TodayVisitsTileProps {
  onStartVisit: (patient: MotherProfile) => void;
}

export const TodayVisitsTile: React.FC<TodayVisitsTileProps> = ({ onStartVisit }) => {
  const {
    patients,
    language,
    aiScanResults,
    isScanningMothers,
    isAiOffline,
    runMotherScan,
  } = useDemo();

  const levelOrder: Record<string, number> = { RED: 3, AMBER: 2, GREEN: 1 };

  // Combine patients with scan results. With AI: AI priority first. Without AI (or for mothers
  // the AI did not rank): deterministic order by overall level, then trend-only hidden risk.
  const rankedPatients = [...patients].map((p) => {
    const scanItem = aiScanResults.find((r) => r.patientId === p.id);
    const priority = scanItem?.priority ?? 99;
    return {
      patient: p,
      scanItem,
      priority,
    };
  }).sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const levelA = levelOrder[a.patient.overallLevel || 'GREEN'] || 0;
    const levelB = levelOrder[b.patient.overallLevel || 'GREEN'] || 0;
    if (levelA !== levelB) return levelB - levelA;
    return Number(Boolean(b.patient.hiddenTrendRisk)) - Number(Boolean(a.patient.hiddenTrendRisk));
  });

  const hiddenRiskCount = rankedPatients.filter(
    (item) =>
      item.scanItem?.hiddenRisk || item.patient.riskSource === 'AI_HIDDEN' || item.patient.hiddenTrendRisk
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Banner & Scan Control */}
      <div className="bg-gradient-to-r from-[#1E2A4A] via-[#28385e] to-[#B0306A] text-white p-4 sm:p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-heading text-white">
                {language === 'hi' ? '📋 आज किससे मिलना है (दैनिक प्राथमिकता सूची)' : "📋 Today's Prioritized Visits"}
              </h2>
              <p className="text-xs text-rose-100">
                {language === 'hi'
                  ? 'प्रणाली माताओं के पिछले 3 दौरों के रुझानों पर स्वचालित नजर रखती है'
                  : "Continuous proactive risk surveillance watching every mother's trajectory"}
              </p>
            </div>
          </div>

          <button
            disabled={isScanningMothers}
            onClick={() => runMotherScan(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 active:scale-95 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition border border-white/20 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningMothers ? 'animate-spin' : ''}`} />
            <span>
              {isScanningMothers
                ? (language === 'hi' ? 'स्कैन हो रहा है...' : 'Scanning...')
                : (language === 'hi' ? '🔍 पुनः स्कैन करें' : '🔍 Scan All Mothers')}
            </span>
          </button>
        </div>

        {/* Proactive Surveillance Summary Pill */}
        <div className="bg-black/20 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-white/90">
              {language === 'hi'
                ? `कुल ${patients.length} माताओं का विश्लेषण • ${hiddenRiskCount} छिपा हुआ जोखिम (Hidden Risk) पकड़ा गया`
                : `${patients.length} mothers monitored • ${hiddenRiskCount} hidden risk trajectory caught`}
            </span>
          </div>

          <span className="text-[11px] text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-400/30">
            {language === 'hi' ? 'दैनिक स्वचालित स्कैन' : 'Auto-scanned daily'}
          </span>
        </div>
      </div>

      {isAiOffline && <AiOfflineBanner language={language} />}

      {/* Ranked Mothers List */}
      <div className="space-y-3.5">
        {rankedPatients.map(({ patient, scanItem, priority }, idx) => {
          const overallLevel = patient.overallLevel || scanItem?.level || 'GREEN';
          const isRed = overallLevel === 'RED';
          const isAmber = overallLevel === 'AMBER';
          const isAiHiddenRisk = scanItem?.hiddenRisk || patient.riskSource === 'AI_HIDDEN';
          const isTrendHiddenRisk = !isAiHiddenRisk && Boolean(patient.hiddenTrendRisk);
          const latestVisit = patient.visits[0];

          // Priority color classes
          const borderClass = isRed
            ? 'border-l-8 border-l-red-600 bg-red-50/30 border-red-200'
            : isAmber
            ? 'border-l-8 border-l-amber-500 bg-amber-50/30 border-amber-200'
            : 'border-l-8 border-l-emerald-500 bg-white border-slate-200';

          return (
            <div
              key={patient.id}
              className={`rounded-2xl p-4 sm:p-5 border shadow-sm transition-all hover:shadow-md ${borderClass} space-y-3`}
            >
              {/* Header: Priority #, Name, Tags */}
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="flex items-start gap-3">
                  {/* Priority Number Pill */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-sm shrink-0 ${
                      isRed
                        ? 'bg-red-600 text-white'
                        : isAmber
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold font-heading text-[#1E2A4A]">
                        {patient.name}
                      </h3>

                      {/* Hidden Risk Tag */}
                      {isAiHiddenRisk && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full shadow-xs">
                          <span>🔍</span>
                          <span>{language === 'hi' ? 'AI ने पकड़ा (Hidden Risk)' : 'Caught by AI (Hidden Risk)'}</span>
                        </span>
                      )}
                      {isTrendHiddenRisk && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full shadow-xs">
                          <span>↗</span>
                          <span>{language === 'hi' ? 'रुझान से पकड़ा (Hidden Risk)' : 'Caught by trend (Hidden Risk)'}</span>
                        </span>
                      )}

                      {/* Level Tag */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isRed
                            ? 'bg-red-100 text-red-800'
                            : isAmber
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isRed
                          ? (language === 'hi' ? '🔴 तत्काल (Urgent)' : '🔴 Urgent')
                          : isAmber
                          ? (language === 'hi' ? '🟡 ध्यान दें (Attention)' : '🟡 Attention')
                          : (language === 'hi' ? '🟢 सामान्य (Normal)' : '🟢 Normal')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5">
                      {patient.age} {language === 'hi' ? 'वर्ष' : 'yrs'} • {patient.village} • G{patient.gravida}P{patient.para} • {patient.gestationalWeeks} {language === 'hi' ? 'सप्ताह' : 'weeks'}
                    </p>
                  </div>
                </div>

                {/* Latest recorded BP */}
                <div className="text-right text-xs bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    {language === 'hi' ? 'हालिया BP' : 'Latest BP'}
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {latestVisit?.systolicBp ?? '--'}/{latestVisit?.diastolicBp ?? '--'} mmHg
                  </span>
                </div>
              </div>

              {/* The Clinical Observation Box with explicit 'for doctor review' tag */}
              {scanItem ? (
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {language === 'hi' ? 'दर्ज स्वास्थ्य अवलोकन:' : 'Observed Clinical Findings:'}
                    </span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                      {language === 'hi' ? 'AI अवलोकन — डॉक्टर समीक्षा हेतु' : 'AI draft — for doctor review'}
                    </span>
                  </div>
                  <p className="text-slate-900 font-semibold text-xs sm:text-sm">{scanItem.reason}</p>

                  {/* Additional observation notes */}
                  {scanItem.suggestedAction && (
                    <p className="text-[11px] text-purple-900 font-medium pt-1 border-t border-slate-100">
                      <strong>{language === 'hi' ? 'दर्ज अवलोकन विवरण:' : 'Documented Finding:'}</strong> {scanItem.suggestedAction}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {language === 'hi' ? 'पिछली विज़िट के नियम ट्रिगर:' : 'Rule triggers at last visit:'}
                    </span>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full border border-slate-300">
                      {language === 'hi' ? 'नियम-इंजन' : 'Rule engine'}
                    </span>
                  </div>
                  {latestVisit && latestVisit.ruleTriggers.length > 0 ? (
                    <ul className="list-disc pl-4 text-slate-800 font-medium space-y-0.5">
                      {latestVisit.ruleTriggers.map((trigger, i) => (
                        <li key={i}>{trigger}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-600">
                      {language === 'hi' ? 'कोई नियम ट्रिगर नहीं हुआ।' : 'No rule triggered.'}
                    </p>
                  )}
                </div>
              )}

              {/* Trajectory & Trend Flags (with ↗ or ↘ icons) */}
              {patient.trendFlags && patient.trendFlags.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    {language === 'hi' ? 'पहचाने गए रुझान (Trajectories Detected):' : 'Trajectories Detected:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.trendFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100/80 text-amber-900 border border-amber-300"
                        title={language === 'hi' ? flag.detailHindi : flag.detailEnglish}
                      >
                        <span className="text-base font-extrabold">
                          {flag.direction}
                        </span>
                        <span>
                          {language === 'hi' ? flag.labelHindi : flag.labelEnglish}
                        </span>
                        <span className="text-[10px] opacity-75 font-normal">
                          ({flag.valuesSummary})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button: Jumps straight into Step 2 with this mother pre-selected */}
              <div className="pt-2">
                <button
                  onClick={() => onStartVisit(patient)}
                  className="w-full py-3 px-4 bg-[#B0306A] hover:bg-[#902454] active:scale-98 text-white font-bold rounded-xl text-sm shadow transition flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>
                    {language === 'hi'
                      ? `🎙️ ${patient.name} की विज़िट शुरू करें (Start Visit)`
                      : `🎙️ Start Visit for ${patient.name}`}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
