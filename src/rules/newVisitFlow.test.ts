import { describe, expect, it } from 'vitest';
import { evaluateClinicalRules, computePatientRiskState } from './clinicalRules';
import { INITIAL_PATIENTS } from '../data/seedData';
import { MotherProfile, VisitRecord } from '../types';

// Mirrors AshaView.handleConfirmAndSave: full visit fields + full mother profile go to the rule engine.
describe('new visit flow (ASHA confirm & save)', () => {
  const kavita = INITIAL_PATIENTS.find((p) => p.name === 'Kavita More') as MotherProfile;

  it('Kavita More: BP 144/94 + urine protein 1+ + face swelling -> RED with pre-eclampsia and PPH tags', () => {
    const visitFields = {
      systolicBp: 144,
      diastolicBp: 94,
      gestationalWeeks: 34,
      symptoms: [],
      urineProtein: '1+' as const,
      swellingType: 'face_or_hands' as const,
    };

    const evaluation = evaluateClinicalRules({ ...visitFields, patientProfile: kavita });

    expect(evaluation.finalSeverity).toBe('RED');
    expect(evaluation.triggers.map((t) => t.ruleId)).toContain('PRE_ECLAMPSIA_COMBO_RED');
    expect(evaluation.riskTags).toContain('Pre-eclampsia risk');
    expect(evaluation.riskTags).toContain('PPH risk');

    // Profile-based rules now fire on new visits (they did not before step 2)
    expect(evaluation.triggers.map((t) => t.ruleId)).toContain('RH_NEGATIVE_REMINDER');

    const newVisit: VisitRecord = {
      ...visitFields,
      id: 'vis-test',
      patientId: kavita.id,
      timestamp: new Date().toISOString(),
      recordedBy: 'test',
      rawTranscript: '',
      inputLanguage: 'hinglish',
      otherObservations: '',
      uncertainFields: [],
      isConfirmed: true,
      ruleSeverity: evaluation.ruleSeverity,
      ruleTriggers: evaluation.triggers.map((t) => t.criterionEnglish),
      finalSeverity: evaluation.finalSeverity,
      needsImmediateTransfer: evaluation.needsImmediateTransfer,
      alertStatus: 'Visible in demo',
    };
    const risk = computePatientRiskState({ ...kavita, visits: [newVisit, ...kavita.visits] });
    expect(risk.overallLevel).toBe('RED');
  });
});
