import React, { useState, useEffect } from 'react';
import {
  Baby,
  HeartPulse,
  PhoneCall,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Stethoscope,
  Info,
  Calendar,
  Sparkles,
  ShieldAlert,
  X,
  MapPin,
  Compass,
  Footprints,
  Activity,
  Heart,
  Navigation,
  Share2,
  Building2,
} from 'lucide-react';
import { useDemo } from '../../context/DemoContext';
import { getTranslation } from '../../utils/translations';
import { TestsTrackerCard } from '../common/TestsTrackerCard';
import { MotherSelfInputsCard } from './MotherSelfInputsCard';
import { BirthPlanModal } from '../common/BirthPlanModal';

export const MotherView: React.FC = () => {
  const {
    patients,
    language,
    triggerMotherSos,
    updateSosTransportStatus,
    logFetalKick,
    state,
    activeMother,
  } = useDemo();

  // Only the mother chosen in the TopBar "who am I" selector (never leak other mothers' data)
  const mother = activeMother || patients[0];
  const latestVisit = mother?.visits[0];

  // SOS state & cancelable countdown (3 seconds per specification)
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [sosFired, setSosFired] = useState(false);
  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [kickAnimation, setKickAnimation] = useState(false);
  const [isBirthPlanOpen, setIsBirthPlanOpen] = useState(false);

  // Look for any existing active SOS alert for this mother
  const motherSosAlert = state.sosAlerts.find(
    (s) => s.patientId === mother.id
  );

  // 3-second countdown timer effect
  useEffect(() => {
    let timer: any = null;
    if (isCountingDown && countdownSeconds > 0) {
      timer = setTimeout(() => {
        setCountdownSeconds((prev) => prev - 1);
      }, 1000);
    } else if (isCountingDown && countdownSeconds === 0) {
      // Countdown completed -> Fire SOS with saved address & GPS coordinates!
      setIsCountingDown(false);
      
      // Uses the mother's saved address/GPS; nothing is invented if they are missing
      const sosId = triggerMotherSos(mother.id, {
        address: mother.address,
        landmark: mother.landmark,
        gpsCoordinates: mother.gpsCoordinates,
      });

      setActiveSosId(sosId);
      setSosFired(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isCountingDown, countdownSeconds, mother, triggerMotherSos]);

  const handleStartSos = () => {
    setCountdownSeconds(3); // Exactly 3-second cancel window
    setIsCountingDown(true);
  };

  const handleCancelSos = () => {
    setIsCountingDown(false);
    setCountdownSeconds(3);
  };

  const handleLogKick = () => {
    logFetalKick(mother.id);
    setKickAnimation(true);
    setTimeout(() => setKickAnimation(false), 800);
  };

  const handleTransportStatusChange = (status: any, note?: string) => {
    if (motherSosAlert) {
      updateSosTransportStatus(motherSosAlert.id, status, note);
    }
  };

  const kicksToday = mother.dailyKickCount || 8;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Strongest Product Line / Care Circle Banner */}
      <div className="order-1 lg:col-span-2 flex items-center gap-2 border-b border-slate-200 px-1 pb-3 text-xs text-slate-600">
        <Heart className="w-4 h-4 shrink-0 text-[#B0306A]" />
        <p>
          {language === 'hi'
            ? 'आपकी आशा दीदी और डॉक्टर आपकी देखभाल टीम का हिस्सा हैं।'
            : 'Your ASHA and doctor are part of your care team.'}
        </p>
      </div>

      {/* Friendly Mother Welcome Card */}
      <div className="order-2 lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-[#B0306A] flex items-center justify-center text-xl font-bold">
            {language === 'hi' ? 'क' : mother.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#1E2A4A]">
              {language === 'hi' ? `नमस्ते, ${mother.name}` : `Namaste, ${mother.name}`}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5">
              {language === 'hi'
                ? `गर्भ: ${mother.gestationalWeeks} सप्ताह • ${mother.village}`
                : `Pregnancy: ${mother.gestationalWeeks} weeks • ${mother.village}`}
            </p>
          </div>
        </div>

        {/* Expected Due Date and ASHA Info */}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block">
              {language === 'hi' ? 'अपेक्षित प्रसव तिथि:' : 'Expected Due Date:'}
            </span>
            <span className="font-bold text-[#1E2A4A]">{mother.edd}</span>
          </div>
          <div>
            <span className="text-slate-500 block">
              {language === 'hi' ? 'आपकी आशा दीदी:' : 'Assigned ASHA:'}
            </span>
            <span className="font-bold text-[#1E2A4A]">{mother.ashaAssigned}</span>
          </div>
        </div>
      </div>

      {/* AI Birth Plan Tile for Mother & Family */}
      <div className="order-4 bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-[#B0306A] flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#B0306A]">
                {language === 'hi' ? 'सुरक्षित प्रसव योजना' : 'Birth Preparedness'}
              </span>
              {mother.birthPlan?.doctorApproved && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.2 rounded-full">
                  ✓ {language === 'hi' ? 'डॉक्टर अनुमोदित' : 'Approved'}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-[#1E2A4A] font-heading mt-0.5">
              {mother.birthPlan?.deliveryPlace ||
                (language === 'hi' ? 'योजना अभी तैयार नहीं हुई' : 'Plan not generated yet')}
            </h3>
            {mother.birthPlan?.doctorApproved && mother.birthPlan.doctorNotes && (
              <p className="text-xs text-emerald-800 font-semibold">
                {language === 'hi' ? 'डॉक्टर का संदेश: ' : 'Doctor: '}
                {mother.birthPlan.doctorNotes}
              </p>
            )}
            <p className="text-xs text-slate-600">
              {mother.birthPlan?.leaveHomeBy ||
                (language === 'hi' ? 'आपकी आशा दीदी योजना बनाएंगी' : 'Your ASHA will prepare the plan')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsBirthPlanOpen(true)}
          className="px-4 py-2.5 bg-[#1E2A4A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 shrink-0 min-h-[44px]"
        >
          <span>{language === 'hi' ? 'योजना देखें 🔊' : 'View Plan 🔊'}</span>
        </button>
      </div>

      {/* Mother Self-Inputs: Kick counter (2-hr timer), Mood emojis, Food pictures, Vomiting, Home Scale/BP */}
      <div className="order-5 lg:col-span-2">
        <MotherSelfInputsCard patient={mother} language={language} />
      </div>

      {/* Emergency SOS Section */}
      <div className="order-3 bg-white rounded-xl p-4 sm:p-5 border border-red-200 text-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
          {language === 'hi' ? 'आपातकालीन सहायता (Emergency SOS)' : 'Emergency Assistance'}
        </span>

        {/* 3-Second Cancelable Countdown Modal / Screen */}
        {isCountingDown ? (
          <div className="py-4 space-y-4">
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
              <div className="w-24 h-24 rounded-full bg-red-600 text-white flex items-center justify-center text-4xl font-extrabold shadow-lg">
                {countdownSeconds}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-base font-bold text-red-700">
                {language === 'hi'
                  ? `${countdownSeconds} सेकंड में आशा और डॉक्टर को आपात सूचना भेजी जा रही है...`
                  : `Alerting ASHA and PHC Doctor in ${countdownSeconds} seconds...`}
              </p>
              <p className="text-xs text-slate-500">
                {language === 'hi'
                  ? 'गलती से दबा हो तो तुरंत नीचे दिए गए बटन से रद्द करें।'
                  : 'Tap below immediately if pressed by mistake.'}
              </p>
            </div>

            <button
              onClick={handleCancelSos}
              className="w-full py-4 px-6 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-2xl text-base shadow transition min-h-[56px] flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5 text-red-600" />
              <span>{language === 'hi' ? 'रद्द करें (Cancel SOS)' : 'Cancel SOS'}</span>
            </button>
          </div>
        ) : motherSosAlert || sosFired ? (
          /* SOS has been fired - Honest status with Care Team Alerted & Call Ambulance */
          <div className="py-2 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-red-950 font-heading">
                {language === 'hi' ? 'केयर टीम को सूचना भेजी गई' : 'Care Team Alerted'}
              </h3>
              <p className="text-xs text-red-800 mt-1 max-w-xs mx-auto">
                {language === 'hi'
                  ? 'आपकी आशा दीदी और प्राथमिक स्वास्थ्य केंद्र के डॉक्टर को आपका पता व जीपीएस लोकेशन साझा कर दी गई है।'
                  : 'Your address and GPS coordinates have been broadcasted to your ASHA and Medical Officer.'}
              </p>
            </div>

            {/* Lifecycle Status Pill */}
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-300 text-red-900 px-4 py-2 rounded-full text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
              <span>
                {language === 'hi' ? 'अलर्ट स्थिति: ' : 'Alert Status: '}
                {motherSosAlert?.status === 'Doctor responded'
                  ? (language === 'hi' ? 'डॉक्टर की सलाह प्राप्त हुई (Doctor responded)' : 'Doctor responded')
                  : motherSosAlert?.status === 'Acknowledged by doctor'
                  ? (language === 'hi' ? 'डॉक्टर ने संज्ञान लिया (Acknowledged by doctor)' : 'Acknowledged by doctor')
                  : (language === 'hi' ? 'केयर टीम को सतर्क किया गया (Care team alerted)' : 'Care team alerted in demo')}
              </span>
            </div>

            {/* Attached Address & GPS Badge */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span>{language === 'hi' ? 'साझा किया गया पता व जीपीएस:' : 'Shared Emergency Address & GPS:'}</span>
              </div>
              <p className="text-slate-700 pl-5">
                {motherSosAlert?.address || mother.address}
              </p>
              <div className="pl-5 text-[11px] text-slate-500 flex items-center gap-2">
                <span>{language === 'hi' ? 'लैंडमार्क:' : 'Landmark:'} {motherSosAlert?.landmark || mother.landmark}</span>
                <span>• GPS: 19.8762° N, 75.3433° E</span>
              </div>
            </div>

            {/* Transport Tracking & Clinical Honesty Notice */}
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">
                  {language === 'hi' ? 'परिवहन स्थिति (Transport Status):' : 'Transport Status:'}
                </span>
                <span className="text-[11px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                  {motherSosAlert?.transportStatus === 'FAMILY_CALLING_108'
                    ? (language === 'hi' ? '108 पर कॉल किया जा रहा है' : 'Family calling 108')
                    : motherSosAlert?.transportStatus === 'ASHA_DISPATCHED'
                    ? (language === 'hi' ? 'आशा दीदी घर आ रही हैं' : 'ASHA arriving')
                    : motherSosAlert?.transportStatus === 'IN_TRANSIT_TO_PHC'
                    ? (language === 'hi' ? 'अस्पताल के रास्ते में' : 'In transit to PHC')
                    : (language === 'hi' ? 'केयर टीम को सतर्क किया गया' : 'Care team alerted')}
                </span>
              </div>

              {/* Family Transport Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => handleTransportStatusChange('FAMILY_CALLING_108', 'Family confirmed dialing 108 ambulance')}
                  className="py-1.5 px-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition text-center"
                >
                  {language === 'hi' ? '108 डायल किया गया' : '108 Dialed'}
                </button>
                <button
                  onClick={() => handleTransportStatusChange('ASHA_DISPATCHED', 'ASHA confirmed moving toward mother residence')}
                  className="py-1.5 px-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition text-center"
                >
                  {language === 'hi' ? 'आशा दीदी आ रही हैं' : 'ASHA Arriving'}
                </button>
              </div>

              {/* Clinical boundary note: ambulance integration note */}
              <p className="text-[10px] text-amber-800 leading-tight">
                *एम्बुलेंस सीधे भेजने का दावा केवल वास्तविक डिस्पैच सेवा एकीकरण व पुष्टि के बाद ही संभव है। NHM के जननी शिशु सुरक्षा कार्यक्रम (JSSK) व 108 सेवा हेतु कृपया तुरंत कॉल करें।
              </p>
            </div>

            {/* Doctor's Advice on SOS (if sent) */}
            {motherSosAlert?.doctorAdvice && (
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-left">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm mb-1">
                  <Stethoscope className="w-4 h-4 text-purple-700" />
                  <span>{language === 'hi' ? 'डॉक्टर का निर्देश:' : "Doctor's Clinical Instructions:"}</span>
                </div>
                <p className="text-sm font-semibold text-purple-950 bg-white p-3 rounded-xl border border-purple-100">
                  "{motherSosAlert.doctorAdvice.message}"
                </p>
                <span className="text-[11px] text-purple-700 mt-1 block">
                  {motherSosAlert.doctorAdvice.doctorName} •{' '}
                  {new Date(motherSosAlert.doctorAdvice.sentAt).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Direct Emergency Call Buttons (108 & 102) */}
            <div className="pt-2 space-y-2">
              <a
                href="tel:108"
                className="w-full py-4 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-base shadow-lg transition flex items-center justify-center gap-2 min-h-[56px]"
              >
                <PhoneCall className="w-5 h-5" />
                <span>{getTranslation('call108', language)} (Ambulance)</span>
              </a>

              <a
                href="tel:102"
                className="w-full py-3.5 px-4 bg-[#1E2A4A] hover:bg-slate-800 text-white rounded-2xl font-bold text-sm shadow transition flex items-center justify-center gap-2 min-h-[50px]"
              >
                <PhoneCall className="w-4 h-4 text-amber-300" />
                <span>{getTranslation('call102', language)} (JSSK Maternal Transport)</span>
              </a>
            </div>

            <p className="text-[11px] text-slate-500 italic mt-2">
              {getTranslation('seekInPersonCare', language)}
            </p>
          </div>
        ) : (
          /* Normal SOS Idle Button */
          <div className="py-2 space-y-4">
            <button
              onClick={handleStartSos}
              className="w-full py-5 px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold rounded-2xl text-xl shadow-xl transition flex flex-col items-center justify-center gap-1 min-h-[72px]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
                <span>{language === 'hi' ? 'आपातकालीन SOS बटन' : 'Emergency SOS Button'}</span>
              </div>
              <span className="text-xs font-normal opacity-90">
                {language === 'hi'
                  ? 'अचानक चक्कर, तेज सिरदर्द, रक्तस्राव या दर्द होने पर दबाएं'
                  : 'Tap if severe headache, blurred vision, or bleeding'}
              </span>
            </button>

            <p className="text-xs text-slate-500">
              {language === 'hi'
                ? 'गलती से दबने से रोकने के लिए 3 सेकंड का समय मिलेगा।'
                : 'Includes a 3-second cancelable countdown.'}
            </p>
          </div>
        )}
      </div>

      {/* Mother Saved Address & Landmark Card */}
      <div className="order-8 bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#B0306A]" />
            <h2 className="text-base font-bold font-heading text-[#1E2A4A]">
              {language === 'hi' ? 'घर का पता एवं आपात लैंडमार्क' : 'Address & Emergency Landmark'}
            </h2>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {language === 'hi' ? 'सुरक्षित सहेजा गया' : 'Saved'}
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
          <div>
            <span className="text-slate-500 block">
              {language === 'hi' ? 'स्थाई पता (Address):' : 'Registered Residence:'}
            </span>
            <strong className="text-slate-800 text-sm">{mother.address}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">
              {language === 'hi' ? 'पहचान चिन्ह (Landmark for Ambulance):' : 'Key Landmark for Ambulance:'}
            </span>
            <strong className="text-slate-800">{mother.landmark}</strong>
          </div>
          <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>GPS: 19.8762° N, 75.3433° E</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'परिशुद्धता ~15 मी' : 'Accuracy ~15m'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Baby-Movement Check (Fetal Kick Counter) */}
      <div className="order-9 bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-[#B0306A]" />
            <h2 className="text-base font-bold font-heading text-[#1E2A4A]">
              {language === 'hi' ? 'शिशु की हलचल की जाँच (Baby Kicks)' : 'Baby Movement Check'}
            </h2>
          </div>
          <span className="text-xs font-bold text-[#1E2A4A] bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
            {kicksToday} / 10 {language === 'hi' ? 'हलचलें' : 'Kicks'}
          </span>
        </div>

        <div className="p-3.5 bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-200/80 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-700 block">
              {language === 'hi' ? 'आज शिशु ने कितनी बार किक किया?' : 'Fetal movements logged today:'}
            </span>
            <span className="text-2xl font-extrabold text-[#B0306A]">{kicksToday}</span>
            <span className="text-xs text-slate-500 ml-1.5">
              {kicksToday >= 10
                ? (language === 'hi' ? '✓ सामान्य स्तर' : '✓ Normal count')
                : (language === 'hi' ? '(कम से कम 10 अपेक्षित)' : '(Target ≥10 in 2h)')}
            </span>
          </div>

          <button
            onClick={handleLogKick}
            className={`py-2.5 px-4 bg-[#B0306A] hover:bg-[#902454] active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 ${
              kickAnimation ? 'scale-110 bg-emerald-600' : ''
            }`}
          >
            <HeartPulse className="w-4 h-4 animate-pulse" />
            <span>{language === 'hi' ? '+1 हलचल दर्ज करें' : '+1 Log Kick'}</span>
          </button>
        </div>

        {/* WHO & NHM Clinical Guidance on Fetal Movements */}
        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <strong>{language === 'hi' ? 'डब्ल्यूएचओ / एनएचएम दिशा-निर्देश:' : 'WHO / NHM Guidance:'}</strong>{' '}
          {language === 'hi'
            ? 'सक्रिय समय में 2 घंटे में कम से कम 10 बार शिशु की हलचल महसूस होना सामान्य है। यदि हलचल में अचानक कमी दिखे, तो तुरंत आशा दीदी या अस्पताल से संपर्क करें।'
            : 'Counting at least 10 movements within 2 hours during active periods is considered healthy. If you notice a reduction in movement, contact your ASHA worker immediately.'}
        </p>
      </div>

      {/* Latest Antenatal Visit & Doctor Advice Status */}
      <div className="order-6 bg-white rounded-xl p-4 border border-slate-200 space-y-4">
        <h2 className="text-base sm:text-lg font-bold font-heading text-[#1E2A4A] flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-[#B0306A]" />
          <span>{language === 'hi' ? 'आशा गृह-भेंट एवं स्वास्थ्य स्थिति' : 'Home-Visit & Health Status'}</span>
        </h2>

        {latestVisit ? (
          <div className="space-y-3">
            {/* Severity and vitals */}
            <div
              className={`p-4 rounded-2xl border ${
                latestVisit.finalSeverity === 'RED'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-emerald-50 border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {language === 'hi' ? 'हालिया रक्तचाप (BP):' : 'Latest BP Reading:'}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    latestVisit.finalSeverity === 'RED'
                      ? 'bg-red-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {latestVisit.finalSeverity === 'RED'
                    ? (language === 'hi' ? 'तुरंत आवश्यक (Urgent)' : 'URGENT')
                    : latestVisit.finalSeverity === 'AMBER'
                    ? (language === 'hi' ? 'ध्यान दें (Attention)' : 'ATTENTION')
                    : (language === 'hi' ? 'सामान्य (Normal)' : 'NORMAL')}
                </span>
              </div>

              <div className="text-2xl font-extrabold text-[#1E2A4A] mt-1">
                {latestVisit.systolicBp}/{latestVisit.diastolicBp} mmHg
              </div>

              {latestVisit.symptoms.length > 0 && (
                <div className="mt-2 text-xs font-medium text-slate-700">
                  <span>{language === 'hi' ? 'बताए गए लक्षण: ' : 'Reported symptoms: '}</span>
                  <strong className="text-red-900">{latestVisit.symptoms.join(', ')}</strong>
                </div>
              )}
            </div>

            {/* Doctor Advice Card: ONLY show if actually recorded */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
              <span className="text-xs font-bold text-purple-900 block mb-1">
                {language === 'hi' ? 'डॉक्टर की सलाह (Doctor Advice):' : "Doctor's Advice:"}
              </span>

              {latestVisit.doctorAdvice ? (
                <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-sm mt-1">
                  <p className="text-sm font-semibold text-purple-950">
                    "{latestVisit.doctorAdvice.message}"
                  </p>
                  <div className="mt-2 pt-2 border-t border-purple-100 flex items-center justify-between text-xs text-purple-700">
                    <span>{latestVisit.doctorAdvice.doctorName}</span>
                    <span>{new Date(latestVisit.doctorAdvice.sentAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white/80 p-3 rounded-xl border border-dashed border-purple-200 text-xs text-purple-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    {language === 'hi'
                      ? 'अलर्ट डॉक्टर को भेजा गया है। डॉक्टर की लिखित सलाह का इंतजार है...'
                      : 'Alert shared with Doctor. Awaiting written clinician advice...'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            {language === 'hi'
              ? 'अभी तक कोई विज़िट दर्ज नहीं हुई है।'
              : 'No visit records logged yet.'}
          </p>
        )}
      </div>

      {/* ANC Clinical Tests Tracker for Mother (Done vs Pending) */}
      <div className="order-7">
        <TestsTrackerCard
          patientId={mother.id}
          patientName={mother.name}
          tests={mother.tests || []}
          allowEdit={false}
        />
      </div>

      {/* Future Roadmap: Optional Pedometer / Wellness Trend */}
      <div className="order-10 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold font-heading text-[#1E2A4A]">
              {language === 'hi' ? 'भावी योजना: मातृत्व स्वास्थ्य वॉक' : 'Future Roadmap: Wellness Steps'}
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
            {language === 'hi' ? 'रोडमैप • वैकल्पिक' : 'Roadmap • Optional'}
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">
              {language === 'hi' ? 'आज का वॉकिंग ट्रेंड (ऐच्छिक):' : "Today's Walking Trend:"}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-[#1E2A4A]">3,420</span>
              <span className="text-xs text-slate-500">{language === 'hi' ? 'कदम (2.1 किमी)' : 'steps (2.1 km)'}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            {language === 'hi' ? 'हल्की सैर' : 'Gentle Walk'}
          </span>
        </div>

        {/* Explicit WHO Statement on pregnancy activity */}
        <p className="text-[11px] text-slate-600 leading-relaxed">
          <strong>WHO / NHM Guidance:</strong>{' '}
          {language === 'hi'
            ? 'WHO सलाह देता है कि बिना किसी चिकित्सीय जटिलता वाली गर्भावस्था में हल्की शारीरिक गतिविधि (जैसे टहलना) लाभकारी है। उच्च रक्तचाप जैसी स्थिति में गतिविधि की सलाह केवल डॉक्टर ही तय करते हैं। इसे कोई अनिवार्य दैनिक लक्ष्य या खतरे का स्कोर नहीं बनाया गया है।'
            : 'WHO recommends physical activity in uncomplicated pregnancy without contraindications. Activity advice must be personalized by the doctor for high-risk pregnancies. Not scored or penalized as danger.'}
        </p>
      </div>

      {/* Routine Antenatal Guidance from ASHA */}
      <div className="order-11 lg:col-span-2 bg-rose-50/50 rounded-xl p-4 border border-rose-200/70 text-xs text-slate-600 space-y-1.5">
        <span className="font-bold text-[#1E2A4A] block">
          {language === 'hi' ? 'आशा दीदी के सुझाव:' : 'ASHA Care Tips:'}
        </span>
        <p>• {language === 'hi' ? 'रोजाना आयरन (IFA) और कैल्शियम की गोली लें।' : 'Take daily IFA and Calcium tablets.'}</p>
        <p>• {language === 'hi' ? 'बाईं करवट लेकर आराम करें।' : 'Rest in the left lateral position.'}</p>
        <p>• {language === 'hi' ? 'शिशु की हलचल पर नियमित नजर रखें।' : 'Monitor daily fetal kick counts.'}</p>
      </div>

      {/* AI Birth Plan Modal */}
      <BirthPlanModal
        isOpen={isBirthPlanOpen}
        onClose={() => setIsBirthPlanOpen(false)}
        patient={mother}
        language={language}
        isMotherView={true}
      />
    </div>
  );
};
