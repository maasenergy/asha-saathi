/**
 * Demo Context & Multi-Tab Synchronization
 * 
 * NOTICE:
 * Uses browser localStorage with 'storage' event listener and short polling fallback
 * exclusively for local cross-tab demonstration of role transitions.
 * This is explicitly LABELED: DEMO-ONLY STORAGE (NOT A PRODUCTION ARCHITECTURE).
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  DemoAppState,
  MotherProfile,
  VisitRecord,
  EmergencySosAlert,
  TransportStatusType,
  UserRole,
  AppLanguage,
  ActivityLogItem,
  DoctorAdvicePayload,
  AiMotherScanItem,
  AiHandoffDraft,
  SeverityLevel,
  KickCountSession,
  MoodLogItem,
  MoodFace,
  BirthPlan,
} from '../types';
import { getInitialAppState } from '../data/seedData';
import { computePatientRiskState } from '../rules/trendEngine';
import { scanMothersWithGemini, generateBirthPlanWithGemini } from '../services/geminiService';
import { calculateProfileCompleteness, calculateWeeksAndEddFromLmp } from '../utils/ancCalculations';

const DEMO_STORAGE_KEY = 'ASHA_SAATHI_DEMO_STORAGE_V3';

interface DemoContextType {
  state: DemoAppState;
  activeRole: UserRole;
  language: AppLanguage;
  selectedPatient: MotherProfile | undefined;
  activeMother: MotherProfile | undefined;
  setActiveMotherId: (id: string) => void;
  patients: MotherProfile[];
  urgentAlerts: {
    visits: { patient: MotherProfile; visit: VisitRecord }[];
    sos: EmergencySosAlert[];
    totalUnacknowledged: number;
    totalUrgent: number;
  };
  aiScanResults: AiMotherScanItem[];
  isScanningMothers: boolean;
  isAiOffline: boolean;
  runMotherScan: (force?: boolean) => Promise<void>;
  setRole: (role: UserRole) => void;
  setLanguage: (lang: AppLanguage) => void;
  setSelectedPatientId: (id: string) => void;
  addVisit: (patientId: string, visit: VisitRecord, riskTags?: string[]) => void;
  updateVisitDraft: (
    patientId: string,
    visitId: string,
    draft: AiHandoffDraft,
    isFallback?: boolean,
    aiError?: string
  ) => void;
  acknowledgeVisit: (visitId: string, doctorName?: string) => void;
  respondDoctorAdvice: (
    visitId: string,
    payload: { message: string; actionPlan?: string; isEmergencyReferral?: boolean },
    doctorName?: string
  ) => void;
  triggerMotherSos: (
    patientId: string,
    options?: {
      address?: string;
      landmark?: string;
      gpsCoordinates?: { latitude: number; longitude: number };
    }
  ) => string;
  acknowledgeSos: (sosId: string, doctorName?: string, adviceText?: string) => void;
  updateSosTransportStatus: (
    sosId: string,
    transportStatus: TransportStatusType,
    notes?: string
  ) => void;
  resolveSosAlert: (sosId: string) => void;
  logFetalKick: (patientId: string) => void;
  registerNewMother: (profile: MotherProfile) => void;
  updateMotherProfile: (patientId: string, updates: Partial<MotherProfile>) => void;
  updateBirthPlanChecklist: (patientId: string, checklistItemId: string, done: boolean) => void;
  approveBirthPlan: (patientId: string, doctorName?: string, chosenFacility?: string, notes?: string) => void;
  refreshBirthPlan: (patientId: string, patientOverride?: MotherProfile) => Promise<void>;
  logMotherSelfInputs: (
    patientId: string,
    type: 'KICK_SESSION' | 'MOOD' | 'FOOD' | 'VOMITING' | 'SELF_VITALS',
    payload: any
  ) => void;
  updateTestStatus: (patientId: string, testId: string, status: 'DONE' | 'PENDING' | 'OVERDUE', result?: string) => void;
  resetDemoData: () => void;
}

const DemoContext = createContext<DemoContextType | null>(null);

/**
 * Recomputes a mother's derived risk fields (trend flags, overall level, risk source, hidden risk)
 * from her visits plus an optional AI scan item. The AI level can only raise the overall level.
 */
function withRiskState(p: MotherProfile, aiScan?: AiMotherScanItem): MotherProfile {
  const risk = computePatientRiskState(p, aiScan);
  return {
    ...p,
    aiScanResult: aiScan,
    trendFlags: risk.trendFlags,
    trendSeverity: risk.trendSeverity,
    overallLevel: risk.overallLevel,
    riskSource: risk.riskSource,
    hiddenTrendRisk: risk.hiddenTrendRisk,
  };
}

function loadStateFromStorage(): DemoAppState {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.patients)) {
        return {
          ...parsed,
          language: parsed.language === 'hi' ? 'hi' : 'en',
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse demo state from localStorage, initializing fresh:', err);
  }
  const initial = getInitialAppState();
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial));
  } catch (e) {
    console.warn('Failed to write initial demo state to localStorage:', e);
  }
  return initial;
}

function saveStateToStorage(state: DemoAppState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(DEMO_STORAGE_KEY, serialized);
  } catch (err) {
    console.error('Failed to write demo state to localStorage:', err);
  }
}

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DemoAppState>(loadStateFromStorage);
  const [aiScanResults, setAiScanResults] = useState<AiMotherScanItem[]>([]);
  const [isScanningMothers, setIsScanningMothers] = useState<boolean>(false);
  const [isAiOffline, setIsAiOffline] = useState<boolean>(false);
  const scanRanRef = useRef(false);

  const getScanCacheKey = useCallback((lang: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return `ASHA_SAATHI_AI_SCAN_CACHE_${todayStr}_${lang}`;
  }, []);

  // Sync across tabs via window 'storage' event
  useEffect(() => {
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === DEMO_STORAGE_KEY && event.newValue) {
        try {
          const updated = JSON.parse(event.newValue);
          if (updated && updated.lastUpdated !== state.lastUpdated) {
            setState(updated);
          }
        } catch (err) {
          console.error('Failed to sync storage change:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    // Short polling fallback (800ms) for same-window context or iframe sandboxes
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          const fresh = JSON.parse(raw);
          if (fresh && fresh.lastUpdated && fresh.lastUpdated !== state.lastUpdated) {
            setState(fresh);
          }
        }
      } catch (err) {
        // ignore polling read err
      }
    }, 800);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(interval);
    };
  }, [state.lastUpdated]);

  const updateStateAndBroadcast = useCallback((updater: (prev: DemoAppState) => DemoAppState) => {
    setState((prev) => {
      const next = updater(prev);
      const withTimestamp = {
        ...next,
        lastUpdated: new Date().toISOString(),
      };
      saveStateToStorage(withTimestamp);
      return withTimestamp;
    });
  }, []);

  const setRole = useCallback((role: UserRole) => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      activeRole: role,
      // Switching role keeps the user's chosen language (English unless they picked another)
    }));
  }, [updateStateAndBroadcast]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      language: lang,
    }));
  }, [updateStateAndBroadcast]);

  const setActiveMotherId = useCallback((id: string) => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      activeMotherId: id,
    }));
  }, [updateStateAndBroadcast]);

  const setSelectedPatientId = useCallback((id: string) => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      selectedPatientId: id,
    }));
  }, [updateStateAndBroadcast]);

  const applyScanResults = useCallback((scanItems: AiMotherScanItem[], logActivity: boolean) => {
    updateStateAndBroadcast((prev) => {
      const updated = prev.patients.map((p) =>
        withRiskState(p, scanItems.find((item) => item.patientId === p.id))
      );
      if (!logActivity) return { ...prev, patients: updated };

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'AI',
        action: 'Proactive Maternal Scan Completed',
        patientName: 'Cohort Overview',
        details: `Proactively analyzed ${prev.patients.length} mothers for trajectories and hidden risks.`,
        severity: 'AMBER',
      };
      return { ...prev, patients: updated, activities: [newActivity, ...prev.activities] };
    });
  }, [updateStateAndBroadcast]);

  const runMotherScan = useCallback(async (force = false) => {
    setIsScanningMothers(true);
    const cacheKey = getScanCacheKey(state.language);

    if (!force) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed: AiMotherScanItem[] = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAiScanResults(parsed);
            setIsAiOffline(false);
            applyScanResults(parsed, false);
            setIsScanningMothers(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to read AI scan cache:', err);
      }
    }

    try {
      const res = await scanMothersWithGemini(state.patients, state.language === 'en' ? 'en' : 'hi');
      if (res.success && res.data.length > 0) {
        setAiScanResults(res.data);
        setIsAiOffline(false);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {
          // ignore storage full
        }
        applyScanResults(res.data, true);
      } else {
        // AI offline: deterministic rule + trend engines only
        setAiScanResults([]);
        setIsAiOffline(true);
        applyScanResults([], false);
      }
    } catch (err) {
      console.error('Error in runMotherScan:', err);
      setIsAiOffline(true);
    } finally {
      setIsScanningMothers(false);
    }
  }, [state.language, state.patients, getScanCacheKey, applyScanResults]);

  // Auto-run on load and whenever language changes
  const prevLangRef = useRef(state.language);
  useEffect(() => {
    if (!scanRanRef.current || prevLangRef.current !== state.language) {
      scanRanRef.current = true;
      prevLangRef.current = state.language;
      runMotherScan(false);
    }
  }, [state.language, runMotherScan]);

  const addVisit = useCallback((patientId: string, visit: VisitRecord, riskTags: string[] = []) => {
    updateStateAndBroadcast((prev) => {
      const patient = prev.patients.find((p) => p.id === patientId);
      const patientName = patient ? patient.name : 'Patient';

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'ASHA',
        action: `Visit Confirmed (${visit.finalSeverity})`,
        patientName,
        details: `Confirmed BP: ${visit.systolicBp ?? '--'}/${visit.diastolicBp ?? '--'} mmHg. Symptoms: ${visit.symptoms.join(', ') || 'None'}. Triggers: ${visit.ruleTriggers.join('; ') || 'Routine'}.`,
        severity: visit.finalSeverity,
      };

      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId) {
          return withRiskState(
            {
              ...p,
              currentVisitSlotOpen: false,
              visits: [visit, ...p.visits],
              riskTags: Array.from(new Set([...(p.riskTags || []), ...riskTags])),
            },
            p.aiScanResult
          );
        }
        return p;
      });

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const updateVisitDraft = useCallback((
    patientId: string,
    visitId: string,
    draft: AiHandoffDraft,
    isFallback = false,
    aiError?: string
  ) => {
    updateStateAndBroadcast((prev) => {
      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId) {
          const updatedVisits = p.visits.map((v) => {
            if (v.id === visitId) {
              return {
                ...v,
                aiHandoffDraft: draft,
                isAiFallback: isFallback,
                aiError,
              };
            }
            return v;
          });
          return {
            ...p,
            visits: updatedVisits,
          };
        }
        return p;
      });
      return {
        ...prev,
        patients: updatedPatients,
      };
    });
  }, [updateStateAndBroadcast]);

  const acknowledgeVisit = useCallback((visitId: string, doctorName = 'Dr. Anand Verma (MO, PHC)') => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Patient';
      let foundVisit: VisitRecord | null = null;

      const updatedPatients = prev.patients.map((p) => {
        const visitIdx = p.visits.findIndex((v) => v.id === visitId);
        if (visitIdx !== -1) {
          patientName = p.name;
          const v = p.visits[visitIdx];
          foundVisit = v;
          const updatedVisits = [...p.visits];
          updatedVisits[visitIdx] = {
            ...v,
            alertStatus: 'Acknowledged by doctor',
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: doctorName,
          };
          return {
            ...p,
            visits: updatedVisits,
          };
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Doctor',
        action: 'Alert Acknowledged',
        patientName,
        details: `${doctorName} acknowledged urgent alert for visit #${visitId.slice(-6)}.`,
        severity: foundVisit ? (foundVisit as VisitRecord).finalSeverity : 'RED',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const respondDoctorAdvice = useCallback((
    visitId: string,
    payload: { message: string; actionPlan?: string; isEmergencyReferral?: boolean },
    doctorName = 'Dr. Anand Verma (MO, PHC)'
  ) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Patient';
      const doctorAdvice: DoctorAdvicePayload = {
        message: payload.message,
        actionPlan: payload.actionPlan || 'Immediate in-person evaluation & monitoring',
        doctorName,
        sentAt: new Date().toISOString(),
        isEmergencyReferral: payload.isEmergencyReferral ?? true,
      };

      const updatedPatients = prev.patients.map((p) => {
        const visitIdx = p.visits.findIndex((v) => v.id === visitId);
        if (visitIdx !== -1) {
          patientName = p.name;
          const v = p.visits[visitIdx];
          const updatedVisits = [...p.visits];
          updatedVisits[visitIdx] = {
            ...v,
            alertStatus: 'Doctor responded',
            doctorAdvice,
          };
          return {
            ...p,
            visits: updatedVisits,
          };
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Doctor',
        action: 'Doctor Advice Sent',
        patientName,
        details: `Sent clinical instructions: "${payload.message}"`,
        severity: 'RED',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const triggerMotherSos = useCallback((
    patientId: string,
    options?: {
      address?: string;
      landmark?: string;
      gpsCoordinates?: { latitude: number; longitude: number };
    }
  ): string => {
    const sosId = `sos-${Date.now()}`;
    updateStateAndBroadcast((prev) => {
      const patient = prev.patients.find((p) => p.id === patientId);
      const patientName = patient ? patient.name : 'Mother';
      const address = options?.address || patient?.address || 'Address not recorded';
      const landmark = options?.landmark || patient?.landmark || '';
      const gpsCoordinates = options?.gpsCoordinates || patient?.gpsCoordinates;

      const newSos: EmergencySosAlert = {
        id: sosId,
        patientId,
        patientName,
        timestamp: new Date().toISOString(),
        status: 'Visible in demo',
        trigger: 'Mother SOS Button',
        address,
        landmark,
        gpsCoordinates,
        transportStatus: 'CARE_TEAM_ALERTED',
      };

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Mother',
        action: 'EMERGENCY SOS TRIGGERED',
        patientName,
        details: `Mother pressed Emergency SOS button. Care team alerted with address: "${address}"${gpsCoordinates ? ` and GPS: ${gpsCoordinates.latitude.toFixed(4)}, ${gpsCoordinates.longitude.toFixed(4)}` : ''}.`,
        severity: 'RED',
      };

      return {
        ...prev,
        sosAlerts: [newSos, ...prev.sosAlerts],
        activities: [newActivity, ...prev.activities],
      };
    });
    return sosId;
  }, [updateStateAndBroadcast]);

  const updateSosTransportStatus = useCallback((
    sosId: string,
    transportStatus: TransportStatusType,
    notes?: string
  ) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Mother';
      const updatedSos = prev.sosAlerts.map((s) => {
        if (s.id === sosId) {
          patientName = s.patientName;
          return {
            ...s,
            transportStatus,
            transportNotes: notes || s.transportNotes,
          };
        }
        return s;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'System',
        action: 'Transport Status Updated',
        patientName,
        details: `Transport status changed to "${transportStatus}". ${notes ? `Notes: ${notes}` : ''}`,
        severity: 'RED',
      };

      return {
        ...prev,
        sosAlerts: updatedSos,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const logFetalKick = useCallback((patientId: string) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Mother';
      let newCount = 1;

      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId) {
          patientName = p.name;
          newCount = (p.dailyKickCount || 0) + 1;
          return {
            ...p,
            dailyKickCount: newCount,
          };
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Mother',
        action: 'Baby Movement Logged',
        patientName,
        details: `Logged +1 fetal kick. Total logged today: ${newCount} kicks (WHO / ANC standard: ≥10 in 2 hrs).`,
        severity: 'GREEN',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const acknowledgeSos = useCallback((
    sosId: string,
    doctorName = 'Dr. Anand Verma (MO, PHC)',
    adviceText?: string
  ) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Mother';
      const updatedSos = prev.sosAlerts.map((s) => {
        if (s.id === sosId) {
          patientName = s.patientName;
          const status = adviceText ? ('Doctor responded' as const) : ('Acknowledged by doctor' as const);
          return {
            ...s,
            status,
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: doctorName,
            doctorAdvice: adviceText
              ? {
                  message: adviceText,
                  doctorName,
                  sentAt: new Date().toISOString(),
                  actionPlan: 'Immediate emergency transport & in-person exam',
                  isEmergencyReferral: true,
                }
              : undefined,
          };
        }
        return s;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Doctor',
        action: adviceText ? 'SOS Advice Sent' : 'SOS Alert Acknowledged',
        patientName,
        details: adviceText ? `${doctorName} sent: "${adviceText}"` : `${doctorName} acknowledged SOS alert.`,
        severity: 'RED',
      };

      return {
        ...prev,
        sosAlerts: updatedSos,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const resolveSosAlert = useCallback((sosId: string) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Mother';
      const updatedSos = prev.sosAlerts.map((s) => {
        if (s.id === sosId) {
          patientName = s.patientName;
          return {
            ...s,
            resolved: true,
            status: 'Doctor responded' as const,
            resolvedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Doctor',
        action: 'Emergency SOS Resolved & Closed',
        patientName,
        details: `Doctor resolved emergency SOS alert for ${patientName}. Emergency feed closed and ASHA notified.`,
        severity: 'GREEN',
      };

      return {
        ...prev,
        sosAlerts: updatedSos,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const updateTestStatus = useCallback((
    patientId: string,
    testId: string,
    status: 'DONE' | 'PENDING' | 'OVERDUE',
    result?: string
  ) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Patient';
      let testName = 'Test';

      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId && p.tests) {
          patientName = p.name;
          const updatedTests = p.tests.map((t) => {
            if (t.id === testId) {
              testName = t.name;
              return {
                ...t,
                status,
                result: result !== undefined ? result : t.result,
                completedDate: status === 'DONE' ? (t.completedDate || 'Today') : undefined,
              };
            }
            return t;
          });
          return {
            ...p,
            tests: updatedTests,
          };
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'ASHA',
        action: `Test Updated: ${status}`,
        patientName,
        details: `${testName} marked as ${status}${result ? ` (${result})` : ''}`,
        severity: status === 'OVERDUE' ? 'AMBER' : 'GREEN',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const registerNewMother = useCallback((profile: MotherProfile) => {
    updateStateAndBroadcast((prev) => {
      const calcWeeks = profile.lmpDate ? calculateWeeksAndEddFromLmp(profile.lmpDate) : null;
      const weeks = calcWeeks?.gestationalWeeks ?? profile.gestationalWeeks ?? 12;
      const edd = calcWeeks?.edd ?? profile.edd ?? '2026-12-01';
      const completeness = calculateProfileCompleteness(profile);

      const newMother: MotherProfile = {
        ...profile,
        gestationalWeeks: weeks,
        edd,
        profileCompletenessPercent: completeness,
        visits: profile.visits || [],
        tests: profile.tests || [],
        overallLevel: profile.overallLevel || 'GREEN',
        riskSource: 'ROUTINE',
        ashaAssigned: profile.ashaAssigned || 'Sunita Tai (ASHA)',
        phcCenter: profile.phcCenter || 'Navapur Primary Health Centre',
      };

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'ASHA',
        action: 'Mother Registered',
        patientName: profile.name,
        details: `Registered ${profile.name} (G${profile.gravida}P${profile.para}, ${weeks}w, EDD ${edd}). Profile ${completeness}% complete.`,
        severity: 'GREEN',
      };

      return {
        ...prev,
        patients: [newMother, ...prev.patients],
        selectedPatientId: newMother.id,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const updateMotherProfile = useCallback((patientId: string, updates: Partial<MotherProfile>) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Patient';
      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId) {
          patientName = p.name;
          const merged: MotherProfile = { ...p, ...updates };
          if (updates.lmpDate) {
            const calc = calculateWeeksAndEddFromLmp(updates.lmpDate);
            if (calc) {
              merged.gestationalWeeks = calc.gestationalWeeks;
              merged.edd = calc.edd;
            }
          }
          merged.profileCompletenessPercent = calculateProfileCompleteness(merged);
          return merged;
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'ASHA',
        action: 'Profile Updated',
        patientName,
        details: `Updated maternal profile and health history.`,
        severity: 'GREEN',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const updateBirthPlanChecklist = useCallback((patientId: string, checklistItemId: string, done: boolean) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Patient';
      let itemLabel = '';
      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId && p.birthPlan) {
          patientName = p.name;
          const updatedItems = (p.birthPlan.prepareChecklist || []).map((item) => {
            if (item.id === checklistItemId) {
              itemLabel = item.labelEnglish || item.labelHindi;
              return { ...item, done };
            }
            return item;
          });
          return {
            ...p,
            birthPlan: {
              ...p.birthPlan,
              prepareChecklist: updatedItems,
            },
          };
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'ASHA',
        action: done ? 'Checklist Item Completed' : 'Checklist Item Reopened',
        patientName,
        details: `Birth readiness: "${itemLabel.slice(0, 50)}" marked as ${done ? 'Completed' : 'Pending'}.`,
        severity: 'GREEN',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const approveBirthPlan = useCallback((
    patientId: string,
    doctorName = 'Dr. Anand Verma (MO, PHC)',
    chosenFacility?: string,
    notes?: string
  ) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Patient';
      let finalPlace = chosenFacility;

      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId && p.birthPlan) {
          patientName = p.name;
          finalPlace = chosenFacility || p.birthPlan.deliveryPlace;
          const facilityChanged = Boolean(chosenFacility && chosenFacility !== p.birthPlan.deliveryPlace);
          return {
            ...p,
            birthPlan: {
              ...p.birthPlan,
              deliveryPlace: finalPlace as BirthPlan['deliveryPlace'],
              doctorChosenFacility: facilityChanged ? chosenFacility : p.birthPlan.doctorChosenFacility,
              doctorApproved: true,
              doctorApprovedAt: new Date().toISOString(),
              doctorNotes: notes || `Approved by ${doctorName} for designated delivery at ${finalPlace}`,
            },
          };
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Doctor',
        action: 'Birth Plan Approved',
        patientName,
        details: `${doctorName} approved delivery facility: ${finalPlace}. Notification dispatched to ASHA & Mother.`,
        severity: 'GREEN',
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const refreshBirthPlan = useCallback(async (patientId: string, patientOverride?: MotherProfile) => {
    // patientOverride lets callers pass a just-updated profile before React state has settled
    const currentPatient = patientOverride || state.patients.find((p) => p.id === patientId);
    if (!currentPatient) return;

    try {
      const res = await generateBirthPlanWithGemini(currentPatient, state.language === 'en' ? 'en' : 'hi');
      if (res && res.data) {
        const newPlan = res.data;
        updateStateAndBroadcast((prev) => {
          let oldFacility = '';
          const updatedPatients = prev.patients.map((p) => {
            if (p.id === patientId) {
              oldFacility = p.birthPlan?.deliveryPlace || '';
              return {
                ...p,
                birthPlan: newPlan,
              };
            }
            return p;
          });

          const facilityChanged = oldFacility && oldFacility !== newPlan.deliveryPlace;
          const newActivity: ActivityLogItem = {
            id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            actor: 'System',
            action: facilityChanged ? 'Facility Designation Changed' : 'Birth Plan Generated',
            patientName: currentPatient.name,
            details: facilityChanged
              ? `Delivery facility shifted from ${oldFacility} to ${newPlan.deliveryPlace}. ASHA Sunita alerted.`
              : `Generated AI Birth Plan: ${newPlan.deliveryPlace}. ${newPlan.upgradedBySafetyRule ? '(Upgraded by safety rule)' : ''}`,
            severity: facilityChanged || newPlan.upgradedBySafetyRule ? 'AMBER' : 'GREEN',
          };

          return {
            ...prev,
            patients: updatedPatients,
            activities: [newActivity, ...prev.activities],
          };
        });
      }
    } catch (e) {
      console.error('Error refreshing birth plan:', e);
    }
  }, [state.patients, state.language, updateStateAndBroadcast]);

  const logMotherSelfInputs = useCallback((
    patientId: string,
    type: 'KICK_SESSION' | 'MOOD' | 'FOOD' | 'VOMITING' | 'SELF_VITALS',
    payload: any
  ) => {
    updateStateAndBroadcast((prev) => {
      let patientName = 'Mother';
      let alertSeverity: SeverityLevel = 'GREEN';
      let alertDetails = '';
      let isUrgentAlert = false;
      let newAlertStatus: VisitRecord['alertStatus'] = 'none';

      const updatedPatients = prev.patients.map((p) => {
        if (p.id === patientId) {
          patientName = p.name;
          const existingLogs = p.selfLogs || {
            kickSessions: [],
            moodLogs: [],
            foodLogs: [],
            vomitingLogs: [],
            hasHomeDevices: false,
          };

          const updated = { ...p };

          if (type === 'KICK_SESSION') {
            const count = Number(payload.count || 0);
            const durationMinutes = Number(payload.durationMinutes || 120);

            // Calculate 7-day average from kickHistory7Days or previous sessions
            const baselineAvg =
              p.kickHistory7Days && p.kickHistory7Days.length > 0
                ? p.kickHistory7Days.reduce((acc, curr) => acc + curr.count, 0) / p.kickHistory7Days.length
                : 10;

            const isBelowHalfBaseline = count < baselineAvg * 0.5;
            const isBelowTenInTwoHours = count < 10 && durationMinutes >= 120;

            const alertType: 'NONE' | 'YELLOW_FEWER_THAN_10' | 'RED_FIFTY_PERCENT_DROP' =
              isBelowHalfBaseline && durationMinutes >= 60
                ? 'RED_FIFTY_PERCENT_DROP'
                : isBelowTenInTwoHours
                ? 'YELLOW_FEWER_THAN_10'
                : 'NONE';

            const session: KickCountSession = {
              id: `kick-${Date.now()}`,
              timestamp: new Date().toISOString(),
              count,
              durationMinutes,
              isCompleted: Boolean(payload.isCompleted ?? true),
              alertTriggered: alertType,
            };

            if (isBelowHalfBaseline && durationMinutes >= 60) {
              alertSeverity = 'RED';
              alertDetails = `RED ALERT: Baby kicks severely dropped to ${count} in 2 hrs (<50% of 7-day avg ${baselineAvg.toFixed(1)}). Immediate ASHA & Doctor alert!`;
              isUrgentAlert = true;
              newAlertStatus = 'Visible in demo';
            } else if (isBelowTenInTwoHours) {
              alertSeverity = 'AMBER';
              alertDetails = `YELLOW ALERT: Baby movements reduced to ${count} in 2 hrs (standard ≥10). ASHA notified to visit.`;
              isUrgentAlert = true;
              newAlertStatus = 'Visible in demo';
            } else {
              alertDetails = `Normal movement session logged: ${count} kicks in 2 hours.`;
            }

            updated.dailyKickCount = count;
            updated.selfLogs = {
              ...existingLogs,
              kickSessions: [session, ...existingLogs.kickSessions],
            };

            // If urgent kick alert, add a visit flag to surface in Doctor and ASHA alert lists
            if (isUrgentAlert) {
              const alertVisit: VisitRecord = {
                id: `vis-self-kick-${Date.now()}`,
                patientId: p.id,
                timestamp: new Date().toISOString(),
                recordedBy: 'Mother (Self-Reported)',
                rawTranscript: `Fetal kick warning: ${count} kicks reported in 2 hours.`,
                inputLanguage: 'hi',
                systolicBp: null,
                diastolicBp: null,
                gestationalWeeks: p.gestationalWeeks,
                symptoms: [alertSeverity === 'RED' ? 'Critically reduced fetal movements' : 'Reduced fetal movements'],
                otherObservations: alertDetails,
                uncertainFields: [],
                isConfirmed: true,
                confirmedAt: new Date().toISOString(),
                ruleSeverity: alertSeverity,
                ruleTriggers: [alertDetails],
                finalSeverity: alertSeverity,
                needsImmediateTransfer: alertSeverity === 'RED',
                alertStatus: newAlertStatus,
                isSelfReported: true,
              };
              updated.visits = [alertVisit, ...p.visits];
              updated.overallLevel = alertSeverity === 'RED' ? 'RED' : p.overallLevel === 'RED' ? 'RED' : 'AMBER';
            }
          } else if (type === 'MOOD') {
            const face: MoodFace = payload.mood || 'neutral';
            const moodItem: MoodLogItem = {
              id: `mood-${Date.now()}`,
              date: new Date().toISOString().slice(0, 10),
              mood: face,
              timestamp: new Date().toISOString(),
            };

            const updatedMoods: MoodLogItem[] = [moodItem, ...existingLogs.moodLogs];
            // Check past 7 days: 3 or more low days (score <= 2 or 'sad'/'crying') -> YELLOW mental-health flag
            const recentWeekMoods = updatedMoods.slice(0, 7);
            const lowDaysCount = recentWeekMoods.filter((m) => m.mood === 'sad' || m.mood === 'crying').length;

            if (lowDaysCount >= 3) {
              alertSeverity = 'AMBER';
              alertDetails = `YELLOW ALERT: Persistent low mood reported (${lowDaysCount}/7 days). ASHA flagged for maternal mental health counselling.`;
              updated.riskTags = Array.from(new Set([...(updated.riskTags || []), 'Maternal mental health']));
            } else {
              alertDetails = `Daily mood recorded (${face}).`;
            }

            updated.selfLogs = {
              ...existingLogs,
              moodLogs: updatedMoods,
            };
          } else if (type === 'FOOD') {
            const foodItem = {
              id: `food-${Date.now()}`,
              date: new Date().toISOString().slice(0, 10),
              mealsCount: Number(payload.mealsCount || 3),
              proteinFoods: payload.proteinFoods || [],
              timestamp: new Date().toISOString(),
            };

            alertDetails = `Nutrition logged: ${foodItem.mealsCount} meals today with [${foodItem.proteinFoods.join(', ')}].`;
            updated.selfLogs = {
              ...existingLogs,
              foodLogs: [foodItem, ...existingLogs.foodLogs],
            };
          } else if (type === 'VOMITING') {
            const vomitingItem = {
              id: `vomit-${Date.now()}`,
              date: new Date().toISOString().slice(0, 10),
              frequency: payload.frequency || 'none',
              timestamp: new Date().toISOString(),
            };

            if (vomitingItem.frequency === 'cannot_keep_down') {
              alertSeverity = 'AMBER';
              alertDetails = `YELLOW ALERT: Mother cannot keep anything down (Hyperemesis / Dehydration risk). ASHA alert sent.`;
              const vomitVisit: VisitRecord = {
                id: `vis-self-vomit-${Date.now()}`,
                patientId: p.id,
                timestamp: new Date().toISOString(),
                recordedBy: 'Mother (Self-Reported)',
                rawTranscript: `Hyperemesis reported: unable to retain liquids or food.`,
                inputLanguage: 'hi',
                systolicBp: null,
                diastolicBp: null,
                gestationalWeeks: p.gestationalWeeks,
                symptoms: ['Hyperemesis / Severe vomiting - cannot keep food down'],
                otherObservations: 'Risk of acute dehydration and ketonuria.',
                uncertainFields: [],
                isConfirmed: true,
                confirmedAt: new Date().toISOString(),
                ruleSeverity: 'AMBER',
                ruleTriggers: ['Severe nausea/vomiting: cannot keep food down'],
                finalSeverity: 'AMBER',
                needsImmediateTransfer: false,
                alertStatus: 'Visible in demo',
                isSelfReported: true,
              };
              updated.visits = [vomitVisit, ...p.visits];
            } else {
              alertDetails = `Vomiting status logged: ${vomitingItem.frequency}.`;
            }

            updated.selfLogs = {
              ...existingLogs,
              vomitingLogs: [vomitingItem, ...existingLogs.vomitingLogs],
            };
          } else if (type === 'SELF_VITALS') {
            const sys = payload.systolicBp ? Number(payload.systolicBp) : null;
            const dia = payload.diastolicBp ? Number(payload.diastolicBp) : null;
            const wt = payload.weightKg ? Number(payload.weightKg) : null;

            if (wt) updated.currentWeightKg = wt;

            const selfVisit: VisitRecord = {
              id: `vis-self-vitals-${Date.now()}`,
              patientId: p.id,
              timestamp: new Date().toISOString(),
              recordedBy: 'Mother (Self-Reported)',
              rawTranscript: `Self-reported vitals: BP ${sys || '--'}/${dia || '--'} mmHg, Weight ${wt || '--'} kg.`,
              inputLanguage: 'hi',
              systolicBp: sys,
              diastolicBp: dia,
              gestationalWeeks: p.gestationalWeeks,
              weightKg: wt,
              symptoms: [],
              otherObservations: 'Self-reported by mother at home using digital BP / scale device.',
              uncertainFields: [],
              isConfirmed: true,
              confirmedAt: new Date().toISOString(),
              ruleSeverity: sys && sys >= 140 ? 'AMBER' : 'GREEN',
              ruleTriggers: sys && sys >= 140 ? ['Self-reported elevated BP (≥140/90)'] : [],
              finalSeverity: sys && sys >= 140 ? 'AMBER' : 'GREEN',
              needsImmediateTransfer: false,
              alertStatus: sys && sys >= 140 ? 'Visible in demo' : 'none',
              isSelfReported: true,
            };

            updated.visits = [selfVisit, ...p.visits];
            existingLogs.hasHomeDevices = true;
            updated.selfLogs = existingLogs;
            alertDetails = `Self vitals recorded: ${sys || '--'}/${dia || '--'} mmHg (Tagged Self-Reported).`;
          }

          return withRiskState(updated, p.aiScanResult);
        }
        return p;
      });

      const newActivity: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        actor: 'Mother',
        action: `Mother Self-Input: ${type}`,
        patientName,
        details: alertDetails,
        severity: alertSeverity,
      };

      return {
        ...prev,
        patients: updatedPatients,
        activities: [newActivity, ...prev.activities],
      };
    });
  }, [updateStateAndBroadcast]);

  const resetDemoData = useCallback(() => {
    const fresh = getInitialAppState();
    saveStateToStorage(fresh);
    setState(fresh);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`ASHA_SAATHI_AI_SCAN_CACHE_${todayStr}_hi`);
      localStorage.removeItem(`ASHA_SAATHI_AI_SCAN_CACHE_${todayStr}_en`);
    } catch (e) {
      // ignore
    }
    // Re-run scan with fresh seed data
    setTimeout(() => {
      runMotherScan(true);
    }, 100);
  }, [runMotherScan]);

  const selectedPatient = useMemo(() => {
    return state.patients.find((p) => p.id === state.selectedPatientId) || state.patients[0];
  }, [state.patients, state.selectedPatientId]);

  const activeMother = useMemo(() => {
    return state.patients.find((p) => p.id === state.activeMotherId) || state.patients[0];
  }, [state.patients, state.activeMotherId]);

  const urgentAlerts = useMemo(() => {
    const urgentVisits: { patient: MotherProfile; visit: VisitRecord }[] = [];
    let unacknowledgedCount = 0;

    state.patients.forEach((patient) => {
      patient.visits.forEach((visit) => {
        if (visit.finalSeverity === 'RED') {
          urgentVisits.push({ patient, visit });
          if (visit.alertStatus === 'Created' || visit.alertStatus === 'Visible in demo') {
            unacknowledgedCount += 1;
          }
        }
      });
    });

    const activeSos = state.sosAlerts.filter((sos) => !sos.resolved);
    activeSos.forEach((sos) => {
      if (sos.status === 'Created' || sos.status === 'Visible in demo') {
        unacknowledgedCount += 1;
      }
    });

    return {
      visits: urgentVisits,
      sos: activeSos,
      totalUnacknowledged: unacknowledgedCount,
      totalUrgent: urgentVisits.length + activeSos.length,
    };
  }, [state.patients, state.sosAlerts]);

  const value = useMemo(
    () => ({
      state,
      activeRole: state.activeRole,
      language: state.language,
      selectedPatient,
      activeMother,
      setActiveMotherId,
      patients: state.patients,
      urgentAlerts,
      aiScanResults,
      isScanningMothers,
      isAiOffline,
      runMotherScan,
      setRole,
      setLanguage,
      setSelectedPatientId,
      addVisit,
      updateVisitDraft,
      acknowledgeVisit,
      respondDoctorAdvice,
      triggerMotherSos,
      acknowledgeSos,
      updateSosTransportStatus,
      resolveSosAlert,
      logFetalKick,
      updateTestStatus,
      resetDemoData,
      registerNewMother,
      updateMotherProfile,
      updateBirthPlanChecklist,
      approveBirthPlan,
      refreshBirthPlan,
      logMotherSelfInputs,
    }),
    [
      state,
      selectedPatient,
      activeMother,
      setActiveMotherId,
      urgentAlerts,
      aiScanResults,
      isScanningMothers,
      isAiOffline,
      runMotherScan,
      setRole,
      setLanguage,
      setSelectedPatientId,
      addVisit,
      updateVisitDraft,
      acknowledgeVisit,
      respondDoctorAdvice,
      triggerMotherSos,
      acknowledgeSos,
      updateSosTransportStatus,
      resolveSosAlert,
      logFetalKick,
      updateTestStatus,
      resetDemoData,
      registerNewMother,
      updateMotherProfile,
      updateBirthPlanChecklist,
      approveBirthPlan,
      refreshBirthPlan,
      logMotherSelfInputs,
    ]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = (): DemoContextType => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
