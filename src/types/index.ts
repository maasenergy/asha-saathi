/**
 * Types & Schemas for ASHA Saathi by Maas Doc
 */
import { SeverityLevel } from '../rules/clinicalRules';
export type { SeverityLevel };

export type UserRole = 'ASHA' | 'DOCTOR' | 'MOTHER';
export type AppLanguage = 'hi' | 'en';

export type AlertLifecycleStatus =
  | 'none'
  | 'Created'
  | 'Visible in demo'
  | 'Acknowledged by doctor'
  | 'Doctor responded';

export interface DoctorAdvicePayload {
  message: string;
  doctorName: string;
  sentAt: string;
  actionPlan: string;
  isEmergencyReferral: boolean;
}

export interface SbarDraft {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface AiHandoffDraft {
  sbar: SbarDraft;
  hindiSummary: string;
  generatedAt: string;
  model: string;
}

export type SwellingType = 'none' | 'feet_only' | 'face_or_hands';
export type FetalMovementStatus = 'normal' | 'reduced' | 'absent' | 'not_felt';
export type BabyPosition = 'head_down' | 'breech' | 'transverse' | 'unknown';
export type UrineProtein = 'nil' | 'trace' | '1+' | '2+' | '3+';
export type UrineSugar = 'nil' | 'trace' | '1+' | '2+' | '3+';
export type TdDose = '0' | '1' | '2' | 'booster';

export interface VisitRecord {
  id: string;
  patientId: string;
  timestamp: string; // ISO string
  recordedBy: string; // e.g. "ASHA Sunita"
  rawTranscript: string;
  inputLanguage: 'hi' | 'en' | 'hinglish';
  
  // Confirmed clinical fields
  systolicBp: number | null;
  diastolicBp: number | null;
  gestationalWeeks: number | null;
  weightKg?: number | null;
  sfhCm?: number | null; // Symphysis-Fundal Height in cm
  hbGdl?: number | null; // Hemoglobin in g/dL
  symptoms: string[];
  otherObservations: string;
  uncertainFields: string[];

  // Rich Visit Inputs (Section 2)
  swellingType?: SwellingType | null;
  fetalMovementStatus?: FetalMovementStatus | null;
  muacCm?: number | null; // Mid-Upper Arm Circumference
  pallor?: boolean | null; // Pale eyes / conjunctiva or nails
  urineProtein?: UrineProtein | null;
  urineSugar?: UrineSugar | null;
  babyPosition?: BabyPosition | null;
  ifaTabletsLeft?: number | null;
  calciumTabletsLeft?: number | null;
  ifaAdherencePercent?: number | null;
  tdDoses?: TdDose | null;
  bloodSugarMgDl?: number | null;
  pulseBpm?: number | null;
  tempF?: number | null;
  spo2Percent?: number | null;
  isSelfReported?: boolean;
  
  // Status flags
  isConfirmed: boolean;
  confirmedAt?: string;
  
  // Deterministic evaluation
  ruleSeverity: SeverityLevel;
  ruleTriggers: string[];
  finalSeverity: SeverityLevel;
  needsImmediateTransfer: boolean;
  
  // Lifecycle & Alert tracking
  alertStatus: AlertLifecycleStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  doctorAdvice?: DoctorAdvicePayload;
  
  // AI draft
  aiHandoffDraft?: AiHandoffDraft;
  isAiFallback?: boolean;
  aiError?: string;
}

export type AncTestStatus = 'DONE' | 'PENDING' | 'OVERDUE';

export interface AncTestItem {
  id: string;
  name: string;
  nameHindi: string;
  category: 'LAB' | 'SCAN' | 'VACCINE' | 'ROUTINE';
  status: AncTestStatus;
  result?: string;
  completedDate?: string;
  dueDate?: string;
  clinicalNote?: string;
}

export interface TrendFlag {
  id: string;
  type: 'BP_RISING' | 'WEIGHT_CROSSING_BAND' | 'SFH_FALLING_BEHIND' | 'HB_FALLING' | 'VISIT_OVERDUE';
  direction: '↗' | '↘';
  severity: SeverityLevel; // Typically AMBER / YELLOW
  labelEnglish: string;
  labelHindi: string;
  detailEnglish: string;
  detailHindi: string;
  valuesSummary: string;
}

export interface MotherTrendAnalysis {
  patientId: string;
  flags: TrendFlag[];
  trendSeverity: SeverityLevel;
  hasTrendRisk: boolean;
}

export interface AiMotherScanItem {
  patientId: string;
  priority: number; // 1 = see first
  level: SeverityLevel; // 'GREEN' | 'AMBER' | 'RED'
  reason: string; // One short line in Hindi/English
  suggestedAction: string;
  hiddenRisk: boolean; // True if risk is only visible from combination/trend, not from single rule
}

export interface BirthPlanChecklistItem {
  id: string;
  labelEnglish: string;
  labelHindi: string;
  done: boolean;
}

export interface BirthPlan {
  id: string;
  patientId: string;
  generatedAt: string;
  deliveryPlace: 'PHC' | 'CHC/FRU with C-section' | 'District hospital / medical college';
  originalAiDeliveryPlace?: string;
  upgradedBySafetyRule: boolean;
  safetyRuleReason?: string;
  deliveryPlaceReason: string[];
  leaveHomeBy: string;
  riskTags: string[];
  prepareChecklist: BirthPlanChecklistItem[];
  ashaMessage: string;
  motherMessage: string;
  doctorSummary: string;
  // True when Gemini was unavailable and the plan came only from the deterministic safety rules
  isRuleEngineOnly?: boolean;
  doctorApproved?: boolean;
  doctorApprovedAt?: string;
  doctorChosenFacility?: string;
  doctorNotes?: string;
}

export interface KickCountSession {
  id: string;
  timestamp: string; // ISO string
  count: number;
  durationMinutes: number; // e.g. 120 (2h)
  isCompleted: boolean;
  alertTriggered?: 'NONE' | 'YELLOW_FEWER_THAN_10' | 'RED_FIFTY_PERCENT_DROP';
}

export type MoodFace = 'great' | 'good' | 'neutral' | 'sad' | 'crying';

export interface MoodLogItem {
  id: string;
  date: string; // YYYY-MM-DD
  mood: MoodFace;
  timestamp: string;
}

export interface FoodLogItem {
  id: string;
  date: string; // YYYY-MM-DD
  mealsCount: number;
  proteinFoods: string[]; // 'dal' | 'egg' | 'milk' | 'meat_fish' | 'sprouts'
  timestamp: string;
}

export interface VomitingLogItem {
  id: string;
  date: string; // YYYY-MM-DD
  frequency: 'none' | '1-2_times' | 'cannot_keep_down';
  timestamp: string;
}

export interface MotherSelfLog {
  kickSessions: KickCountSession[];
  moodLogs: MoodLogItem[];
  foodLogs: FoodLogItem[];
  vomitingLogs: VomitingLogItem[];
  hasHomeDevices: boolean;
}

export interface ObstetricHistory {
  gravida: number;
  para: number;
  previousCSection: boolean;
  cSectionCount: number;
  previousStillbirth: boolean;
  miscarriagesCount: number;
  previousPretermBirth: boolean;
  previousLowBirthWeight: boolean;
  previousPph: boolean;
  lastDeliveryDate?: string | null;
}

export interface MotherProfile {
  id: string;
  name: string;
  age: number;
  village: string;
  address?: string;
  landmark?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
  phone: string; // Synthetic/fictional
  language?: 'hi' | 'en' | 'mr';

  // Antenatal timing
  lmpDate?: string; // YYYY-MM-DD or 'unknown'
  isLmpUnknown?: boolean;
  gestationalWeeks: number;
  edd: string;

  // Anthropometry
  heightCm?: number;
  prePregnancyWeightKg?: number;
  currentWeightKg?: number;
  muacCm?: number;

  // Obstetric history (Step B)
  gravida: number;
  para: number;
  obstetricHistory?: ObstetricHistory;

  // Clinical & Laboratory Status (Step C)
  bloodGroup?: string; // 'A+' | 'B+' | 'O+' | 'AB+' | 'A-' | 'B-' | 'O-' | 'AB-' | 'unknown'
  fatherBloodGroup?: string; // 'A+' | 'B+' | 'O+' | 'AB+' | 'A-' | 'B-' | 'O-' | 'AB-' | 'unknown'
  diabetesStatus?: 'none' | 'gestational' | 'pre-existing';
  hasThyroid?: boolean;
  hasHeartDisease?: boolean;
  hasEpilepsy?: boolean;
  hasTb?: boolean;
  hasSickleCell?: boolean;
  infectiousStatus?: {
    hiv: 'positive' | 'negative' | 'unknown';
    hbsag: 'positive' | 'negative' | 'unknown';
    syphilis: 'positive' | 'negative' | 'unknown';
  };
  hasTwins?: boolean;
  hasPreEclampsiaRisk?: boolean;
  hasPlacentaPrevia?: boolean;

  // Life & Access (Step D)
  usesTobaccoOrMishri?: boolean;
  travelTimeToHospitalMinutes?: number;
  hasTransport?: boolean;
  supportPersonName?: string;
  supportPersonPhone?: string;

  // Assignment & Facilities
  ashaAssigned: string;
  phcCenter: string;
  highRiskFactors: string[];
  riskTags?: string[];
  currentVisitSlotOpen: boolean;
  dailyKickCount?: number;
  nextFollowUpDate?: string;
  tests: AncTestItem[];
  visits: VisitRecord[];

  // Profile Completeness
  profileCompletenessPercent?: number;

  // AI Birth Plan
  birthPlan?: BirthPlan;

  // Mother Self-Inputs & Logs
  selfLogs?: MotherSelfLog;

  // Historical trajectories
  muacHistory?: { date: string; muacCm: number }[];
  kickHistory7Days?: { date: string; count: number }[];
  
  // Proactive Trend & AI Scan Fields
  trendFlags?: TrendFlag[];
  trendSeverity?: SeverityLevel;
  aiScanResult?: AiMotherScanItem;
  overallLevel?: SeverityLevel; // worst(rule, trend, AI)
  riskSource?: 'SINGLE_RULE' | 'TREND' | 'AI_HIDDEN' | 'ROUTINE';
  hiddenTrendRisk?: boolean; // latest visit GREEN but trend engine shows a physiological trajectory
}

export type TransportStatusType =
  | 'CARE_TEAM_ALERTED'
  | 'FAMILY_CALLING_108'
  | 'ASHA_DISPATCHED'
  | 'IN_TRANSIT_TO_PHC'
  | 'DISPATCH_CONFIRMED';

export interface EmergencySosAlert {
  id: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  status: AlertLifecycleStatus;
  trigger: 'Mother SOS Button';
  address?: string;
  landmark?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
  transportStatus?: TransportStatusType;
  transportNotes?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  doctorAdvice?: DoctorAdvicePayload;
  resolved?: boolean;
  resolvedAt?: string;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  actor: 'ASHA' | 'Doctor' | 'Mother' | 'System' | 'AI';
  action: string;
  patientName: string;
  details: string;
  severity?: SeverityLevel;
}

export interface DemoAppState {
  patients: MotherProfile[];
  sosAlerts: EmergencySosAlert[];
  activities: ActivityLogItem[];
  selectedPatientId: string;
  activeMotherId?: string; // "who am I" in the Mother role
  activeRole: UserRole;
  language: AppLanguage;
  lastUpdated: string;
}
