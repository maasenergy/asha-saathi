/**
 * Clinical Decision Support Rules Module - ASHA Saathi by Maas Doc
 * 
 * DISCLAIMER:
 * Simulation with synthetic data • Decision support only • Doctor makes clinical decisions.
 * This is an educational prototype and NOT a validated clinical diagnostic device.
 * Real maternal emergency care requires immediate in-person assessment by a medical officer.
 */

import {
  SwellingType,
  FetalMovementStatus,
  BabyPosition,
  UrineProtein,
  UrineSugar,
  TdDose,
  MotherProfile,
} from '../types';

export type SeverityLevel = 'GREEN' | 'AMBER' | 'RED';

export * from './trendEngine';

export interface ClinicalEvaluationInput {
  systolicBp: number | null;
  diastolicBp: number | null;
  gestationalWeeks?: number | null;
  symptoms: string[];
  otherObservations?: string;

  // New visit inputs
  weightKg?: number | null;
  swellingType?: SwellingType | null;
  fetalMovementStatus?: FetalMovementStatus | null;
  muacCm?: number | null;
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

  // Mother profile context
  patientProfile?: Partial<MotherProfile>;
}

export interface RuleTrigger {
  ruleId: string;
  severity: SeverityLevel;
  criterionEnglish: string;
  criterionHindi: string;
  triggerInput: string;
  clinicalRationale: string;
}

export interface ClinicalEvaluationResult {
  ruleSeverity: SeverityLevel;
  finalSeverity: SeverityLevel;
  triggers: RuleTrigger[];
  riskTags: string[];
  summaryEnglish: string;
  summaryHindi: string;
  recommendedActionEnglish: string;
  recommendedActionHindi: string;
  needsImmediateTransfer: boolean;
  alertRequired: boolean;
  disclaimer: string;
}

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  GREEN: 1,
  AMBER: 2,
  RED: 3,
};

/**
 * Compare two severities and return the higher one.
 * AI or secondary systems cannot downgrade deterministic rule severity.
 */
export function maxSeverity(a: SeverityLevel, b: SeverityLevel): SeverityLevel {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

/**
 * Evaluate deterministic clinical antenatal rules.
 * Implements standard Government of India / WHO antenatal emergency screening thresholds.
 */
export function evaluateClinicalRules(input: ClinicalEvaluationInput): ClinicalEvaluationResult {
  const triggers: RuleTrigger[] = [];
  const { systolicBp, diastolicBp, symptoms = [] } = input;
  const lowerSymptoms = symptoms.map((s) => s.toLowerCase());

  // 1. Severe Blood Pressure Check (RED Thresholds)
  // Systolic BP >= 160 OR Diastolic BP >= 110
  if (systolicBp !== null && systolicBp >= 160) {
    triggers.push({
      ruleId: 'BP_SYS_CRITICAL_HIGH',
      severity: 'RED',
      criterionEnglish: `Systolic BP (${systolicBp} mmHg) ≥ 160 mmHg threshold`,
      criterionHindi: `सिस्टोलिक रक्तचाप (${systolicBp} mmHg) खतरनाक सीमा 160 से अधिक है`,
      triggerInput: `Systolic: ${systolicBp} mmHg`,
      clinicalRationale: 'High risk of severe pre-eclampsia, eclampsia, or cerebrovascular complication. Immediate stabilization and doctor notification required.',
    });
  }

  if (diastolicBp !== null && diastolicBp >= 110) {
    triggers.push({
      ruleId: 'BP_DIA_CRITICAL_HIGH',
      severity: 'RED',
      criterionEnglish: `Diastolic BP (${diastolicBp} mmHg) ≥ 110 mmHg threshold`,
      criterionHindi: `डायस्टोलिक रक्तचाप (${diastolicBp} mmHg) खतरनाक सीमा 110 से अधिक है`,
      triggerInput: `Diastolic: ${diastolicBp} mmHg`,
      clinicalRationale: 'High diastolic pressure indicates severe peripheral vascular resistance and imminent maternal-fetal compromise.',
    });
  }

  // 2. Moderate Blood Pressure Check (AMBER Thresholds)
  // Systolic BP >= 140 OR Diastolic BP >= 90 (if not already triggered as RED)
  if (systolicBp !== null && systolicBp >= 140 && systolicBp < 160) {
    triggers.push({
      ruleId: 'BP_SYS_MODERATE_HIGH',
      severity: 'AMBER',
      criterionEnglish: `Systolic BP (${systolicBp} mmHg) ≥ 140 mmHg (Gestational Hypertension range)`,
      criterionHindi: `सिस्टोलिक रक्तचाप (${systolicBp} mmHg) 140 या अधिक (मध्यम उच्च रक्तचाप)`,
      triggerInput: `Systolic: ${systolicBp} mmHg`,
      clinicalRationale: 'Requires medical officer review and urine protein screening to rule out pre-eclampsia.',
    });
  }

  if (diastolicBp !== null && diastolicBp >= 90 && diastolicBp < 110) {
    triggers.push({
      ruleId: 'BP_DIA_MODERATE_HIGH',
      severity: 'AMBER',
      criterionEnglish: `Diastolic BP (${diastolicBp} mmHg) ≥ 90 mmHg (Gestational Hypertension range)`,
      criterionHindi: `डायस्टोलिक रक्तचाप (${diastolicBp} mmHg) 90 या अधिक (मध्यम उच्च रक्तचाप)`,
      triggerInput: `Diastolic: ${diastolicBp} mmHg`,
      clinicalRationale: 'Requires prompt medical officer assessment and regular surveillance.',
    });
  }

  // 3. Neurological / Visual Red Flag Symptoms
  const hasHeadache = lowerSymptoms.some(
    (s) => s.includes('headache') || s.includes('sar dard') || s.includes('sir dard') || s.includes('sar mein dard')
  );
  const hasVisual = lowerSymptoms.some(
    (s) => s.includes('blur') || s.includes('vision') || s.includes('dhundhla') || s.includes('aankh') || s.includes('chakkar')
  );

  if (hasHeadache && hasVisual) {
    triggers.push({
      ruleId: 'NEURO_VISUAL_COMBO_RED',
      severity: 'RED',
      criterionEnglish: 'Combined severe headache AND visual blurring/disturbances reported',
      criterionHindi: 'गंभीर सिरदर्द और आँखों के आगे धुंधलापन दोनों मौजूद हैं',
      triggerInput: 'Symptoms: Severe headache + Blurred vision',
      clinicalRationale: 'Classic prodromal signs of imminent eclampsia (cerebral edema and retinal arteriolar spasm) requiring immediate transfer.',
    });
  } else if (hasHeadache) {
    const isElevatedBp = (systolicBp !== null && systolicBp >= 140) || (diastolicBp !== null && diastolicBp >= 90);
    triggers.push({
      ruleId: 'HEADACHE_TRIGGER',
      severity: isElevatedBp ? 'RED' : 'AMBER',
      criterionEnglish: isElevatedBp 
        ? 'Severe headache presenting alongside elevated blood pressure' 
        : 'Persistent or severe headache reported',
      criterionHindi: isElevatedBp 
        ? 'उच्च रक्तचाप के साथ तेज सिरदर्द (गंभीर जोखिम)' 
        : 'सिरदर्द की शिकायत (चिकित्सकीय समीक्षा आवश्यक)',
      triggerInput: 'Symptom: Headache',
      clinicalRationale: isElevatedBp ? 'Severe pre-eclampsia warning symptom.' : 'Symptom requires clinical evaluation.',
    });
  } else if (hasVisual) {
    const isElevatedBp = (systolicBp !== null && systolicBp >= 140) || (diastolicBp !== null && diastolicBp >= 90);
    triggers.push({
      ruleId: 'VISUAL_TRIGGER',
      severity: isElevatedBp ? 'RED' : 'AMBER',
      criterionEnglish: isElevatedBp
        ? 'Visual disturbance (blurred vision) presenting alongside elevated BP'
        : 'Visual blurring reported',
      criterionHindi: isElevatedBp
        ? 'उच्च रक्तचाप के साथ आँखों के आगे धुंधलापन (गंभीर जोखिम)'
        : 'धुंधलापन (चिकित्सकीय समीक्षा आवश्यक)',
      triggerInput: 'Symptom: Visual changes',
      clinicalRationale: 'Neurological/retinal symptom requiring formal clinical assessment.',
    });
  }

  // 4. Critical Obstetric / General Danger Signs (Automatic RED)
  const isConvulsions = lowerSymptoms.some(
    (s) => s.includes('convulsion') || s.includes('fit') || s.includes('seizure') || s.includes('jhatke') || s.includes('daura')
  );
  if (isConvulsions) {
    triggers.push({
      ruleId: 'CONVULSIONS_RED',
      severity: 'RED',
      criterionEnglish: 'Fits, convulsions or seizures reported (Possible Eclampsia)',
      criterionHindi: 'दौरा या झटके आने की शिकायत (इक्लैम्पसिया की तीव्र आशंका)',
      triggerInput: 'Convulsions / Fits',
      clinicalRationale: 'Absolute obstetrical emergency requiring immediate airway management and parenteral magnesium sulfate under clinical supervision.',
    });
  }

  const isBleeding = lowerSymptoms.some(
    (s) => s.includes('bleeding') || s.includes('khoon') || s.includes('hemorrhage') || s.includes('blood')
  );
  if (isBleeding) {
    const hasPrevia = Boolean(
      input.patientProfile?.hasPlacentaPrevia ||
      input.patientProfile?.highRiskFactors?.some((f) => f.toLowerCase().includes('placenta previa'))
    );
    triggers.push({
      ruleId: hasPrevia ? 'PLACENTA_PREVIA_BLEEDING_RED' : 'BLEEDING_RED',
      severity: 'RED',
      criterionEnglish: hasPrevia
        ? 'Active vaginal bleeding with confirmed Placenta Previa (Critical Emergency)'
        : 'Antepartum vaginal bleeding reported',
      criterionHindi: hasPrevia
        ? 'प्लेसेंटा प्रीविया के साथ योनि से रक्तस्राव (अति गंभीर आपातकाल)'
        : 'योनि से रक्तस्राव (ब्लीडिंग) की शिकायत',
      triggerInput: hasPrevia ? 'Placenta previa + Vaginal bleeding' : 'Vaginal bleeding',
      clinicalRationale: 'Major hemorrhage risk in placenta previa or abruption; emergency C-section facility transfer mandated.',
    });
  }

  // Pre-eclampsia combo: Face/hand swelling + BP >= 140/90 OR Urine protein >= 1+ with BP >= 140/90
  const isHighBp = (systolicBp !== null && systolicBp >= 140) || (diastolicBp !== null && diastolicBp >= 90);
  const isFaceHandSwelling =
    input.swellingType === 'face_or_hands' ||
    lowerSymptoms.some((s) => s.includes('face') || s.includes('hand') || s.includes('chehra') || s.includes('haath'));
  const hasProteinuria = input.urineProtein === '1+' || input.urineProtein === '2+' || input.urineProtein === '3+';

  if (isHighBp && (isFaceHandSwelling || hasProteinuria)) {
    triggers.push({
      ruleId: 'PRE_ECLAMPSIA_COMBO_RED',
      severity: 'RED',
      criterionEnglish: hasProteinuria
        ? `Elevated BP (≥140/90) with Proteinuria (${input.urineProtein}) — Possible Pre-eclampsia`
        : 'Elevated BP (≥140/90) with non-dependent Face/Hand Swelling — Possible Pre-eclampsia',
      criterionHindi: hasProteinuria
        ? `उच्च रक्तचाप (≥140/90) के साथ पेशाब में प्रोटीन (${input.urineProtein}) — प्री-एक्लेम्पसिया की प्रबल आशंका`
        : 'उच्च रक्तचाप (≥140/90) के साथ चेहरे व हाथों में सूजन — प्री-एक्लेम्पसिया की प्रबल आशंका',
      triggerInput: `BP: ${systolicBp}/${diastolicBp}, Swelling: ${input.swellingType || 'face/hands'}, Urine: ${input.urineProtein || 'none'}`,
      clinicalRationale: 'Diagnostic criteria for pre-eclampsia met. Requires immediate urgent referral to FRU/CHC.',
    });
  }

  const isSevereBreathlessness = lowerSymptoms.some(
    (s) => s.includes('breathless') || s.includes('sans phoolna') || s.includes('sans lene mein takleef') || s.includes('respiratory')
  );
  if (isSevereBreathlessness) {
    triggers.push({
      ruleId: 'BREATHLESSNESS_RED',
      severity: 'RED',
      criterionEnglish: 'Severe breathlessness or respiratory distress reported',
      criterionHindi: 'सांस लेने में भारी तकलीफ या सांस फूलना',
      triggerInput: 'Severe breathlessness',
      clinicalRationale: 'Risk of pulmonary edema or cardiac compromise in pre-eclampsia.',
    });
  }

  const isUnconscious = lowerSymptoms.some(
    (s) => s.includes('unconscious') || s.includes('behoshi') || s.includes('lethargy') || s.includes('fainting')
  );
  if (isUnconscious) {
    triggers.push({
      ruleId: 'UNCONSCIOUS_RED',
      severity: 'RED',
      criterionEnglish: 'Altered sensorium or loss of consciousness reported',
      criterionHindi: 'बेहोशी या सुस्ती की शिकायत',
      triggerInput: 'Loss of consciousness',
      clinicalRationale: 'Critical neurological sign requiring emergency intervention.',
    });
  }

  // 5. Moderate / Antenatal Risk Signs (AMBER)
  // Edema (feet only or mild)
  const isEdema =
    input.swellingType === 'feet_only' ||
    lowerSymptoms.some((s) => s.includes('sujan') || s.includes('swelling') || s.includes('edema') || s.includes('sojan'));
  if (isEdema && !triggers.some((t) => t.severity === 'RED') && !isFaceHandSwelling) {
    triggers.push({
      ruleId: 'EDEMA_FEET_AMBER',
      severity: 'AMBER',
      criterionEnglish: 'Pedal edema / swelling in feet reported',
      criterionHindi: 'पैरों में सूजन की शिकायत',
      triggerInput: 'Pedal edema',
      clinicalRationale: 'Sign of fluid retention; warrants urine albumin testing and BP tracking.',
    });
  }

  // Reduced fetal movement
  const isReducedFetalMovement =
    input.fetalMovementStatus === 'reduced' ||
    input.fetalMovementStatus === 'absent' ||
    lowerSymptoms.some((s) => s.includes('fetal') || s.includes('movement') || s.includes('kick kam') || s.includes('harkat kam'));
  if (isReducedFetalMovement) {
    triggers.push({
      ruleId: 'FETAL_MOVEMENT_AMBER',
      severity: 'AMBER',
      criterionEnglish: 'Reduced fetal movement / kicks reported',
      criterionHindi: 'बच्चे की हलचल कम होने की शिकायत',
      triggerInput: 'Reduced fetal movement',
      clinicalRationale: 'Potential sign of fetal distress; requires fetal heart rate auscultation and NST.',
    });
  }

  // MUAC < 23 cm -> YELLOW "undernutrition, low birth weight risk"
  const currentMuac = input.muacCm ?? input.patientProfile?.muacCm;
  if (typeof currentMuac === 'number' && currentMuac > 0 && currentMuac < 23) {
    triggers.push({
      ruleId: 'MUAC_LOW_AMBER',
      severity: 'AMBER',
      criterionEnglish: `MUAC (${currentMuac} cm) < 23 cm threshold — undernutrition, low birth weight risk`,
      criterionHindi: `मध्य बांह का घेरा MUAC (${currentMuac} सेमी) 23 सेमी से कम — कुपोषण एवं कम वजन के शिशु का जोखिम`,
      triggerInput: `MUAC: ${currentMuac} cm`,
      clinicalRationale: 'Mid-Upper Arm Circumference < 23 cm correlates with severe maternal acute malnutrition and fetal growth restriction.',
    });
  }

  // Height < 145 cm -> YELLOW "risk of obstructed labour - plan delivery at C-section facility"
  const maternalHeight = input.patientProfile?.heightCm;
  if (typeof maternalHeight === 'number' && maternalHeight > 0 && maternalHeight < 145) {
    triggers.push({
      ruleId: 'SHORT_STATURE_AMBER',
      severity: 'AMBER',
      criterionEnglish: `Maternal height (${maternalHeight} cm) < 145 cm — risk of obstructed labour (plan delivery at C-section facility)`,
      criterionHindi: `माता की ऊंचाई (${maternalHeight} सेमी) 145 सेमी से कम — अवरुद्ध प्रसव (Obstructed Labour) का जोखिम (सिजेरियन सुविधा वाले अस्पताल में योजना बनाएं)`,
      triggerInput: `Height: ${maternalHeight} cm`,
      clinicalRationale: 'Cephalopelvic disproportion (CPD) and obstructed labour risk; delivery must be planned at CHC/FRU with operative capabilities.',
    });
  }

  // Age < 18 or > 35 -> YELLOW
  const maternalAge = input.patientProfile?.age;
  if (typeof maternalAge === 'number' && maternalAge > 0 && (maternalAge < 18 || maternalAge > 35)) {
    triggers.push({
      ruleId: 'AGE_EXTREMES_AMBER',
      severity: 'AMBER',
      criterionEnglish: `Maternal age (${maternalAge} yrs) < 18 or > 35 — high risk age category`,
      criterionHindi: `माता की उम्र (${maternalAge} वर्ष) 18 से कम या 35 से अधिक — उच्च जोखिम आयु वर्ग`,
      triggerInput: `Age: ${maternalAge} yrs`,
      clinicalRationale: 'Young primigravida or advanced maternal age increases risks of pre-eclampsia, chromosomal abnormalities, and prolonged labour.',
    });
  }

  // Previous C-section -> YELLOW "scar - delivery only at C-section facility"
  const hasPreviousCSection = Boolean(
    input.patientProfile?.obstetricHistory?.previousCSection ||
    input.patientProfile?.highRiskFactors?.some((f) => f.toLowerCase().includes('c-section') || f.toLowerCase().includes('lscs'))
  );
  if (hasPreviousCSection) {
    triggers.push({
      ruleId: 'PREVIOUS_CS_AMBER',
      severity: 'AMBER',
      criterionEnglish: 'Previous C-section scar — delivery only at C-section facility (FRU/hospital)',
      criterionHindi: 'पिछला सिजेरियन ऑपरेशन (दाग/Scar) — प्रसव केवल सिजेरियन सुविधा वाले अस्पताल में',
      triggerInput: 'Previous C-Section',
      clinicalRationale: 'Uterine rupture risk during trial of labour; institutional delivery at comprehensive emergency obstetric care (CEmONC) facility mandatory.',
    });
  }

  // Pallor yes with no Hb value -> YELLOW "check Hb"
  if (input.pallor === true && (input.hbGdl === null || input.hbGdl === undefined)) {
    triggers.push({
      ruleId: 'PALLOR_WITHOUT_HB_AMBER',
      severity: 'AMBER',
      criterionEnglish: 'Clinical pallor observed (pale eyes/nails) without confirmed Hb — check Hb urgently',
      criterionHindi: 'आँखों या नाखूनों में पीलापन (Pallor) दिखा पर हीमोग्लोबिन ज्ञात नहीं — तत्काल हीमोग्लोबिन जाँच कराएं',
      triggerInput: 'Pallor: Yes, Hb: Unknown',
      clinicalRationale: 'Screening sign of moderate-to-severe anemia requiring quantitative Sahli or digital hemoglobinometer verification.',
    });
  }

  // Breech / transverse after 36 weeks -> YELLOW "plan hospital delivery"
  const weeks = input.gestationalWeeks ?? input.patientProfile?.gestationalWeeks ?? 0;
  if (weeks >= 36 && (input.babyPosition === 'breech' || input.babyPosition === 'transverse')) {
    triggers.push({
      ruleId: 'MALPRESENTATION_36W_AMBER',
      severity: 'AMBER',
      criterionEnglish: `Malpresentation (${input.babyPosition}) at ${weeks} weeks — plan hospital delivery`,
      criterionHindi: `${weeks} सप्ताह पर शिशु की स्थिति उल्टी/तिरछी (${input.babyPosition}) — अस्पताल में प्रसव की योजना बनाएं`,
      triggerInput: `Position: ${input.babyPosition} at ${weeks}w`,
      clinicalRationale: 'Breech or transverse lie at term requires specialist external cephalic version assessment or planned hospital/cesarean delivery.',
    });
  }

  // IFA adherence < 70% -> YELLOW "iron tablets not taken regularly"
  if (typeof input.ifaAdherencePercent === 'number' && input.ifaAdherencePercent < 70) {
    triggers.push({
      ruleId: 'IFA_ADHERENCE_LOW_AMBER',
      severity: 'AMBER',
      criterionEnglish: `IFA adherence (${input.ifaAdherencePercent}%) < 70% — iron tablets not taken regularly`,
      criterionHindi: `आयरन की गोली (IFA) लेने की दर (${input.ifaAdherencePercent}%) 70% से कम — गोलियां नियमित नहीं खाई जा रही हैं`,
      triggerInput: `IFA Adherence: ${input.ifaAdherencePercent}%`,
      clinicalRationale: 'Sub-optimal IFA compliance increases risk of nutritional iron-deficiency anemia.',
    });
  }

  // Tobacco / mishri use -> YELLOW "counsel to stop; low birth weight risk"
  const usesTobacco = Boolean(
    input.patientProfile?.usesTobaccoOrMishri ||
    input.patientProfile?.highRiskFactors?.some((f) => f.toLowerCase().includes('tobacco') || f.toLowerCase().includes('mishri'))
  );
  if (usesTobacco) {
    triggers.push({
      ruleId: 'TOBACCO_MISHRI_AMBER',
      severity: 'AMBER',
      criterionEnglish: 'Tobacco / mishri use reported — counsel to stop; low birth weight & placental risk',
      criterionHindi: 'तंबाकू या मिश्री का सेवन — बंद करने की सलाह दें; कम वजन व अपरा विकार का जोखिम',
      triggerInput: 'Tobacco/Mishri: Yes',
      clinicalRationale: 'Nicotine and oral tobacco cause placental vasoconstriction, leading to low birth weight and intrauterine growth restriction.',
    });
  }

  // Comorbidities: Heart disease, epilepsy, sickle cell, TB, or HIV/HBsAg/syphilis positive -> YELLOW
  const pProfile = input.patientProfile;
  if (
    pProfile?.hasHeartDisease ||
    pProfile?.hasEpilepsy ||
    pProfile?.hasSickleCell ||
    pProfile?.hasTb ||
    pProfile?.infectiousStatus?.hiv === 'positive' ||
    pProfile?.infectiousStatus?.hbsag === 'positive' ||
    pProfile?.infectiousStatus?.syphilis === 'positive'
  ) {
    const list = [];
    if (pProfile?.hasHeartDisease) list.push('Heart disease');
    if (pProfile?.hasEpilepsy) list.push('Epilepsy');
    if (pProfile?.hasSickleCell) list.push('Sickle cell');
    if (pProfile?.hasTb) list.push('TB');
    if (pProfile?.infectiousStatus?.hiv === 'positive') list.push('HIV+');
    if (pProfile?.infectiousStatus?.hbsag === 'positive') list.push('HBsAg+');
    if (pProfile?.infectiousStatus?.syphilis === 'positive') list.push('Syphilis+');

    triggers.push({
      ruleId: 'COMORBIDITY_AMBER',
      severity: 'AMBER',
      criterionEnglish: `High-risk maternal condition present: ${list.join(', ')} — specialist care required`,
      criterionHindi: `विशेष चिकित्सीय स्थिति: ${list.join(', ')} — विशेषज्ञ देखभाल आवश्यक`,
      triggerInput: list.join(', '),
      clinicalRationale: 'Systemic maternal disease requires coordinated specialist physician and obstetric monitoring.',
    });
  }

  // Previous stillbirth or preterm birth -> YELLOW "closer monitoring"
  if (pProfile?.obstetricHistory?.previousStillbirth || pProfile?.obstetricHistory?.previousPretermBirth) {
    triggers.push({
      ruleId: 'PREVIOUS_STILLBIRTH_PRETERM_AMBER',
      severity: 'AMBER',
      criterionEnglish: 'History of previous stillbirth or preterm birth — closer monitoring required',
      criterionHindi: 'पिछले प्रसव में मृत शिशु या समय पूर्व प्रसव का इतिहास — विशेष निगरानी आवश्यक',
      triggerInput: 'Stillbirth / Preterm history',
      clinicalRationale: 'Recurrence risk for preterm labour or occult fetal compromise requires enhanced surveillance.',
    });
  }

  // Short pregnancy gap (<18 months)
  if (pProfile?.obstetricHistory?.lastDeliveryDate) {
    const lastDate = new Date(pProfile.obstetricHistory.lastDeliveryDate).getTime();
    const lmpDate = pProfile.lmpDate ? new Date(pProfile.lmpDate).getTime() : Date.now();
    const gapMonths = (lmpDate - lastDate) / (1000 * 60 * 60 * 24 * 30.4);
    if (gapMonths > 0 && gapMonths < 18) {
      triggers.push({
        ruleId: 'SHORT_GAP_AMBER',
        severity: 'AMBER',
        criterionEnglish: `Last delivery was ${Math.round(gapMonths)} months ago (<18 months gap) — short pregnancy interval`,
        criterionHindi: `पिछला प्रसव ${Math.round(gapMonths)} महीने पहले हुआ था (<18 महीने का अंतर) — कम अंतराल जोखिम`,
        triggerInput: `Gap: ${Math.round(gapMonths)}m`,
        clinicalRationale: 'Interpregnancy interval < 18 months increases risks of uterine rupture, maternal nutritional depletion, and preterm birth.',
      });
    }
  }

  // Rh Incompatibility & Anti-D reminders
  const motherBlood = pProfile?.bloodGroup || '';
  const fatherBlood = pProfile?.fatherBloodGroup || '';
  const isMotherRhNegative = motherBlood.includes('-');
  const isFatherRhPositiveOrUnknown = fatherBlood.includes('+') || !fatherBlood || fatherBlood === 'unknown';

  if (isMotherRhNegative) {
    const isIsoimmunizationRisk = isFatherRhPositiveOrUnknown;
    triggers.push({
      ruleId: 'RH_NEGATIVE_REMINDER',
      severity: 'AMBER',
      criterionEnglish: isIsoimmunizationRisk
        ? `Mother Rh Negative (${motherBlood}) with Father Rh Positive/Unknown (${fatherBlood || 'unknown'}) — Rh isoimmunization risk; Anti-D required at 28w and post-delivery`
        : `Mother Rh Negative (${motherBlood}) — Anti-D prophylaxis review at 28 weeks`,
      criterionHindi: isIsoimmunizationRisk
        ? `माता आरएच नेगेटिव (${motherBlood}) व पिता आरएच पॉजिटिव/अज्ञात (${fatherBlood || 'अज्ञात'}) — आरएच इनकम्पैटिबिलिटी का जोखिम; 28वें सप्ताह व प्रसव बाद एंटी-डी की जरूरत`
        : `माता आरएच नेगेटिव (${motherBlood}) — 28वें सप्ताह में एंटी-डी टीकाकरण समीक्षा`,
      triggerInput: `Mother: ${motherBlood}, Father: ${fatherBlood || 'unknown'}`,
      clinicalRationale: 'Fetal maternal hemorrhage can sensitize an Rh-negative mother, causing hemolytic disease of the newborn in subsequent pregnancies.',
    });
  }

  // Compute Risk Tags:
  // Gravida ≥ 5, previous PPH, twins, or Hb < 10 -> "PPH risk" tag
  const riskTags: string[] = [];
  const currentHb = input.hbGdl ?? pProfile?.tests?.find((t) => t.id.includes('hb'))?.result;
  const numericHb = typeof input.hbGdl === 'number' ? input.hbGdl : (typeof currentHb === 'string' ? parseFloat(currentHb) : null);

  const isGravida5Plus = (input.patientProfile?.gravida ?? 1) >= 5;
  const hadPph = Boolean(input.patientProfile?.obstetricHistory?.previousPph);
  const hasTwins = Boolean(input.patientProfile?.hasTwins);
  const hasLowHb = numericHb !== null && !isNaN(numericHb) && numericHb < 10;

  if (isGravida5Plus || hadPph || hasTwins || hasLowHb) {
    riskTags.push('PPH risk');
  }

  if (maternalHeight && maternalHeight < 145) {
    riskTags.push('Obstructed labour risk');
  }
  if (hasPreviousCSection) {
    riskTags.push('C-section scar');
  }
  if (isMotherRhNegative) {
    riskTags.push('Rh negative');
  }
  if (hasHighRiskPreeclampsia(input, triggers)) {
    riskTags.push('Pre-eclampsia risk');
  }

  // Calculate highest severity among triggers
  let calculatedSeverity: SeverityLevel = 'GREEN';
  for (const trigger of triggers) {
    calculatedSeverity = maxSeverity(calculatedSeverity, trigger.severity);
  }

  // Construct patient-facing and clinician-facing messages
  let summaryEnglish = 'All measured parameters are within standard routine surveillance limits.';
  let summaryHindi = 'सभी दर्ज माप सामान्य सीमा के भीतर हैं। नियमित देखभाल जारी रखें।';
  let recommendedActionEnglish = 'Continue routine antenatal care and nutritional iron/calcium supplements.';
  let recommendedActionHindi = 'नियमित प्रसव पूर्व जांच, संतुलित आहार और आयरन-कैल्शियम की गोलियां जारी रखें।';

  if (calculatedSeverity === 'RED') {
    summaryEnglish = 'RED ALERT: Severe hypertension and/or danger symptoms detected. Immediate doctor review & emergency transport required.';
    summaryHindi = 'लाल चेतावनी (RED ALERT): अत्यधिक उच्च रक्तचाप और/या गंभीर खतरे के लक्षण। तत्काल डॉक्टर की समीक्षा और अस्पताल जाना अनिवार्य है।';
    recommendedActionEnglish = 'Notify Medical Officer immediately. Prepare urgent transport (Call 108 / 102). Keep mother in left lateral position and maintain calm.';
    recommendedActionHindi = 'तुरंत प्राथमिक स्वास्थ्य केंद्र के डॉक्टर को सूचित करें। एम्बुलेंस (108 / 102) बुलाएं। गर्भवती को बाईं करवट लिटाएं और शांत रखें।';
  } else if (calculatedSeverity === 'AMBER') {
    summaryEnglish = 'AMBER ALERT: Mild to moderate elevation in BP or warning symptoms. Non-urgent medical officer assessment needed within 24-48 hours.';
    summaryHindi = 'पीली चेतावनी (AMBER ALERT): हल्का-मध्यम उच्च रक्तचाप या चेतावनी लक्षण। अगले 24-48 घंटों में डॉक्टर से जांच कराएं।';
    recommendedActionEnglish = 'Schedule clinical visit at nearest PHC. Repeat BP measurement in quiet sitting position. Check urine protein.';
    recommendedActionHindi = 'नजदीकी पीएचसी पर डॉक्टर से जांच का समय तय करें। रक्तचाप दोबारा नापें और पेशाब की जांच कराएं।';
  }

  return {
    ruleSeverity: calculatedSeverity,
    finalSeverity: calculatedSeverity, // Deterministic rule sets minimum bar; AI can never downgrade
    triggers,
    riskTags,
    summaryEnglish,
    summaryHindi,
    recommendedActionEnglish,
    recommendedActionHindi,
    needsImmediateTransfer: calculatedSeverity === 'RED',
    alertRequired: calculatedSeverity === 'RED' || calculatedSeverity === 'AMBER',
    disclaimer: 'Simulation with synthetic data • Decision support only • Doctor makes clinical decisions.',
  };
}

function hasHighRiskPreeclampsia(input: ClinicalEvaluationInput, triggers: RuleTrigger[]): boolean {
  if (triggers.some((t) => t.ruleId === 'PRE_ECLAMPSIA_COMBO_RED' || t.ruleId === 'BP_SYS_CRITICAL_HIGH')) return true;
  if ((input.systolicBp && input.systolicBp >= 140) || (input.diastolicBp && input.diastolicBp >= 90)) return true;
  return Boolean(input.patientProfile?.hasPreEclampsiaRisk);
}

/**
 * Safety rule in code for Birth Plan:
 * If any of height < 145, previous C-section, twins, placenta previa,
 * breech after 36 weeks, severe anaemia (Hb < 7), or pre-eclampsia is present,
 * deliveryPlace CAN NEVER be "PHC" (upgrade it automatically and show "upgraded by safety rule").
 */
export type DeliveryPlace = 'PHC' | 'CHC/FRU with C-section' | 'District hospital / medical college';

export function evaluateBirthPlanSafetyRule(
  patient: MotherProfile,
  aiSuggestedPlace: DeliveryPlace
): {
  finalPlace: DeliveryPlace;
  upgradedBySafetyRule: boolean;
  safetyRuleReason?: string;
  riskTags: string[];
} {
  const { reasons, riskTags } = collectBirthPlanSafetyFactors(patient);

  const mustUpgrade = reasons.length > 0;
  if (mustUpgrade && aiSuggestedPlace === 'PHC') {
    return {
      finalPlace: facilityForSafetyFactorCount(reasons.length),
      upgradedBySafetyRule: true,
      safetyRuleReason: `Safety Rule Override: Upgraded from PHC to C-Section facility due to: ${reasons.join('; ')}`,
      riskTags,
    };
  }

  return {
    finalPlace: aiSuggestedPlace,
    upgradedBySafetyRule: false,
    riskTags,
  };
}

function facilityForSafetyFactorCount(count: number): DeliveryPlace {
  if (count === 0) return 'PHC';
  return count > 2 ? 'District hospital / medical college' : 'CHC/FRU with C-section';
}

/**
 * Deterministic facility designation used when AI is offline: no AI suggestion exists,
 * so the facility follows directly from the safety factors.
 */
export function ruleBasedDeliveryPlace(patient: MotherProfile): {
  place: DeliveryPlace;
  reasons: string[];
  riskTags: string[];
} {
  const { reasons, riskTags } = collectBirthPlanSafetyFactors(patient);
  return { place: facilityForSafetyFactorCount(reasons.length), reasons, riskTags };
}

export function collectBirthPlanSafetyFactors(patient: MotherProfile): { reasons: string[]; riskTags: string[] } {
  const reasons: string[] = [];
  const riskTags: string[] = [];

  // 1. Height < 145 cm
  if (patient.heightCm && patient.heightCm < 145) {
    reasons.push(`Maternal height (${patient.heightCm} cm) < 145 cm — obstructed labour risk`);
    riskTags.push('Obstructed labour risk');
  }

  // 2. Previous C-section
  if (patient.obstetricHistory?.previousCSection || patient.highRiskFactors?.some((f) => f.toLowerCase().includes('c-section'))) {
    reasons.push('Previous C-section scar — trial of scar / operative capability required');
    riskTags.push('C-section scar');
  }

  // 3. Twins
  if (patient.hasTwins || patient.highRiskFactors?.some((f) => f.toLowerCase().includes('twin'))) {
    reasons.push('Multiple gestation (twins) — malpresentation and PPH risk');
    riskTags.push('Twins / Multiple gestation');
  }

  // 4. Placenta previa
  if (patient.hasPlacentaPrevia || patient.highRiskFactors?.some((f) => f.toLowerCase().includes('placenta previa'))) {
    reasons.push('Placenta previa — severe antepartum/intrapartum hemorrhage risk');
    riskTags.push('Placenta previa');
  }

  // 5. Breech after 36 weeks
  const latestVisit = patient.visits[0];
  if (
    patient.gestationalWeeks >= 36 &&
    (latestVisit?.babyPosition === 'breech' || latestVisit?.babyPosition === 'transverse')
  ) {
    reasons.push(`Malpresentation (${latestVisit.babyPosition}) at ${patient.gestationalWeeks} weeks`);
    riskTags.push('Malpresentation');
  }

  // 6. Severe anaemia (Hb < 7)
  const hbVal = latestVisit?.hbGdl;
  if (typeof hbVal === 'number' && hbVal < 7.0) {
    reasons.push(`Severe maternal anaemia (Hb ${hbVal} g/dL < 7.0) — blood transfusion access required`);
    riskTags.push('Severe anaemia');
  }

  // 7. Pre-eclampsia / Severe hypertension
  if (
    patient.overallLevel === 'RED' ||
    latestVisit?.finalSeverity === 'RED' ||
    (latestVisit?.systolicBp && latestVisit.systolicBp >= 140) ||
    patient.hasPreEclampsiaRisk
  ) {
    reasons.push('Pre-eclampsia / severe arterial pressure elevation');
    riskTags.push('Pre-eclampsia risk');
  }

  // PPH risk tag check
  if (
    patient.gravida >= 5 ||
    patient.obstetricHistory?.previousPph ||
    patient.hasTwins ||
    (typeof hbVal === 'number' && hbVal < 10)
  ) {
    if (!riskTags.includes('PPH risk')) riskTags.push('PPH risk');
  }

  return { reasons, riskTags };
}

