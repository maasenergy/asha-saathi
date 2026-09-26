import React, { useState } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  User,
  Heart,
  Calendar,
  AlertTriangle,
  Car,
  Phone,
  Baby,
  Activity,
  ShieldAlert,
  Save,
  HelpCircle,
} from 'lucide-react';
import { MotherProfile, ObstetricHistory } from '../../types';
import { calculateWeeksAndEddFromLmp, calculateProfileCompleteness } from '../../utils/ancCalculations';

interface RegistrationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: MotherProfile) => void;
  existingProfile?: MotherProfile | null;
  language: 'hi' | 'en';
}

export const RegistrationWizardModal: React.FC<RegistrationWizardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingProfile,
  language,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // STEP A: Basics
  const [name, setName] = useState(existingProfile?.name || '');
  const [age, setAge] = useState(existingProfile ? String(existingProfile.age) : '22');
  const [village, setVillage] = useState(existingProfile?.village || 'Kasara');
  const [phone, setPhone] = useState(existingProfile?.phone || '');
  const [motherLang, setMotherLang] = useState<'hi' | 'en' | 'mr'>(existingProfile?.language || 'en');
  const [heightCm, setHeightCm] = useState(existingProfile?.heightCm ? String(existingProfile.heightCm) : '');
  const [prePregnancyWeightKg, setPrePregnancyWeightKg] = useState(
    existingProfile?.prePregnancyWeightKg ? String(existingProfile.prePregnancyWeightKg) : ''
  );
  const [lmpMode, setLmpMode] = useState<'exact' | 'month_only' | 'dont_know'>(
    existingProfile?.isLmpUnknown ? 'dont_know' : 'exact'
  );
  const [lmpDate, setLmpDate] = useState(existingProfile?.lmpDate && existingProfile.lmpDate !== 'unknown' ? existingProfile.lmpDate : '');
  const [manualWeeks, setManualWeeks] = useState(
    existingProfile?.gestationalWeeks ? String(existingProfile.gestationalWeeks) : '12'
  );

  // STEP B: Past Pregnancies
  const [gravida, setGravida] = useState(existingProfile ? String(existingProfile.gravida) : '1');
  const [para, setPara] = useState(existingProfile ? String(existingProfile.para) : '0');
  const [previousCSection, setPreviousCSection] = useState<boolean>(
    existingProfile?.obstetricHistory?.previousCSection || false
  );
  const [cSectionCount, setCSectionCount] = useState(
    existingProfile?.obstetricHistory?.cSectionCount ? String(existingProfile.obstetricHistory.cSectionCount) : '1'
  );
  const [previousStillbirth, setPreviousStillbirth] = useState<boolean>(
    existingProfile?.obstetricHistory?.previousStillbirth || false
  );
  const [miscarriagesCount, setMiscarriagesCount] = useState<number>(
    existingProfile?.obstetricHistory?.miscarriagesCount || 0
  );
  const [previousPretermBirth, setPreviousPretermBirth] = useState<boolean>(
    existingProfile?.obstetricHistory?.previousPretermBirth || false
  );
  const [previousLowBirthWeight, setPreviousLowBirthWeight] = useState<boolean>(
    existingProfile?.obstetricHistory?.previousLowBirthWeight || false
  );
  const [previousPph, setPreviousPph] = useState<boolean>(
    existingProfile?.obstetricHistory?.previousPph || false
  );
  const [lastDeliveryDate, setLastDeliveryDate] = useState(
    existingProfile?.obstetricHistory?.lastDeliveryDate || ''
  );

  // STEP C: Health
  const [bloodGroup, setBloodGroup] = useState<string>(existingProfile?.bloodGroup || 'unknown');
  const [fatherBloodGroup, setFatherBloodGroup] = useState<string>(existingProfile?.fatherBloodGroup || 'unknown');
  const [diabetesStatus, setDiabetesStatus] = useState<'none' | 'gestational' | 'pre-existing'>(
    existingProfile?.diabetesStatus || 'none'
  );
  const [hasThyroid, setHasThyroid] = useState<boolean>(existingProfile?.hasThyroid || false);
  const [hasHeartDisease, setHasHeartDisease] = useState<boolean>(existingProfile?.hasHeartDisease || false);
  const [hasEpilepsy, setHasEpilepsy] = useState<boolean>(existingProfile?.hasEpilepsy || false);
  const [hasTb, setHasTb] = useState<boolean>(existingProfile?.hasTb || false);
  const [hasSickleCell, setHasSickleCell] = useState<boolean>(existingProfile?.hasSickleCell || false);
  const [hivStatus, setHivStatus] = useState<'positive' | 'negative' | 'unknown'>(
    existingProfile?.infectiousStatus?.hiv || 'unknown'
  );
  const [hbsagStatus, setHbsagStatus] = useState<'positive' | 'negative' | 'unknown'>(
    existingProfile?.infectiousStatus?.hbsag || 'unknown'
  );
  const [syphilisStatus, setSyphilisStatus] = useState<'positive' | 'negative' | 'unknown'>(
    existingProfile?.infectiousStatus?.syphilis || 'unknown'
  );
  const [hasTwins, setHasTwins] = useState<boolean>(existingProfile?.hasTwins || false);
  const [hasPreEclampsiaRisk, setHasPreEclampsiaRisk] = useState<boolean>(
    existingProfile?.hasPreEclampsiaRisk || false
  );

  // STEP D: Life & Access
  const [usesTobaccoOrMishri, setUsesTobaccoOrMishri] = useState<boolean>(
    existingProfile?.usesTobaccoOrMishri || false
  );
  const [travelTimeToHospitalMinutes, setTravelTimeToHospitalMinutes] = useState(
    existingProfile?.travelTimeToHospitalMinutes ? String(existingProfile.travelTimeToHospitalMinutes) : '30'
  );
  const [hasTransport, setHasTransport] = useState<boolean>(
    existingProfile?.hasTransport ?? true
  );
  const [supportPersonName, setSupportPersonName] = useState(existingProfile?.supportPersonName || '');
  const [supportPersonPhone, setSupportPersonPhone] = useState(existingProfile?.supportPersonPhone || '');

  if (!isOpen) return null;

  // Real-time calculation of Weeks and EDD
  let calculatedWeeks = 12;
  let calculatedEdd = '2026-11-20';

  if (lmpMode === 'dont_know') {
    calculatedWeeks = parseInt(manualWeeks, 10) || 12;
    const now = new Date();
    const futureDays = (40 - calculatedWeeks) * 7;
    const eddDate = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000);
    calculatedEdd = eddDate.toISOString().slice(0, 10);
  } else if (lmpDate) {
    const calc = calculateWeeksAndEddFromLmp(lmpDate);
    if (calc) {
      calculatedWeeks = calc.gestationalWeeks;
      calculatedEdd = calc.edd;
    }
  }

  // Construct current profile object to measure completeness
  const currentProfilePreview: Partial<MotherProfile> = {
    name,
    age: parseInt(age, 10) || 20,
    village,
    phone,
    heightCm: heightCm ? parseFloat(heightCm) : undefined,
    prePregnancyWeightKg: prePregnancyWeightKg ? parseFloat(prePregnancyWeightKg) : undefined,
    lmpDate: lmpMode === 'dont_know' ? 'unknown' : lmpDate,
    isLmpUnknown: lmpMode === 'dont_know',
    gestationalWeeks: calculatedWeeks,
    edd: calculatedEdd,
    gravida: parseInt(gravida, 10) || 1,
    para: parseInt(para, 10) || 0,
    obstetricHistory: {
      gravida: parseInt(gravida, 10) || 1,
      para: parseInt(para, 10) || 0,
      previousCSection,
      cSectionCount: previousCSection ? parseInt(cSectionCount, 10) || 1 : 0,
      previousStillbirth,
      miscarriagesCount,
      previousPretermBirth,
      previousLowBirthWeight,
      previousPph,
      lastDeliveryDate: lastDeliveryDate || null,
    },
    bloodGroup,
    fatherBloodGroup,
    diabetesStatus,
    hasThyroid,
    hasHeartDisease,
    hasEpilepsy,
    hasTb,
    hasSickleCell,
    infectiousStatus: {
      hiv: hivStatus,
      hbsag: hbsagStatus,
      syphilis: syphilisStatus,
    },
    hasTwins,
    hasPreEclampsiaRisk,
    usesTobaccoOrMishri,
    travelTimeToHospitalMinutes: parseInt(travelTimeToHospitalMinutes, 10) || 30,
    hasTransport,
    supportPersonName,
    supportPersonPhone,
  };

  const completeness = calculateProfileCompleteness(currentProfilePreview);

  const handleSave = () => {
    const finalObstetric: ObstetricHistory = {
      gravida: parseInt(gravida, 10) || 1,
      para: parseInt(para, 10) || 0,
      previousCSection,
      cSectionCount: previousCSection ? parseInt(cSectionCount, 10) || 1 : 0,
      previousStillbirth,
      miscarriagesCount,
      previousPretermBirth,
      previousLowBirthWeight,
      previousPph,
      lastDeliveryDate: lastDeliveryDate || null,
    };

    const riskTags: string[] = [];
    if (heightCm && parseFloat(heightCm) < 145) riskTags.push('Obstructed labour risk');
    if (previousCSection) riskTags.push('C-section scar');
    if (previousPph || (parseInt(gravida, 10) >= 5)) riskTags.push('PPH risk');
    if (bloodGroup.includes('-')) riskTags.push('Rh negative');
    if (usesTobaccoOrMishri) riskTags.push('Tobacco / Mishri use');
    if (parseInt(travelTimeToHospitalMinutes, 10) > 60 || !hasTransport) riskTags.push('Distance/Transport risk');
    if (hasTwins) riskTags.push('Twin pregnancy');

    const profileToSave: MotherProfile = {
      id: existingProfile?.id || `pat-${Date.now()}`,
      name: name.trim() || (language === 'hi' ? 'नई गर्भवती माता' : 'New Pregnant Mother'),
      age: parseInt(age, 10) || 22,
      village: village.trim() || 'Kasara',
      phone: phone.trim() || '98XXXXXX00',
      language: motherLang,
      gestationalWeeks: calculatedWeeks,
      edd: calculatedEdd,
      lmpDate: lmpMode === 'dont_know' ? 'unknown' : lmpDate,
      isLmpUnknown: lmpMode === 'dont_know',
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      prePregnancyWeightKg: prePregnancyWeightKg ? parseFloat(prePregnancyWeightKg) : undefined,
      currentWeightKg: prePregnancyWeightKg ? parseFloat(prePregnancyWeightKg) + 3 : 50,
      gravida: parseInt(gravida, 10) || 1,
      para: parseInt(para, 10) || 0,
      obstetricHistory: finalObstetric,
      bloodGroup,
      fatherBloodGroup,
      diabetesStatus,
      hasThyroid,
      hasHeartDisease,
      hasEpilepsy,
      hasTb,
      hasSickleCell,
      infectiousStatus: {
        hiv: hivStatus,
        hbsag: hbsagStatus,
        syphilis: syphilisStatus,
      },
      hasTwins,
      hasPreEclampsiaRisk,
      usesTobaccoOrMishri,
      travelTimeToHospitalMinutes: parseInt(travelTimeToHospitalMinutes, 10) || 30,
      hasTransport,
      supportPersonName: supportPersonName.trim() || undefined,
      supportPersonPhone: supportPersonPhone.trim() || undefined,
      ashaAssigned: existingProfile?.ashaAssigned || 'Sunita Tai (ASHA)',
      phcCenter: existingProfile?.phcCenter || 'Navapur Primary Health Centre',
      highRiskFactors: riskTags,
      riskTags,
      currentVisitSlotOpen: false,
      dailyKickCount: 8,
      profileCompletenessPercent: completeness,
      tests: existingProfile?.tests || [],
      visits: existingProfile?.visits || [],
      overallLevel: riskTags.length > 0 ? 'AMBER' : 'GREEN',
      riskSource: 'ROUTINE',
    };

    onSave(profileToSave);
    onClose();
  };

  const stepsList = [
    { num: 1, label: language === 'hi' ? 'A. बुनियादी' : 'A. Basics', icon: User },
    { num: 2, label: language === 'hi' ? 'B. पूर्व प्रसव' : 'B. Past Pregnancies', icon: Baby },
    { num: 3, label: language === 'hi' ? 'C. स्वास्थ्य' : 'C. Health', icon: Heart },
    { num: 4, label: language === 'hi' ? 'D. आवागमन' : 'D. Life & Access', icon: Car },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E2A4A] to-[#B0306A] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <User className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-heading">
                {existingProfile
                  ? (language === 'hi' ? 'माता प्रोफ़ाइल अपडेट' : 'Update Mother Profile')
                  : (language === 'hi' ? 'नई गर्भवती माता का पंजीकरण' : 'Register New Pregnant Mother')}
              </h2>
              <p className="text-xs text-white/80">
                {language === 'hi'
                  ? '4-चरणीय सरल विज़ार्ड • कोई भी चरण बाद में पूरा कर सकते हैं'
                  : '4-Step Simple Wizard • Any step can be skipped and completed later'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Completeness Ring Badge */}
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-bold text-amber-200 border border-white/30">
              <Activity className="w-3.5 h-3.5" />
              <span>{completeness}% {language === 'hi' ? 'पूर्ण' : 'Complete'}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-full transition text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Navigation Tabs */}
        <div className="grid grid-cols-4 bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-semibold">
          {stepsList.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            return (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num as any)}
                className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition text-center ${
                  isActive
                    ? 'bg-white text-[#B0306A] font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#B0306A]' : 'text-slate-400'}`} />
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: BASICS */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 font-medium">
                💡 <strong>निर्देश:</strong> माता की बुनियादी जानकारी और LMP (अंतिम माहवारी तिथि) भरें। ऐप स्वतः गर्भ के सप्ताह और प्रसव की संभावित तारीख (EDD) की गणना करेगा।
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'माता का नाम (Full Name) *' : 'Mother Full Name *'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'hi' ? 'उदा. रेखा पवार' : 'e.g. Rekha Pawar'}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#B0306A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'उम्र (Age in years)' : 'Age (years)'}
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#B0306A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'गाँव / बस्ती (Village / Ward)' : 'Village / Ward'}
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="Kasara"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-[#B0306A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'मोबाइल नंबर (Phone)' : 'Mobile Phone'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-[#B0306A]"
                  />
                </div>
              </div>

              {/* Anthropometry: Height & Weight */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'ऊंचाई (Height cm)' : 'Height (cm)'}
                  </label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="150"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-[#1E2A4A] bg-white"
                  />
                  {heightCm && parseFloat(heightCm) < 145 && (
                    <span className="text-[11px] text-amber-700 font-semibold block mt-1">
                      ⚠️ &lt; 145 cm: {language === 'hi' ? 'अवरुद्ध प्रसव का जोखिम' : 'CPD / Obstructed labour risk'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'गर्भपूर्व वजन (Pre-pregnancy wt kg)' : 'Pre-pregnancy Wt (kg)'}
                  </label>
                  <input
                    type="number"
                    value={prePregnancyWeightKg}
                    onChange={(e) => setPrePregnancyWeightKg(e.target.value)}
                    placeholder="48"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-[#1E2A4A] bg-white"
                  />
                </div>
              </div>

              {/* LMP Date & Auto Calculation */}
              <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1E2A4A] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#B0306A]" />
                    <span>{language === 'hi' ? 'अंतिम माहवारी तिथि (LMP Date)' : 'Last Menstrual Period (LMP)'}</span>
                  </label>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setLmpMode('exact')}
                      className={`px-2 py-0.5 text-[11px] rounded-lg font-bold ${
                        lmpMode === 'exact' ? 'bg-[#B0306A] text-white' : 'bg-white text-slate-600 border'
                      }`}
                    >
                      {language === 'hi' ? 'तारीख पता है' : 'Exact Date'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLmpMode('dont_know')}
                      className={`px-2 py-0.5 text-[11px] rounded-lg font-bold ${
                        lmpMode === 'dont_know' ? 'bg-[#B0306A] text-white' : 'bg-white text-slate-600 border'
                      }`}
                    >
                      {language === 'hi' ? 'पता नहीं / केवल माह' : 'Don\'t know / Weeks'}
                    </button>
                  </div>
                </div>

                {lmpMode === 'exact' ? (
                  <input
                    type="date"
                    value={lmpDate}
                    onChange={(e) => setLmpDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#1E2A4A]"
                  />
                ) : (
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">
                      {language === 'hi' ? 'विज़िट पर अनुमानित गर्भ सप्ताह:' : 'Estimated gestational weeks at visit:'}
                    </label>
                    <input
                      type="number"
                      value={manualWeeks}
                      onChange={(e) => setManualWeeks(e.target.value)}
                      placeholder="12"
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#1E2A4A]"
                    />
                  </div>
                )}

                {/* Auto-calculated Gestational Age & EDD Banner */}
                <div className="bg-white p-3 rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      {language === 'hi' ? 'स्वतः गणना (Auto-calculated):' : 'Auto-calculated Weeks:'}
                    </span>
                    <strong className="text-base font-bold text-[#B0306A]">
                      {calculatedWeeks} {language === 'hi' ? 'सप्ताह' : 'Weeks'}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[11px]">
                      {language === 'hi' ? 'प्रसव की संभावित तारीख (EDD):' : 'Estimated Due Date (EDD):'}
                    </span>
                    <strong className="text-sm font-bold text-slate-800">
                      {calculatedEdd}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PAST PREGNANCIES */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 font-medium">
                💡 <strong>निर्देश:</strong> पिछले प्रसवों की संख्या (Gravida/Para) और जटिलताओं (जैसे पिछला सिजेरियन या PPH) के हाँ/ना बटन पर क्लिक करें।
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'ग्रैविडा (Gravida - कुल गर्भ)' : 'Gravida (Total Pregnancies)'}
                  </label>
                  <input
                    type="number"
                    value={gravida}
                    onChange={(e) => setGravida(e.target.value)}
                    className="w-full p-2 text-base font-bold text-[#1E2A4A] bg-white rounded-lg border border-slate-300"
                  />
                  {parseInt(gravida, 10) >= 5 && (
                    <span className="text-[10px] text-red-700 font-bold block mt-1">
                      ⚠️ G≥5: {language === 'hi' ? 'ग्रैंड मल्टीपैरा - PPH जोखिम' : 'Grand Multipara - PPH Risk'}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'पैरा (Para - पूर्व जीवित/मृत प्रसव)' : 'Para (Deliveries > 28w)'}
                  </label>
                  <input
                    type="number"
                    value={para}
                    onChange={(e) => setPara(e.target.value)}
                    className="w-full p-2 text-base font-bold text-[#1E2A4A] bg-white rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {language === 'hi' ? 'पूर्व प्रसव जटिलताएँ (Yes/No कार्ड्स)' : 'Past Pregnancy Complications (Toggle Cards)'}
                </label>

                {/* Previous C-Section */}
                <div className="flex items-center justify-between p-3 rounded-2xl border bg-white shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="text-xs font-bold text-[#1E2A4A] block">
                        {language === 'hi' ? 'पिछला सिजेरियन ऑपरेशन (C-Section)' : 'Previous C-Section'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {language === 'hi' ? 'टांका - केवल ऑपरेशन सुविधा वाले अस्पताल में प्रसव' : 'Scar - Delivery only at C-section facility'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviousCSection(!previousCSection)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      previousCSection
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {previousCSection ? <Check className="w-4 h-4" /> : null}
                    <span>{previousCSection ? (language === 'hi' ? 'हाँ (Yes)' : 'Yes') : (language === 'hi' ? 'नहीं (No)' : 'No')}</span>
                  </button>
                </div>

                {previousCSection && (
                  <div className="pl-6 pb-1 flex items-center gap-2 text-xs">
                    <span className="text-slate-600">{language === 'hi' ? 'कितने ऑपरेशन हुए:' : 'Number of previous C-sections:'}</span>
                    <input
                      type="number"
                      value={cSectionCount}
                      onChange={(e) => setCSectionCount(e.target.value)}
                      className="w-16 p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-center"
                    />
                  </div>
                )}

                {/* Previous PPH */}
                <div className="flex items-center justify-between p-3 rounded-2xl border bg-white shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-5 h-5 text-red-600" />
                    <div>
                      <span className="text-xs font-bold text-[#1E2A4A] block">
                        {language === 'hi' ? 'प्रसव बाद अत्यधिक रक्तस्राव (PPH)' : 'Previous Heavy Bleeding (PPH)'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {language === 'hi' ? 'ब्लड बैंक युक्त अस्पताल अनिवार्य' : 'Requires hospital with blood bank'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviousPph(!previousPph)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      previousPph ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {previousPph ? <Check className="w-4 h-4" /> : null}
                    <span>{previousPph ? (language === 'hi' ? 'हाँ (Yes)' : 'Yes') : (language === 'hi' ? 'नहीं (No)' : 'No')}</span>
                  </button>
                </div>

                {/* Previous Stillbirth */}
                <div className="flex items-center justify-between p-3 rounded-2xl border bg-white shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <div>
                      <span className="text-xs font-bold text-[#1E2A4A] block">
                        {language === 'hi' ? 'पिछला मृत प्रसव (Stillbirth)' : 'Previous Stillbirth'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {language === 'hi' ? 'नजदीकी निगरानी आवश्यक' : 'Closer monitoring required'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviousStillbirth(!previousStillbirth)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      previousStillbirth ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {previousStillbirth ? <Check className="w-4 h-4" /> : null}
                    <span>{previousStillbirth ? (language === 'hi' ? 'हाँ (Yes)' : 'Yes') : (language === 'hi' ? 'नहीं (No)' : 'No')}</span>
                  </button>
                </div>

                {/* Previous Preterm Birth */}
                <div className="flex items-center justify-between p-3 rounded-2xl border bg-white shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Baby className="w-5 h-5 text-indigo-500" />
                    <div>
                      <span className="text-xs font-bold text-[#1E2A4A] block">
                        {language === 'hi' ? 'समय पूर्व प्रसव (Preterm < 37w)' : 'Previous Preterm Birth (<37w)'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {language === 'hi' ? 'एसएनसीयू युक्त केंद्र की जरूरत' : 'SNCU nursery facility advised'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviousPretermBirth(!previousPretermBirth)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      previousPretermBirth ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {previousPretermBirth ? <Check className="w-4 h-4" /> : null}
                    <span>{previousPretermBirth ? (language === 'hi' ? 'हाँ (Yes)' : 'Yes') : (language === 'hi' ? 'नहीं (No)' : 'No')}</span>
                  </button>
                </div>

                {/* Last delivery date */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'पिछले प्रसव की तारीख (Date of Last Delivery)' : 'Date of Last Delivery'}
                  </label>
                  <input
                    type="date"
                    value={lastDeliveryDate}
                    onChange={(e) => setLastDeliveryDate(e.target.value)}
                    className="w-full p-2 bg-white text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HEALTH & MEDICAL HISTORY */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 font-medium">
                💡 <strong>निर्देश:</strong> माता व पिता का रक्त समूह (Rh फैक्टर सहित) तथा अन्य चिकित्सीय स्थितियाँ (मधुमेह, थायराइड, हृदय रोग आदि) चुनें।
              </div>

              {/* Blood Groups: Mother & Father */}
              <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#1E2A4A] block mb-1">
                      {language === 'hi' ? 'माता का रक्त समूह (Mother Blood Group)' : 'Mother Blood Group & Rh'}
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-[#1E2A4A]"
                    >
                      <option value="unknown">{language === 'hi' ? 'अज्ञात (Unknown)' : 'Unknown'}</option>
                      <option value="A+">A Positive (A+)</option>
                      <option value="A-">A Negative (A-)</option>
                      <option value="B+">B Positive (B+)</option>
                      <option value="B-">B Negative (B-)</option>
                      <option value="O+">O Positive (O+)</option>
                      <option value="O-">O Negative (O-)</option>
                      <option value="AB+">AB Positive (AB+)</option>
                      <option value="AB-">AB Negative (AB-)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#1E2A4A] block mb-1">
                      {language === 'hi' ? 'पिता का रक्त समूह (Father Blood Group)' : 'Father Blood Group & Rh'}
                    </label>
                    <select
                      value={fatherBloodGroup}
                      onChange={(e) => setFatherBloodGroup(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-[#1E2A4A]"
                    >
                      <option value="unknown">{language === 'hi' ? 'अज्ञात (Unknown)' : 'Unknown'}</option>
                      <option value="A+">A Positive (A+)</option>
                      <option value="A-">A Negative (A-)</option>
                      <option value="B+">B Positive (B+)</option>
                      <option value="B-">B Negative (B-)</option>
                      <option value="O+">O Positive (O+)</option>
                      <option value="O-">O Negative (O-)</option>
                      <option value="AB+">AB Positive (AB+)</option>
                      <option value="AB-">AB Negative (AB-)</option>
                    </select>
                  </div>
                </div>

                {/* Rh Agglutination / Isoimmunization Risk Banner */}
                {bloodGroup.includes('-') && (
                  <div className="p-2.5 bg-amber-100 rounded-xl text-xs text-amber-900 font-semibold border border-amber-300">
                    ⚠️ {language === 'hi'
                      ? 'Rh नेगेटिव स्थिति: पिता Rh+ या अज्ञात होने पर Rh आइसोइम्युनाइजेशन का जोखिम। 28वें सप्ताह और प्रसव बाद एंटी-डी (Anti-D) इंजेक्शन का ध्यान रखें।'
                      : 'Rh Negative Status: If father is Rh+ or unknown, Rh isoimmunization risk exists. Reminder for Anti-D at 28w and post-delivery.'}
                  </div>
                )}
              </div>

              {/* Chronic & Infectious Health Conditions */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {language === 'hi' ? 'स्वास्थ्य इतिहास (Yes/No कार्ड्स)' : 'Health History & Chronic Diseases'}
                </label>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Diabetes */}
                  <button
                    type="button"
                    onClick={() => setDiabetesStatus(diabetesStatus === 'none' ? 'gestational' : 'none')}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      diabetesStatus !== 'none'
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'मधुमेह (Diabetes)' : 'Diabetes'}</span>
                    <span className="text-[11px]">{diabetesStatus !== 'none' ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* Thyroid */}
                  <button
                    type="button"
                    onClick={() => setHasThyroid(!hasThyroid)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasThyroid
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'थायराइड (Thyroid)' : 'Thyroid'}</span>
                    <span className="text-[11px]">{hasThyroid ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* Heart Disease */}
                  <button
                    type="button"
                    onClick={() => setHasHeartDisease(!hasHeartDisease)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasHeartDisease
                        ? 'bg-red-50 border-red-400 text-red-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'हृदय रोग (Heart Disease)' : 'Heart Disease'}</span>
                    <span className="text-[11px]">{hasHeartDisease ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* Epilepsy */}
                  <button
                    type="button"
                    onClick={() => setHasEpilepsy(!hasEpilepsy)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasEpilepsy
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'मिर्गी / दौरे (Epilepsy)' : 'Epilepsy'}</span>
                    <span className="text-[11px]">{hasEpilepsy ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* TB */}
                  <button
                    type="button"
                    onClick={() => setHasTb(!hasTb)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasTb
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'टीबी (Tuberculosis)' : 'TB'}</span>
                    <span className="text-[11px]">{hasTb ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* Sickle Cell */}
                  <button
                    type="button"
                    onClick={() => setHasSickleCell(!hasSickleCell)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasSickleCell
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'सिकल सेल (Sickle Cell)' : 'Sickle Cell'}</span>
                    <span className="text-[11px]">{hasSickleCell ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* Twins */}
                  <button
                    type="button"
                    onClick={() => setHasTwins(!hasTwins)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasTwins
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'जुड़वां बच्चे (Twins on USG)' : 'Twins (Ultrasound)'}</span>
                    <span className="text-[11px]">{hasTwins ? 'हाँ' : 'नहीं'}</span>
                  </button>

                  {/* Pre-eclampsia Risk */}
                  <button
                    type="button"
                    onClick={() => setHasPreEclampsiaRisk(!hasPreEclampsiaRisk)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      hasPreEclampsiaRisk
                        ? 'bg-red-50 border-red-400 text-red-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'प्री-एक्लेम्पसिया जोखिम' : 'Pre-eclampsia Risk'}</span>
                    <span className="text-[11px]">{hasPreEclampsiaRisk ? 'हाँ' : 'नहीं'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: LIFE & ACCESS */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 font-medium">
                💡 <strong>निर्देश:</strong> तंबाकू/मिश्री सेवन, अस्पताल पहुँचने का यात्रा समय, परिवहन उपलब्धता और आपातकालीन संपर्क व्यक्ति की जानकारी भरें।
              </div>

              {/* Tobacco / Mishri */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-white shadow-xs">
                <div>
                  <span className="text-xs font-bold text-[#1E2A4A] block">
                    {language === 'hi' ? 'तंबाकू या मिश्री का उपयोग (Tobacco / Mishri)' : 'Tobacco or Mishri use'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {language === 'hi' ? 'कम वजन के बच्चे (LBW) का जोखिम — तुरंत बंद करने की सलाह' : 'Low birth weight risk — counsel to stop'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUsesTobaccoOrMishri(!usesTobaccoOrMishri)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    usesTobaccoOrMishri ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {usesTobaccoOrMishri ? (language === 'hi' ? 'हाँ (Yes)' : 'Yes') : (language === 'hi' ? 'नहीं (No)' : 'No')}
                </button>
              </div>

              {/* Travel Time to Hospital */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  {language === 'hi'
                    ? 'सिजेरियन सुविधा वाले बड़े अस्पताल तक यात्रा समय (मिनट)'
                    : 'Travel time to nearest C-section hospital (minutes)'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="180"
                    step="5"
                    value={travelTimeToHospitalMinutes}
                    onChange={(e) => setTravelTimeToHospitalMinutes(e.target.value)}
                    className="flex-1 accent-[#B0306A]"
                  />
                  <span className="text-sm font-bold text-[#1E2A4A] w-16 text-right">
                    {travelTimeToHospitalMinutes} {language === 'hi' ? 'मिनट' : 'mins'}
                  </span>
                </div>
                {parseInt(travelTimeToHospitalMinutes, 10) > 60 && (
                  <span className="text-[11px] text-amber-700 font-bold block">
                    ⚠️ &gt; 60 मिनट: {language === 'hi' ? 'EDD से पहले अस्पताल में भर्ती की योजना अनिवार्य' : 'Transit risk - planned admission prior to EDD required'}
                  </span>
                )}
              </div>

              {/* Has Transport */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-white shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Car className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="text-xs font-bold text-[#1E2A4A] block">
                      {language === 'hi' ? 'परिवहन वाहन उपलब्ध है? (Has Transport)' : 'Has Private / Assured Transport?'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'hi' ? 'यदि नहीं, तो 102/108 एम्बुलेंस की अग्रिम बुकिंग' : 'If no, 102/108 ambulance pre-arrangement'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHasTransport(!hasTransport)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    hasTransport ? 'bg-emerald-600 text-white' : 'bg-red-100 text-red-700 border border-red-300'
                  }`}
                >
                  {hasTransport ? (language === 'hi' ? 'हाँ (Yes)' : 'Yes') : (language === 'hi' ? 'नहीं (No)' : 'No')}
                </button>
              </div>

              {/* Support person */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'साथी / परिजन का नाम (Support Person)' : 'Support Person Name'}
                  </label>
                  <input
                    type="text"
                    value={supportPersonName}
                    onChange={(e) => setSupportPersonName(e.target.value)}
                    placeholder={language === 'hi' ? 'जैसे: पति / माता' : 'e.g. Husband'}
                    className="w-full p-2 bg-white text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'परिजन का फोन नंबर' : 'Support Person Phone'}
                  </label>
                  <input
                    type="tel"
                    value={supportPersonPhone}
                    onChange={(e) => setSupportPersonPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full p-2 bg-white text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep - 1) as any)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 min-h-[44px]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{language === 'hi' ? 'पिछला' : 'Previous'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep + 1) as any)}
                className="px-5 py-2.5 rounded-xl bg-[#1E2A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow transition min-h-[44px]"
              >
                <span>{language === 'hi' ? 'अगला कदम' : 'Next Step'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}

            {/* Quick Save / Complete Button (available anytime!) */}
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-[#2F7D4F] hover:bg-[#25653f] text-white text-xs font-bold flex items-center gap-2 shadow-md transition min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'hi' ? 'सहेजें (Save & Finish)' : 'Save & Finish'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
