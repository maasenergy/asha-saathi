import { MotherProfile, VisitRecord } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal confirmed visit `daysAgo` days in the past; override any field. */
export function makeVisit(daysAgo: number, overrides: Partial<VisitRecord> = {}): VisitRecord {
  const timestamp = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  return {
    id: `vis-${daysAgo}-${Math.random().toString(36).slice(2, 6)}`,
    patientId: 'pat-test',
    timestamp,
    recordedBy: 'test',
    rawTranscript: '',
    inputLanguage: 'en',
    systolicBp: 120,
    diastolicBp: 80,
    gestationalWeeks: 30,
    symptoms: [],
    otherObservations: '',
    uncertainFields: [],
    isConfirmed: true,
    ruleSeverity: 'GREEN',
    ruleTriggers: [],
    finalSeverity: 'GREEN',
    needsImmediateTransfer: false,
    alertStatus: 'none',
    ...overrides,
  };
}

/** Low-risk synthetic mother; override any field. Visits are newest first, like the app. */
export function makeMother(overrides: Partial<MotherProfile> = {}): MotherProfile {
  return {
    id: 'pat-test',
    name: 'Test Mother',
    age: 25,
    village: 'Test Village',
    phone: '0000000000',
    gestationalWeeks: 32,
    edd: '2027-01-01',
    heightCm: 155,
    gravida: 2,
    para: 1,
    ashaAssigned: 'ASHA',
    phcCenter: 'PHC',
    highRiskFactors: [],
    currentVisitSlotOpen: false,
    tests: [],
    visits: [],
    ...overrides,
  };
}
