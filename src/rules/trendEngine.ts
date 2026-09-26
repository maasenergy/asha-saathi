/**
 * Proactive Antenatal Trend Engine - ASHA Saathi by Maas Doc
 * 
 * Deterministic TypeScript module that analyzes visit history across 3+ visits
 * to flag trajectories even when each single value is individually "normal".
 * 
 * Rules:
 * 1. BP rising: systolic or diastolic increased at each of the last 3 visits by total ≥10 mmHg -> YELLOW ↗
 * 2. Weight crossing band: moved from inside target band to outside it (or sudden jump ≥2 kg in ≤3 weeks) -> YELLOW ↗
 * 3. SFH falling behind: (SFH - weeks) got more negative at each of the last 2 visits -> YELLOW ↘ ("growth slowing")
 * 4. Hb falling: dropped ≥1.0 g/dL across visits -> YELLOW ↘
 * 5. Overdue visit: no visit for more than 5 weeks -> YELLOW ↗ ("visit overdue")
 */

import { MotherProfile, VisitRecord, SeverityLevel, TrendFlag, MotherTrendAnalysis } from '../types';

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  GREEN: 1,
  AMBER: 2,
  RED: 3,
};

export function maxSeverity(a: SeverityLevel, b: SeverityLevel): SeverityLevel {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

const FIVE_WEEKS_MS = 5 * 7 * 24 * 60 * 60 * 1000;

/**
 * Computes deterministic trend analysis for a mother from her visit history.
 */
export function analyzeMotherTrends(patient: MotherProfile): MotherTrendAnalysis {
  const flags: TrendFlag[] = [];
  
  // Sort visits chronologically (oldest to newest)
  const visits = [...(patient.visits || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // -------------------------------------------------------------
  // Rule 1: BP Rising Steadily (↗)
  // Systolic or diastolic increased at each of the last 3 visits by a total of ≥10 mmHg
  // -------------------------------------------------------------
  const visitsWithBp = visits.filter(
    (v) => typeof v.systolicBp === 'number' && typeof v.diastolicBp === 'number'
  );

  if (visitsWithBp.length >= 3) {
    const last3 = visitsWithBp.slice(-3);
    const [v1, v2, v3] = last3;
    const sys1 = v1.systolicBp!;
    const sys2 = v2.systolicBp!;
    const sys3 = v3.systolicBp!;
    const dia1 = v1.diastolicBp!;
    const dia2 = v2.diastolicBp!;
    const dia3 = v3.diastolicBp!;

    const systolicRising = sys1 < sys2 && sys2 < sys3 && (sys3 - sys1 >= 10);
    const diastolicRising = dia1 < dia2 && dia2 < dia3 && (dia3 - dia1 >= 10);

    if (systolicRising || diastolicRising) {
      const sysDelta = sys3 - sys1;
      const diaDelta = dia3 - dia1;
      flags.push({
        id: `trend-bp-rising-${patient.id}`,
        type: 'BP_RISING',
        direction: '↗',
        severity: 'AMBER',
        labelEnglish: 'BP rising steadily',
        labelHindi: 'रक्तचाप लगातार बढ़ रहा है',
        detailEnglish: `Systolic/diastolic BP has increased consecutively at each of the last 3 visits (Total rise: +${Math.max(sysDelta, diaDelta)} mmHg).`,
        detailHindi: `पिछले 3 दौरों में रक्तचाप लगातार बढ़ रहा है (कुल वृद्धि: +${Math.max(sysDelta, diaDelta)} mmHg)।`,
        valuesSummary: `${sys1}/${dia1} → ${sys2}/${dia2} → ${sys3}/${dia3} mmHg`,
      });
    }
  }

  // -------------------------------------------------------------
  // Rule 2: Weight Crossing Band (↗)
  // Moved from inside target band to outside it, or sudden jump ≥2.0 kg in ≤3 weeks
  // (Classic sign of occult maternal fluid retention / early pre-eclampsia)
  // -------------------------------------------------------------
  const visitsWithWeight = visits.filter(
    (v) => typeof v.weightKg === 'number' && v.weightKg > 0
  );

  if (visitsWithWeight.length >= 2) {
    const vPrev = visitsWithWeight[visitsWithWeight.length - 2];
    const vLatest = visitsWithWeight[visitsWithWeight.length - 1];
    const wDiff = Number((vLatest.weightKg! - vPrev.weightKg!).toFixed(1));
    const timeDiffDays = Math.max(
      1,
      Math.round(
        (new Date(vLatest.timestamp).getTime() - new Date(vPrev.timestamp).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const weeksDiff = timeDiffDays / 7;

    // Normal expected weight gain in 2nd/3rd trimester is ~0.3 - 0.5 kg/week.
    // If weight increases by ≥ 2.0 kg in ≤ 3 weeks, or rate > 1.0 kg/week:
    const isRapidWeightJump = wDiff >= 2.0 && weeksDiff <= 3.5;
    const isExcessiveRate = wDiff >= 1.5 && weeksDiff <= 1.5;

    if (isRapidWeightJump || isExcessiveRate) {
      flags.push({
        id: `trend-weight-jump-${patient.id}`,
        type: 'WEIGHT_CROSSING_BAND',
        direction: '↗',
        severity: 'AMBER',
        labelEnglish: 'Weight crossing target band',
        labelHindi: 'वजन में अचानक अत्यधिक वृद्धि',
        detailEnglish: `Weight jumped by ${wDiff > 0 ? `+${wDiff}` : wDiff} kg in ${Math.round(weeksDiff)} weeks (target band exceeded; fluid retention risk).`,
        detailHindi: `${Math.round(weeksDiff)} सप्ताह में ${wDiff > 0 ? `+${wDiff}` : wDiff} किग्रा की तीव्र वृद्धि (अति-सूजन/प्री-एक्लेम्पसिया चेतावनी)।`,
        valuesSummary: `${vPrev.weightKg} kg → ${vLatest.weightKg} kg (+${wDiff} kg in ${Math.round(weeksDiff)}w)`,
      });
    }
  }

  // -------------------------------------------------------------
  // Rule 3: SFH Falling Behind (↘)
  // (SFH - weeks) got more negative at each of the last 2 visits -> "growth slowing"
  // -------------------------------------------------------------
  const visitsWithSfh = visits.filter(
    (v) =>
      typeof v.sfhCm === 'number' &&
      v.sfhCm > 0 &&
      typeof v.gestationalWeeks === 'number' &&
      v.gestationalWeeks >= 20
  );

  if (visitsWithSfh.length >= 2) {
    const lastVisits = visitsWithSfh.slice(-3); // check last 2 or 3
    if (lastVisits.length >= 2) {
      const vPrev = lastVisits[lastVisits.length - 2];
      const vLatest = lastVisits[lastVisits.length - 1];
      const gapPrev = vPrev.sfhCm! - vPrev.gestationalWeeks!;
      const gapLatest = vLatest.sfhCm! - vLatest.gestationalWeeks!;

      // Check if gap is negative and getting more negative (e.g. -1 -> -3, or -2 -> -5)
      // or if 3 visits are available, -1 -> -3 -> -5
      let isFallingBehind = false;
      if (lastVisits.length === 3) {
        const vFirst = lastVisits[0];
        const gapFirst = vFirst.sfhCm! - vFirst.gestationalWeeks!;
        if (gapFirst > gapPrev && gapPrev > gapLatest && gapLatest <= -2) {
          isFallingBehind = true;
        }
      }
      if (!isFallingBehind && gapLatest < gapPrev && gapLatest <= -2 && (gapPrev - gapLatest >= 1.5)) {
        isFallingBehind = true;
      }

      if (isFallingBehind) {
        flags.push({
          id: `trend-sfh-falling-${patient.id}`,
          type: 'SFH_FALLING_BEHIND',
          direction: '↘',
          severity: 'AMBER',
          labelEnglish: 'growth slowing',
          labelHindi: 'शिशु का विकास धीमा (SFH कम)',
          detailEnglish: `Symphysis-fundal height gap widened from ${gapPrev} cm to ${gapLatest} cm below gestational age (fetal growth restriction risk).`,
          detailHindi: `गर्भाशय की ऊंचाई (SFH) गर्भ सप्ताह से ${Math.abs(gapLatest)} सेमी पिछड़ रही है (शिशु विकास धीमा)।`,
          valuesSummary: `SFH ${vPrev.sfhCm}cm (${gapPrev >= 0 ? `+${gapPrev}` : gapPrev}) → ${vLatest.sfhCm}cm (${gapLatest >= 0 ? `+${gapLatest}` : gapLatest})`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // Rule 4: Hb Falling (↘)
  // Dropped ≥1.0 g/dL across visits
  // -------------------------------------------------------------
  // Collect Hb from visits or lab tests
  const hbReadings: { date: string; value: number }[] = [];
  
  // From visits
  visits.forEach((v) => {
    if (typeof v.hbGdl === 'number' && v.hbGdl > 0) {
      hbReadings.push({ date: v.timestamp, value: v.hbGdl });
    }
  });

  // From lab tests
  patient.tests?.forEach((t) => {
    if (t.id.includes('hb') && t.status === 'DONE' && t.result) {
      const match = t.result.match(/(\d+(\.\d+)?)\s*g\/dL/i);
      if (match) {
        hbReadings.push({
          date: t.completedDate || 'Earlier',
          value: parseFloat(match[1]),
        });
      }
    }
  });

  if (hbReadings.length >= 2) {
    const firstHb = hbReadings[0].value;
    const latestHb = hbReadings[hbReadings.length - 1].value;
    const drop = Number((firstHb - latestHb).toFixed(1));

    // Also check consecutive visits drop
    let maxConsecutiveDrop = 0;
    for (let i = 1; i < hbReadings.length; i++) {
      const diff = hbReadings[i - 1].value - hbReadings[i].value;
      if (diff > maxConsecutiveDrop) maxConsecutiveDrop = diff;
    }

    if (drop >= 1.0 || (maxConsecutiveDrop >= 0.8 && latestHb < 9.5)) {
      flags.push({
        id: `trend-hb-falling-${patient.id}`,
        type: 'HB_FALLING',
        direction: '↘',
        severity: 'AMBER',
        labelEnglish: 'Hb falling',
        labelHindi: 'हीमोग्लोबिन स्तर में गिरावट',
        detailEnglish: `Hemoglobin dropped from ${firstHb} to ${latestHb} g/dL (drop: -${drop} g/dL; progressive anemia).`,
        detailHindi: `हीमोग्लोबिन ${firstHb} से गिरकर ${latestHb} g/dL हो गया (-${drop} g/dL की गिरावट)।`,
        valuesSummary: `${firstHb} → ${latestHb} g/dL (-${drop} g/dL)`,
      });
    }
  }

  // -------------------------------------------------------------
  // Rule 5: Overdue Visit (↗)
  // No visit for more than 5 weeks
  // -------------------------------------------------------------
  if (visits.length > 0) {
    const latestVisit = visits[visits.length - 1];
    const latestTime = new Date(latestVisit.timestamp).getTime();
    const now = Date.now();
    const diffMs = now - latestTime;

    if (diffMs > FIVE_WEEKS_MS) {
      const weeksOverdue = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      flags.push({
        id: `trend-visit-overdue-${patient.id}`,
        type: 'VISIT_OVERDUE',
        direction: '↗',
        severity: 'AMBER',
        labelEnglish: 'visit overdue',
        labelHindi: 'नियमित भेंट में देरी',
        detailEnglish: `No antenatal visit recorded for ${weeksOverdue} weeks (threshold is >5 weeks).`,
        detailHindi: `पिछले ${weeksOverdue} सप्ताह से कोई जांच दर्ज नहीं हुई है (5 सप्ताह से अधिक की देरी)।`,
        valuesSummary: `Last visit: ${weeksOverdue} weeks ago`,
      });
    }
  }

  // Determine highest severity from trend flags
  let trendSeverity: SeverityLevel = 'GREEN';
  for (const flag of flags) {
    trendSeverity = maxSeverity(trendSeverity, flag.severity);
  }

  return {
    patientId: patient.id,
    flags,
    trendSeverity,
    hasTrendRisk: flags.length > 0,
  };
}

/**
 * Computes the final patient level using worst(rule level, trend level, AI level).
 * AI can never lower a level.
 */
export function computeFinalPatientLevel(
  ruleLevel: SeverityLevel = 'GREEN',
  trendLevel: SeverityLevel = 'GREEN',
  aiLevel?: SeverityLevel
): SeverityLevel {
  const worstOfRuleAndTrend = maxSeverity(ruleLevel, trendLevel);
  if (!aiLevel) return worstOfRuleAndTrend;
  return maxSeverity(worstOfRuleAndTrend, aiLevel);
}

// Trend types that describe a physiological trajectory (as opposed to a missed visit)
const PHYSIOLOGICAL_TREND_TYPES: TrendFlag['type'][] = [
  'BP_RISING',
  'WEIGHT_CROSSING_BAND',
  'SFH_FALLING_BEHIND',
  'HB_FALLING',
];

/**
 * Hidden risk: the latest visit passed every single-value rule (GREEN),
 * but the multi-visit trajectory shows a physiological trend.
 */
export function detectHiddenTrendRisk(latestRuleSeverity: SeverityLevel, flags: TrendFlag[]): boolean {
  return latestRuleSeverity === 'GREEN' && flags.some((f) => PHYSIOLOGICAL_TREND_TYPES.includes(f.type));
}

export interface PatientRiskState {
  trendFlags: TrendFlag[];
  trendSeverity: SeverityLevel;
  overallLevel: SeverityLevel;
  riskSource: 'SINGLE_RULE' | 'TREND' | 'AI_HIDDEN' | 'ROUTINE';
  hiddenTrendRisk: boolean;
}

/**
 * Single source of truth for a mother's derived risk state.
 * overallLevel = worst(latest rule level, trend level, optional AI level).
 */
export function computePatientRiskState(
  patient: MotherProfile,
  aiScan?: { level: SeverityLevel; hiddenRisk: boolean }
): PatientRiskState {
  const trend = analyzeMotherTrends(patient);
  const latestRuleSeverity: SeverityLevel = patient.visits[0]?.finalSeverity || 'GREEN';
  const overallLevel = computeFinalPatientLevel(latestRuleSeverity, trend.trendSeverity, aiScan?.level);
  const hiddenTrendRisk = detectHiddenTrendRisk(latestRuleSeverity, trend.flags);

  let riskSource: PatientRiskState['riskSource'] = 'ROUTINE';
  if (latestRuleSeverity === 'RED' || latestRuleSeverity === 'AMBER') {
    riskSource = 'SINGLE_RULE';
  } else if (aiScan?.hiddenRisk) {
    riskSource = 'AI_HIDDEN';
  } else if (trend.hasTrendRisk) {
    riskSource = 'TREND';
  }

  return {
    trendFlags: trend.flags,
    trendSeverity: trend.trendSeverity,
    overallLevel,
    riskSource,
    hiddenTrendRisk,
  };
}
