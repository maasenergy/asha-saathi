import React from 'react';
import {
  HeartPulse,
  Stethoscope,
  Baby,
  RefreshCw,
  Bell,
  Languages,
  ShieldAlert,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useDemo } from '../../context/DemoContext';
import { UserRole, AppLanguage } from '../../types';
import { getTranslation } from '../../utils/translations';

export const TopBar: React.FC = () => {
  const {
    activeRole,
    setRole,
    language,
    setLanguage,
    urgentAlerts,
    resetDemoData,
    patients,
    activeMother,
    setActiveMotherId,
  } = useDemo();

  const [resetConfirming, setResetConfirming] = React.useState(false);

  const handleReset = () => {
    if (!resetConfirming) {
      setResetConfirming(true);
      setTimeout(() => setResetConfirming(false), 3000);
      return;
    }
    resetDemoData();
    setResetConfirming(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1E2A4A] text-white shadow-md border-b border-white/10">
      {/* Simulation Banner */}
      <div className="bg-[#B0306A] text-white text-xs py-1 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          {getTranslation('prototypeBanner', language)}
        </span>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#B0306A] flex items-center justify-center shadow-inner">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-lg sm:text-xl tracking-tight text-white">
                {language === 'hi' ? 'आशा साथी' : 'ASHA Saathi'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                {getTranslation('demoPill', language)}
              </span>
              <span className="text-white/40 text-[10px] hidden sm:inline">•</span>
              <span className="text-[11px] text-white/70 hidden sm:inline">
                {language === 'hi' ? 'काल्पनिक मरीज डेटा' : 'Synthetic Data Only'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Role Switcher */}
        <div className="flex items-center bg-black/25 p-1 rounded-xl border border-white/10 order-3 sm:order-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => setRole('ASHA')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeRole === 'ASHA'
                ? 'bg-[#B0306A] text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <HeartPulse className="w-4 h-4 text-rose-300" />
            <span>{language === 'hi' ? 'आशा (ASHA)' : 'ASHA'}</span>
          </button>

          <button
            onClick={() => setRole('DOCTOR')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeRole === 'DOCTOR'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-blue-300" />
            <span>{language === 'hi' ? 'डॉक्टर (Doctor)' : 'Doctor'}</span>
            {urgentAlerts.totalUnacknowledged > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow">
                {urgentAlerts.totalUnacknowledged}
              </span>
            )}
          </button>

          <button
            onClick={() => setRole('MOTHER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeRole === 'MOTHER'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Baby className="w-4 h-4 text-purple-300" />
            <span>{language === 'hi' ? 'माता (Mother)' : 'Mother'}</span>
          </button>
        </div>

        {/* Right Actions: "Who am I" (Mother role), Lang, Reset, Alerts badge */}
        <div className="flex items-center gap-2 order-2 sm:order-3">
          {activeRole === 'MOTHER' && (
            <label className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <span className="hidden md:inline">{language === 'hi' ? 'मैं हूँ:' : 'I am:'}</span>
              <select
                value={activeMother?.id || ''}
                onChange={(e) => setActiveMotherId(e.target.value)}
                aria-label={language === 'hi' ? 'माता चुनें' : 'Select mother'}
                className="max-w-[9rem] px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-semibold focus:outline-none"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id} className="text-[#1E2A4A]">
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/90 border border-white/10 transition"
            title="Toggle Hindi / English"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'English' : 'हिन्दी'}</span>
          </button>

          {/* Reset Demo button */}
          <button
            onClick={handleReset}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              resetConfirming
                ? 'bg-amber-500 text-black border-amber-400 font-bold animate-pulse'
                : 'bg-white/10 hover:bg-red-500/30 text-white/90 border-white/10'
            }`}
            title="Reset synthetic demo data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">
              {resetConfirming
                ? (language === 'hi' ? 'पुष्टि हेतु पुनः दबाएं' : 'Confirm Reset?')
                : getTranslation('resetDemo', language)}
            </span>
          </button>

          {/* Notification Indicator */}
          {urgentAlerts.totalUrgent > 0 && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                urgentAlerts.totalUnacknowledged > 0
                  ? 'bg-red-600/30 border-red-500 text-red-200 animate-pulse'
                  : 'bg-white/10 border-white/10 text-white/80'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>
                {urgentAlerts.totalUrgent} {language === 'hi' ? 'अलर्ट' : 'Alerts'}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
