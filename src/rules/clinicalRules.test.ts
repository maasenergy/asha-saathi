import { describe, expect, it } from 'vitest';
import {
  evaluateClinicalRules,
  evaluateBirthPlanSafetyRule,
  ruleBasedDeliveryPlace,
} from './clinicalRules';
import { makeMother, makeVisit } from './testHelpers';

describe('evaluateClinicalRules', () => {
  it('severe systolic BP (160/100) is RED and needs transfer', () => {
    const r = evaluateClinicalRules({ systolicBp: 160, diastolicBp: 100, symptoms: [] });
    expect(r.finalSeverity).toBe('RED');
    expect(r.needsImmediateTransfer).toBe(true);
    expect(r.triggers.map((t) => t.ruleId)).toContain('BP_SYS_CRITICAL_HIGH');
  });

  it('severe diastolic BP (150/110) is RED', () => {
    const r = evaluateClinicalRules({ systolicBp: 150, diastolicBp: 110, symptoms: [] });
    expect(r.finalSeverity).toBe('RED');
  });

  it('BP 144/94 with proteinuria 1+ is RED (pre-eclampsia combo)', () => {
    const r = evaluateClinicalRules({ systolicBp: 144, diastolicBp: 94, symptoms: [], urineProtein: '1+' });
    expect(r.finalSeverity).toBe('RED');
    expect(r.triggers.map((t) => t.ruleId)).toContain('PRE_ECLAMPSIA_COMBO_RED');
    expect(r.riskTags).toContain('Pre-eclampsia risk');
  });

  it('BP 144/94 alone is AMBER, not RED', () => {
    const r = evaluateClinicalRules({ systolicBp: 144, diastolicBp: 94, symptoms: [] });
    expect(r.finalSeverity).toBe('AMBER');
  });

  it('normal BP with no findings is GREEN', () => {
    const r = evaluateClinicalRules({ systolicBp: 118, diastolicBp: 76, symptoms: [] });
    expect(r.finalSeverity).toBe('GREEN');
    expect(r.triggers).toHaveLength(0);
  });

  it('uses the mother profile: height < 145 cm triggers the obstructed-labour rule', () => {
    const r = evaluateClinicalRules({
      systolicBp: 118,
      diastolicBp: 76,
      symptoms: [],
      patientProfile: makeMother({ heightCm: 143 }),
    });
    expect(r.triggers.map((t) => t.ruleId)).toContain('SHORT_STATURE_AMBER');
    expect(r.riskTags).toContain('Obstructed labour risk');
  });
});

describe('evaluateBirthPlanSafetyRule', () => {
  it('height 143 cm: an AI suggestion of PHC is upgraded, never PHC', () => {
    const mother = makeMother({ heightCm: 143, visits: [makeVisit(3)] });
    const r = evaluateBirthPlanSafetyRule(mother, 'PHC');
    expect(r.finalPlace).not.toBe('PHC');
    expect(r.upgradedBySafetyRule).toBe(true);
    expect(r.riskTags).toContain('Obstructed labour risk');
  });

  it('height 143 cm: the rule-only (AI offline) plan is never PHC', () => {
    const mother = makeMother({ heightCm: 143, visits: [makeVisit(3)] });
    expect(ruleBasedDeliveryPlace(mother).place).not.toBe('PHC');
  });

  it('low-risk mother: PHC suggestion is kept', () => {
    const mother = makeMother({ visits: [makeVisit(3)] });
    const r = evaluateBirthPlanSafetyRule(mother, 'PHC');
    expect(r.finalPlace).toBe('PHC');
    expect(r.upgradedBySafetyRule).toBe(false);
  });

  it('a higher-level AI suggestion is never downgraded', () => {
    const mother = makeMother({ heightCm: 143, visits: [makeVisit(3)] });
    const r = evaluateBirthPlanSafetyRule(mother, 'District hospital / medical college');
    expect(r.finalPlace).toBe('District hospital / medical college');
  });
});
