import React, { useState, useEffect, useRef } from 'react';
import {
  Baby,
  Smile,
  Utensils,
  AlertCircle,
  Scale,
  Activity,
  Check,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Heart,
  Droplet,
} from 'lucide-react';
import { MotherProfile, MoodFace } from '../../types';
import { useDemo } from '../../context/DemoContext';

interface MotherSelfInputsCardProps {
  patient: MotherProfile;
  language: 'hi' | 'en';
}

export const MotherSelfInputsCard: React.FC<MotherSelfInputsCardProps> = ({
  patient,
  language,
}) => {
  const { logMotherSelfInputs } = useDemo();

  // Voice speech synthesis helper (Icon-only, no reading needed: spoken aloud on tap)
  const speak = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // 1. Kick Counter with 2-hour timer
  const [kickCount, setKickCount] = useState<number>(patient.dailyKickCount || 8);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // 2 hours = 7200 sec
  const [kickAlertMsg, setKickAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev >= 7200) {
            setIsTimerRunning(false);
            return 7200;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const handleTapKick = () => {
    const next = kickCount + 1;
    setKickCount(next);
    if (!isTimerRunning && elapsedSeconds === 0) {
      setIsTimerRunning(true);
    }
    speak(language === 'hi' ? `शिशु की हलचल। कुल ${next} बार।` : `Baby movement recorded. Total ${next} kicks.`);
  };

  const handleFinishKickSession = () => {
    setIsTimerRunning(false);
    const durationMins = Math.max(1, Math.round(elapsedSeconds / 60));
    logMotherSelfInputs(patient.id, 'KICK_SESSION', {
      count: kickCount,
      durationMinutes: durationMins >= 60 ? 120 : durationMins,
      isCompleted: true,
    });

    const baseline =
      patient.kickHistory7Days && patient.kickHistory7Days.length > 0
        ? patient.kickHistory7Days.reduce((acc, c) => acc + c.count, 0) / patient.kickHistory7Days.length
        : 10;

    if (kickCount < baseline * 0.5) {
      setKickAlertMsg(
        language === 'hi'
          ? '⚠️ हलचल में अत्यधिक गिरावट (50% से कम)! आशा दीदी और डॉक्टर को तुरंत लाल अलर्ट भेजा गया।'
          : '⚠️ Movement dropped below 50% baseline! Critical RED alert sent to ASHA.'
      );
      speak(language === 'hi' ? 'शिशु की हलचल बहुत कम है। आशा दीदी को तुरंत अलर्ट भेजा गया है।' : 'Critical low movement. ASHA alerted.');
    } else if (kickCount < 10) {
      setKickAlertMsg(
        language === 'hi'
          ? '⚠️ 2 घंटे में 10 से कम हलचल। आशा दीदी को पीला अलर्ट भेजा गया।'
          : '⚠️ Fewer than 10 kicks in 2 hours. Yellow alert sent to ASHA.'
      );
      speak(language === 'hi' ? 'हलचल 10 से कम है। आशा दीदी को सूचना भेजी गई है।' : 'Fewer than 10 kicks. ASHA notified.');
    } else {
      setKickAlertMsg(
        language === 'hi' ? '✓ शाबाश! शिशु की हलचल सामान्य है।' : '✓ Normal healthy baby movement recorded.'
      );
      speak(language === 'hi' ? 'शिशु की हलचल सामान्य है।' : 'Baby movements are normal.');
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 2. Mood (5 Emoji Faces once a day)
  const [selectedMood, setSelectedMood] = useState<MoodFace | null>(null);
  const moods: { face: MoodFace; emoji: string; labelHi: string; labelEn: string; isLow: boolean }[] = [
    { face: 'great', emoji: '😄', labelHi: 'बहुत खुश', labelEn: 'Very Happy', isLow: false },
    { face: 'good', emoji: '🙂', labelHi: 'अच्छा', labelEn: 'Good', isLow: false },
    { face: 'neutral', emoji: '😐', labelHi: 'सामान्य', labelEn: 'Neutral', isLow: false },
    { face: 'sad', emoji: '🙁', labelHi: 'उदास / चिंता', labelEn: 'Sad / Anxious', isLow: true },
    { face: 'crying', emoji: '😭', labelHi: 'बहुत परेशान / रोना', labelEn: 'Crying / Distressed', isLow: true },
  ];

  const handleSelectMood = (item: typeof moods[0]) => {
    setSelectedMood(item.face);
    speak(language === 'hi' ? `आज का मूड: ${item.labelHi}` : `Today mood: ${item.labelEn}`);
    logMotherSelfInputs(patient.id, 'MOOD', { mood: item.face });
  };

  // 3. Food Today: Meals count & protein foods
  const [mealsCount, setMealsCount] = useState<number>(3);
  const [proteinFoods, setProteinFoods] = useState<string[]>(['dal']);
  const proteinOptions = [
    { id: 'dal', labelHi: 'दाल', labelEn: 'Dal / Lentils', icon: '🍲' },
    { id: 'egg', labelHi: 'अंडा', labelEn: 'Egg', icon: '🥚' },
    { id: 'milk', labelHi: 'दूध / दही', labelEn: 'Milk / Curd', icon: '🥛' },
    { id: 'meat_fish', labelHi: 'मांस / मछली', labelEn: 'Meat / Fish', icon: '🐟' },
    { id: 'sprouts', labelHi: 'अंकुरित अनाज', labelEn: 'Sprouts', icon: '🌱' },
  ];

  const handleToggleProtein = (id: string, label: string) => {
    const updated = proteinFoods.includes(id)
      ? proteinFoods.filter((f) => f !== id)
      : [...proteinFoods, id];
    setProteinFoods(updated);
    speak(label);
    logMotherSelfInputs(patient.id, 'FOOD', { mealsCount, proteinFoods: updated });
  };

  const handleSelectMeals = (count: number) => {
    setMealsCount(count);
    speak(language === 'hi' ? `आज ${count} बार भोजन किया` : `${count} meals eaten today`);
    logMotherSelfInputs(patient.id, 'FOOD', { mealsCount: count, proteinFoods });
  };

  // 4. Vomiting Today (first trimester & general)
  const [vomitingStatus, setVomitingStatus] = useState<'none' | '1-2_times' | 'cannot_keep_down'>('none');
  const vomitOptions: { id: 'none' | '1-2_times' | 'cannot_keep_down'; emoji: string; labelHi: string; labelEn: string; isYellow: boolean }[] = [
    { id: 'none', emoji: '😊', labelHi: 'उल्टी नहीं हुई', labelEn: 'No vomiting', isYellow: false },
    { id: '1-2_times', emoji: '😐', labelHi: '1-2 बार उल्टी', labelEn: '1-2 times', isYellow: false },
    { id: 'cannot_keep_down', emoji: '🤢', labelHi: 'कुछ भी नहीं पच रहा (पानी भी नहीं)', labelEn: 'Cannot keep anything down', isYellow: true },
  ];

  const handleSelectVomiting = (opt: typeof vomitOptions[0]) => {
    setVomitingStatus(opt.id);
    speak(language === 'hi' ? opt.labelHi : opt.labelEn);
    logMotherSelfInputs(patient.id, 'VOMITING', { frequency: opt.id });
  };

  // 5. Home BP / Weight Machine Toggle
  const [hasHomeDevices, setHasHomeDevices] = useState(patient.selfLogs?.hasHomeDevices || false);
  const [homeWeight, setHomeWeight] = useState('');
  const [homeSystolic, setHomeSystolic] = useState('');
  const [homeDiastolic, setHomeDiastolic] = useState('');
  const [vitalsSaved, setVitalsSaved] = useState(false);

  const handleSaveHomeVitals = () => {
    logMotherSelfInputs(patient.id, 'SELF_VITALS', {
      weightKg: homeWeight ? parseFloat(homeWeight) : undefined,
      systolicBp: homeSystolic ? parseInt(homeSystolic, 10) : undefined,
      diastolicBp: homeDiastolic ? parseInt(homeDiastolic, 10) : undefined,
    });
    setVitalsSaved(true);
    speak(language === 'hi' ? 'घर की बीपी व वजन दर्ज हो गया। डॉक्टर इसे सेल्फ-रिपोर्टेड के रूप में देखेंगे।' : 'Home vitals recorded with Self-Reported tag.');
    setTimeout(() => setVitalsSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* SECTION 1: DAILY KICK COUNTER WITH 2-HOUR TIMER */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-rose-100 text-[#B0306A] flex items-center justify-center">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-[#1E2A4A]">
                {language === 'hi' ? 'शिशु की हलचल (2 घंटे का टाइमर)' : 'Baby Kick Counter (2-Hr Timer)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {language === 'hi' ? '28 सप्ताह बाद: जब भी बच्चा हिले, टैप करें' : 'After 28 weeks: Tap each time baby moves'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {language === 'hi' ? 'टाइमर' : 'Timer'}
            </span>
            <span className="text-sm font-mono font-bold text-[#1E2A4A]">
              {formatTimer(elapsedSeconds)} / 02:00:00
            </span>
          </div>
        </div>

        {/* Big Kick Button */}
        <div className="text-center py-2 space-y-3">
          <button
            type="button"
            onClick={handleTapKick}
            className="w-32 h-32 rounded-full bg-gradient-to-tr from-[#B0306A] to-pink-500 hover:scale-105 active:scale-95 text-white shadow-xl transition-transform mx-auto flex flex-col items-center justify-center relative group"
          >
            <Baby className="w-10 h-10 group-active:animate-ping" />
            <span className="text-2xl font-black mt-1">{kickCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              {language === 'hi' ? 'किक लगा!' : 'Kick!'}
            </span>
          </button>

          <p className="text-xs text-slate-500 font-medium">
            {language === 'hi'
              ? 'प्रत्येक किक पर बड़ा गोला दबाएं (आवाज़ में बोला जाएगा)'
              : 'Tap the big circle whenever baby kicks (spoken aloud)'}
          </p>
        </div>

        {/* Timer Controls & Finish Session */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            {isTimerRunning ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isTimerRunning ? (language === 'hi' ? 'रोकें' : 'Pause') : (language === 'hi' ? 'शुरू करें' : 'Start')}</span>
          </button>

          <button
            type="button"
            onClick={handleFinishKickSession}
            className="px-4 py-2 rounded-xl bg-[#2F7D4F] hover:bg-[#25653f] text-white text-xs font-bold shadow transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'जाँच पूर्ण करें (Finish)' : 'Finish Session'}</span>
          </button>
        </div>

        {kickAlertMsg && (
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 font-semibold">
            {kickAlertMsg}
          </div>
        )}
      </div>

      {/* SECTION 2: DAILY MOOD (5 EMOJI FACES) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smile className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold font-heading text-[#1E2A4A]">
              {language === 'hi' ? 'आज आपका मन कैसा है? (Daily Mood)' : 'How Are You Feeling Today?'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">
            {language === 'hi' ? 'दिन में एक बार' : 'Once a day'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center">
          {moods.map((m) => {
            const isSelected = selectedMood === m.face;
            return (
              <button
                key={m.face}
                type="button"
                onClick={() => handleSelectMood(m)}
                className={`p-2.5 rounded-2xl border transition flex flex-col items-center gap-1 ${
                  isSelected
                    ? 'bg-amber-100 border-amber-500 scale-105 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-bold text-slate-700 truncate w-full">
                  {language === 'hi' ? m.labelHi : m.labelEn}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500 leading-tight">
          {language === 'hi'
            ? 'सप्ताह में 3 या अधिक दिन उदास रहने पर आशा दीदी को परामर्श हेतु पीला संकेत जाएगा।'
            : '3 or more low days in a week triggers a supportive mental-health check-in from ASHA.'}
        </p>
      </div>

      {/* SECTION 3: FOOD TODAY (MEALS + PROTEIN FOODS) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold font-heading text-[#1E2A4A]">
              {language === 'hi' ? 'आज का पौष्टिक आहार (Food Today)' : 'Food & Nutrition Today'}
            </h3>
          </div>
        </div>

        {/* Meals Count */}
        <div>
          <span className="text-xs font-bold text-slate-700 block mb-1.5">
            {language === 'hi' ? 'आज कितनी बार भोजन किया? (Meals count):' : 'Number of meals today:'}
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleSelectMeals(count)}
                className={`py-2 px-1 rounded-xl border text-xs font-bold transition text-center ${
                  mealsCount === count
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {count === 4 ? '4+ बार' : `${count} बार`}
              </button>
            ))}
          </div>
        </div>

        {/* Protein Foods */}
        <div>
          <span className="text-xs font-bold text-slate-700 block mb-1.5">
            {language === 'hi' ? 'आज क्या प्रोटीन भोजन खाया? (टैप करें):' : 'Protein foods consumed today:'}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {proteinOptions.map((item) => {
              const isChecked = proteinFoods.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleProtein(item.id, language === 'hi' ? item.labelHi : item.labelEn)}
                  className={`p-2.5 rounded-2xl border text-left transition flex items-center gap-2 ${
                    isChecked
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs truncate">{language === 'hi' ? item.labelHi : item.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: VOMITING TODAY */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-bold font-heading text-[#1E2A4A]">
            {language === 'hi' ? 'आज उल्टी की स्थिति (Vomiting Today)' : 'Vomiting / Nausea Check'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {vomitOptions.map((opt) => {
            const isSelected = vomitingStatus === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectVomiting(opt)}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                  isSelected
                    ? opt.isYellow
                      ? 'bg-red-50 border-red-500 text-red-950 font-bold'
                      : 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-xs leading-tight">{language === 'hi' ? opt.labelHi : opt.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 5: OPTIONAL HOME SCALE / BP MACHINE */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm sm:text-base font-bold font-heading text-[#1E2A4A]">
                {language === 'hi' ? 'मेरे पास घर पर वजन कांटा / BP मशीन है' : 'I have weighing scale / BP machine at home'}
              </h3>
              <span className="text-[11px] text-slate-500">
                {language === 'hi' ? 'डॉक्टर को "सेल्फ-रिपोर्टेड" टैग दिखेगा' : 'Marked "Self-reported" for doctor review'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHasHomeDevices(!hasHomeDevices)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              hasHomeDevices ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                hasHomeDevices ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {hasHomeDevices && (
          <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3 animate-in fade-in">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                  {language === 'hi' ? 'सिस्टोलिक BP' : 'Systolic'}
                </label>
                <input
                  type="number"
                  value={homeSystolic}
                  onChange={(e) => setHomeSystolic(e.target.value)}
                  placeholder="120"
                  className="w-full p-2 bg-white text-xs font-bold rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                  {language === 'hi' ? 'डायस्टोलिक BP' : 'Diastolic'}
                </label>
                <input
                  type="number"
                  value={homeDiastolic}
                  onChange={(e) => setHomeDiastolic(e.target.value)}
                  placeholder="80"
                  className="w-full p-2 bg-white text-xs font-bold rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                  {language === 'hi' ? 'वजन (Weight kg)' : 'Weight (kg)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={homeWeight}
                  onChange={(e) => setHomeWeight(e.target.value)}
                  placeholder="55.0"
                  className="w-full p-2 bg-white text-xs font-bold rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveHomeVitals}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              {vitalsSaved
                ? (language === 'hi' ? '✓ सहेजा गया (सेल्फ-रिपोर्टेड)' : '✓ Saved (Self-Reported)')
                : (language === 'hi' ? 'सहेजें (Save Self-Reported Vitals)' : 'Save Self-Reported Vitals')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
