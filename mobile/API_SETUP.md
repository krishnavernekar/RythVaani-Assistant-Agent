# 🔧 RythuVaani AI API Setup

The app works with **zero keys** (offline ANGRAU knowledge base). A key only adds
live AI answers. Pick **one** text-AI provider and set `EXPO_PUBLIC_AI_PROVIDER`.

## Current configuration (`mobile/.env`)

```
EXPO_PUBLIC_AI_PROVIDER=openrouter
EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-...
EXPO_PUBLIC_OPENROUTER_MODEL=openrouter/auto
EXPO_PUBLIC_SARVAM_API_KEY=sk_...
EXPO_PUBLIC_DATA_GOV_API_KEY=...
```

- `openrouter/auto` lets OpenRouter pick a live model, so retired models
  (e.g. `google/gemini-2.0-flash-001`) can never break the app again.
- Sarvam is **always** needed for voice (Saaras v4 STT + Bulbul v3 TTS).
- Changing `.env` requires a cache-clearing restart: `npx expo start -c`.

## Live data sources

| Data | Source | Key needed? | Offline fallback |
|---|---|---|---|
| Agromet weather + soil moisture | Open-Meteo (`api.open-meteo.com`) | No | Stitch benchmark weather (32°C / 24% soil) |
| Mandi prices | Data.gov.in Agmarknet | `EXPO_PUBLIC_DATA_GOV_API_KEY` | 5 verified APMC benchmark cards |
| Farmer schemes | apagrisnet / karshak / apmip / PM-KISAN / PMFBY | No | Bundled verified dataset |

### Data.gov.in (Agmarknet) key

1. Register at https://data.gov.in.
2. Open **My Account → API key** and copy the key.
3. Add it to `mobile/.env`:

```
EXPO_PUBLIC_DATA_GOV_API_KEY=<your-data-gov-api-key>
```

4. `npx expo start -c`

The app requests
`resource/9ef84268-d588-465a-a308-a864a43d0070` filtered to Andhra Pradesh.
Live rows are merged over the APMC benchmarks for Guntur Mirchi Yard and
Tenali/Guntur paddy & cotton yards. If the key is missing, the market is
closed, or the phone is offline, the benchmark cards are shown with an
"APMC Benchmark" badge instead of an empty screen.

### Weather

No key is required. The app calls Open-Meteo for Guntur (16.3067, 80.4365),
converts `soil_moisture_3_to_9cm` from m³/m³ to a percentage, and marks
spraying safe when `wind_speed_10m < 18 km/h`.


## Provider options

| `EXPO_PUBLIC_AI_PROVIDER` | Needs | Notes |
|---|---|---|
| `openrouter` | `EXPO_PUBLIC_OPENROUTER_API_KEY` | One key, many models. Default. |
| `gemini` | `EXPO_PUBLIC_GEMINI_API_KEY` (starts `AIza`) | Also handles inline audio/vision. |
| `freellm` | `EXPO_PUBLIC_FREELLM_BASE_URL` + key | Self-hosted router (see below). |
| `custom` | `EXPO_PUBLIC_AI_BASE_URL` + key | Any OpenAI-compatible endpoint. |
| `openai` / `claude` / `deepseek` | matching key | Optional. |
| `offline` | nothing | ANGRAU KB only. |

## FreeLLMAPI (self-hosted router)

FreeLLMAPI is **not a public key service** — it is a gateway you run yourself
(Docker/desktop app). You add your own free provider keys (Groq, Cerebras,
Google AI Studio, Mistral, NVIDIA, OpenRouter…) in its dashboard, and it routes
to whichever provider still has quota, exposing one OpenAI-compatible `/v1`.

Setup:

1. Install/run FreeLLMAPI (`https://github.com/tashfeenahmed/freellmapi`).
   The server listens on port `3001` by default.
2. Create a **unified key** in its dashboard.
3. Put the gateway on the same Wi-Fi as the phone and use your computer's LAN
   IP — **not** `localhost` (the phone is a different device):

```
EXPO_PUBLIC_AI_PROVIDER=freellm
EXPO_PUBLIC_FREELLM_BASE_URL=http://192.168.1.5:3001/v1
EXPO_PUBLIC_FREELLM_API_KEY=<your-freellm-api-key>
EXPO_PUBLIC_FREELLM_MODEL=auto
```

4. `npx expo start -c`

If the gateway is unreachable the app falls back to the offline ANGRAU KB
instead of showing an empty card.

## Test from the terminal

```bash
cd D:\RythuVaani\mobile
node test-apis.mjs
```

It parses `.env` itself, tests the selected provider + Sarvam, and skips
unconfigured optional providers instead of reporting them as failures.

## In-app diagnostics

Home Dashboard → **🔧 AI Diagnostics** runs the same check from the device and
shows the provider, model, HTTP error, and fix steps.

## Key links

| Service | URL |
|---|---|
| OpenRouter keys | https://openrouter.ai/keys |
| OpenRouter credits | https://openrouter.ai/credits |
| Google Gemini | https://aistudio.google.com/apikey |
| Sarvam | https://indus.sarvam.ai/key-management |
| Data.gov.in API key | https://data.gov.in |
| Open-Meteo (no key) | https://open-meteo.com |
| FreeLLMAPI | https://github.com/tashfeenahmed/freellmapi |
