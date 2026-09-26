/**
 * Antenatal Calculations and Clinical Utility Helpers
 * ASHA Saathi by Maas Doc
 */

import { MotherProfile } from '../types';

/**
 * Calculates gestational age in completed weeks and estimated date of delivery (EDD)
 * from Last Menstrual Period (LMP) using Naegele's rule (LMP + 280 days).
 */
export function calculateWeeksAndEddFromLmp(lmpDateStr: string | null | undefined): {
  gestationalWeeks: number;
  edd: string;
  isValid: boolean;
} {
  if (!lmpDateStr || lmpDateStr === 'unknown') {
    return {
      gestationalWeeks: 20, // safe mid-pregnancy default if unknown
      edd: '',
      isValid: false,
    };
  }

  try {
    // Support YYYY-MM by appending -01
    const normalizedStr = lmpDateStr.length === 7 ? `${lmpDateStr}-01` : lmpDateStr;
    const lmpDate = new Date(normalizedStr);
    if (isNaN(lmpDate.getTime())) {
      return { gestationalWeeks: 20, edd: '', isValid: false };
    }

    const today = new Date();
    const diffMs = today.getTime() - lmpDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Gestational age in completed weeks
    const gestationalWeeks = Math.max(1, Math.min(43, Math.floor(diffDays / 7)));

    // EDD = LMP + 280 days (40 weeks)
    const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
    const edd = eddDate.toISOString().slice(0, 10);

    return {
      gestationalWeeks,
      edd,
      isValid: true,
    };
  } catch (err) {
    console.warn('Error calculating EDD from LMP:', err);
    return { gestationalWeeks: 20, edd: '', isValid: false };
  }
}

/**
 * Generates an ISO date string (YYYY-MM-DD) for an LMP corresponding to given weeks.
 * Useful for seed data generation and testing.
 */
export function getLmpForWeeks(weeks: number): string {
  const daysAgo = weeks * 7;
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates IFA or Calcium supplement adherence percentage based on tablets remaining.
 */
export function calculateSupplementAdherence(tabletsGiven: number, tabletsLeft: number): number {
  if (tabletsGiven <= 0) return 100;
  const taken = Math.max(0, tabletsGiven - tabletsLeft);
  return Math.min(100, Math.round((taken / tabletsGiven) * 100));
}

/**
 * Computes profile completeness percentage (0-100%) across the 4 registration steps.
 */
export function calculateProfileCompleteness(p: Partial<MotherProfile>): number {
  let score = 0;
  const totalWeight = 100;

  // Step A: Basics (25 pts)
  let stepA = 0;
  if (p.name) stepA += 4;
  if (p.age) stepA += 4;
  if (p.village) stepA += 4;
  if (p.phone) stepA += 4;
  if (p.heightCm) stepA += 4;
  if (p.prePregnancyWeightKg) stepA += 2;
  if (p.lmpDate || p.gestationalWeeks) stepA += 3;
  score += Math.min(25, stepA);

  // Step B: Obstetric history (25 pts)
  let stepB = 0;
  if (typeof p.gravida === 'number') stepB += 5;
  if (typeof p.para === 'number') stepB += 5;
  if (p.obstetricHistory) {
    if (typeof p.obstetricHistory.previousCSection === 'boolean') stepB += 4;
    if (typeof p.obstetricHistory.previousStillbirth === 'boolean') stepB += 4;
    if (typeof p.obstetricHistory.previousPretermBirth === 'boolean') stepB += 4;
    if (typeof p.obstetricHistory.previousPph === 'boolean') stepB += 3;
  } else {
    // If not filled, partial credit if gravida=1 primi
    if (p.gravida === 1) stepB += 15;
  }
  score += Math.min(25, stepB);

  // Step C: Health & Comorbidities (25 pts)
  let stepC = 0;
  if (p.bloodGroup) stepC += 5;
  if (p.fatherBloodGroup) stepC += 4;
  if (p.diabetesStatus) stepC += 4;
  if (typeof p.hasHeartDisease === 'boolean') stepC += 4;
  if (typeof p.hasTwins === 'boolean') stepC += 4;
  if (p.infectiousStatus) stepC += 4;
  score += Math.min(25, stepC);

  // Step D: Life & Access (25 pts)
  let stepD = 0;
  if (typeof p.usesTobaccoOrMishri === 'boolean') stepD += 7;
  if (typeof p.travelTimeToHospitalMinutes === 'number') stepD += 6;
  if (typeof p.hasTransport === 'boolean') stepD += 6;
  if (p.supportPersonName || p.supportPersonPhone) stepD += 6;
  score += Math.min(25, stepD);

  return Math.min(totalWeight, Math.round(score));
}

/**
 * Text-to-speech audio reader using the browser SpeechSynthesis API.
 * High-utility for illiterate or semi-literate mothers and ASHAs in rural field visits.
 */
export function speakText(text: string, language: 'hi' | 'en' = 'en') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[—#*•_]/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}
