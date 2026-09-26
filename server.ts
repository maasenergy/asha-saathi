import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

// Load .env first, then .env.local on top (matches the Vite convention used in this project;
// .env.local is git-ignored and is where a real GEMINI_API_KEY should go for local dev).
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Single source for the Gemini model name; override with GEMINI_MODEL in the environment
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Initialize GoogleGenAI server-side with User-Agent header
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI:', err);
  }
}

// Helper for retry on transient Gemini errors.
// The @google/genai SDK's ApiError.status is the numeric HTTP status code (e.g. 503, 429),
// not the string "UNAVAILABLE" — that string only appears (maybe) inside the JSON-stringified
// message body. Check the numeric status directly so this doesn't depend on message formatting.
async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 4, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const numericStatus = Number(err?.status ?? err?.code);
      const errStr = String(err?.message || err);
      const isTransient =
        numericStatus === 429 ||
        numericStatus === 503 ||
        (numericStatus >= 500 && numericStatus < 600) ||
        errStr.includes('UNAVAILABLE') ||
        errStr.includes('503') ||
        errStr.includes('429') ||
        errStr.includes('high demand') ||
        errStr.includes('overloaded') ||
        errStr.includes('Resource has been exhausted');
      if (isTransient && i < retries - 1) {
        console.warn(`Gemini API transient failure (attempt ${i + 1}/${retries}, status ${numericStatus || 'unknown'}). Retrying in ${delayMs * (i + 1)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    model: GEMINI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

/**
 * 1. extractVisit Endpoint
 * Extracts systolic, diastolic, gestational weeks, symptoms, and uncertain fields from spoken/typed text.
 */
app.post('/api/gemini/extract-visit', async (req: Request, res: Response) => {
  try {
    const { text, language = 'en', patientContext } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: 'Missing or empty transcript text for extraction.',
      });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment (GEMINI_API_KEY).',
        isAiUnavailable: true,
      });
    }

    const systemInstruction = `You are an expert bilingual clinical transcription parser for Indian Community Health Workers (ASHA workers) conducting antenatal home visits.
You parse spoken or typed Hindi, Hinglish, Marathi, or English maternal health reports.

CRITICAL TRANSLATION & EXTRACTION RULES:
1. Hindi/Hinglish number words for vitals — compose them generically:
   - Hundreds: "ek sau" = 100, "do sau" = 200.
   - Tens and units follow standard Hindi numerals (e.g. das 10, bees 20, tees 30, chaalis 40, pachaas 50,
     saath 60, sattar 70, assi 80, nabbe 90, and compound forms such as pachattar 75, pachaasi 85, baanave 92).
   - "ek sau" followed by a number word N means 100 + N.
   - "by", "bata", "par" or "/" separates systolic from diastolic.
   - Generic example: "BP ek sau pachaas by nabbe" -> systolicBp = 150, diastolicBp = 90.
   - Generic example: "BP 118/76" -> systolicBp = 118, diastolicBp = 76.
2. NEVER invent or hallucinate missing measurements. If BP or gestational age is NOT mentioned in the text, return null. Do NOT assume 120/80 or default weeks.
3. Symptoms:
   - "sar mein dard" / "sar dard" -> "Severe headache"
   - "aankhon ke aage dhundhla dikh raha hai" / "dhundhla dikhna" -> "Blurred vision / visual disturbance"
   - "haath paanv mein sujan" -> "Swelling of hands/feet (edema)"
   - "chakkar" -> "Dizziness"
   - "pet dard" -> "Abdominal pain"
   - "khoon aana" -> "Vaginal bleeding"
   - "sans phoolna" / "sans lene mein takleef" -> "Breathlessness"
   - "daura" / "jhatke" -> "Convulsions / seizures"
4. Include list of "uncertainFields" if any part of the transcript is ambiguous.
5. If extra non-vital observations are spoken (e.g. taking iron tablets, swelling, fatigue), record them in otherObservations.`;

    const userPrompt = `Antenatal Visit Transcript to parse:
"""
${text}
"""

Patient Context (if available):
${patientContext ? JSON.stringify(patientContext) : 'Not specified'}

Language hint: ${language}

Extract the exact values mentioned. Return valid JSON adhering to the schema.`;

    const response = await callGeminiWithRetry(() =>
      ai!.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.1, // low temperature for high extraction fidelity
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              systolicBp: {
                type: Type.INTEGER,
                description: 'Systolic blood pressure in mmHg, or null if not explicitly mentioned',
              },
              diastolicBp: {
                type: Type.INTEGER,
                description: 'Diastolic blood pressure in mmHg, or null if not explicitly mentioned',
              },
              gestationalWeeks: {
                type: Type.INTEGER,
                description: 'Gestational age in weeks if explicitly stated, or null if not mentioned',
              },
              weightKg: {
                type: Type.NUMBER,
                description: 'Maternal weight in kg, or null if not mentioned',
              },
              swellingType: {
                type: Type.STRING,
                description: 'Swelling type: "none", "feet_only", or "face_or_hands"',
              },
              fetalMovementStatus: {
                type: Type.STRING,
                description: 'Baby movements: "normal", "reduced", or "absent"',
              },
              muacCm: {
                type: Type.NUMBER,
                description: 'Mid-Upper Arm Circumference in cm, or null',
              },
              pallor: {
                type: Type.BOOLEAN,
                description: 'True if pallor/pale eyes/nails mentioned, or false',
              },
              urineProtein: {
                type: Type.STRING,
                description: 'Urine protein dipstick: "nil", "trace", "1+", "2+", "3+", or null',
              },
              urineSugar: {
                type: Type.STRING,
                description: 'Urine sugar dipstick: "nil", "trace", "1+", "2+", "3+", or null',
              },
              babyPosition: {
                type: Type.STRING,
                description: 'Fetal lie/presentation: "head_down", "breech", "transverse", or "unknown"',
              },
              ifaTabletsLeft: {
                type: Type.INTEGER,
                description: 'IFA tablets remaining count, or null',
              },
              calciumTabletsLeft: {
                type: Type.INTEGER,
                description: 'Calcium tablets remaining count, or null',
              },
              tdDoses: {
                type: Type.STRING,
                description: 'Tetanus/Td doses completed: "0", "1", "2", "booster", or null',
              },
              sfhCm: {
                type: Type.NUMBER,
                description: 'Symphysis Fundal Height in cm, or null',
              },
              hbGdl: {
                type: Type.NUMBER,
                description: 'Hemoglobin in g/dL, or null',
              },
              bloodSugarMgDl: {
                type: Type.INTEGER,
                description: 'Random/fasting blood sugar in mg/dL, or null',
              },
              pulseBpm: {
                type: Type.INTEGER,
                description: 'Pulse rate in bpm, or null',
              },
              tempF: {
                type: Type.NUMBER,
                description: 'Temperature in Fahrenheit, or null',
              },
              spo2Percent: {
                type: Type.INTEGER,
                description: 'Blood oxygen saturation percentage, or null',
              },
              symptoms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of specific clinical symptoms mentioned in the transcript',
              },
              otherObservations: {
                type: Type.STRING,
                description: 'Other observations noted by ASHA (diet, IFA tablets, fetal movement, general status)',
              },
              uncertainFields: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of field names that were unclear or ambiguous in the audio/transcript',
              },
              hindiTranscriptInterpretation: {
                type: Type.STRING,
                description: 'One-sentence clean plain Hindi summary of what was reported',
              },
            },
            required: ['symptoms', 'uncertainFields'],
          },
        },
      })
    );

    const responseText = response.text?.trim() || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('JSON parse error from Gemini extraction:', parseErr, responseText);
      return res.status(502).json({
        error: 'Failed to parse structured response from Gemini.',
        rawText: responseText,
      });
    }

    const systolicBp = typeof parsedData.systolicBp === 'number' ? parsedData.systolicBp : null;
    const diastolicBp = typeof parsedData.diastolicBp === 'number' ? parsedData.diastolicBp : null;

    // Ensure gestationalWeeks is only set if explicitly stated in text
    let gestationalWeeks: number | null = typeof parsedData.gestationalWeeks === 'number' ? parsedData.gestationalWeeks : null;
    if (gestationalWeeks !== null) {
      const mentionsWeeksInText = /\b(week|weeks|hafta|hafte|mahina|maheene|month|months)\b/i.test(text) || /\b\d{1,2}\s*(hafte|hafta|weeks?)\b/i.test(text);
      if (!mentionsWeeksInText) {
        gestationalWeeks = null;
      }
    }

    const symptoms: string[] = Array.isArray(parsedData.symptoms) ? parsedData.symptoms : [];

    // Sanitize values
    const result = {
      rawTranscript: text,
      systolicBp,
      diastolicBp,
      gestationalWeeks,
      weightKg: typeof parsedData.weightKg === 'number' ? parsedData.weightKg : null,
      swellingType: parsedData.swellingType || null,
      fetalMovementStatus: parsedData.fetalMovementStatus || null,
      muacCm: typeof parsedData.muacCm === 'number' ? parsedData.muacCm : null,
      pallor: typeof parsedData.pallor === 'boolean' ? parsedData.pallor : null,
      urineProtein: parsedData.urineProtein || null,
      urineSugar: parsedData.urineSugar || null,
      babyPosition: parsedData.babyPosition || null,
      ifaTabletsLeft: typeof parsedData.ifaTabletsLeft === 'number' ? parsedData.ifaTabletsLeft : null,
      calciumTabletsLeft: typeof parsedData.calciumTabletsLeft === 'number' ? parsedData.calciumTabletsLeft : null,
      tdDoses: parsedData.tdDoses || null,
      sfhCm: typeof parsedData.sfhCm === 'number' ? parsedData.sfhCm : null,
      hbGdl: typeof parsedData.hbGdl === 'number' ? parsedData.hbGdl : null,
      bloodSugarMgDl: typeof parsedData.bloodSugarMgDl === 'number' ? parsedData.bloodSugarMgDl : null,
      pulseBpm: typeof parsedData.pulseBpm === 'number' ? parsedData.pulseBpm : null,
      tempF: typeof parsedData.tempF === 'number' ? parsedData.tempF : null,
      spo2Percent: typeof parsedData.spo2Percent === 'number' ? parsedData.spo2Percent : null,
      symptoms,
      otherObservations: parsedData.otherObservations || '',
      uncertainFields: Array.isArray(parsedData.uncertainFields) ? parsedData.uncertainFields : [],
      hindiTranscriptInterpretation: parsedData.hindiTranscriptInterpretation || '',
    };

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/extract-visit:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini extraction service encountered an error.',
      isAiUnavailable: true,
    });
  }
});

/**
 * 2. draftHandoff Endpoint
 * Generates concise English SBAR for doctor review and empathetic Hindi summary for ASHA.
 */
app.post('/api/gemini/draft-handoff', async (req: Request, res: Response) => {
  try {
    const { confirmedVisit, patientProfile, ruleFlags } = req.body;

    if (!confirmedVisit || !patientProfile) {
      return res.status(400).json({
        error: 'Missing confirmedVisit or patientProfile in request body.',
      });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment.',
        isAiUnavailable: true,
      });
    }

    const systemInstruction = `You are a clinical decision-support assistant generating an SBAR (Situation, Background, Assessment, Recommendation) handoff for an Indian Primary Health Centre (PHC) Medical Officer, and a simple Hindi summary for the community ASHA worker.

SAFETY AND BOUNDARIES:
- The SBAR is an AI DRAFT for the doctor's review.
- Never alter or downgrade confirmed measurements or deterministic risk flags.
- Do NOT prescribe drugs or dosages (e.g. no specific labetalol / magnesium sulfate dosing).
- Emphasize immediate in-person clinical assessment, stabilization, and transfer to Community Health Centre (CHC) / First Referral Unit (FRU) if severe.
- The Hindi message for the ASHA must be empathetic, calm, practical, and clear on immediate actions (e.g., arrange transport, notify doctor, keep mother calm).`;

    const userPrompt = `Patient Details:
- Name: ${patientProfile.name}
- Age: ${patientProfile.age}
- Village: ${patientProfile.village}
- Gravida / Para: G${patientProfile.gravida}P${patientProfile.para}
- Gestational Weeks: ${confirmedVisit.gestationalWeeks ?? patientProfile.gestationalWeeks} weeks
- EDD: ${patientProfile.edd}

Confirmed Visit Findings:
- Blood Pressure: ${confirmedVisit.systolicBp ?? 'Not measured'} / ${confirmedVisit.diastolicBp ?? 'Not measured'} mmHg
- Reported Symptoms: ${confirmedVisit.symptoms?.join(', ') || 'None reported'}
- Other Observations: ${confirmedVisit.otherObservations || 'None'}
- Raw ASHA Report: "${confirmedVisit.rawTranscript}"
- Deterministic Clinical Flags: ${ruleFlags?.join('; ') || 'None'}
- Clinical Severity: ${confirmedVisit.finalSeverity || 'RED'}

Generate structured SBAR (Situation, Background, Assessment, Recommendation) in English for the Doctor, and a short, empathetic Hindi message for the ASHA.`;

    const response = await callGeminiWithRetry(() =>
      ai!.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sbar: {
                type: Type.OBJECT,
                properties: {
                  situation: {
                    type: Type.STRING,
                    description: 'Concise statement of patient identity, location, gestational age, and chief urgency',
                  },
                  background: {
                    type: Type.STRING,
                    description: 'Obstetric history, baseline vitals, and relevant clinical context',
                  },
                  assessment: {
                    type: Type.STRING,
                    description: 'Clinical findings, deterministic flags (e.g. severe hypertension with neurological symptoms)',
                  },
                  recommendation: {
                    type: Type.STRING,
                    description: 'Neutral clinical observations and potential triage considerations for doctor review only — suffixed with "— for doctor review"',
                  },
                },
                required: ['situation', 'background', 'assessment', 'recommendation'],
              },
              hindiSummary: {
                type: Type.STRING,
                description: 'Short empathetic guidance in Hindi for the ASHA worker regarding next steps and reassurance',
              },
            },
            required: ['sbar', 'hindiSummary'],
          },
        },
      })
    );

    const responseText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      data: {
        sbar: parsedData.sbar,
        hindiSummary: parsedData.hindiSummary,
        generatedAt: new Date().toISOString(),
        model: GEMINI_MODEL,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/draft-handoff:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini handoff drafting encountered an error.',
      isAiUnavailable: true,
    });
  }
});

/**
 * 3. scanMothers Endpoint
 * Proactively scans all enrolled mothers' histories, trajectories, and trend flags
 * in one unified call to rank today's visit priorities and uncover hidden risks.
 */
app.post('/api/gemini/scan-mothers', async (req: Request, res: Response) => {
  try {
    const { mothers, language = 'en' } = req.body;

    if (!Array.isArray(mothers) || mothers.length === 0) {
      return res.status(400).json({
        error: 'Missing or empty mothers array in request body.',
      });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment.',
        isAiUnavailable: true,
      });
    }

    const systemInstruction = `You are an expert maternal healthcare triage assistant for Indian Community Health Workers (ASHA workers) and Primary Health Centre Medical Officers.
You review a cohort of pregnant mothers, their visit histories, vital sign trajectories, and deterministic trend flags.
Your task is to proactively scan all mothers and rank them by who needs to be visited today (Priority 1 = see first).

CRITICAL REQUIREMENT - CLINICAL LANGUAGE COMPLIANCE:
- The AI must NEVER phrase output as a clinical recommendation, diagnostic suggestion, medical prescription, or instruction to act (e.g. NEVER say "requiring anemia screening", "verify IFA tablet compliance", "refer to PHC", "call 108", or "order scan").
- Rewrite "reason" and "suggestedAction" as neutral observations only of what was observed, measured, or reported in the visit records.
- Every observation must explicitly be suffixed with:
  " — for doctor review" (if English) or " — डॉक्टर समीक्षा हेतु" (if Hindi).

CRITICAL REQUIREMENT - HIDDEN RISKS:
You MUST identify "hiddenRisk": true for any mother whose risk is ONLY visible from the combination or trend, NOT from any single rule threshold breach.
Generic example of hidden risk (illustrative values, not a real patient):
A mother whose individual BP readings all stay below 140/90 (e.g. 110/70 -> 122/78 -> 132/84) with no danger signs,
but whose BP has climbed at every visit while her weight rose by more than 2 kg in 2-3 weeks. No single threshold is
breached, yet the combined trajectory suggests fluid retention and rising pre-eclampsia risk, so hiddenRisk must be true.

Output language: Provide the "reason" and "suggestedAction" in ${language === 'en' ? 'English' : 'Hindi'}. Keep "reason" to one crisp, scannable observation.
Level must be strictly one of: "RED", "AMBER", "GREEN". (AMBER corresponds to yellow warning).
Return a JSON array sorted by priority (1 is most urgent).`;

    const userPrompt = `Please evaluate these ${mothers.length} mothers and produce the ranked daily visit priority list with hidden risk detection:

${JSON.stringify(
  mothers.map((m: any) => ({
    patientId: m.id,
    name: m.name,
    age: m.age,
    village: m.village,
    gestationalWeeks: m.gestationalWeeks,
    gravida: m.gravida,
    para: m.para,
    highRiskFactors: m.highRiskFactors,
    trendFlags: m.trendFlags?.map((f: any) => `${f.type} (${f.direction}): ${f.labelEnglish} - ${f.valuesSummary}`),
    latestVisits: m.visits?.slice(0, 3).map((v: any) => ({
      date: v.timestamp,
      bp: `${v.systolicBp}/${v.diastolicBp}`,
      weightKg: v.weightKg,
      sfhCm: v.sfhCm,
      hbGdl: v.hbGdl,
      symptoms: v.symptoms,
      ruleSeverity: v.ruleSeverity,
    })),
  })),
  null,
  2
)}`;

    const response = await callGeminiWithRetry(() =>
      ai!.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                patientId: {
                  type: Type.STRING,
                  description: 'The exact patientId corresponding to the mother',
                },
                priority: {
                  type: Type.INTEGER,
                  description: 'Priority ranking from 1 (most urgent to see first) upwards',
                },
                level: {
                  type: Type.STRING,
                  description: 'Triage level: RED, AMBER, or GREEN',
                },
                reason: {
                  type: Type.STRING,
                  description: 'One crisp scannable line explaining why this mother must be visited today',
                },
                suggestedAction: {
                  type: Type.STRING,
                  description: 'Actionable clinical check for the ASHA worker during the visit',
                },
                hiddenRisk: {
                  type: Type.BOOLEAN,
                  description: 'True IF AND ONLY IF the risk is only visible from the combination or trend, not from any single rule',
                },
              },
              required: ['patientId', 'priority', 'level', 'reason', 'suggestedAction', 'hiddenRisk'],
            },
          },
        },
      })
    );

    const responseText = response.text?.trim() || '[]';
    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      data: parsedData,
      generatedAt: new Date().toISOString(),
      model: GEMINI_MODEL,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/scan-mothers:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini mother scanning encountered an error.',
      isAiUnavailable: true,
    });
  }
});

/**
 * 4. birthPlan Endpoint (Gemini AI Birth Plan)
 * Synthesizes comprehensive maternal obstetric history, travel time, vitals,
 * and clinical risks into an actionable birth preparedness plan adhering to PMSMA/WHO guidelines.
 */
app.post('/api/gemini/birth-plan', async (req: Request, res: Response) => {
  try {
    const {
      patientProfile,
      visitHistory = [],
      ruleFlags = [],
      trendFlags = [],
      language = 'en',
    } = req.body;

    if (!patientProfile) {
      return res.status(400).json({ error: 'Missing patientProfile in request body.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment.',
        isAiUnavailable: true,
      });
    }

    const systemInstruction = `You are a specialist obstetric triage advisor for Indian Community Health (ASHA workers and PHC Medical Officers).
You generate structured, actionable Antenatal Birth Plans adhering to Government of India (GoI), Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA), and WHO Guidelines.

DELIVERY FACILITY CLASSIFICATION:
1. "PHC" (Primary Health Centre): STRICTLY for low-risk, uncomplicated multiparas without any scars, height ≥145 cm, singleton cephalic, normal BP, normal Hb.
2. "CHC/FRU with C-section" (Community Health Centre / First Referral Unit): Required for previous C-section scar, maternal height < 145 cm, breech/transverse at term, twins, severe anemia, travel time > 45 mins, or moderate gestational hypertension.
3. "District hospital / medical college": For severe pre-eclampsia, placenta previa, severe cardiac/systemic disease, or multiple compounding risk factors.

CRITICAL SAFETY OVERRIDE RULES (Enforced in medical protocol):
- If maternal height < 145 cm, previous C-section, twins, placenta previa, breech after 36 weeks, severe anaemia (<7 g/dL), or pre-eclampsia is present: NEVER recommend "PHC". Delivery MUST be at "CHC/FRU with C-section" or "District hospital / medical college".

Return valid JSON adhering to the response schema.`;

    const userPrompt = `Generate a personalized birth plan for this expectant mother:
Name: ${patientProfile.name}
Age: ${patientProfile.age}
Village: ${patientProfile.village}
Gestational Weeks: ${patientProfile.gestationalWeeks} (EDD: ${patientProfile.edd})
Height: ${patientProfile.heightCm ? `${patientProfile.heightCm} cm` : 'Not recorded'}
Pre-pregnancy Weight: ${patientProfile.prePregnancyWeightKg ? `${patientProfile.prePregnancyWeightKg} kg` : 'Not recorded'}
Gravida: ${patientProfile.gravida}, Para: ${patientProfile.para}
Obstetric History: ${JSON.stringify(patientProfile.obstetricHistory || {})}
Blood Group: Mother ${patientProfile.bloodGroup || 'unknown'}, Father ${patientProfile.fatherBloodGroup || 'unknown'}
Comorbidities: Diabetes=${patientProfile.diabetesStatus}, Heart=${patientProfile.hasHeartDisease}, Twins=${patientProfile.hasTwins}, Previa=${patientProfile.hasPlacentaPrevia}, Tobacco=${patientProfile.usesTobaccoOrMishri}
Travel time to C-section facility: ${patientProfile.travelTimeToHospitalMinutes || 30} minutes (Has transport: ${patientProfile.hasTransport})
Recent visits: ${JSON.stringify(visitHistory.slice(0, 3))}
Current Rule triggers: ${JSON.stringify(ruleFlags)}
Current Trend flags: ${JSON.stringify(trendFlags)}
Preferred Language: ${language}

Generate deliveryPlace, deliveryPlaceReason, leaveHomeBy, riskTags, prepareChecklist, ashaMessage, motherMessage, and doctorSummary.`;

    const response = await callGeminiWithRetry(() =>
      ai!.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deliveryPlace: {
                type: Type.STRING,
                description: 'One of: "PHC", "CHC/FRU with C-section", or "District hospital / medical college"',
              },
              deliveryPlaceReason: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Concise clinical reasons with guideline tags explaining the facility choice',
              },
              leaveHomeBy: {
                type: Type.STRING,
                description: 'Clear timing recommendation, e.g. "At first sign of labour pains" or "Elective admission 7 days prior to EDD"',
              },
              riskTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Short tags e.g. ["PPH risk", "Obstructed labour risk", "C-section scar"]',
              },
              prepareChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Actionable items for mother and ASHA to arrange in advance (blood donor, 102 ambulance, JSY documents, family attendant)',
              },
              ashaMessage: {
                type: Type.STRING,
                description: '3-4 simple, professional sentences in the requested language for ASHA worker preparation',
              },
              motherMessage: {
                type: Type.STRING,
                description: '2-3 warm, reassuring, easy-to-understand sentences in the requested language for mother and family',
              },
              doctorSummary: {
                type: Type.STRING,
                description: '2-3 lines of clinical English summarizing obstetric triage considerations for doctor review',
              },
            },
            required: [
              'deliveryPlace',
              'deliveryPlaceReason',
              'leaveHomeBy',
              'riskTags',
              'prepareChecklist',
              'ashaMessage',
              'motherMessage',
              'doctorSummary',
            ],
          },
        },
      })
    );

    const responseText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(responseText);

    // Enforce Safety Rule in code:
    // If any of height < 145, previous C-section, twins, placenta previa, breech after 36 weeks, severe anaemia, or pre-eclampsia is present:
    // deliveryPlace CAN NEVER be "PHC".
    const latestVisit = visitHistory[0] || {};
    const safetyReasons: string[] = [];

    if (patientProfile.heightCm && patientProfile.heightCm < 145) {
      safetyReasons.push(`Maternal height ${patientProfile.heightCm} cm (<145 cm CPD risk)`);
    }
    if (
      patientProfile.obstetricHistory?.previousCSection ||
      patientProfile.highRiskFactors?.some((f: string) => /c-section|lscs|scar/i.test(f))
    ) {
      safetyReasons.push('Previous C-Section scar');
    }
    if (patientProfile.hasTwins || patientProfile.highRiskFactors?.some((f: string) => /twin/i.test(f))) {
      safetyReasons.push('Multiple gestation (twins)');
    }
    if (patientProfile.hasPlacentaPrevia || patientProfile.highRiskFactors?.some((f: string) => /placenta previa/i.test(f))) {
      safetyReasons.push('Placenta previa');
    }
    if (
      patientProfile.gestationalWeeks >= 36 &&
      (latestVisit.babyPosition === 'breech' || latestVisit.babyPosition === 'transverse')
    ) {
      safetyReasons.push(`Malpresentation (${latestVisit.babyPosition}) at term`);
    }
    if (typeof latestVisit.hbGdl === 'number' && latestVisit.hbGdl < 7.0) {
      safetyReasons.push(`Severe anaemia (Hb ${latestVisit.hbGdl} g/dL)`);
    }
    if (
      patientProfile.overallLevel === 'RED' ||
      latestVisit.finalSeverity === 'RED' ||
      (latestVisit.systolicBp && latestVisit.systolicBp >= 140)
    ) {
      safetyReasons.push('Pre-eclampsia / severe arterial pressure elevation');
    }

    let finalDeliveryPlace = parsedData.deliveryPlace || 'CHC/FRU with C-section';
    let upgradedBySafetyRule = false;
    let safetyRuleReason = '';

    if (safetyReasons.length > 0 && finalDeliveryPlace === 'PHC') {
      finalDeliveryPlace = safetyReasons.length > 2 ? 'District hospital / medical college' : 'CHC/FRU with C-section';
      upgradedBySafetyRule = true;
      safetyRuleReason = `Safety Rule Override: Upgraded from PHC to C-Section facility due to ${safetyReasons.join('; ')}`;
      if (!parsedData.deliveryPlaceReason) parsedData.deliveryPlaceReason = [];
      parsedData.deliveryPlaceReason.unshift(`⚠️ Safety Rule: C-section facility required (${safetyReasons.join(', ')})`);
    }

    return res.json({
      success: true,
      data: {
        ...parsedData,
        deliveryPlace: finalDeliveryPlace,
        upgradedBySafetyRule,
        safetyRuleReason,
      },
      generatedAt: new Date().toISOString(),
      model: GEMINI_MODEL,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/birth-plan:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini birth plan service encountered an error.',
      isAiUnavailable: true,
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASHA Saathi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
