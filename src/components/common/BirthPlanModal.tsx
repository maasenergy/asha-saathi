import React, { useState } from 'react';
import {
  X,
  Building2,
  AlertTriangle,
  CheckSquare,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Phone,
  FileText,
} from 'lucide-react';
import { MotherProfile, BirthPlan } from '../../types';
import { useDemo } from '../../context/DemoContext';
import { AiOfflineBanner } from './AiOfflineBanner';

interface BirthPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: MotherProfile;
  language: 'hi' | 'en';
  isMotherView?: boolean;
}

export const BirthPlanModal: React.FC<BirthPlanModalProps> = ({
  isOpen,
  onClose,
  patient,
  language,
  isMotherView = false,
}) => {
  const { updateBirthPlanChecklist, refreshBirthPlan, approveBirthPlan } = useDemo();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!isOpen) return null;

  const plan: BirthPlan | undefined = patient.birthPlan;

  const handleToggleChecklist = (itemId: string, currentDone: boolean) => {
    updateBirthPlanChecklist(patient.id, itemId, !currentDone);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBirthPlan(patient.id);
    setIsRefreshing(false);
  };

  const handleSpeak = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  const speechText = isMotherView
    ? (plan?.motherMessage || '')
    : (plan?.ashaMessage || plan?.doctorSummary || '');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E2A4A] via-[#1E2A4A] to-[#B0306A] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-heading">
                  {language === 'hi' ? '🏥 जन्म योजना (AI Birth Plan)' : '🏥 AI Birth Preparedness Plan'}
                </h2>
                {plan?.doctorApproved && (
                  <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{language === 'hi' ? 'डॉक्टर अनुमोदित' : 'Doctor Approved'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80">
                {patient.name} • {patient.gestationalWeeks}w • EDD {patient.edd}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isMotherView && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title={language === 'hi' ? 'पुनः उत्पन्न करें' : 'Regenerate Plan'}
                className="p-2 hover:bg-white/20 rounded-full transition text-white/90 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={() => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                onClose();
              }}
              className="p-2 hover:bg-white/20 rounded-full transition text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!plan ? (
            <div className="text-center py-8 space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600 font-semibold">
                {language === 'hi'
                  ? 'इस माता के लिए जन्म योजना अभी उत्पन्न नहीं हुई है।'
                  : 'Birth plan has not yet been generated for this mother.'}
              </p>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-[#B0306A] text-white rounded-xl text-xs font-bold"
              >
                {isRefreshing
                  ? (language === 'hi' ? 'उत्पन्न हो रहा है...' : 'Generating...')
                  : (language === 'hi' ? 'अभी उत्पन्न करें' : 'Generate Now')}
              </button>
            </div>
          ) : (
            <>
              {plan.isRuleEngineOnly && <AiOfflineBanner language={language} />}
              {/* Designated Delivery Facility Banner */}
              <div
                className={`p-4 rounded-2xl border-2 ${
                  plan.deliveryPlace === 'PHC'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                    : plan.deliveryPlace === 'CHC/FRU with C-section'
                    ? 'bg-amber-50 border-amber-500 text-amber-950'
                    : 'bg-rose-50 border-red-600 text-red-950'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                      {language === 'hi' ? 'निर्धारित प्रसव केंद्र (Designated Facility):' : 'Designated Delivery Facility:'}
                    </span>
                    <h3 className="text-xl font-black font-heading mt-0.5">
                      {plan.deliveryPlace}
                    </h3>
                  </div>

                  {plan.upgradedBySafetyRule && (
                    <span className="bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs animate-pulse">
                      {language === 'hi' ? '⚠️ सुरक्षा नियम द्वारा अपग्रेड' : '⚠️ Upgraded by safety rule'}
                    </span>
                  )}
                </div>

                {/* Safety Rule Reason */}
                {plan.safetyRuleReason && plan.upgradedBySafetyRule && (
                  <div className="mt-2.5 p-2.5 bg-red-100/90 rounded-xl text-xs text-red-900 font-semibold border border-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <span>{plan.safetyRuleReason}</span>
                  </div>
                )}

                {/* Clinical Reasons List */}
                {plan.deliveryPlaceReason && plan.deliveryPlaceReason.length > 0 && (
                  <ul className="mt-2.5 space-y-1 text-xs opacity-90 pl-1">
                    {plan.deliveryPlaceReason.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-slate-400">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Leave Home Timing Card */}
              <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200 flex items-center gap-3">
                <Clock className="w-5 h-5 text-indigo-700 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-indigo-950 block">
                    {language === 'hi' ? 'अस्पताल कब रवाना होना है (When to Leave Home):' : 'When to Leave Home:'}
                  </span>
                  <span className="text-indigo-900 font-semibold">{plan.leaveHomeBy}</span>
                </div>
              </div>

              {/* Risk Tags */}
              {plan.riskTags && plan.riskTags.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">
                    {language === 'hi' ? 'पहचाने गए जोखिम टैग (Risk Tags):' : 'Identified Risk Tags:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.riskTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Spoken Advice for Mother & Family (AI-written; absent when AI is offline) */}
              {speechText && (
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-700" />
                    <span>
                      {isMotherView
                        ? (language === 'hi' ? 'माता व परिवार हेतु संदेश:' : 'Message for Mother & Family:')
                        : (language === 'hi' ? 'आशा कार्यकर्ता हेतु स्पष्ट निर्देश:' : 'Actionable Instructions for ASHA:')}
                    </span>
                  </span>

                  {speechText && (
                    <button
                      type="button"
                      onClick={() => handleSpeak(speechText)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow-xs transition"
                    >
                      {isPlayingAudio ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>{language === 'hi' ? 'रोकें' : 'Stop'}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{language === 'hi' ? 'बोलकर सुनाएँ' : 'Read Aloud'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs font-medium text-purple-900 leading-relaxed bg-white/70 p-3 rounded-xl border border-purple-100">
                  {speechText}
                </p>
              </div>
              )}

              {/* Big Interactive Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {language === 'hi' ? 'प्रसव पूर्व तैयारी चेकलिस्ट (Checklist):' : 'Birth Preparedness Checklist:'}
                  </h4>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {plan.prepareChecklist?.filter((c) => c.done).length || 0} /{' '}
                    {plan.prepareChecklist?.length || 0} {language === 'hi' ? 'पूर्ण' : 'Done'}
                  </span>
                </div>

                <div className="space-y-2">
                  {plan.prepareChecklist?.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleChecklist(item.id, item.done)}
                      className={`w-full text-left p-3 rounded-2xl border transition flex items-start gap-3 ${
                        item.done
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.done ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 text-xs">
                        <span className={item.done ? 'line-through text-slate-500' : 'font-semibold'}>
                          {language === 'hi' ? item.labelHindi || item.labelEnglish : item.labelEnglish}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Doctor Review & Verification Section */}
              {plan.doctorSummary && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">
                    Clinical English Summary (For Medical Officer Review):
                  </span>
                  <p className="text-slate-700 italic font-mono text-[11px]">
                    "{plan.doctorSummary}"
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {language === 'hi'
                ? 'नियम-आधारित सुरक्षा अपग्रेड सदैव सक्रिय रहता है'
                : 'Deterministic safety rules actively override AI suggestions'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#1E2A4A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition"
          >
            {language === 'hi' ? 'बंद करें (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
