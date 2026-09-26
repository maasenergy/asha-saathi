/**
 * ASHA Saathi by Maas Doc
 * 
 * Educational antenatal decision-support prototype.
 * Turns spoken home-visit reports into reviewed records, deterministic alerts, and SBAR handoffs.
 */
import React from 'react';
import { DemoProvider, useDemo } from './context/DemoContext';
import { TopBar } from './components/common/TopBar';
import { AshaView } from './components/asha/AshaView';
import { DoctorView } from './components/doctor/DoctorView';
import { MotherView } from './components/mother/MotherView';
import { PhoneCall, ShieldAlert, HeartPulse, RefreshCw } from 'lucide-react';
import { getTranslation } from './utils/translations';

function MainContent() {
  const { activeRole, language, resetDemoData, activeMother } = useDemo();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FC]">
      <TopBar />

      {/* Main role view area */}
      <main className="flex-1 pb-16">
        {activeRole === 'ASHA' && <AshaView />}
        {activeRole === 'DOCTOR' && <DoctorView />}
        {activeRole === 'MOTHER' && <MotherView key={activeMother?.id} />}
      </main>

      {/* Global Safety & Prototype Disclaimer Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500 space-y-3">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-rose-50 text-[#B0306A] font-bold px-3 py-1 rounded-full border border-rose-200 text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {language === 'hi'
                ? 'सिमुलेशन - केवल डमी डेटा • निर्णय सहायता केवल • वास्तविक नैदानिक निर्णय केवल डॉक्टर लेते हैं'
                : 'Simulation with synthetic data • Decision support only • Doctor makes clinical decisions'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {language === 'hi'
              ? 'आशा साथी एक शैक्षिक प्रोटोटाइप है। यह सीडीएससीओ, एबीडीएम, या वास्तविक आपातकालीन सेवा एकीकरण का दावा नहीं करता है। किसी भी आपात स्थिति में तुरंत 108 या 102 पर संपर्क करें।'
              : 'ASHA Saathi is an educational prototype. It does not claim CDSCO clearance, ABDM certification, or live emergency-service dispatch integration. Always seek immediate in-person medical care.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {language === 'hi' ? 'मल्टी-टैब लोकल स्टोरेज सिंक सक्रिय' : 'Multi-Tab Local Storage Sync Active'}
            </span>
            <span>•</span>
            <a href="tel:108" className="hover:text-red-600 flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5 text-red-600" />
              <span>{getTranslation('call108', language)}</span>
            </a>
            <span>•</span>
            <a href="tel:102" className="hover:text-blue-600 flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
              <span>{getTranslation('call102', language)}</span>
            </a>
            <span>•</span>
            <button
              onClick={() => {
                if (window.confirm('Reset demo state to initial seed data?')) {
                  resetDemoData();
                }
              }}
              className="text-[#B0306A] hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{getTranslation('resetDemo', language)}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <DemoProvider>
      <MainContent />
    </DemoProvider>
  );
}
