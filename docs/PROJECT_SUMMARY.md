# RythuVaani — Complete Project Summary

**Date:** November 19, 2026  
**Platform:** React Native (Expo) — Android/iOS  
**Languages:** Telugu (te), English (en), Hindi (hi)  

---

## 1. Project Overview

RythuVaani is an AI-powered smart agronomy companion for farmers in Andhra Pradesh and Telangana. It provides:
- Voice-first AI agronomist consultation (Sarvam STT/TTS + LLM)
- Crop health scanner (Gemini Vision)
- Live mandi prices (Data.gov.in Agmarknet)
- Government scheme eligibility verifier (6 AP/TG schemes)
- Farmer profile & vault (bookmarks, question history)
- Real OTP authentication (MSG91)
- Cloud database sync (Supabase PostgreSQL)

---

## 2. Architecture

```
RythuVaani/
├── docs/                    # PRD, Architecture, TRACK.md, etc.
├── stitch-screens/          # UI prototype reference
├── package-lock.json
└── mobile/                  # React Native Expo app
    ├── .env                 # API keys (gitignored)
    ├── app.json
    ├── src/
    │   ├── components/      # TopHeader, QuickToolCard, etc.
    │   ├── i18n/            # translations.ts (te/en/hi)
    │   ├── navigation/      # RootNavigator
    │   ├── screens/         # All screens
    │   ├── services/        # All service modules
    │   ├── store/           # Zustand store
    │   ├── theme/           # tokens.ts
    │   └── utils/           # voice.ts
    └── ...
```

### Tech Stack
- **Framework:** Expo (React Native)
- **Navigation:** React Navigation (not Expo Router)
- **State:** Zustand with AsyncStorage persistence
- **Voice:** Sarvam AI (Saaras v4 STT, Bulbul v3 TTS) + expo-speech fallback
- **AI:** FreeLLMAPI (self-hosted, 299 models) / Gemini / OpenRouter
- **Database:** Supabase PostgreSQL (PostgREST API via fetch)
- **Auth:** MSG91 v5 OTP (SMS + Voice Call)
- **Mandi:** Data.gov.in Agmarknet API

---

## 3. Epics Completed

### EPIC-01: Core Shell & i18n ✅
- 3-language instant switcher (Telugu/English/Hindi)
- Mobile OTP Auth, Voice Assistant Login, Guest Mode
- 5-Tab Navigation
- KVK header, brand card with ANGRAU badge

### EPIC-02: Home & Quick Tools ✅
- Farmer greeting header
- Today's Advisory audio player
- Weather summary card
- 2x2 Quick Tools navigation

### EPIC-03: Agromet Weather ✅
- Open-Meteo integration
- 4-metric grid (Rain, RH, Wind, Soil Moisture)
- Audio Bulletin, Severe Rain Alert

### EPIC-04: Ask Agronomist Voice AI ✅
- Sarvam STT → LLM → ANGRAU JSON
- Live editable Telugu/English transcript
- Banned-pesticide filter, spray interlock
- Telugu TTS output

### EPIC-05: AI Crop Health Scanner ✅
- Camera UI with leaf guide overlay
- Gemini Vision pest diagnosis for Paddy & Chilli

### EPIC-06: e-NAM Mandi Rates ✅
- State/District/Yard filter
- Live modal/min/max price cards
- Daily Mandi Audio Bulletin
- Data.gov.in Agmarknet integration with benchmark fallback

### EPIC-07 Pro: Government Schemes Eligibility Verifier ✅
**9-input Zero-PII Wizard:**
- Step 1 (33%): District/State (6 districts), Social Category (OC/BC/SC/ST), Income Tax/Govt Employee exclusion
- Step 2 (66%): Exact acres (adjuster + chips), 4-way ownership, e-Panta status
- Step 3 (100%): 5-crop multi-select, irrigation source, priority need

**6 Authentic Schemes:**
1. Annadata Sukhibhava / YSR Rythu Bharosa + PM-KISAN
2. PM-KISAN Samman Nidhi
3. APMIP Micro Irrigation (90% Drip/Sprinkler Subsidy)
4. PMFBY + AP State Crop Insurance
5. YSR Sunna Vaddi (0% Interest KCC Crop Loan)
6. PM-KUSUM Solar Pump & Farm Mechanization Subsidy

**3-Tier Financial Engine:**
- Status: ELIGIBLE / ACTION_REQUIRED / NOT_ELIGIBLE
- matchScore (0-100), calculatedBenefit (dynamic ₹), verdictReason, decisionPriority
- APMIP example: 4.5 ac Chilli → system ₹2,02,500 → 90% sub ₹1,82,250 → farmer share ₹20,250

**Full-Screen Scheme Modal:**
- Personalized banner + ₹ breakdown + audio guide
- Tappable document checklist with progress bar + where-to-get guidance
- Offline RSK/RBK + online application steps
- VAA/MAO/bank contacts, helplines (155251, 1800-425-0430)
- Embedded AI advisor with follow-up chips + text + voice mic + listen answer
- Portal link as secondary bottom button

**AI Advisor (`askSchemeAiAdvisor`):**
- Gemini 2.5 Flash with full profile + rulebook
- FreeLLM fallback when Gemini unavailable
- Comprehensive offline rule-based responder

### EPIC-08: Farmer Profile & Vault ✅
- Identity card (Venkata Reddy Garu, 4.5 Acres, Guntur)
- 3-stat row (questions/saved/season)
- Tabbed vault (Saved/Questions/Settings)
- Cloud sync badge + Sync Now button

### MSG91 OTP Authentication ✅
- Real MSG91 v5 OTP (SMS + Voice Call)
- 4-digit OTP (MSG91 default)
- Sandbox fallback (OTP: 1234)
- 30-second countdown with resend via SMS/Voice
- Phone validation, loading spinners

### Cloud Database Sync (Supabase) ✅
- `databaseService.ts` with 6 functions
- Offline-first: AsyncStorage cache + async cloud sync
- Login triggers cloud restore or new record creation
- Profile/saved items/questions sync automatically
- Cloud sync status indicator on profile screen

---

## 4. Service Files

| Service | Purpose | Key Exports |
|---|---|---|
| `agronomyAiService.ts` | AI agronomist pipeline | `analyzeVoiceQuery`, `analyzeCropImage`, `AiResponse` |
| `sarvamVoiceService.ts` | Sarvam STT/TTS | `transcribeAudio`, `playIndicVoice`, `synthesizeSpeech` |
| `mandiService.ts` | Live mandi prices | `fetchMandiRates`, `MandiCard` |
| `schemesService.ts` | Scheme eligibility engine | `evaluateSchemes`, `askSchemeAiAdvisor`, `FarmerSchemeProfile` |
| `msg91AuthService.ts` | MSG91 OTP auth | `sendMsg91Otp`, `verifyMsg91Otp`, `resendMsg91Otp` |
| `databaseService.ts` | Supabase cloud sync | `syncFarmerOnLogin`, `upsertFarmerProfileToCloud`, etc. |
| `weatherService.ts` | Open-Meteo weather | `fetchWeather` |
| `apiDiagnostics.ts` | Provider diagnostics | `runDiagnostics` |

---

## 5. Environment Variables (.env)

> Real values live in the gitignored `mobile/.env`. Never commit keys.

```env
# AI Provider
EXPO_PUBLIC_AI_PROVIDER=freellm
EXPO_PUBLIC_FREELLM_BASE_URL=http://127.0.0.1:31415/v1
EXPO_PUBLIC_FREELLM_API_KEY=<your-freellm-api-key>
EXPO_PUBLIC_FREELLM_MODEL=auto

# Sarvam Voice
EXPO_PUBLIC_SARVAM_API_KEY=<your-sarvam-api-key>

# Mandi Prices
EXPO_PUBLIC_DATA_GOV_API_KEY=<your-data-gov-api-key>

# MSG91 OTP
EXPO_PUBLIC_MSG91_AUTH_KEY=<your-msg91-auth-key>
EXPO_PUBLIC_MSG91_TEMPLATE_ID=<your-msg91-template-id>

# Supabase
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

---

## 6. Key Files Modified

### Screens
- `WelcomeAuthScreen.tsx` — MSG91 OTP auth with 4-digit OTP, voice login, countdown timer
- `GovtSchemesScreen.tsx` — 9-input wizard, ranked decision report, full-screen modal with AI advisor
- `AskAgronomistScreen.tsx` — Voice STT → AI pipeline with transcript display
- `FarmerProfileScreen.tsx` — Cloud sync badge, sync now button, saved items vault
- `HomeDashboardScreen.tsx` — Quick tools, weather, advisory

### Services
- `schemesService.ts` — 6 schemes, 3-tier evaluation engine, Gemini + FreeLLM + offline advisor
- `agronomyAiService.ts` — AI pipeline with FreeLLM/OpenRouter/Gemini/DeepSeek routing
- `msg91AuthService.ts` — MSG91 v5 OTP (SMS + Voice)
- `databaseService.ts` — Supabase PostgREST client
- `sarvamVoiceService.ts` — Sarvam STT/TTS
- `mandiService.ts` — Data.gov.in Agmarknet + benchmark fallback

### Store
- `useAppStore.ts` — Zustand with cloud sync, question history, saved items

---

## 7. Verification Status

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx expo lint` | ✅ 0 warnings |
| `npx expo-doctor` | ✅ 20/20 checks passed |
| `npx expo export --platform android` | ✅ Bundle resolves |

---

## 8. Next Phases (Backlog)

### EPIC-09: Guntur Field Pilot & Release
- Sunlight contrast audit
- 3G throttling tests
- ANGRAU agronomist sign-off
- Play Store production rollout

### Potential Enhancements
- Add more schemes (Rythu Bandhu for Telangana, PM-KISAN registration)
- Offline AI model (on-device LLM)
- Push notifications for scheme deadlines
- Multi-farmer support (family members)
- Crop calendar integration
- Weather-based spray alerts

---

## 9. How to Continue on a New System

1. Copy `.env` file (gitignored — contains all API keys)
2. Run `npm install` in `mobile/`
3. Verify: `npx tsc --noEmit && npx expo lint && npx expo-doctor`
4. Start: `npx expo start -c`

### Required External Services
- **FreeLLMAPI** (desktop/Docker) — AI provider (port 31415)
- **Supabase** — Cloud database (already configured)
- **MSG91** — OTP authentication (already configured)
- **Sarvam** — Voice STT/TTS (already configured)
- **Data.gov.in** — Mandi prices (already configured)

---

## 10. Key Design Decisions

1. **Zero-PII:** Never collect Aadhaar, OTP, or bank details. Only phone number for auth.
2. **Offline-first:** AsyncStorage as instant cache, Supabase as cloud backup
3. **Fallback chains:** FreeLLM → OpenRouter → Gemini → Offline KB
4. **Bilingual:** All UI and AI responses in Telugu + English (+ Hindi)
5. **Voice-first:** Sarvam STT/TTS for non-literate farmers
6. **No synchronous setState in useEffect:** All async operations use callbacks
7. **Global audio guard:** Navigation stops all audio on screen change

---

*Generated: November 19, 2026*
*Project: RythuVaani — AI Smart Agronomy Companion for AP & Telangana Farmers*
