import React, { useState, useEffect, useRef } from 'react';
import {
  HeartPulse,
  Users,
  AlertTriangle,
  Mic,
  MicOff,
  Keyboard,
  Send,
  Sparkles,
  CheckCircle2,
  PhoneCall,
  Clock,
  ArrowLeft,
  Search,
  Plus,
  X,
  Stethoscope,
  Info,
  Calendar,
  AlertCircle,
  HelpCircle,
  Volume2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  ClipboardList,
} from 'lucide-react';
import { useDemo } from '../../context/DemoContext';
import { MotherProfile, VisitRecord, SeverityLevel, FetalMovementStatus } from '../../types';
import { evaluateClinicalRules, computePatientRiskState } from '../../rules/clinicalRules';
import { extractVisitWithGemini, draftHandoffWithGemini, ExtractionResponseData } from '../../services/geminiService';
import { getTranslation } from '../../utils/translations';
import { AiOfflineBanner } from '../common/AiOfflineBanner';
import { TestsTrackerCard } from '../common/TestsTrackerCard';
import { TodayVisitsTile } from './TodayVisitsTile';
import { RegistrationWizardModal } from './RegistrationWizardModal';
import { VisitAddMoreModal, ExtraVisitInputs } from './VisitAddMoreModal';
import { BirthPlanModal } from '../common/BirthPlanModal';

// Standard demo phrase requested in brief
const DEMO_TEST_PHRASE = 'BP ek sau saath by ek sau das, sar mein dard hai, aankhon ke aage dhundhla dikh raha hai.';
const DEMO_NORMAL_PHRASE = 'BP ek sau bees by assi, koi takleef nahi hai, baby movement acchi hai.';
const DEMO_AMBER_PHRASE = 'BP ek sau paintalis by baanavve, halka sar dard hai aur pairon mein thodi sujan hai.';

// Standard antenatal danger signs for direct form toggling
const COMMON_SYMPTOMS_LIST = [
  { id: 'Severe headache', labelHi: 'तेज सिरदर्द (Headache)', isDanger: true },
  { id: 'Blurred vision / visual disturbance', labelHi: 'धुंधला दिखना (Blurred Vision)', isDanger: true },
  { id: 'Swelling of hands/feet (edema)', labelHi: 'हाथ-पैरों में सूजन (Edema)', isDanger: false },
  { id: 'Dizziness', labelHi: 'चक्कर आना (Dizziness)', isDanger: false },
  { id: 'Vaginal bleeding', labelHi: 'रक्तस्राव (Vaginal Bleeding)', isDanger: true },
  { id: 'Severe breathlessness', labelHi: 'सांस फूलना (Breathlessness)', isDanger: true },
  { id: 'Convulsions / seizures', labelHi: 'दौरा/झटके (Convulsions)', isDanger: true },
  { id: 'Abdominal pain', labelHi: 'पेट में तेज दर्द (Abdominal Pain)', isDanger: false },
];

export const AshaView: React.FC = () => {
  const {
    patients,
    language,
    addVisit,
    updateVisitDraft,
    urgentAlerts,
    selectedPatient,
    setSelectedPatientId,
    aiScanResults,
    isScanningMothers,
    runMotherScan,
    registerNewMother,
    refreshBirthPlan,
  } = useDemo();

  // Exactly 3 primary actions: 'NEW_VISIT' | 'MY_MOTHERS' | 'ALERTS'
  // 'MY_MOTHERS' opens as the default sorted worklist & visit-starting view
  const [activeTab, setActiveTab] = useState<'NEW_VISIT' | 'MY_MOTHERS' | 'ALERTS'>('MY_MOTHERS');

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBirthPlanModalOpen, setIsBirthPlanModalOpen] = useState(false);
  const [birthPlanPatient, setBirthPlanPatient] = useState<MotherProfile | null>(null);

  // Helper to check if mother has overdue follow-up (>5 weeks or past due date)
  const isMotherOverdue = (patient: MotherProfile): boolean => {
    const latestVisit = patient.visits[0];
    if (!latestVisit) return true;
    const daysSinceVisit = Math.floor(
      (Date.now() - new Date(latestVisit.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceVisit > 35) return true;
    if (patient.nextFollowUpDate) {
      const dueDate = new Date(patient.nextFollowUpDate).getTime();
      if (!isNaN(dueDate) && dueDate < Date.now()) return true;
    }
    return false;
  };

  const overdueCount = patients.filter(isMotherOverdue).length;

  // Helper to get doctor status reusing four-state lineage
  const getDoctorStatus = (patient: MotherProfile) => {
    const latestVisit = patient.visits[0];
    if (!latestVisit) {
      return {
        status: 'Pending',
        label: language === 'hi' ? 'लंबित' : 'Pending',
        color: 'bg-slate-100 text-slate-700',
      };
    }
    if (latestVisit.alertStatus === 'Doctor responded') {
      return {
        status: 'Advice Sent',
        label: language === 'hi' ? 'सलाह प्राप्त' : 'Advice Sent',
        color: 'bg-purple-100 text-purple-900 border border-purple-200',
      };
    }
    if (latestVisit.alertStatus === 'Acknowledged by doctor') {
      return {
        status: 'Acknowledged',
        label: language === 'hi' ? 'स्वीकृत' : 'Acknowledged',
        color: 'bg-blue-100 text-blue-900 border border-blue-200',
      };
    }
    if (latestVisit.finalSeverity === 'RED' || patient.overallLevel === 'RED' || latestVisit.finalSeverity === 'AMBER') {
      return {
        status: 'Pending',
        label: language === 'hi' ? 'समीक्षा प्रतीक्षारत' : 'Pending Review',
        color: 'bg-amber-100 text-amber-900 border border-amber-200',
      };
    }
    return {
      status: 'Routine',
      label: language === 'hi' ? 'नियमित' : 'Routine',
      color: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    };
  };

  // Wizard state for New Visit:
  // Step 1: Choose Mother
  // Step 2: Voice, Typed, or Direct Form Input
  // Step 3: AI Extraction Review ("AI ने यह समझा")
  // Step 4: Result & Alert Status
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [targetPatient, setTargetPatient] = useState<MotherProfile>(
    selectedPatient || patients[0]
  );

  // Jump straight to Step 2 with the selected mother pre-selected from worklist
  const handleStartVisitForMother = (patient: MotherProfile) => {
    setTargetPatient(patient);
    setSelectedPatientId(patient.id);
    setActiveTab('NEW_VISIT');
    setWizardStep(2);
    // Prefill direct form defaults if needed
    setFormWeeks(String(patient.gestationalWeeks || 32));
    setInputText('');
  };

  // Search filter for mothers
  const [searchQuery, setSearchQuery] = useState('');

  // Step 2: 3 Input Methods ('VOICE' | 'TYPING' | 'FORM')
  const [inputMethod, setInputMethod] = useState<'VOICE' | 'TYPING' | 'FORM'>('VOICE');

  // Direct Form State
  const [formSystolic, setFormSystolic] = useState('160');
  const [formDiastolic, setFormDiastolic] = useState('110');
  const [formWeeks, setFormWeeks] = useState('34');
  const [formSymptoms, setFormSymptoms] = useState<string[]>([
    'Severe headache',
    'Blurred vision / visual disturbance',
  ]);
  const [formWeight, setFormWeight] = useState('54');
  const [formNotes, setFormNotes] = useState('Reported severe headache and vision blurring during home visit.');

  // Voice & Typing state
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Step 3: Extracted & Editable Fields
  const [extractedData, setExtractedData] = useState<ExtractionResponseData | null>(null);
  const [editableSystolic, setEditableSystolic] = useState<string>('');
  const [editableDiastolic, setEditableDiastolic] = useState<string>('');
  const [editableWeeks, setEditableWeeks] = useState<string>('');
  const [editableSymptoms, setEditableSymptoms] = useState<string[]>([]);
  const [newSymptomText, setNewSymptomText] = useState('');
  const [editableObservations, setEditableObservations] = useState<string>('');
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  // Rich visit inputs: prefilled from AI extraction, editable via the "➕ और जोड़ें" modal
  const [extraInputs, setExtraInputs] = useState<ExtraVisitInputs>({});
  const [editableWeight, setEditableWeight] = useState<string>('');
  const [fetalMovementStatus, setFetalMovementStatus] = useState<FetalMovementStatus | null>(null);
  const [isAddMoreOpen, setIsAddMoreOpen] = useState(false);

  // Step 4: Submitted Visit record & feedback
  const [submittedVisit, setSubmittedVisit] = useState<VisitRecord | null>(null);
  const [expandedMotherId, setExpandedMotherId] = useState<string | null>(null);

  // Web Speech API reference
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Sync selected patient if changed externally
  useEffect(() => {
    if (selectedPatient && wizardStep === 1) {
      setTargetPatient(selectedPatient);
    }
  }, [selectedPatient, wizardStep]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Audio Recording with Web Speech API
  const startRecording = () => {
    setMicError(null);
    setInputText('');
    setRecordDuration(0);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError(
        language === 'hi'
          ? 'आपके ब्राउज़र में डायरेक्ट वॉयस रिकॉग्निशन समर्थित नहीं है। कृपया नीचे टाइप करें या टेस्ट बटन का उपयोग करें।'
          : 'Direct speech recognition is not supported in this browser environment. Please use typing or demo phrase.'
      );
      setInputMethod('TYPING');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setRecordDuration((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInputText(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError(
            language === 'hi'
              ? 'माइक्रोफ़ोन अनुमति अस्वीकृत है। कृपया ब्राउज़र सेटिंग्स में अनुमति दें या नीचे टाइप करें।'
              : 'Microphone permission was denied. Please allow microphone access or use typing mode.'
          );
        } else {
          setMicError(
            language === 'hi'
              ? `माइक्रोफ़ोन स्थिति: ${event.error}। आप नीचे सीधे लिख भी सकती हैं।`
              : `Speech input note: ${event.error}. You can type the visit report below.`
          );
        }
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setMicError(
        language === 'hi'
          ? 'माइक्रोफ़ोन शुरू नहीं हो सका। कृपया नीचे टेस्ट वाक्य चुनें या टाइप करें।'
          : 'Could not initialize microphone. Please type or use sample audio text.'
      );
      setIsRecording(false);
      setInputMethod('TYPING');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const toggleFormSymptom = (symptomId: string) => {
    if (formSymptoms.includes(symptomId)) {
      setFormSymptoms(formSymptoms.filter((s) => s !== symptomId));
    } else {
      setFormSymptoms([...formSymptoms, symptomId]);
    }
  };

  const handleProceedFromForm = () => {
    const sys = formSystolic.trim();
    const dia = formDiastolic.trim();
    if (!sys || !dia) {
      alert(language === 'hi' ? 'कृपया सिस्टोलिक और डायस्टोलिक BP दोनों भरें।' : 'Please enter both systolic and diastolic BP.');
      return;
    }
    setEditableSystolic(sys);
    setEditableDiastolic(dia);
    setEditableWeeks(formWeeks || String(targetPatient.gestationalWeeks || '34'));
    setEditableSymptoms(formSymptoms);
    setEditableObservations(formNotes);
    setEditableWeight(formWeight);
    setExtraInputs({});
    setFetalMovementStatus(null);
    setUncertainFields([]);
    setInputText(`Direct Form Entry: BP ${sys}/${dia} mmHg, Weeks: ${formWeeks}, Symptoms: ${formSymptoms.join(', ') || 'None'}`);
    setWizardStep(3);
  };

  // Step 2 -> Step 3: Trigger Gemini Extraction
  const handleProcessWithGemini = async () => {
    if (!inputText.trim()) {
      alert(
        language === 'hi'
          ? 'कृपया पहले बोलें या विज़िट रिपोर्ट टाइप करें।'
          : 'Please speak or enter a visit transcript first.'
      );
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    const res = await extractVisitWithGemini(
      inputText,
      language === 'hi' ? 'hi' : 'hinglish',
      {
        name: targetPatient.name,
        gestationalWeeks: targetPatient.gestationalWeeks,
      }
    );

    setIsExtracting(false);

    if (!res.success || !res.data) {
      setExtractionError(
        res.error || (language === 'hi' ? 'AI डेटा एक्सट्रैक्ट करने में विफल रहा।' : 'AI extraction failed.')
      );
      // AI offline: no guessing from the text. The ASHA enters values manually; rules still run on confirm.
      setExtractedData(null);
      setEditableSystolic('');
      setEditableDiastolic('');
      setEditableWeeks(String(targetPatient.gestationalWeeks || ''));
      setEditableSymptoms([]);
      setEditableObservations(inputText);
      setEditableWeight('');
      setExtraInputs({});
      setFetalMovementStatus(null);
      setUncertainFields([]);
      setWizardStep(3);
      return;
    }

    // Populate editable fields with AI extraction
    const d = res.data;
    setExtractedData(d);
    setEditableSystolic(d.systolicBp !== null ? String(d.systolicBp) : '');
    setEditableDiastolic(d.diastolicBp !== null ? String(d.diastolicBp) : '');
    setEditableWeeks(d.gestationalWeeks !== null ? String(d.gestationalWeeks) : String(targetPatient.gestationalWeeks || ''));
    setEditableSymptoms(d.symptoms || []);
    setEditableObservations(d.otherObservations || '');
    setUncertainFields(d.uncertainFields || []);
    setEditableWeight(d.weightKg != null ? String(d.weightKg) : '');
    setFetalMovementStatus(d.fetalMovementStatus ?? null);
    setExtraInputs({
      muacCm: d.muacCm ?? null,
      swellingType: d.swellingType ?? undefined,
      pallor: d.pallor ?? null,
      urineProtein: d.urineProtein ?? null,
      urineSugar: d.urineSugar ?? null,
      babyPosition: d.babyPosition ?? null,
      ifaTabletsLeft: d.ifaTabletsLeft ?? null,
      calciumTabletsLeft: d.calciumTabletsLeft ?? null,
      tdDoses: d.tdDoses ?? null,
      sfhCm: d.sfhCm ?? null,
      hbGdl: d.hbGdl ?? null,
      bloodSugarMgDl: d.bloodSugarMgDl ?? null,
      pulseBpm: d.pulseBpm ?? null,
      tempF: d.tempF ?? null,
      spo2Percent: d.spo2Percent ?? null,
    });
    setWizardStep(3);
  };

  // Add / Remove symptom chip
  const handleAddSymptom = () => {
    if (newSymptomText.trim()) {
      setEditableSymptoms([...editableSymptoms, newSymptomText.trim()]);
      setNewSymptomText('');
    }
  };

  const handleRemoveSymptom = (index: number) => {
    setEditableSymptoms(editableSymptoms.filter((_, i) => i !== index));
  };

  // Step 3 -> Step 4: Confirm and Save
  const handleConfirmAndSave = async () => {
    const sys = editableSystolic.trim() !== '' ? Number(editableSystolic) : null;
    const dia = editableDiastolic.trim() !== '' ? Number(editableDiastolic) : null;
    const weeks = editableWeeks.trim() !== '' ? Number(editableWeeks) : targetPatient.gestationalWeeks;

    const weightKg = editableWeight.trim() !== '' ? Number(editableWeight) : null;

    // All visit fields in one place: stored on the record AND fed to the rule engine
    const visitFields = {
      systolicBp: sys,
      diastolicBp: dia,
      gestationalWeeks: weeks,
      weightKg,
      fetalMovementStatus,
      symptoms: editableSymptoms,
      otherObservations: editableObservations,
      muacCm: extraInputs.muacCm ?? null,
      swellingType: extraInputs.swellingType ?? null,
      pallor: extraInputs.pallor ?? null,
      urineProtein: extraInputs.urineProtein ?? null,
      urineSugar: extraInputs.urineSugar ?? null,
      babyPosition: extraInputs.babyPosition ?? null,
      ifaTabletsLeft: extraInputs.ifaTabletsLeft ?? null,
      calciumTabletsLeft: extraInputs.calciumTabletsLeft ?? null,
      ifaAdherencePercent: extraInputs.ifaAdherencePercent ?? null,
      tdDoses: extraInputs.tdDoses ?? null,
      sfhCm: extraInputs.sfhCm ?? null,
      hbGdl: extraInputs.hbGdl ?? null,
      bloodSugarMgDl: extraInputs.bloodSugarMgDl ?? null,
      pulseBpm: extraInputs.pulseBpm ?? null,
      tempF: extraInputs.tempF ?? null,
      spo2Percent: extraInputs.spo2Percent ?? null,
    };

    // Evaluate deterministic clinical rules with the full mother profile (height, age, history, Rh, ...)
    const ruleEvaluation = evaluateClinicalRules({
      ...visitFields,
      patientProfile: targetPatient,
    });

    const visitId = `vis-${Date.now()}`;
    const newVisit: VisitRecord = {
      ...visitFields,
      id: visitId,
      patientId: targetPatient.id,
      timestamp: new Date().toISOString(),
      recordedBy: 'Sunita Tai (ASHA)',
      rawTranscript: inputText,
      inputLanguage: language === 'hi' ? 'hi' : 'hinglish',
      uncertainFields: uncertainFields,
      isConfirmed: true,
      confirmedAt: new Date().toISOString(),
      ruleSeverity: ruleEvaluation.ruleSeverity,
      ruleTriggers: ruleEvaluation.triggers.map((t) => t.criterionEnglish),
      finalSeverity: ruleEvaluation.finalSeverity,
      needsImmediateTransfer: ruleEvaluation.needsImmediateTransfer,
      alertStatus: ruleEvaluation.finalSeverity === 'RED' ? 'Visible in demo' : 'none',
    };

    // Trend engine over the history including this visit; overall level = worst(rule, trend, AI)
    const patientWithVisit: MotherProfile = {
      ...targetPatient,
      visits: [newVisit, ...targetPatient.visits],
      riskTags: Array.from(new Set([...(targetPatient.riskTags || []), ...ruleEvaluation.riskTags])),
    };
    const riskState = computePatientRiskState(patientWithVisit, targetPatient.aiScanResult);
    const updatedPatient: MotherProfile = { ...patientWithVisit, ...riskState };

    // Save into state & broadcast to cross-tab storage
    addVisit(targetPatient.id, newVisit, ruleEvaluation.riskTags);
    setSubmittedVisit(newVisit);
    setWizardStep(4);

    // Birth plan depends on the latest findings; regenerate from 28 weeks onward
    if ((weeks ?? 0) >= 28) {
      refreshBirthPlan(targetPatient.id, updatedPatient);
    }

    // Call Gemini asynchronously to generate the SBAR draft for the doctor
    draftHandoffWithGemini(
      newVisit,
      targetPatient,
      ruleEvaluation.triggers.map((t) => `${t.criterionEnglish}: ${t.clinicalRationale}`)
    ).then((sbarRes) => {
      if (sbarRes.success && sbarRes.data) {
        updateVisitDraft(targetPatient.id, newVisit.id, sbarRes.data, false);
        setSubmittedVisit((prev) =>
          prev
            ? {
                ...prev,
                aiHandoffDraft: sbarRes.data,
              }
            : null
        );
      } else {
        updateVisitDraft(targetPatient.id, newVisit.id, undefined as any, true, sbarRes.error);
        setSubmittedVisit((prev) =>
          prev
            ? {
                ...prev,
                isAiFallback: true,
                aiError: sbarRes.error,
              }
            : null
        );
      }
    });
  };

  // Reset wizard to start a new visit
  const handleStartFreshVisit = () => {
    setInputText('');
    setRecordDuration(0);
    setMicError(null);
    setExtractedData(null);
    setEditableSystolic('');
    setEditableDiastolic('');
    setEditableWeeks('');
    setEditableSymptoms([]);
    setEditableObservations('');
    setUncertainFields([]);
    setExtraInputs({});
    setEditableWeight('');
    setFetalMovementStatus(null);
    setSubmittedVisit(null);
    setWizardStep(1);
    setActiveTab('NEW_VISIT');
  };

  // Filtered mothers list
  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.village.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorted worklist: Overdue follow-up first, then RED/unresolved, then routine
  const sortedWorklistMothers = [...filteredPatients].sort((a, b) => {
    // 1. Overdue follow-up first
    const aOverdue = isMotherOverdue(a);
    const bOverdue = isMotherOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // 2. Then RED / unresolved
    const aLatest = a.visits[0];
    const bLatest = b.visits[0];
    const aIsRed =
      a.overallLevel === 'RED' ||
      (aLatest?.finalSeverity === 'RED' && aLatest.alertStatus !== 'Doctor responded');
    const bIsRed =
      b.overallLevel === 'RED' ||
      (bLatest?.finalSeverity === 'RED' && bLatest.alertStatus !== 'Doctor responded');
    if (aIsRed && !bIsRed) return -1;
    if (!aIsRed && bIsRed) return 1;

    // 3. Then Amber
    const aIsAmber = a.overallLevel === 'AMBER' || aLatest?.finalSeverity === 'AMBER';
    const bIsAmber = b.overallLevel === 'AMBER' || bLatest?.finalSeverity === 'AMBER';
    if (aIsAmber && !bIsAmber) return -1;
    if (!aIsAmber && bIsAmber) return 1;

    // 4. Then Routine
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Exactly 3 Prominent Primary Action Tabs */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200/80 mb-5 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setActiveTab('NEW_VISIT')}
          className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[52px] ${
            activeTab === 'NEW_VISIT'
              ? 'bg-[#B0306A] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>{getTranslation('tabNewVisit', language)}</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_MOTHERS')}
          className={`relative flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[52px] ${
            activeTab === 'MY_MOTHERS'
              ? 'bg-[#B0306A] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>{getTranslation('tabMyMothers', language)}</span>
          {overdueCount > 0 && (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs">
              {overdueCount} {language === 'hi' ? 'अतिदेय' : 'Due'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`relative flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[52px] ${
            activeTab === 'ALERTS'
              ? 'bg-[#B0306A] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{getTranslation('tabAlerts', language)}</span>
          {(urgentAlerts.totalUnacknowledged > 0 || urgentAlerts.totalUrgent > 0) && (
            <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-xs">
              {urgentAlerts.totalUnacknowledged > 0 ? urgentAlerts.totalUnacknowledged : urgentAlerts.totalUrgent}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: NEW VISIT WIZARD */}
      {activeTab === 'NEW_VISIT' && (
        <div className="space-y-4">
          {/* STEP 1: SELECT MOTHER */}
          {wizardStep === 1 && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#1E2A4A]">
                    {language === 'hi' ? '1. गर्भवती माता का चयन करें' : '1. Select Expectant Mother'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {language === 'hi'
                      ? 'गृह-भेंट दर्ज करने के लिए माता का कार्ड चुनें'
                      : 'Choose mother for this antenatal home-visit'}
                  </p>
                </div>
                <span className="text-xs bg-rose-50 text-[#B0306A] px-2.5 py-1 rounded-full font-bold">
                  {language === 'hi' ? 'चरण 1/4' : 'Step 1/4'}
                </span>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    language === 'hi' ? 'नाम या गाँव से खोजें...' : 'Search by name or village...'
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B0306A]/30"
                />
              </div>

              {/* Patient Cards */}
              <div className="space-y-3">
                {filteredPatients.map((patient) => {
                  const isSelected = targetPatient.id === patient.id;
                  const lastLevel = patient.visits[0]?.finalSeverity || 'GREEN';

                  return (
                    <div
                      key={patient.id}
                      onClick={() => {
                        setTargetPatient(patient);
                        setSelectedPatientId(patient.id);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#B0306A] bg-rose-50/40 shadow-sm ring-2 ring-[#B0306A]/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                              isSelected
                                ? 'bg-[#B0306A] text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-[#1E2A4A]">
                                {patient.name}
                              </h3>
                              {patient.currentVisitSlotOpen && (
                                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-300">
                                  {language === 'hi' ? '★ विज़िट शेष' : '★ Visit Due'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {patient.age} {language === 'hi' ? 'वर्ष' : 'yrs'} • {patient.village} • G
                              {patient.gravida}P{patient.para} • {patient.gestationalWeeks}{' '}
                              {language === 'hi' ? 'सप्ताह' : 'weeks'}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="w-6 h-6 text-[#B0306A] shrink-0" />
                        )}
                      </div>

                      {/* Prior visit snippet */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {language === 'hi' ? 'पिछली जांच BP:' : 'Prior BP:'}{' '}
                          <strong className="text-slate-800">
                            {patient.visits[0]?.systolicBp ?? '--'}/
                            {patient.visits[0]?.diastolicBp ?? '--'} mmHg
                          </strong>
                        </span>
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            lastLevel === 'RED' ? 'text-red-700' : lastLevel === 'AMBER' ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              lastLevel === 'RED' ? 'bg-red-500' : lastLevel === 'AMBER' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          ></span>
                          {lastLevel === 'RED'
                            ? (language === 'hi' ? 'तत्काल (Red)' : 'Urgent (Red)')
                            : lastLevel === 'AMBER'
                            ? (language === 'hi' ? 'ध्यान दें (Amber)' : 'Attention (Amber)')
                            : (language === 'hi' ? 'सामान्य (Green)' : 'Normal (Green)')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Proceed Button */}
              <button
                onClick={() => setWizardStep(2)}
                className="w-full mt-5 bg-[#B0306A] hover:bg-[#972659] text-white font-bold py-3.5 px-4 rounded-xl text-base shadow-md transition flex items-center justify-center gap-2 min-h-[56px]"
              >
                <span>
                  {language === 'hi'
                    ? `${targetPatient.name} की विज़िट दर्ज करें`
                    : `Record Visit for ${targetPatient.name}`}
                </span>
                <Send className="w-4 h-4 rotate-45" />
              </button>
            </div>
          )}

          {/* STEP 2: VOICE, TYPED OR DIRECT FORM INPUT */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
                {/* Header with back */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{language === 'hi' ? 'माता बदलें' : 'Back'}</span>
                  </button>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#1E2A4A] block">
                      {targetPatient.name} ({targetPatient.gestationalWeeks}{' '}
                      {language === 'hi' ? 'सप्ताह' : 'wks'})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'hi' ? 'चरण 2/4: विज़िट इनपुट' : 'Step 2/4: Visit Input'}
                    </span>
                  </div>
                </div>

                {/* 3 Input Mode Tabs: Voice, Typing, Form */}
                <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1 mb-5">
                  <button
                    type="button"
                    onClick={() => setInputMethod('VOICE')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                      inputMethod === 'VOICE'
                        ? 'bg-white text-[#B0306A] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mic className="w-4 h-4 text-[#B0306A]" />
                    <span>{language === 'hi' ? '1. आवाज़ (Voice)' : 'Voice'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMethod('TYPING')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                      inputMethod === 'TYPING'
                        ? 'bg-white text-[#B0306A] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Keyboard className="w-4 h-4 text-blue-600" />
                    <span>{language === 'hi' ? '2. टाइपिंग (Type)' : 'Typing'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMethod('FORM')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                      inputMethod === 'FORM'
                        ? 'bg-white text-[#B0306A] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'hi' ? '3. सीधा फॉर्म (Form)' : 'Direct Form'}</span>
                  </button>
                </div>

                {/* MODE A: VOICE INPUT */}
                {inputMethod === 'VOICE' && (
                  <div className="space-y-4">
                    <div className="text-center py-1">
                      <h3 className="text-lg sm:text-xl font-bold font-heading text-[#1E2A4A]">
                        {language === 'hi' ? 'विज़िट रिपोर्ट बोलें (Voice Recording)' : 'Speak Visit Report'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
                        {language === 'hi'
                          ? 'रक्तचाप (BP), लक्षण व शिकायतें हिंदी या हिंग्लिश में बोलें'
                          : 'Speak BP readings and symptoms in Hindi or Hinglish'}
                      </p>
                    </div>

                    {/* Large Central Microphone */}
                    <div className="my-5 flex flex-col items-center justify-center">
                      <div className="relative">
                        {isRecording && (
                          <>
                            <div className="absolute -inset-4 rounded-full bg-rose-400/25 animate-ping"></div>
                            <div className="absolute -inset-2 rounded-full bg-rose-500/30 animate-pulse"></div>
                          </>
                        )}
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                            isRecording
                              ? 'bg-red-600 text-white shadow-red-200'
                              : 'bg-[#B0306A] hover:bg-[#972659] text-white shadow-rose-200'
                          }`}
                        >
                          {isRecording ? (
                            <>
                              <MicOff className="w-10 h-10 animate-bounce" />
                              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                                {language === 'hi' ? 'रोकें' : 'Stop'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-10 h-10" />
                              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                                {language === 'hi' ? 'बोलें' : 'Speak'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Recording timer & status */}
                      <div className="mt-3 text-center">
                        {isRecording ? (
                          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-semibold border border-red-200">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            <span>
                              {language === 'hi' ? 'रिकॉर्डिंग चालू है:' : 'Recording:'}{' '}
                              {recordDuration}s
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {language === 'hi'
                              ? 'माइक पर टैप करके बोलना शुरू करें'
                              : 'Tap microphone to speak'}
                          </span>
                        )}
                      </div>

                      {micError && (
                        <div className="mt-3 text-xs bg-amber-50 text-amber-900 p-2.5 rounded-xl border border-amber-200 text-center max-w-md">
                          <p className="font-semibold">{micError}</p>
                        </div>
                      )}
                    </div>

                    {/* Quick Demo Test Phrases */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-[#B0306A]" />
                          {language === 'hi' ? 'डेमो टेस्ट वाक्य (एक क्लिक में चुनें):' : 'Demo Test Phrases (1-click fill):'}
                        </span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                          सिमुलेशन
                        </span>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => setInputText(DEMO_TEST_PHRASE)}
                          className="w-full text-left text-xs bg-white hover:bg-rose-50/70 p-2.5 rounded-lg border border-rose-200 transition flex items-start gap-2 group"
                        >
                          <span className="shrink-0 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            RED SCENARIO
                          </span>
                          <span className="text-[#1E2A4A] font-medium group-hover:text-[#B0306A]">
                            "{DEMO_TEST_PHRASE}"
                          </span>
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => setInputText(DEMO_NORMAL_PHRASE)}
                            className="text-left text-xs bg-white hover:bg-emerald-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition flex items-start gap-1.5"
                          >
                            <span className="shrink-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              GREEN
                            </span>
                            <span className="truncate">"{DEMO_NORMAL_PHRASE}"</span>
                          </button>

                          <button
                            onClick={() => setInputText(DEMO_AMBER_PHRASE)}
                            className="text-left text-xs bg-white hover:bg-amber-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition flex items-start gap-1.5"
                          >
                            <span className="shrink-0 bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              AMBER
                            </span>
                            <span className="truncate">"{DEMO_AMBER_PHRASE}"</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Spoken Text Preview */}
                    {inputText && (
                      <div className="p-3 bg-white rounded-xl border border-slate-300">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                          {language === 'hi' ? 'पहचाना गया टेक्स्ट:' : 'Captured Transcript:'}
                        </span>
                        <p className="text-sm font-medium text-slate-800 italic">"{inputText}"</p>
                      </div>
                    )}

                    {/* Action: Process with Gemini */}
                    <button
                      disabled={isExtracting || !inputText.trim()}
                      onClick={handleProcessWithGemini}
                      className="w-full bg-[#B0306A] hover:bg-[#972659] disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl text-base shadow-md transition flex items-center justify-center gap-2 min-h-[56px]"
                    >
                      {isExtracting ? (
                        <>
                          <Sparkles className="w-5 h-5 animate-spin text-amber-300" />
                          <span>
                            {language === 'hi'
                              ? 'Gemini समझ रहा है (कृपया प्रतीक्षा करें)...'
                              : 'Gemini Extracting (Please wait)...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-amber-300" />
                          <span>
                            {language === 'hi' ? 'AI से समझें (आगे बढ़ें)' : 'Analyze with Gemini AI'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* MODE B: TYPING INPUT */}
                {inputMethod === 'TYPING' && (
                  <div className="space-y-4">
                    <div className="text-center py-1">
                      <h3 className="text-lg sm:text-xl font-bold font-heading text-[#1E2A4A]">
                        {language === 'hi' ? 'विज़िट रिपोर्ट टाइप करें' : 'Type Visit Report'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {language === 'hi'
                          ? 'हिंदी या हिंग्लिश में विवरण लिखें, AI संख्या और लक्षण स्वतः समझेगा'
                          : 'Type maternal vitals and symptoms in Hindi or Hinglish'}
                      </p>
                    </div>

                    {/* Quick Demo Test Phrases */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                      <span className="font-bold text-slate-700 block">
                        {language === 'hi' ? 'त्वरित टेस्ट वाक्य (क्लिक करें):' : 'Quick Samples:'}
                      </span>
                      <button
                        onClick={() => setInputText(DEMO_TEST_PHRASE)}
                        className="w-full text-left p-2 bg-white rounded border border-rose-200 text-rose-900 font-medium hover:bg-rose-50"
                      >
                        "{DEMO_TEST_PHRASE}"
                      </button>
                      <button
                        onClick={() => setInputText(DEMO_NORMAL_PHRASE)}
                        className="w-full text-left p-2 bg-white rounded border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                      >
                        "{DEMO_NORMAL_PHRASE}"
                      </button>
                    </div>

                    <textarea
                      rows={4}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        language === 'hi'
                          ? 'उदा. "BP ek sau saath by ek sau das, sar mein dard hai, aankhon ke aage dhundhla dikh raha hai."'
                          : 'e.g. "BP ek sau saath by ek sau das, sar mein dard hai..."'
                      }
                      className="w-full p-3 rounded-xl border border-slate-300 text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#B0306A]/30 resize-none bg-white"
                    />

                    {/* Action: Process with Gemini */}
                    <button
                      disabled={isExtracting || !inputText.trim()}
                      onClick={handleProcessWithGemini}
                      className="w-full bg-[#B0306A] hover:bg-[#972659] disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl text-base shadow-md transition flex items-center justify-center gap-2 min-h-[56px]"
                    >
                      {isExtracting ? (
                        <>
                          <Sparkles className="w-5 h-5 animate-spin text-amber-300" />
                          <span>
                            {language === 'hi'
                              ? 'Gemini समझ रहा है (कृपया प्रतीक्षा करें)...'
                              : 'Gemini Extracting (Please wait)...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-amber-300" />
                          <span>
                            {language === 'hi' ? 'AI से समझें (आगे बढ़ें)' : 'Analyze with Gemini AI'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* MODE C: DIRECT STRUCTURED FORM ENTRY */}
                {inputMethod === 'FORM' && (
                  <div className="space-y-4">
                    <div className="text-center py-1">
                      <h3 className="text-lg sm:text-xl font-bold font-heading text-[#1E2A4A] flex items-center justify-center gap-1.5">
                        <ClipboardList className="w-5 h-5 text-emerald-600" />
                        <span>{language === 'hi' ? 'सीधा नैदानिक फॉर्म भरें' : 'Direct Antenatal Clinical Form'}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {language === 'hi'
                          ? 'रक्तचाप व लक्षण सीधे दर्ज करें। फॉर्म भरते ही क्लिनिकल नियम स्वतः लागू होंगे।'
                          : 'Directly record maternal vitals and checklist symptoms.'}
                      </p>
                    </div>

                    {/* Blood Pressure Inputs */}
                    <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200">
                      <label className="text-xs font-bold text-[#1E2A4A] block mb-2">
                        {language === 'hi' ? 'रक्तचाप (Blood Pressure) - mmHg' : 'Blood Pressure (mmHg)'}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                            {language === 'hi' ? 'सिस्टोलिक (Systolic)' : 'Systolic'}
                          </span>
                          <input
                            type="number"
                            value={formSystolic}
                            onChange={(e) => setFormSystolic(e.target.value)}
                            placeholder="160"
                            className="w-full p-2.5 text-lg font-bold text-[#1E2A4A] bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#B0306A]/30 focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                            {language === 'hi' ? 'डायस्टोलिक (Diastolic)' : 'Diastolic'}
                          </span>
                          <input
                            type="number"
                            value={formDiastolic}
                            onChange={(e) => setFormDiastolic(e.target.value)}
                            placeholder="110"
                            className="w-full p-2.5 text-lg font-bold text-[#1E2A4A] bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#B0306A]/30 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Gestational Weeks & Weight */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          {language === 'hi' ? 'गर्भ के सप्ताह (Weeks)' : 'Gestational Weeks'}
                        </label>
                        <input
                          type="number"
                          value={formWeeks}
                          onChange={(e) => setFormWeeks(e.target.value)}
                          placeholder="34"
                          className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white rounded-lg border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          {language === 'hi' ? 'माता का वजन (Weight kg)' : 'Weight (kg)'}
                        </label>
                        <input
                          type="number"
                          value={formWeight}
                          onChange={(e) => setFormWeight(e.target.value)}
                          placeholder="54"
                          className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white rounded-lg border border-slate-300"
                        />
                      </div>
                    </div>

                    {/* Symptoms Toggle Chips */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        {language === 'hi'
                          ? 'लक्षण व खतरे के संकेत (टैप करके चुनें):'
                          : 'Danger Signs & Symptoms (Tap to toggle):'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {COMMON_SYMPTOMS_LIST.map((sym) => {
                          const isSelected = formSymptoms.includes(sym.id);
                          return (
                            <button
                              key={sym.id}
                              type="button"
                              onClick={() => toggleFormSymptom(sym.id)}
                              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between text-left transition ${
                                isSelected
                                  ? sym.isDanger
                                    ? 'bg-red-100 text-red-900 border-red-400 font-bold ring-1 ring-red-400'
                                    : 'bg-rose-100 text-[#B0306A] border-rose-300 font-bold'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span>{language === 'hi' ? sym.labelHi : sym.id}</span>
                              {isSelected ? (
                                <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                              ) : (
                                <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0"></span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Observations Notes */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {language === 'hi' ? 'टिप्पणी व अवलोकन:' : 'Observations / Notes:'}
                      </label>
                      <textarea
                        rows={2}
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder={
                          language === 'hi'
                            ? 'उदा. IFA गोलियां ले रही हैं, पेशाब में प्रोटीन जाँच बाकी है।'
                            : 'e.g. Taking IFA tablets, urine protein test overdue.'
                        }
                        className="w-full p-2.5 text-xs text-slate-800 bg-white rounded-lg border border-slate-300 focus:outline-none"
                      />
                    </div>

                    {/* Direct Form Submit Button */}
                    <button
                      type="button"
                      onClick={handleProceedFromForm}
                      className="w-full bg-[#2F7D4F] hover:bg-[#25653f] text-white font-bold py-3.5 px-4 rounded-xl text-base shadow-md transition flex items-center justify-center gap-2 min-h-[56px]"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                      <span>
                        {language === 'hi'
                          ? 'समीक्षा एवं पुष्टि हेतु आगे बढ़ें'
                          : 'Proceed to Review & Confirm'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* TESTS TRACKER CARD FOR TARGET MOTHER (Done vs Pending) */}
              <TestsTrackerCard
                patientId={targetPatient.id}
                patientName={targetPatient.name}
                tests={targetPatient.tests || []}
                allowEdit={true}
              />
            </div>
          )}

          {/* STEP 3: "AI ने यह समझा" (REVIEW & EDIT EXTRACTION) */}
          {wizardStep === 3 && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <button
                  onClick={() => setWizardStep(2)}
                  className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{language === 'hi' ? 'वापस बदलें' : 'Back'}</span>
                </button>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full">
                  {language === 'hi' ? 'चरण 3/4: पुष्टि करें' : 'Step 3/4: Review'}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#B0306A]" />
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#1E2A4A]">
                    {language === 'hi' ? 'AI ने यह समझा' : 'AI Extracted Findings'}
                  </h2>
                </div>
                <p className="text-xs sm:text-slate-500 mt-1">
                  {language === 'hi'
                    ? 'कृपया हर मान की समीक्षा करें। आप सीधे टैप करके सुधार सकती हैं।'
                    : 'Review each item carefully. You can edit values before final confirmation.'}
                </p>
              </div>

              {/* Original spoken transcript recap */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block mb-0.5">
                  {language === 'hi' ? 'मूल ऑडियो/टेक्स्ट रिपोर्ट:' : 'Original Spoken Report:'}
                </span>
                <p className="italic font-serif">"{inputText}"</p>
              </div>

              {/* Actionable error banner if AI was unavailable */}
              {extractionError && (
                <div className="mb-4 space-y-1">
                  <AiOfflineBanner language={language} />
                  <p className="text-[11px] text-slate-500 px-1">
                    {language === 'hi'
                      ? 'कृपया नीचे मान स्वयं दर्ज करें। पुष्टि करने पर क्लिनिकल नियम लागू होंगे।'
                      : 'Enter the values below manually. Clinical rules run when you confirm.'}
                  </p>
                </div>
              )}

              {/* Editable Vital Fields */}
              <div className="space-y-4">
                {/* Blood Pressure Systolic & Diastolic */}
                <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200/80">
                  <label className="text-xs font-bold text-[#1E2A4A] block mb-2">
                    {language === 'hi' ? 'रक्तचाप (Blood Pressure - mmHg)' : 'Blood Pressure (mmHg)'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                        {language === 'hi' ? 'सिस्टोलिक (Systolic)' : 'Systolic (Top)'}
                      </span>
                      <input
                        type="number"
                        value={editableSystolic}
                        onChange={(e) => setEditableSystolic(e.target.value)}
                        placeholder={language === 'hi' ? 'उपलब्ध नहीं' : 'Not provided'}
                        className="w-full p-2.5 text-lg font-bold text-[#1E2A4A] bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#B0306A]/30 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                        {language === 'hi' ? 'डायस्टोलिक (Diastolic)' : 'Diastolic (Bottom)'}
                      </span>
                      <input
                        type="number"
                        value={editableDiastolic}
                        onChange={(e) => setEditableDiastolic(e.target.value)}
                        placeholder={language === 'hi' ? 'उपलब्ध नहीं' : 'Not provided'}
                        className="w-full p-2.5 text-lg font-bold text-[#1E2A4A] bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#B0306A]/30 focus:outline-none"
                      />
                    </div>
                  </div>
                  {editableSystolic && editableDiastolic && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        {language === 'hi' ? 'वर्तमान मान:' : 'Reading:'}{' '}
                        <strong>
                          {editableSystolic}/{editableDiastolic} mmHg
                        </strong>
                      </span>
                      {Number(editableSystolic) >= 160 || Number(editableDiastolic) >= 110 ? (
                        <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded">
                          {language === 'hi' ? 'तुरंत आवश्यक (Urgent)' : 'Urgent Action'}
                        </span>
                      ) : Number(editableSystolic) >= 140 || Number(editableDiastolic) >= 90 ? (
                        <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                          {language === 'hi' ? 'ध्यान दें (Attention)' : 'Attention Needed'}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                          {language === 'hi' ? 'सामान्य (Normal)' : 'Normal'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Gestational Weeks */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'गर्भ के सप्ताह (Gestational Weeks)' : 'Gestational Weeks'}
                  </label>
                  <input
                    type="number"
                    value={editableWeeks}
                    onChange={(e) => setEditableWeeks(e.target.value)}
                    placeholder={
                      language === 'hi' ? 'उपलब्ध नहीं (Not provided)' : 'Not provided'
                    }
                    className="w-full p-2.5 text-base font-semibold text-[#1E2A4A] bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#B0306A]/30"
                  />
                </div>

                {/* Symptoms Chips */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi'
                      ? 'पहचाने गए लक्षण (Symptoms Chips)'
                      : 'Extracted Symptoms (Chips)'}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editableSymptoms.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">
                        {language === 'hi' ? 'कोई लक्षण नहीं बताया गया' : 'No symptoms mentioned'}
                      </span>
                    ) : (
                      editableSymptoms.map((sym, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-rose-100 text-[#B0306A] text-xs font-bold px-3 py-1.5 rounded-full border border-rose-200"
                        >
                          <span>{sym}</span>
                          <button
                            onClick={() => handleRemoveSymptom(idx)}
                            className="hover:text-red-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add symptom manually */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSymptomText}
                      onChange={(e) => setNewSymptomText(e.target.value)}
                      placeholder={
                        language === 'hi' ? '+ नया लक्षण जोड़ें...' : '+ Add symptom...'
                      }
                      className="flex-1 p-2 text-xs rounded-lg border border-slate-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSymptom}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-800 rounded-lg"
                    >
                      {language === 'hi' ? 'जोड़ें' : 'Add'}
                    </button>
                  </div>
                </div>

                {/* Other observations */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'अन्य टिप्पणी / आहार / पोषण' : 'Other Observations'}
                  </label>
                  <input
                    type="text"
                    value={editableObservations}
                    onChange={(e) => setEditableObservations(e.target.value)}
                    placeholder={
                      language === 'hi' ? 'जैसे: IFA गोली ले रही हैं' : 'e.g. Taking IFA tablets'
                    }
                    className="w-full p-2.5 text-xs text-slate-800 bg-white rounded-lg border border-slate-300"
                  />
                </div>

                {/* Extra clinical inputs (MUAC, swelling, urine, Hb, SFH, vitals...) */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'hi' ? 'अतिरिक्त जाँच व माप' : 'Additional findings'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddMoreOpen(true)}
                      className="px-3 py-1.5 bg-[#1E2A4A] hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                    >
                      ➕ {language === 'hi' ? 'और जोड़ें' : 'Add more'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-600">
                      {language === 'hi' ? 'वजन (kg)' : 'Weight (kg)'}
                      <input
                        type="number"
                        value={editableWeight}
                        onChange={(e) => setEditableWeight(e.target.value)}
                        className="mt-0.5 w-full p-2 text-xs bg-white rounded-lg border border-slate-300"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">
                      {language === 'hi' ? 'शिशु की हलचल' : 'Fetal movement'}
                      <select
                        value={fetalMovementStatus ?? ''}
                        onChange={(e) => setFetalMovementStatus((e.target.value || null) as FetalMovementStatus | null)}
                        className="mt-0.5 w-full p-2 text-xs bg-white rounded-lg border border-slate-300"
                      >
                        <option value="">{language === 'hi' ? 'दर्ज नहीं' : 'Not recorded'}</option>
                        <option value="normal">{language === 'hi' ? 'सामान्य' : 'Normal'}</option>
                        <option value="reduced">{language === 'hi' ? 'कम' : 'Reduced'}</option>
                        <option value="absent">{language === 'hi' ? 'महसूस नहीं' : 'Absent'}</option>
                      </select>
                    </label>
                  </div>
                  {(() => {
                    const chips: string[] = [];
                    if (extraInputs.swellingType && extraInputs.swellingType !== 'none') chips.push(`Swelling: ${extraInputs.swellingType}`);
                    if (extraInputs.urineProtein) chips.push(`Urine protein: ${extraInputs.urineProtein}`);
                    if (extraInputs.urineSugar) chips.push(`Urine sugar: ${extraInputs.urineSugar}`);
                    if (extraInputs.muacCm != null) chips.push(`MUAC: ${extraInputs.muacCm} cm`);
                    if (extraInputs.hbGdl != null) chips.push(`Hb: ${extraInputs.hbGdl} g/dL`);
                    if (extraInputs.pallor === true) chips.push('Pallor');
                    if (extraInputs.sfhCm != null) chips.push(`SFH: ${extraInputs.sfhCm} cm`);
                    if (extraInputs.babyPosition) chips.push(`Position: ${extraInputs.babyPosition}`);
                    if (extraInputs.ifaAdherencePercent != null) chips.push(`IFA: ${extraInputs.ifaAdherencePercent}%`);
                    if (extraInputs.tdDoses) chips.push(`Td: ${extraInputs.tdDoses}`);
                    if (extraInputs.bloodSugarMgDl != null) chips.push(`Sugar: ${extraInputs.bloodSugarMgDl} mg/dL`);
                    if (extraInputs.pulseBpm != null) chips.push(`Pulse: ${extraInputs.pulseBpm}`);
                    if (extraInputs.tempF != null) chips.push(`Temp: ${extraInputs.tempF}°F`);
                    if (extraInputs.spo2Percent != null) chips.push(`SpO₂: ${extraInputs.spo2Percent}%`);
                    return chips.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {chips.map((c) => (
                          <span key={c} className="text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded-md">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        {language === 'hi' ? 'कोई अतिरिक्त माप दर्ज नहीं।' : 'No additional findings recorded.'}
                      </p>
                    );
                  })()}
                </div>

                {/* Uncertain Fields Warning */}
                {uncertainFields.length > 0 && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      <span>
                        {language === 'hi' ? 'अस्पष्ट क्षेत्र (Uncertain fields):' : 'Uncertain fields in audio:'}
                      </span>
                    </div>
                    <p>
                      {uncertainFields.join(', ')} -{' '}
                      {language === 'hi'
                        ? 'कृपया सहेजने से पहले जांच लें।'
                        : 'Please verify the values before saving.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm and Save Button */}
              <button
                onClick={handleConfirmAndSave}
                className="w-full mt-6 bg-[#2F7D4F] hover:bg-[#25653f] text-white font-bold py-3.5 px-4 rounded-xl text-base shadow-lg transition flex items-center justify-center gap-2 min-h-[56px]"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>
                  {language === 'hi'
                    ? 'पुष्टि करें और सहेजें (Confirm & Save)'
                    : 'Confirm and Save Visit'}
                </span>
              </button>

              {isAddMoreOpen && (
                <VisitAddMoreModal
                  isOpen={isAddMoreOpen}
                  onClose={() => setIsAddMoreOpen(false)}
                  initialValues={extraInputs}
                  onApply={setExtraInputs}
                  language={language}
                  gestationalWeeks={editableWeeks ? Number(editableWeeks) : targetPatient.gestationalWeeks}
                />
              )}
            </div>
          )}

          {/* STEP 4: RESULT PAGE & ALERT STATUS */}
          {wizardStep === 4 && (submittedVisit || targetPatient.visits[0]) && (() => {
            const liveTargetPatient = patients.find((p) => p.id === targetPatient.id) || targetPatient;
            const liveSubmittedVisit = submittedVisit
              ? liveTargetPatient.visits.find((v) => v.id === submittedVisit.id) || submittedVisit
              : liveTargetPatient.visits[0];

            if (!liveSubmittedVisit) return null;

            return (
            <div className="space-y-4">
              {/* Giant Severity Banner: Color + Icon + Explicit text */}
              <div
                className={`rounded-2xl p-5 sm:p-6 shadow-md border-2 ${
                  liveSubmittedVisit.finalSeverity === 'RED'
                    ? 'bg-red-50 border-red-600 text-red-950'
                    : liveSubmittedVisit.finalSeverity === 'AMBER'
                    ? 'bg-amber-50 border-amber-500 text-amber-950'
                    : 'bg-emerald-50 border-emerald-600 text-emerald-950'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                      liveSubmittedVisit.finalSeverity === 'RED'
                        ? 'bg-red-600 text-white animate-pulse'
                        : liveSubmittedVisit.finalSeverity === 'AMBER'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    <AlertTriangle className="w-8 h-8" />
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block opacity-75">
                      {language === 'hi' ? 'नैदानिक निर्णय सहायता' : 'Deterministic Clinical Result'}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold font-heading">
                      {liveSubmittedVisit.finalSeverity === 'RED' &&
                        (language === 'hi'
                          ? 'तुरंत आवश्यक (Urgent): तत्काल डॉक्टर समीक्षा आवश्यक'
                          : 'URGENT: Immediate Doctor Review Required')}
                      {liveSubmittedVisit.finalSeverity === 'AMBER' &&
                        (language === 'hi'
                          ? 'ध्यान दें (Attention): डॉक्टर से जांच आवश्यक'
                          : 'ATTENTION: Medical Review Needed')}
                      {liveSubmittedVisit.finalSeverity === 'GREEN' &&
                        (language === 'hi'
                          ? 'सामान्य (Normal): नियमित देखभाल जारी रखें'
                          : 'NORMAL: Routine Antenatal Care')}
                    </h2>
                  </div>
                </div>

                {/* Exact Deterministic Triggers */}
                <div className="mt-4 pt-3 border-t border-black/10">
                  <span className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-80">
                    {language === 'hi' ? 'नियम ट्रिगर का कारण:' : 'Exact Rule Triggers:'}
                  </span>
                  <ul className="space-y-1 text-sm font-semibold">
                    {liveSubmittedVisit.ruleTriggers.map((trig, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{trig}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Overall mother level = worst(rule, trend, AI) + trend flags + risk tags */}
                <div className="mt-3 pt-3 border-t border-black/10 space-y-1.5 text-xs">
                  <div className="font-bold">
                    {language === 'hi' ? 'माता का कुल स्तर (नियम + रुझान):' : 'Overall mother level (rules + trends):'}{' '}
                    <span>{liveTargetPatient.overallLevel || liveSubmittedVisit.finalSeverity}</span>
                  </div>
                  {(liveTargetPatient.trendFlags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(liveTargetPatient.trendFlags || []).map((flag) => (
                        <span key={flag.id} className="bg-white/70 border border-black/10 px-2 py-0.5 rounded-md font-semibold">
                          {flag.direction} {language === 'hi' ? flag.labelHindi : flag.labelEnglish} ({flag.valuesSummary})
                        </span>
                      ))}
                    </div>
                  )}
                  {(liveTargetPatient.riskTags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(liveTargetPatient.riskTags || []).map((tag) => (
                        <span key={tag} className="bg-white/70 border border-black/10 px-2 py-0.5 rounded-md font-bold">
                          🏷️ {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Doctor Alert Status Pill & Workflow */}
              {liveSubmittedVisit.finalSeverity === 'RED' && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    {language === 'hi' ? 'डॉक्टर अलर्ट स्थिति (Live Workflow Status):' : 'Doctor Alert Status:'}
                  </span>

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                        liveSubmittedVisit.alertStatus === 'Doctor responded'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : liveSubmittedVisit.alertStatus === 'Acknowledged by doctor'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      <span>
                        {liveSubmittedVisit.alertStatus === 'Doctor responded' &&
                          (language === 'hi' ? 'डॉक्टर की सलाह प्राप्त हुई' : 'Doctor Responded')}
                        {liveSubmittedVisit.alertStatus === 'Acknowledged by doctor' &&
                          (language === 'hi' ? 'डॉक्टर द्वारा स्वीकृत' : 'Acknowledged by Doctor')}
                        {(liveSubmittedVisit.alertStatus === 'Visible in demo' ||
                          liveSubmittedVisit.alertStatus === 'Created') &&
                          (language === 'hi'
                            ? 'डेमो में दृश्यमान (अलर्ट भेजा गया)'
                            : 'Visible in demo (Alert Sent)')}
                      </span>
                    </span>

                    <span className="text-xs text-slate-500">
                      {liveSubmittedVisit.acknowledgedBy
                        ? `(${liveSubmittedVisit.acknowledgedBy})`
                        : (language === 'hi' ? 'डॉक्टर की प्रतिक्रिया प्रतीक्षारत...' : 'Waiting for Doctor...')}
                    </span>
                  </div>

                  {/* Doctor's Advice Box (if sent) */}
                  {liveSubmittedVisit.doctorAdvice ? (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mt-2">
                      <div className="flex items-center gap-2 text-purple-900 font-bold text-sm mb-1">
                        <Stethoscope className="w-4 h-4 text-purple-700" />
                        <span>
                          {language === 'hi' ? 'डॉक्टर का लिखित निर्देश:' : 'Doctor Advice Received:'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-purple-950 bg-white p-3 rounded-lg border border-purple-100">
                        "{liveSubmittedVisit.doctorAdvice.message}"
                      </p>
                      <div className="mt-2 text-[11px] text-purple-700 flex justify-between">
                        <span>{liveSubmittedVisit.doctorAdvice.doctorName}</span>
                        <span>{new Date(liveSubmittedVisit.doctorAdvice.sentAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        {language === 'hi'
                          ? 'सलाह मिलने पर यह स्क्रीन और माता की स्क्रीन अपने आप अपडेट हो जाएगी।'
                          : 'When doctor responds, advice will automatically appear here and on Mother screen.'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Emergency Call 108 & 102 Buttons */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
                <span className="text-xs font-bold text-slate-600 block mb-2">
                  {language === 'hi' ? 'आपातकालीन सहायता (Emergency Calls):' : 'Emergency Dispatch Calls:'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href="tel:108"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow transition min-h-[56px]"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{getTranslation('call108', language)}</span>
                  </a>

                  <a
                    href="tel:102"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-[#1E2A4A] hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow transition min-h-[56px]"
                  >
                    <PhoneCall className="w-4 h-4 text-amber-300" />
                    <span>{getTranslation('call102', language)}</span>
                  </a>
                </div>

                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  {getTranslation('seekInPersonCare', language)}
                </p>
              </div>

              {/* ANC Tests Tracker in Step 4 */}
              <TestsTrackerCard
                patientId={liveSubmittedVisit.patientId}
                patientName={targetPatient.name}
                tests={targetPatient.tests || []}
                allowEdit={true}
              />

              {/* Route back home / fresh visit */}
              <div className="flex gap-3">
                <button
                  onClick={handleStartFreshVisit}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-[#1E2A4A] rounded-xl font-bold text-sm transition text-center min-h-[56px] flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'hi' ? 'अन्य विज़िट दर्ज करें' : 'Record Another Visit'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('MY_MOTHERS')}
                  className="flex-1 py-3 px-4 bg-[#B0306A] hover:bg-[#972659] text-white rounded-xl font-bold text-sm transition text-center min-h-[56px] flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>{language === 'hi' ? 'माता सूची देखें' : 'View Mothers'}</span>
                </button>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2: MY MOTHERS (WORKLIST & VISIT-STARTING POINT) */}
      {activeTab === 'MY_MOTHERS' && (
        <div className="space-y-4">
          <TodayVisitsTile onStartVisit={handleStartVisitForMother} />

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            {/* Header: Title, Sort Subtitle, and Proactive Scan Trigger */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#1E2A4A] flex items-center gap-2">
                  <Users className="w-6 h-6 text-[#B0306A]" />
                  <span>{language === 'hi' ? 'मेरी माताएँ (कार्यसूची / Worklist)' : 'My Mothers & Daily Worklist'}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'hi'
                    ? 'सुनीता ताई के अधीन पंजीकृत माताएँ • स्वतः क्रमित: अतिदेय फॉलो-अप पहले, फिर रेड अलर्ट, फिर नियमित'
                    : 'Assigned under ASHA Sunita Tai • Sorted: Overdue follow-up first, then RED/unresolved, then routine'}
                </p>
              </div>

              {/* Header Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="px-4 py-2.5 bg-[#2F7D4F] hover:bg-[#25653f] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-emerald-200" />
                  <span>{language === 'hi' ? '➕ नई गर्भवती माता का पंजीकरण' : '+ Register New Mother'}</span>
                </button>

                {/* Proactive Scan Button */}
                <button
                  onClick={() => runMotherScan(true)}
                  disabled={isScanningMothers}
                  className="px-3.5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 text-amber-300 ${isScanningMothers ? 'animate-spin' : ''}`} />
                  <span>
                    {isScanningMothers
                      ? (language === 'hi' ? 'स्कैन जारी है...' : 'Scanning cohort...')
                      : (language === 'hi' ? '🔍 सभी माताओं की जांच (AI Scan)' : '🔍 Scan All Mothers (AI)')}
                  </span>
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'hi' ? 'नाम या गाँव से खोजें...' : 'Search by mother name or village...'}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#B0306A]"
              />
            </div>

            {/* Worklist Table (Strictly 6 columns per Priority 6) */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">
                      {language === 'hi' ? 'गंभीरता' : 'Severity'}
                    </th>
                    <th className="py-3 px-3.5">
                      {language === 'hi' ? 'माता का नाम व गाँव' : 'Name & Village'}
                    </th>
                    <th className="py-3 px-3">
                      {language === 'hi' ? 'गर्भ सप्ताह' : 'Gestational Week'}
                    </th>
                    <th className="py-3 px-3">
                      {language === 'hi' ? 'अंतिम विज़िट' : 'Last Visit Date'}
                    </th>
                    <th className="py-3 px-3">
                      {language === 'hi' ? 'अगला फॉलो-अप' : 'Next Follow-up Due'}
                    </th>
                    <th className="py-3 px-3 text-right">
                      {language === 'hi' ? 'डॉक्टर स्थिति व विज़िट' : 'Doctor Status & Visit'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sortedWorklistMothers.map((patient) => {
                    const latestVisit = patient.visits[0];
                    const ruleSev = latestVisit?.ruleSeverity || 'GREEN';
                    const overallLevel = patient.overallLevel || ruleSev;
                    const overdue = isMotherOverdue(patient);
                    const docStatus = getDoctorStatus(patient);

                    // Check if flagged as hidden risk
                    const scanItem = aiScanResults.find((s) => s.patientId === patient.id);
                    const isAiHiddenRisk = patient.riskSource === 'AI_HIDDEN' || scanItem?.hiddenRisk === true;
                    const isTrendHiddenRisk = !isAiHiddenRisk && Boolean(patient.hiddenTrendRisk);

                    // Days since visit
                    const daysAgo = latestVisit
                      ? Math.floor((Date.now() - new Date(latestVisit.timestamp).getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <tr
                        key={patient.id}
                        className={`hover:bg-slate-50/80 transition ${
                          overallLevel === 'RED'
                            ? 'bg-red-50/20'
                            : overdue
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        {/* 1. Severity Badge (color + icon + text) */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                              overallLevel === 'RED'
                                ? 'bg-red-600 text-white'
                                : overallLevel === 'AMBER'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            <span>
                              {overallLevel === 'RED'
                                ? (language === 'hi' ? '🔴 तुरंत आवश्यक' : '🔴 URGENT')
                                : overallLevel === 'AMBER'
                                ? (language === 'hi' ? '🟡 ध्यान दें' : '🟡 ATTENTION')
                                : (language === 'hi' ? '🟢 सामान्य' : '🟢 NORMAL')}
                            </span>
                          </span>
                        </td>

                        {/* 2. Name + Village */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-sm text-[#1E2A4A]">{patient.name}</span>
                            {isAiHiddenRisk && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                <span>{language === 'hi' ? '🔍 AI ने पकड़ा' : '🔍 Caught by AI'}</span>
                              </span>
                            )}
                            {isTrendHiddenRisk && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                <span>{language === 'hi' ? '↗ रुझान से पकड़ा' : '↗ Caught by trend'}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {patient.age} {language === 'hi' ? 'वर्ष' : 'yrs'} • {patient.village} • G{patient.gravida}P{patient.para}
                          </div>
                          {scanItem?.reason && (
                            <p className="text-[11px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-200 mt-1 max-w-sm">
                              {scanItem.reason}
                            </p>
                          )}
                        </td>

                        {/* 3. Gestational Week */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold text-slate-800">{patient.gestationalWeeks} {language === 'hi' ? 'सप्ताह' : 'weeks'}</span>
                          <div className="text-[10px] text-slate-400">EDD: {patient.edd}</div>
                        </td>

                        {/* 4. Last Visit Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {daysAgo !== null ? (
                            <div>
                              <span className="font-semibold text-slate-800">
                                {daysAgo === 0
                                  ? (language === 'hi' ? 'आज' : 'Today')
                                  : daysAgo === 1
                                  ? (language === 'hi' ? 'कल' : 'Yesterday')
                                  : `${daysAgo} ${language === 'hi' ? 'दिन पहले' : 'days ago'}`}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                BP: {latestVisit?.systolicBp ?? '--'}/{latestVisit?.diastolicBp ?? '--'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">{language === 'hi' ? 'कोई विज़िट नहीं' : 'No visits'}</span>
                          )}
                        </td>

                        {/* 5. Next Follow-up Due Date with Overdue Flag */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {overdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                              <span>{language === 'hi' ? 'अतिदेय (Overdue)' : 'Overdue Visit'}</span>
                            </span>
                          ) : (
                            <span className="text-slate-700 font-medium text-[11px]">
                              {patient.nextFollowUpDate || (language === 'hi' ? 'अगले सप्ताह' : 'Next week')}
                            </span>
                          )}
                        </td>

                        {/* 6. Doctor Status & Start Visit Action */}
                        <td className="py-3 px-3 text-right whitespace-nowrap space-y-1">
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${docStatus.color}`}>
                              <span>{docStatus.label}</span>
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => handleStartVisitForMother(patient)}
                              className="px-3 py-1.5 bg-[#B0306A] hover:bg-[#972659] active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                            >
                              <span>🎙️</span>
                              <span>{language === 'hi' ? 'विज़िट शुरू करें' : 'Start Visit'}</span>
                            </button>
                            <button
                              onClick={() => {
                                setBirthPlanPatient(patient);
                                setIsBirthPlanModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-[#1E2A4A] text-xs font-bold rounded-xl border border-slate-300 transition inline-flex items-center gap-1.5"
                            >
                              <span>🏥</span>
                              <span>{language === 'hi' ? 'जन्म योजना' : 'Birth Plan'}</span>
                              {patient.birthPlan?.doctorApproved && <span className="text-emerald-600">✓</span>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALERTS & ADVICE */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-4">
          {/* Doctor-approved birth plans (notification to ASHA) */}
          {(() => {
            const approved = patients
              .filter((p) => p.birthPlan?.doctorApproved)
              .sort((a, b) =>
                (b.birthPlan?.doctorApprovedAt || '').localeCompare(a.birthPlan?.doctorApprovedAt || '')
              );
            if (approved.length === 0) return null;
            return (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-2">
                <h3 className="text-sm font-bold text-emerald-900">
                  {language === 'hi' ? '🏥 डॉक्टर द्वारा अनुमोदित जन्म योजनाएँ' : '🏥 Birth plans approved by doctor'}
                </h3>
                {approved.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setBirthPlanPatient(p);
                      setIsBirthPlanModalOpen(true);
                    }}
                    className="w-full text-left bg-white rounded-xl p-3 border border-emerald-200 text-xs hover:bg-emerald-50/50"
                  >
                    <div className="font-bold text-[#1E2A4A]">
                      {p.name} → {p.birthPlan?.deliveryPlace}
                      {p.birthPlan?.doctorChosenFacility && (
                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                          {language === 'hi' ? 'डॉक्टर ने सुविधा बदली' : 'Facility changed by doctor'}
                        </span>
                      )}
                    </div>
                    {p.birthPlan?.doctorNotes && <p className="text-slate-600 mt-0.5">{p.birthPlan.doctorNotes}</p>}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#1E2A4A] mb-1">
              {language === 'hi' ? 'सक्रिय अलर्ट एवं डॉक्टर सलाह' : 'Active Alerts & Doctor Advice'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'hi'
                ? 'तत्काल डॉक्टर समीक्षा के लिए भेजे गए अलर्ट'
                : 'Urgent visits and SOS alerts shared with Medical Officer'}
            </p>

            {urgentAlerts.totalUrgent === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {language === 'hi'
                    ? 'कोई सक्रिय आपातकालीन अलर्ट नहीं है।'
                    : 'No active urgent alerts at this moment.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'hi'
                    ? 'किसी माता की नई विज़िट दर्ज करें; खतरे के संकेत मिलने पर RED अलर्ट यहाँ दिखेगा।'
                    : 'Record a new visit; RED alerts appear here when danger signs are found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Urgent visits */}
                {urgentAlerts.visits.map(({ patient, visit }) => (
                  <div
                    key={visit.id}
                    className="p-4 rounded-xl border-2 border-red-500 bg-red-50/40"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-red-950">
                            {patient.name}
                          </h3>
                          <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded">
                            BP {visit.systolicBp}/{visit.diastolicBp} mmHg
                          </span>
                        </div>
                        <p className="text-xs text-red-800 mt-1">
                          {visit.ruleTriggers.join('; ')}
                        </p>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          visit.alertStatus === 'Doctor responded'
                            ? 'bg-purple-100 text-purple-800'
                            : visit.alertStatus === 'Acknowledged by doctor'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800 animate-pulse'
                        }`}
                      >
                        {visit.alertStatus}
                      </span>
                    </div>

                    {visit.doctorAdvice && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200 text-xs">
                        <span className="font-bold text-purple-900 block mb-0.5">
                          {language === 'hi' ? 'डॉक्टर की सलाह:' : "Doctor's Advice:"}
                        </span>
                        <p className="text-slate-800 font-medium">"{visit.doctorAdvice.message}"</p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          {visit.doctorAdvice.doctorName} •{' '}
                          {new Date(visit.doctorAdvice.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Emergency SOS alerts */}
                {urgentAlerts.sos.map((sos) => (
                  <div
                    key={sos.id}
                    className="p-4 rounded-xl border-2 border-red-600 bg-red-100 text-red-950"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />
                        <h4 className="font-bold text-sm">
                          {sos.patientName} - EMERGENCY SOS
                        </h4>
                      </div>
                      <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                        {sos.status}
                      </span>
                    </div>
                    <p className="text-xs text-red-900 mt-1">
                      {language === 'hi'
                        ? 'माता ने आपातकालीन SOS बटन दबाया है। कृपया तुरंत संपर्क करें।'
                        : 'Mother triggered Emergency SOS button. Contact family immediately.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isRegisterModalOpen && (
        <RegistrationWizardModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSave={registerNewMother}
          language={language}
        />
      )}

      {isBirthPlanModalOpen && birthPlanPatient && (
        <BirthPlanModal
          isOpen={isBirthPlanModalOpen}
          onClose={() => setIsBirthPlanModalOpen(false)}
          patient={patients.find((p) => p.id === birthPlanPatient.id) || birthPlanPatient}
          language={language}
        />
      )}
    </div>
  );
};
