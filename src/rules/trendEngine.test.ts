import { describe, expect, it } from 'vitest';
import {
  analyzeMotherTrends,
  computeFinalPatientLevel,
  computePatientRiskState,
} from './trendEngine';
import { SeverityLevel } from '../types';
import { makeMother, makeVisit } from './testHelpers';

// Every reading individually normal (<140/90), but BP climbs each visit and weight jumps 2.5 kg in 2 weeks.
const risingBpMother = () =>
  makeMother({
    visits: [
      makeVisit(2, { systolicBp: 134, diastolicBp: 86, weightKg: 57.5, gestationalWeeks: 32 }),
      makeVisit(16, { systolicBp: 124, diastolicBp: 80, weightKg: 55.0, gestationalWeeks: 30 }),
      makeVisit(30, { systolicBp: 112, diastolicBp: 72, weightKg: 54.2, gestationalWeeks: 28 }),
    ],
  });

describe('analyzeMotherTrends', () => {
  it('rising BP series (112 -> 124 -> 134) raises a BP_RISING flag', () => {
    const r = analyzeMotherTrends(risingBpMother());
    expect(r.flags.map((f) => f.type)).toContain('BP_RISING');
    expect(r.trendSeverity).toBe('AMBER');
  });

  it('2.5 kg weight jump in 2 weeks raises WEIGHT_CROSSING_BAND', () => {
    const r = analyzeMotherTrends(risingBpMother());
    expect(r.flags.map((f) => f.type)).toContain('WEIGHT_CROSSING_BAND');
  });

  it('stable BP raises no BP flag', () => {
    const r = analyzeMotherTrends(
      makeMother({
        visits: [makeVisit(2), makeVisit(16), makeVisit(30)],
      })
    );
    expect(r.flags.map((f) => f.type)).not.toContain('BP_RISING');
  });

  it('no visit for > 5 weeks raises VISIT_OVERDUE', () => {
    const r = analyzeMotherTrends(makeMother({ visits: [makeVisit(40)] }));
    expect(r.flags.map((f) => f.type)).toContain('VISIT_OVERDUE');
  });
});

describe('computePatientRiskState (hidden risk comes from the trend engine)', () => {
  it('rule-GREEN latest visit + rising BP trend = hidden trend risk, overall AMBER', () => {
    const r = computePatientRiskState(risingBpMother());
    expect(r.hiddenTrendRisk).toBe(true);
    expect(r.overallLevel).toBe('AMBER');
    expect(r.riskSource).toBe('TREND');
  });

  it('an overdue visit alone is not a hidden physiological risk', () => {
    const r = computePatientRiskState(makeMother({ visits: [makeVisit(40)] }));
    expect(r.hiddenTrendRisk).toBe(false);
  });
});

describe('computeFinalPatientLevel: AI can never lower the level', () => {
  const levels: SeverityLevel[] = ['GREEN', 'AMBER', 'RED'];
  const rank = { GREEN: 1, AMBER: 2, RED: 3 };

  it('final level is never below the rule or trend level, for every AI level', () => {
    for (const rule of levels) {
      for (const trend of levels) {
        for (const ai of levels) {
          const final = computeFinalPatientLevel(rule, trend, ai);
          expect(rank[final]).toBeGreaterThanOrEqual(rank[rule]);
          expect(rank[final]).toBeGreaterThanOrEqual(rank[trend]);
        }
      }
    }
  });

  it('RED rule + GREEN AI stays RED', () => {
    expect(computeFinalPatientLevel('RED', 'GREEN', 'GREEN')).toBe('RED');
  });

  it('AI GREEN cannot lower a RED visit in computePatientRiskState', () => {
    const mother = makeMother({
      visits: [makeVisit(1, { systolicBp: 165, diastolicBp: 112, ruleSeverity: 'RED', finalSeverity: 'RED' })],
    });
    expect(computePatientRiskState(mother, { level: 'GREEN', hiddenRisk: false }).overallLevel).toBe('RED');
  });
});
