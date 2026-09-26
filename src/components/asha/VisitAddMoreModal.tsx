import React, { useState } from 'react';
import {
  X,
  Plus,
  Check,
  Activity,
  Heart,
  Pill,
  Droplet,
  Baby,
  Eye,
  Thermometer,
  Zap,
  Save,
  Info,
  AlertTriangle,
} from 'lucide-react';
import {
  SwellingType,
  BabyPosition,
  UrineProtein,
  UrineSugar,
  TdDose,
} from '../../types';

export interface ExtraVisitInputs {
  muacCm?: number | null;
  swellingType?: SwellingType;
  pallor?: boolean | null;
  urineProtein?: UrineProtein | null;
  urineSugar?: UrineSugar | null;
  babyPosition?: BabyPosition | null;
  ifaTabletsLeft?: number | null;
  calciumTabletsLeft?: number | null;
  ifaAdherencePercent?: number | null;
  tdDoses?: TdDose | null;
  sfhCm?: number | null;
  hbGdl?: number | null;
  bloodSugarMgDl?: number | null;
  pulseBpm?: number | null;
  tempF?: number | null;
  spo2Percent?: number | null;
}

interface VisitAddMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValues: ExtraVisitInputs;
  onApply: (values: ExtraVisitInputs) => void;
  language: 'hi' | 'en';
  gestationalWeeks?: number;
}

export const VisitAddMoreModal: React.FC<VisitAddMoreModalProps> = ({
  isOpen,
  onClose,
  initialValues,
  onApply,
  language,
  gestationalWeeks,
}) => {
  const [activeTile, setActiveTile] = useState<string | null>(null);

  const [muacCm, setMuacCm] = useState<string>(
    initialValues.muacCm !== undefined && initialValues.muacCm !== null ? String(initialValues.muacCm) : ''
  );
  const [swellingType, setSwellingType] = useState<SwellingType>(initialValues.swellingType || 'none');
  const [pallor, setPallor] = useState<boolean | null>(initialValues.pallor ?? null);
  const [urineProtein, setUrineProtein] = useState<UrineProtein | null>(initialValues.urineProtein ?? null);
  const [urineSugar, setUrineSugar] = useState<UrineSugar | null>(initialValues.urineSugar ?? null);
  const [babyPosition, setBabyPosition] = useState<BabyPosition | null>(initialValues.babyPosition ?? null);
  const [ifaTabletsLeft, setIfaTabletsLeft] = useState<string>(
    initialValues.ifaTabletsLeft !== undefined && initialValues.ifaTabletsLeft !== null
      ? String(initialValues.ifaTabletsLeft)
      : ''
  );
  const [calciumTabletsLeft, setCalciumTabletsLeft] = useState<string>(
    initialValues.calciumTabletsLeft !== undefined && initialValues.calciumTabletsLeft !== null
      ? String(initialValues.calciumTabletsLeft)
      : ''
  );
  const [tdDoses, setTdDoses] = useState<TdDose | null>(initialValues.tdDoses ?? null);
  const [sfhCm, setSfhCm] = useState<string>(
    initialValues.sfhCm !== undefined && initialValues.sfhCm !== null ? String(initialValues.sfhCm) : ''
  );
  const [hbGdl, setHbGdl] = useState<string>(
    initialValues.hbGdl !== undefined && initialValues.hbGdl !== null ? String(initialValues.hbGdl) : ''
  );
  const [bloodSugarMgDl, setBloodSugarMgDl] = useState<string>(
    initialValues.bloodSugarMgDl !== undefined && initialValues.bloodSugarMgDl !== null
      ? String(initialValues.bloodSugarMgDl)
      : ''
  );
  const [pulseBpm, setPulseBpm] = useState<string>(
    initialValues.pulseBpm !== undefined && initialValues.pulseBpm !== null ? String(initialValues.pulseBpm) : ''
  );
  const [tempF, setTempF] = useState<string>(
    initialValues.tempF !== undefined && initialValues.tempF !== null ? String(initialValues.tempF) : ''
  );
  const [spo2Percent, setSpo2Percent] = useState<string>(
    initialValues.spo2Percent !== undefined && initialValues.spo2Percent !== null
      ? String(initialValues.spo2Percent)
      : ''
  );

  if (!isOpen) return null;

  // Calculate IFA adherence: assume 30 tablets were given for the month
  let calculatedIfaAdherence: number | null = null;
  if (ifaTabletsLeft !== '') {
    const left = parseInt(ifaTabletsLeft, 10);
    if (!isNaN(left)) {
      const consumed = Math.max(0, 30 - left);
      calculatedIfaAdherence = Math.min(100, Math.round((consumed / 30) * 100));
    }
  }

  const handleApply = () => {
    onApply({
      muacCm: muacCm !== '' ? parseFloat(muacCm) : null,
      swellingType,
      pallor,
      urineProtein,
      urineSugar,
      babyPosition,
      ifaTabletsLeft: ifaTabletsLeft !== '' ? parseInt(ifaTabletsLeft, 10) : null,
      calciumTabletsLeft: calciumTabletsLeft !== '' ? parseInt(calciumTabletsLeft, 10) : null,
      ifaAdherencePercent: calculatedIfaAdherence,
      tdDoses,
      sfhCm: sfhCm !== '' ? parseFloat(sfhCm) : null,
      hbGdl: hbGdl !== '' ? parseFloat(hbGdl) : null,
      bloodSugarMgDl: bloodSugarMgDl !== '' ? parseInt(bloodSugarMgDl, 10) : null,
      pulseBpm: pulseBpm !== '' ? parseInt(pulseBpm, 10) : null,
      tempF: tempF !== '' ? parseFloat(tempF) : null,
      spo2Percent: spo2Percent !== '' ? parseInt(spo2Percent, 10) : null,
    });
    onClose();
  };

  const tiles = [
    {
      id: 'muac',
      label: language === 'hi' ? 'बाँह का घेरा (MUAC)' : 'MUAC (Arm cm)',
      icon: Activity,
      color: 'bg-amber-50 text-amber-900 border-amber-200',
      activeColor: 'ring-2 ring-amber-500 bg-amber-100',
      summary: muacCm ? `${muacCm} cm` : language === 'hi' ? 'दर्ज करें' : 'Tap to enter',
      isFlagged: muacCm && parseFloat(muacCm) < 23,
    },
    {
      id: 'swelling',
      label: language === 'hi' ? 'सूजन का प्रकार' : 'Swelling Type',
      icon: AlertTriangle,
      color: 'bg-rose-50 text-rose-900 border-rose-200',
      activeColor: 'ring-2 ring-rose-500 bg-rose-100',
      summary:
        swellingType === 'face_or_hands'
          ? (language === 'hi' ? 'चेहरे/हाथ पर (गंभीर)' : 'Face/Hands')
          : swellingType === 'feet_only'
          ? (language === 'hi' ? 'पैरों पर' : 'Feet only')
          : (language === 'hi' ? 'कोई सूजन नहीं' : 'None'),
      isFlagged: swellingType === 'face_or_hands',
    },
    {
      id: 'pallor',
      label: language === 'hi' ? 'पीलापन (Pallor - आँखें/नाखून)' : 'Pallor (Pale eyes/nails)',
      icon: Eye,
      color: 'bg-amber-50 text-amber-900 border-amber-200',
      activeColor: 'ring-2 ring-amber-500 bg-amber-100',
      summary: pallor === true ? (language === 'hi' ? 'हाँ (पीलापन दिखा)' : 'Yes (Pale)') : pallor === false ? (language === 'hi' ? 'नहीं' : 'No') : language === 'hi' ? 'जांचें' : 'Check',
      isFlagged: pallor === true,
    },
    {
      id: 'urine',
      label: language === 'hi' ? 'पेशाब जाँच (Protein / Sugar)' : 'Urine Dipstick',
      icon: Droplet,
      color: 'bg-blue-50 text-blue-900 border-blue-200',
      activeColor: 'ring-2 ring-blue-500 bg-blue-100',
      summary: urineProtein ? `Protein: ${urineProtein}` : language === 'hi' ? 'डिपस्टिक किट' : 'ANM Kit',
      isFlagged: urineProtein === '1+' || urineProtein === '2+' || urineProtein === '3+',
    },
    {
      id: 'babyPosition',
      label: language === 'hi' ? 'शिशु की स्थिति (36+ सप्ताह)' : 'Baby Position (Lie)',
      icon: Baby,
      color: 'bg-purple-50 text-purple-900 border-purple-200',
      activeColor: 'ring-2 ring-purple-500 bg-purple-100',
      summary: babyPosition || (language === 'hi' ? 'सिर नीचे / ब्रीच' : 'Position'),
      isFlagged: babyPosition === 'breech' || babyPosition === 'transverse',
    },
    {
      id: 'ifa',
      label: language === 'hi' ? 'आयरन व कैल्शियम गोलियाँ' : 'IFA & Calcium Left',
      icon: Pill,
      color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      activeColor: 'ring-2 ring-emerald-500 bg-emerald-100',
      summary: ifaTabletsLeft !== '' ? `${ifaTabletsLeft} गोलियाँ शेष (${calculatedIfaAdherence}% नियमित)` : language === 'hi' ? 'गोलियों की गणना' : 'Count tablets',
      isFlagged: calculatedIfaAdherence !== null && calculatedIfaAdherence < 70,
    },
    {
      id: 'td',
      label: language === 'hi' ? 'टीडी इंजेक्शन (Td Doses)' : 'Td Vaccine Dose',
      icon: Zap,
      color: 'bg-slate-50 text-slate-900 border-slate-200',
      activeColor: 'ring-2 ring-slate-500 bg-slate-100',
      summary: tdDoses ? `Td-${tdDoses}` : language === 'hi' ? '0 / 1 / 2' : 'Dose status',
    },
    {
      id: 'otherVitals',
      label: language === 'hi' ? 'SFH, Hb, शर्करा, पल्स, SpO2' : 'SFH, Hb, Sugar, SpO2',
      icon: Thermometer,
      color: 'bg-teal-50 text-teal-900 border-teal-200',
      activeColor: 'ring-2 ring-teal-500 bg-teal-100',
      summary: sfhCm || hbGdl ? `SFH: ${sfhCm || '--'}cm, Hb: ${hbGdl || '--'}` : language === 'hi' ? 'अन्य जाँच' : 'Vitals',
      isFlagged: (hbGdl && parseFloat(hbGdl) < 10) || (spo2Percent && parseInt(spo2Percent, 10) < 95),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E2A4A] to-[#B0306A] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <Plus className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-heading">
                {language === 'hi' ? 'अतिरिक्त जाँच जोड़ें (Add More Inputs)' : 'Add More Clinical Inputs'}
              </h2>
              <p className="text-xs text-white/80">
                {language === 'hi'
                  ? 'किसी भी टाइल पर टैप करें • बड़ा कीपैड या Yes/No चयन करें'
                  : 'Tap any tile to enter values with big keypad or toggles'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tiles Grid & Active Form Pane */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Grid of Icon Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tiles.map((tile) => {
              const Icon = tile.icon;
              const isSelected = activeTile === tile.id;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setActiveTile(tile.id)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between min-h-[96px] ${
                    isSelected ? tile.activeColor : tile.color
                  } hover:shadow-xs relative`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon className="w-5 h-5" />
                    {tile.isFlagged && (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-bold block truncate">{tile.label}</span>
                    <span className="text-[11px] opacity-80 block truncate font-medium">
                      {tile.summary}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Detail Input Form */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            {/* 1. MUAC Input */}
            {activeTile === 'muac' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {language === 'hi' ? 'मध्य ऊपरी बाँह का घेरा (MUAC - cm):' : 'Mid-Upper Arm Circumference (MUAC cm):'}
                  </h4>
                  <span className="text-[11px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                    &lt; 23 cm = {language === 'hi' ? 'कुपोषण जोखिम' : 'Undernutrition Risk'}
                  </span>
                </div>

                {/* Picture showing where to measure on the arm */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-center text-amber-700 font-black text-xs shrink-0">
                    💪 📏
                  </div>
                  <p className="text-xs text-slate-600 leading-tight">
                    {language === 'hi'
                      ? 'बाँह के कंधे और कोहनी के ठीक बीच में लाल/पीले/हरे Shakir टेप से नापें। 23 सेमी से कम होने पर पीला अलर्ट।'
                      : 'Measure at midpoint between shoulder and elbow using MUAC tape. Values < 23 cm flag acute undernutrition.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    value={muacCm}
                    onChange={(e) => setMuacCm(e.target.value)}
                    placeholder="22.5"
                    className="flex-1 p-3 text-xl font-bold text-[#1E2A4A] bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#B0306A]"
                  />
                  <span className="text-sm font-bold text-slate-600">cm</span>
                </div>
              </div>
            )}

            {/* 2. Swelling Type */}
            {activeTile === 'swelling' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {language === 'hi' ? 'सूजन का प्रकार चुनें (Swelling Type):' : 'Select Swelling Type:'}
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSwellingType('none')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                      swellingType === 'none'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'hi' ? 'कोई नहीं (None)' : 'None'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSwellingType('feet_only')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                      swellingType === 'feet_only'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'hi' ? 'केवल पैरों पर (Feet only)' : 'Feet only'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSwellingType('face_or_hands')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                      swellingType === 'face_or_hands'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'hi' ? 'चेहरे या हाथ पर (RED)' : 'Face or Hands (RED)'}
                  </button>
                </div>
                {swellingType === 'face_or_hands' && (
                  <p className="text-xs text-red-700 font-semibold">
                    ⚠️ {language === 'hi' ? 'चेहरे/हाथ की सूजन प्री-एक्लेम्पसिया का मुख्य संकेत है।' : 'Face/hand edema is a cardinal sign of pre-eclampsia.'}
                  </p>
                )}
              </div>
            )}

            {/* 3. Pallor */}
            {activeTile === 'pallor' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {language === 'hi' ? 'पीलापन (Pallor - आँखें, जीभ या नाखून):' : 'Pallor (Pale eyes, tongue, nails):'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPallor(true)}
                    className={`p-3.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      pallor === true ? 'bg-amber-600 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'हाँ (पीलापन मौजूद है)' : 'Yes (Pallor Present)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPallor(false)}
                    className={`p-3.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      pallor === false ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    <span>{language === 'hi' ? 'नहीं (सामान्य गुलाबी)' : 'No (Pink / Normal)'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Urine Dipstick */}
            {activeTile === 'urine' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    {language === 'hi' ? 'पेशाब में एल्बुमिन/प्रोटीन (Urine Protein Dipstick):' : 'Urine Protein Dipstick:'}
                  </h4>
                  <div className="grid grid-cols-5 gap-1.5 text-xs font-bold">
                    {(['nil', 'trace', '1+', '2+', '3+'] as UrineProtein[]).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setUrineProtein(val)}
                        className={`p-2.5 rounded-xl border transition text-center ${
                          urineProtein === val
                            ? val === 'nil'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    {language === 'hi' ? 'पेशाब में शर्करा (Urine Sugar):' : 'Urine Sugar:'}
                  </h4>
                  <div className="grid grid-cols-5 gap-1.5 text-xs font-bold">
                    {(['nil', 'trace', '1+', '2+', '3+'] as UrineSugar[]).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setUrineSugar(val)}
                        className={`p-2 rounded-xl border transition text-center ${
                          urineSugar === val ? 'bg-amber-600 text-white' : 'bg-white text-slate-700'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Baby Position */}
            {activeTile === 'babyPosition' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {language === 'hi' ? 'शिशु की स्थिति (Baby Lie & Presentation):' : 'Fetal Position (Presentation):'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                  {[
                    { id: 'head_down', label: language === 'hi' ? 'सिर नीचे (Cephalic)' : 'Head down' },
                    { id: 'breech', label: language === 'hi' ? 'उल्टा / ब्रीच (Breech)' : 'Breech' },
                    { id: 'transverse', label: language === 'hi' ? 'आड़ा (Transverse)' : 'Transverse' },
                    { id: 'unknown', label: language === 'hi' ? 'अस्पष्ट (Unknown)' : 'Unknown' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setBabyPosition(pos.id as any)}
                      className={`p-3 rounded-xl border text-center transition ${
                        babyPosition === pos.id
                          ? pos.id === 'head_down'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. IFA Tablets Left */}
            {activeTile === 'ifa' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {language === 'hi' ? 'बची हुई आयरन व कैल्शियम गोलियाँ:' : 'Tablets Remaining at Home:'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'IFA गोलियाँ बची हैं (Tablets Left):' : 'IFA Tablets Left (out of 30):'}
                    </label>
                    <input
                      type="number"
                      value={ifaTabletsLeft}
                      onChange={(e) => setIfaTabletsLeft(e.target.value)}
                      placeholder="5"
                      className="w-full p-2.5 text-base font-bold bg-white rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'कैल्शियम गोलियाँ बची हैं:' : 'Calcium Tablets Left:'}
                    </label>
                    <input
                      type="number"
                      value={calciumTabletsLeft}
                      onChange={(e) => setCalciumTabletsLeft(e.target.value)}
                      placeholder="4"
                      className="w-full p-2.5 text-base font-bold bg-white rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                {calculatedIfaAdherence !== null && (
                  <div className="p-2.5 bg-white rounded-xl border text-xs flex items-center justify-between">
                    <span className="text-slate-600">
                      {language === 'hi' ? 'दवा लेने की नियमितता (Adherence):' : 'Calculated Adherence Rate:'}
                    </span>
                    <strong className={calculatedIfaAdherence < 70 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                      {calculatedIfaAdherence}% {calculatedIfaAdherence < 70 ? '(⚠️ अनियमित - सेवन परामर्श दें)' : '(नियमित)'}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* 7. Td Vaccine */}
            {activeTile === 'td' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {language === 'hi' ? 'टीडी टीका खुराक (Td Vaccine Doses Done):' : 'Td Vaccine Doses Completed:'}
                </h4>
                <div className="grid grid-cols-4 gap-2 text-xs font-bold">
                  {(['0', '1', '2', 'booster'] as TdDose[]).map((dose) => (
                    <button
                      key={dose}
                      type="button"
                      onClick={() => setTdDoses(dose)}
                      className={`p-3 rounded-xl border text-center transition ${
                        tdDoses === dose ? 'bg-[#1E2A4A] text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      {dose === 'booster' ? 'Booster' : `Td-${dose}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 8. SFH, Hb, Vitals */}
            {activeTile === 'otherVitals' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {language === 'hi' ? 'अतिरिक्त नैदानिक माप (Clinical Parameters):' : 'Additional Clinical Parameters:'}
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'SFH (फंडल ऊंचाई cm)' : 'SFH (cm)'}
                    </label>
                    <input
                      type="number"
                      value={sfhCm}
                      onChange={(e) => setSfhCm(e.target.value)}
                      placeholder="28"
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'हीमोग्लोबिन (Hb g/dL)' : 'Hb (g/dL)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hbGdl}
                      onChange={(e) => setHbGdl(e.target.value)}
                      placeholder="10.2"
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'रक्त शर्करा (Sugar mg/dL)' : 'Blood Sugar (mg/dL)'}
                    </label>
                    <input
                      type="number"
                      value={bloodSugarMgDl}
                      onChange={(e) => setBloodSugarMgDl(e.target.value)}
                      placeholder="110"
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'नाड़ी दर (Pulse bpm)' : 'Pulse (bpm)'}
                    </label>
                    <input
                      type="number"
                      value={pulseBpm}
                      onChange={(e) => setPulseBpm(e.target.value)}
                      placeholder="78"
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'तापमान (Temp °F)' : 'Temp (°F)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempF}
                      onChange={(e) => setTempF(e.target.value)}
                      placeholder="98.6"
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      {language === 'hi' ? 'ऑक्सीजन (SpO2 %)' : 'SpO2 (%)'}
                    </label>
                    <input
                      type="number"
                      value={spo2Percent}
                      onChange={(e) => setSpo2Percent(e.target.value)}
                      placeholder="98"
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 font-bold text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {!activeTile && (
              <div className="text-center py-4 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400" />
                <span>
                  {language === 'hi'
                    ? 'विवरण दर्ज करने हेतु ऊपर दिए गए किसी भी टाइल पर टैप करें।'
                    : 'Tap any icon tile above to enter values.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 min-h-[44px]"
          >
            {language === 'hi' ? 'रद्द करें' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="px-6 py-2.5 bg-[#2F7D4F] hover:bg-[#25653f] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition min-h-[44px]"
          >
            <Check className="w-4 h-4" />
            <span>{language === 'hi' ? 'लागू करें और विज़िट में जोड़ें' : 'Apply to Visit Review'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
