# ASHA Saathi by Maas Doc

An educational antenatal decision-support prototype. An ASHA (village health worker) speaks her
home-visit report in Hindi / Hinglish / English; the app turns it into a structured visit record,
runs deterministic danger-sign and trend rules, and hands urgent cases to the PHC doctor with an
AI-drafted SBAR note. Three roles share one live demo: **ASHA**, **Doctor**, **Mother**.

> Simulation with synthetic data • Decision support only • The doctor makes clinical decisions.

## The problem

ASHAs record antenatal visits on paper or in long forms, often in a second language. Danger signs
(e.g. BP ≥ 160/110 with headache and blurred vision) can be missed or reach the doctor late, and
slow-building risks — BP creeping up over several visits while each reading is "normal" — are
almost never caught by single-threshold checklists.

## What it does

| Role | Main features |
|---|---|
| **ASHA** | Today's prioritised visit list · 4-step visit wizard (voice / typing / form → review what AI understood → confirm → result) · "➕ और जोड़ें" for MUAC, swelling, urine, Hb, SFH, vitals · register new mothers (4-step wizard) · birth plan per mother · alerts & doctor advice |
| **Doctor** | Cohort table with severity, trend arrows and "caught by trend/AI" badges · urgent alert feed with 15-min SLA flag · per-visit rule triggers, transcript and AI SBAR draft · acknowledge / send advice · birth-plan approve or change facility · SOS response & transport status |
| **Mother** | "Who am I" selector · SOS with 3-second cancel, shared address/GPS · kick counter, mood, food, vomiting, optional home BP/weight (tagged self-reported) · birth plan with read-aloud |

## How AI is used vs. deterministic rules

| Step | Gemini (AI) | Deterministic code |
|---|---|---|
| Spoken report → fields | Extracts BP, weeks, symptoms, swelling, urine, Hb… into a JSON schema; marks uncertain fields; told never to invent missing values | Server drops a gestational age the text never mentioned; the ASHA reviews and edits every value before saving |
| Severity (GREEN/AMBER/RED) | **Not used** | `src/rules/clinicalRules.ts` — GoI/WHO-style thresholds on the full visit + mother profile (BP, danger symptoms, pre-eclampsia combos, MUAC, height, age, previous C-section, Rh, comorbidities…) |
| Multi-visit trends / hidden risk | Optional cohort scan may add a ranked note and its own level | `src/rules/trendEngine.ts` — BP rising 3 visits, weight jump, SFH falling behind, Hb falling, overdue visit. **Hidden risk** = latest visit passed every single rule but a physiological trend is present |
| Final mother level | Can only **raise** it | `computeFinalPatientLevel` = worst(rule, trend, AI) |
| Doctor handoff | Drafts SBAR (English) + Hindi summary, labelled "AI draft" | Rule triggers are shown verbatim next to it |
| Birth plan | Suggests facility, checklist, messages | `evaluateBirthPlanSafetyRule`: with height < 145 cm, previous C-section, twins, placenta previa, breech ≥ 36 w, Hb < 7 or pre-eclampsia the facility can **never** be PHC (enforced on server and client) |

## Safety design

- **AI can never lower severity.** Rules set the minimum; the AI level is combined with `max`.
- **No fake AI when AI is down.** If Gemini fails or no key is set, the app shows a grey banner
  *"AI offline — showing rule-engine result only"* and displays only rule/trend output (rule
  triggers, trend flags, a rule-derived birth-plan facility). No AI-looking text is generated.
- **No demo-specific logic.** There are no patient-ID/name checks or phrase-specific regexes in the
  code; prompts use generic illustrative examples only.
- **Human in the loop.** ASHA confirms every extracted value; the doctor acknowledges alerts and
  approves or changes the birth-plan facility (a PHC choice against a safety rule requires a note).
- **API key stays server-side.** The browser only calls `/api/gemini/*` on the Express server.
- AI outputs are phrased as observations "for doctor review", with no drug dosing.

## Assumptions & limitations

- All mothers, phone numbers and addresses are **synthetic**.
- **Decision support only** — not a validated medical device; no CDSCO/ABDM claims; SOS and
  108/102 buttons do not dispatch real services.
- Demo storage is browser `localStorage`, synced across tabs (open ASHA, Doctor and Mother in
  separate tabs). It is not a production backend.
- Voice input uses the browser Web Speech API (best in Chrome/Edge).

## Run locally

Prerequisite: Node.js 20+.

```bash
npm install
cp .env.example .env.local    # set GEMINI_API_KEY (optional GEMINI_MODEL, default gemini-3.8-flash)
npm run dev                   # http://localhost:3000
```

Without a key the app still runs in rule-engine-only mode.

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite dev server |
| `npm run build` then `npm start` | Production build and serve (cross-platform via `cross-env`) |
| `npm test` | Vitest unit tests for the rule engine, trend engine and birth-plan safety rule |
| `npm run lint` | TypeScript type check |

## Project layout

```
server.ts                      Express server + 4 Gemini endpoints (extract, SBAR, scan, birth plan)
src/rules/clinicalRules.ts     Deterministic visit rules + birth-plan safety rule
src/rules/trendEngine.ts       Multi-visit trends, hidden risk, final level
src/context/DemoContext.tsx    App state, cross-tab sync, all state actions
src/services/geminiService.ts  Browser → server API client + rule-only fallbacks
src/components/{asha,doctor,mother,common}/   Role views and shared UI
src/data/seedData.ts           Synthetic demo mothers
```

## Disclosure of public code and resources

- Project scaffold (Vite + React + Express server layout, `metadata.json`) was generated from the
  **Google AI Studio** app template.
- Open-source libraries: React, Vite, Tailwind CSS, lucide-react, motion, Express, dotenv,
  `@google/genai`, tsx, cross-env, Vitest (see `package.json`, each under its own licence).
- Fonts: Baloo 2 and Mukta from Google Fonts.
- Clinical thresholds follow publicly available Government of India (PMSMA/MCP card) and WHO
  antenatal guidance; they are implemented from scratch, not copied from other code.
- No other third-party source code is included.
