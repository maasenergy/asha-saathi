/**
 * Gemini Service Client (Browser -> Express Backend Proxy)
 * 
 * Invokes server-side /api/gemini/* endpoints.
 * Never exposes API keys in client-side code.
 */
import {
  VisitRecord,
  MotherProfile,
  SbarDraft,
  BirthPlan,
  SwellingType,
  FetalMovementStatus,
  BabyPosition,
  UrineProtein,
  UrineSugar,
  TdDose,
} from '../types';
import { evaluateBirthPlanSafetyRule, ruleBasedDeliveryPlace } from '../rules/clinicalRules';

export interface ExtractionResponseData {
  rawTranscript: string;
  systolicBp: number | null;
  diastolicBp: number | null;
  gestationalWeeks: number | null;
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
  tdDoses?: TdDose | null;
  sfhCm?: number | null;
  hbGdl?: number | null;
  bloodSugarMgDl?: number | null;
  pulseBpm?: number | null;
  tempF?: number | null;
  spo2Percent?: number | null;
  symptoms: string[];
  otherObservations: string;
  uncertainFields: string[];
  hindiTranscriptInterpretation?: string;
}

export interface HandoffResponseData {
  sbar: SbarDraft;
  hindiSummary: string;
  generatedAt: string;
  model: string;
}

export async function extractVisitWithGemini(
  transcript: string,
  language: 'hi' | 'en' | 'hinglish',
  patientContext?: { name: string; gestationalWeeks: number }
): Promise<{ success: boolean; data?: ExtractionResponseData; error?: string; isAiUnavailable?: boolean }> {
  try {
    const res = await fetch('/api/gemini/extract-visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: transcript,
        language,
        patientContext,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: body?.error || `HTTP error ${res.status}: Failed to extract visit data`,
        isAiUnavailable: Boolean(body?.isAiUnavailable),
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    console.error('Network/Client error during extractVisitWithGemini:', err);
    return {
      success: false,
      error: err?.message || 'Network connection failed while calling AI service.',
      isAiUnavailable: true,
    };
  }
}

export async function draftHandoffWithGemini(
  confirmedVisit: Partial<VisitRecord>,
  patientProfile: MotherProfile,
  ruleFlags: string[]
): Promise<{ success: boolean; data?: HandoffResponseData; error?: string; isAiUnavailable?: boolean }> {
  try {
    const res = await fetch('/api/gemini/draft-handoff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmedVisit,
        patientProfile,
        ruleFlags,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: body?.error || `HTTP error ${res.status}: Failed to generate SBAR draft`,
        isAiUnavailable: Boolean(body?.isAiUnavailable),
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    console.error('Network/Client error during draftHandoffWithGemini:', err);
    return {
      success: false,
      error: err?.message || 'Network connection failed while generating handoff draft.',
      isAiUnavailable: true,
    };
  }
}

export async function scanMothersWithGemini(
  mothers: MotherProfile[],
  language: 'hi' | 'en' = 'hi'
): Promise<{ success: boolean; data: import('../types').AiMotherScanItem[]; error?: string; isAiUnavailable?: boolean }> {
  try {
    const res = await fetch('/api/gemini/scan-mothers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mothers,
        language,
      }),
    });

    const body = await res.json();

    if (res.ok && Array.isArray(body.data) && body.data.length > 0) {
      const suffix = language === 'hi' ? ' — डॉक्टर समीक्षा हेतु' : ' — for doctor review';
      const sanitized = body.data.map((item: any) => {
        let reason = String(item.reason || '').trim();
        let suggestedAction = String(item.suggestedAction || '').trim();
        if (!reason.includes('डॉक्टर समीक्षा') && !reason.includes('doctor review')) {
          reason = `${reason}${suffix}`;
        }
        if (!suggestedAction.includes('डॉक्टर समीक्षा') && !suggestedAction.includes('doctor review')) {
          suggestedAction = `${suggestedAction}${suffix}`;
        }
        return {
          ...item,
          reason,
          suggestedAction,
        };
      });
      return {
        success: true,
        data: sanitized,
      };
    }

    throw new Error(body?.error || `HTTP error ${res.status}: Failed to scan mothers`);
  } catch (err: any) {
    // No AI-looking fallback text: callers apply the deterministic rule + trend engines instead.
    console.warn('Gemini mother scan unavailable; rule-engine result only:', err?.message);
    return {
      success: false,
      data: [],
      error: err?.message || 'AI scan unavailable',
      isAiUnavailable: true,
    };
  }
}

/**
 * Invokes Gemini or deterministic safety fallback to synthesize an AI Birth Plan.
 */
export async function generateBirthPlanWithGemini(
  patientProfile: MotherProfile,
  language: 'hi' | 'en' = 'hi'
): Promise<{ success: boolean; data?: BirthPlan; error?: string; isAiUnavailable?: boolean }> {
  try {
    const res = await fetch('/api/gemini/birth-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientProfile,
        visitHistory: patientProfile.visits || [],
        ruleFlags: patientProfile.visits[0]?.ruleTriggers || [],
        trendFlags: patientProfile.trendFlags || [],
        language,
      }),
    });

    const body = await res.json();

    if (res.ok && body.success && body.data) {
      // Ensure safety rule in code is strictly honored
      const safetyCheck = evaluateBirthPlanSafetyRule(
        patientProfile,
        body.data.deliveryPlace
      );

      const checklistItems = (body.data.prepareChecklist || []).map((text: string, idx: number) => ({
        id: `chk-${patientProfile.id}-${idx}`,
        labelEnglish: text,
        labelHindi: text,
        done: false,
      }));

      const plan: BirthPlan = {
        id: `bp-${patientProfile.id}-${Date.now()}`,
        patientId: patientProfile.id,
        generatedAt: new Date().toISOString(),
        deliveryPlace: safetyCheck.finalPlace,
        originalAiDeliveryPlace: body.data.deliveryPlace,
        upgradedBySafetyRule: safetyCheck.upgradedBySafetyRule || Boolean(body.data.upgradedBySafetyRule),
        safetyRuleReason: safetyCheck.safetyRuleReason || body.data.safetyRuleReason,
        deliveryPlaceReason: body.data.deliveryPlaceReason || [],
        leaveHomeBy: body.data.leaveHomeBy || 'At first onset of true labour pains',
        riskTags: Array.from(new Set([...(body.data.riskTags || []), ...safetyCheck.riskTags])),
        prepareChecklist: checklistItems,
        ashaMessage: body.data.ashaMessage || '',
        motherMessage: body.data.motherMessage || '',
        doctorSummary: body.data.doctorSummary || '',
        doctorApproved: false,
      };

      return {
        success: true,
        data: plan,
      };
    }

    // Fallback if backend returned error
    return generateDeterministicFallbackBirthPlan(patientProfile, language);
  } catch (err: any) {
    console.warn('Network error during generateBirthPlanWithGemini, using deterministic fallback:', err);
    return generateDeterministicFallbackBirthPlan(patientProfile, language);
  }
}

/**
 * AI-offline birth plan: facility, reasons and risk tags come only from the deterministic
 * safety rules. No free-text messages are generated, so nothing can be mistaken for AI output.
 */
function generateDeterministicFallbackBirthPlan(
  p: MotherProfile,
  lang: 'hi' | 'en'
): { success: boolean; data: BirthPlan; isAiUnavailable: boolean } {
  const { place, reasons, riskTags } = ruleBasedDeliveryPlace(p);

  // Standard GoI birth-preparedness checklist (static guideline items, same for every mother)
  const standardChecklist = [
    { en: 'Two voluntary blood donors identified and blood groups verified', hi: 'रक्तदान हेतु 2 दाताओं की पहचान व रक्त समूह की पुष्टि' },
    { en: 'Emergency transport arranged (102 ambulance number saved)', hi: 'आपातकालीन वाहन व्यवस्था (102 एम्बुलेंस का नंबर सहेजा गया)' },
    { en: 'MCP card, Aadhaar and bank passbook ready for JSY', hi: 'एमसीपी कार्ड, आधार कार्ड व बैंक पासबुक जेएसवाई योजना हेतु तैयार' },
    { en: 'Family support companion identified for hospital stay', hi: 'अस्पताल में साथ रुकने हेतु परिजन/सहायक का चयन' },
    { en: 'Clean newborn clothes and hospital bag packed', hi: 'नवजात शिशु के साफ कपड़े व प्रसव किट का थैला तैयार' },
  ];

  const plan: BirthPlan = {
    id: `bp-rules-${p.id}-${Date.now()}`,
    patientId: p.id,
    generatedAt: new Date().toISOString(),
    deliveryPlace: place,
    upgradedBySafetyRule: false,
    deliveryPlaceReason:
      reasons.length > 0
        ? reasons
        : [lang === 'hi' ? 'कोई सुरक्षा जोखिम कारक दर्ज नहीं' : 'No safety-rule risk factor recorded'],
    leaveHomeBy:
      place === 'PHC'
        ? (lang === 'hi' ? 'पहले प्रसव दर्द या पानी छूटते ही' : 'At first sign of labour or membrane rupture')
        : (lang === 'hi' ? 'EDD से 5-7 दिन पूर्व भर्ती या दर्द शुरू होते ही' : 'Admit 5-7 days before EDD or at first labour pain'),
    riskTags,
    prepareChecklist: standardChecklist.map((item, idx) => ({
      id: `chk-rules-${p.id}-${idx}`,
      labelEnglish: item.en,
      labelHindi: item.hi,
      done: false,
    })),
    ashaMessage: '',
    motherMessage: '',
    doctorSummary: '',
    isRuleEngineOnly: true,
    doctorApproved: false,
  };

  return {
    success: true,
    data: plan,
    isAiUnavailable: true,
  };
}
