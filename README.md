# 🌾 RythuVaani — AI Agronomy Companion

**Hackathon demo build · Expo SDK 58 · React Native 0.88 · TypeScript**

RythuVaani is a voice-first smart farming assistant for farmers in Andhra Pradesh and Telangana. It combines a bilingual/trilingual advisory UI with live weather, mandi prices, government-scheme eligibility, AI crop diagnosis, OTP login, Supabase cloud sync, and personalized smart alerts.

GitHub repository: <https://github.com/krishnavernekar/RythVaani-Assistant-Agent>

---

## ⚡ Judge quick start

### 1. Prerequisites

| Requirement | Version / notes |
|---|---|
| Node.js | **22.13.x or newer** (required by Expo SDK 58) |
| npm | Comes with Node; this repo uses `package-lock.json` |
| Mobile device | Expo Go, Android emulator, or iOS simulator |
| Optional native builds | Android Studio + Java, or macOS + Xcode |

> The app runs **without any API keys** using offline fallbacks. Keys only add live AI, live mandi, voice, OTP, and cloud sync.

### 2. Install and launch

```bash
git clone https://github.com/krishnavernekar/RythVaani-Assistant-Agent.git
cd RythuVaani-Assistant-Agent/mobile
npm install
npx expo start -c
```

- Scan the QR code with **Expo Go**.
- Physical phone and computer must be on the same Wi-Fi.
- On restricted Wi-Fi / Windows firewalls, use:

```bash
npx expo start --tunnel -c
```

- Press `a` for a connected Android device/emulator, `i` for an iOS simulator, or `w` for web.

### 3. Platform shortcuts

From `mobile/`:

```bash
npm start          # same as npx expo start
npm run android    # Android emulator/device (Android Studio required)
npm run ios        # iOS simulator (macOS + Xcode required)
npm run web        # browser preview
```

There are no hand-written `android/` or `ios/` folders. Expo generates native projects with Continuous Native Generation when needed. Do not edit generated native folders manually.

### 4. First-run demo flow

1. Open the app.
2. Choose **Telugu / English / Hindi**.
3. Use **Guest mode** for a clean offline walkthrough, or use OTP login:
   - Without MSG91 keys, sandbox OTP is **`1234`**.
   - With MSG91 widget keys, a real 4-digit OTP is sent.
4. Complete profile setup: name, acres, ownership, crops, mandal.
5. Open the bell icon on the home header to see personalized alerts.
6. Try the Scheme Checker, Market, Ask Agronomist, Crop Scanner, and Profile screens.
7. The Profile screen shows the cloud-sync status and **Sync Now** fallback.

New logins and guest sessions always start with an empty profile. No sample farmer data is inherited from a previous user.

---

## 🔐 Environment variables

Real values belong in `mobile/.env`, which is gitignored. Create it from the block below using placeholders. After changing it, restart with `npx expo start -c`.

> `EXPO_PUBLIC_*` values are embedded into the client bundle. Never put a Supabase service-role key or other private server secret here.

### Minimum demo

No `.env` file is required. The app falls back to bundled ANGRAU knowledge, benchmark mandi cards, weather fallback, and sandbox OTP `1234`.

### Recommended full-demo configuration

```env
# Supabase — cloud sync + notifications
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# MSG91 OTP — widget mode (recommended for this build)
EXPO_PUBLIC_MSG91_MODE=widget
EXPO_PUBLIC_MSG91_WIDGET_ID=YOUR_MSG91_WIDGET_ID
EXPO_PUBLIC_MSG91_TOKEN_AUTH=YOUR_MSG91_TOKEN_AUTH

# AI provider — choose one
EXPO_PUBLIC_AI_PROVIDER=openrouter
EXPO_PUBLIC_OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
EXPO_PUBLIC_OPENROUTER_MODEL=openrouter/auto

# Sarvam voice — STT + TTS
EXPO_PUBLIC_SARVAM_API_KEY=YOUR_SARVAM_API_KEY

# Data.gov.in Agmarknet — live mandi prices
EXPO_PUBLIC_DATA_GOV_API_KEY=YOUR_DATA_GOV_API_KEY
```

### Supported optional providers

| `EXPO_PUBLIC_AI_PROVIDER` | Required variables |
|---|---|
| `openrouter` | `EXPO_PUBLIC_OPENROUTER_API_KEY`, optional `EXPO_PUBLIC_OPENROUTER_MODEL` |
| `gemini` | `EXPO_PUBLIC_GEMINI_API_KEY`, optional `EXPO_PUBLIC_GEMINI_MODEL` |
| `freellm` | `EXPO_PUBLIC_FREELLM_BASE_URL`, `EXPO_PUBLIC_FREELLM_API_KEY`, optional `EXPO_PUBLIC_FREELLM_MODEL` |
| `custom` | `EXPO_PUBLIC_AI_BASE_URL`, `EXPO_PUBLIC_AI_API_KEY`, `EXPO_PUBLIC_AI_MODEL` |
| `openai` / `claude` / `deepseek` | Matching `EXPO_PUBLIC_*_API_KEY` and optional model variables |
| `offline` | None — uses bundled ANGRAU knowledge base |

For classic MSG91 OTP instead of widget mode, use:

```env
EXPO_PUBLIC_MSG91_AUTH_KEY=YOUR_MSG91_AUTH_KEY
EXPO_PUBLIC_MSG91_TEMPLATE_ID=YOUR_MSG91_TEMPLATE_ID
```

See `mobile/API_SETUP.md` for provider details and in-app diagnostics.

---

## ☁️ Supabase setup

Cloud sync is optional for the offline demo, but it powers zero-click sync and smart notifications. Create a Supabase project, then run this in the SQL editor.

> The RLS policy below is permissive and intended only for a hackathon demo with the anon key. Do not use it for production user data.

```sql
create table if not exists public.farmers (
  phone text primary key,
  name_en text not null default '',
  name_te text not null default '',
  preferred_language text not null default 'te',
  state text not null default '',
  district text not null default '',
  mandal text not null default '',
  acres numeric not null default 0,
  ownership_type text not null default 'PATTADAR',
  primary_crops text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_saved_items (
  id text primary key,
  farmer_phone text not null references public.farmers(phone) on delete cascade,
  item_id text not null,
  item_type text,
  title_en text,
  title_te text,
  subtitle_en text,
  subtitle_te text,
  benefit_or_dosage text,
  saved_at bigint not null
);

create table if not exists public.farmer_ai_questions (
  id text primary key,
  farmer_phone text not null references public.farmers(phone) on delete cascade,
  query_type text,
  question_en text,
  question_te text,
  diagnosis_en text,
  diagnosis_te text,
  advisory_en text,
  advisory_te text,
  asked_at bigint not null
);

create table if not exists public.farmer_scheme_checks (
  farmer_phone text primary key references public.farmers(phone) on delete cascade,
  wizard_inputs jsonb not null default '{}'::jsonb,
  checked_documents text[] not null default '{}',
  eligible_count integer not null default 0
);

create table if not exists public.farmer_notifications (
  id text primary key,
  farmer_phone text not null,
  category text not null default 'SCHEME',
  priority text not null default 'NORMAL',
  title_en text not null default '',
  title_te text not null default '',
  message_en text not null default '',
  message_te text not null default '',
  target_crops text[] not null default '{}',
  target_ownership text[] not null default '{}',
  action_tab text not null default 'Schemes',
  action_scheme_id varchar(80),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists farmer_saved_items_phone_idx
  on public.farmer_saved_items (farmer_phone);
create index if not exists farmer_ai_questions_phone_idx
  on public.farmer_ai_questions (farmer_phone);
create index if not exists farmer_notifications_phone_idx
  on public.farmer_notifications (farmer_phone, created_at desc);

-- Demo-only anon access. Replace with real auth/RLS before production.
do $$
declare
  t text;
begin
  foreach t in array array[
    'farmers',
    'farmer_saved_items',
    'farmer_ai_questions',
    'farmer_scheme_checks',
    'farmer_notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists rv_demo_anon_all on public.%I', t);
    execute format(
      'create policy rv_demo_anon_all on public.%I for all to anon using (true) with check (true)',
      t
    );
  end loop;
end $$;
```

Important implementation notes:

- `saved_at` and `asked_at` are **bigint epoch milliseconds**, not `timestamptz`.
- Every child row has `farmer_phone` referencing `farmers(phone)`. The app writes the parent farmer first.
- Notification rows with `farmer_phone = 'ALL'` are global broadcasts. Crop and ownership targeting use `target_crops` / `target_ownership`; `ALL` means generic.
- Keep `action_scheme_id` within **80 characters** and `target_ownership` values short.

Copy the project URL and anon key into `mobile/.env`, then restart with `npx expo start -c`.

---

## 🧠 What is included

| Area | Feature |
|---|---|
| Core | 5-tab navigation, instant Telugu/English/Hindi switching, audio guidance |
| Auth | MSG91 OTP (SMS/voice), sandbox OTP `1234`, clean guest mode, clean logout |
| Profile | Per-phone identity, saved items, question vault, cloud-sync badge |
| Weather | Open-Meteo Agromet data, soil moisture, spray advisory, audio bulletin |
| Mandi | Data.gov.in Agmarknet rates with verified APMC benchmark fallback |
| Schemes | 9-input zero-PII wizard, 6 AP/TG schemes, eligibility + benefit breakdown |
| AI | Voice agronomist, Gemini vision crop scanner, multi-provider routing |
| Cloud | Zero-click Supabase sync across farmers, saved items, questions, scheme checks |
| Alerts | Personalized bilingual notifications with reasons, filters, listen, and deep links |
| Privacy | No cross-user profile leakage; blank/phone-only cloud rows open setup |

Key source locations:

- `mobile/src/store/useAppStore.ts` — state, persistence, auto-sync, profile isolation
- `mobile/src/services/databaseService.ts` — Supabase REST sync
- `mobile/src/services/notificationService.ts` — personalized alert engine
- `mobile/src/components/NotificationCenterModal.tsx` — alert center UI
- `mobile/src/navigation/RootNavigator.tsx` — navigation and global alert mount

More background is available in `docs/PROJECT_SUMMARY.md`, `docs/ARCHITECTURE.md`, and `mobile/API_SETUP.md`.

---

## ✅ Verification performed

The following checks were run against this exact source tree before submission:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx expo lint` | 0 warnings |
| `npx expo-doctor` | 20/20 checks passed |
| `npm ls --depth=0` | Dependency tree resolved |
| `npx expo export --platform all` | Android + iOS production bundles built successfully |
| Four-table Supabase sync | farmers, saved items, AI questions, scheme checks all written/restored |
| Zero-click sync | hydration/login auto-sync verified |
| Action sync | save, ask, scheme change, language, profile edit all pushed |
| Idempotency | repeated syncs do not create duplicate rows |
| Notifications | 11 personalized alerts generated for a Chilli/Paddy Tenant profile |
| Read-state | single/broadcast read shadows and mark-all → 0 unread verified |
| Reason round-trip | bilingual reason encoded, decoded, and stripped from visible message |
| Profile isolation | guest, logout, fresh OTP login, stale cache, blank cloud row verified |
| Probe cleanup | temporary Supabase test rows removed |

Run the static checks yourself from `mobile/`:

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx expo export --platform all --output-dir ../rv-export-check
```

---

## 🛠 Troubleshooting

| Symptom | Fix |
|---|---|
| QR code will not open on phone | Use the same Wi-Fi, or run `npx expo start --tunnel -c`. |
| `.env` changes are ignored | Restart Metro with `npx expo start -c`. |
| OTP SMS not received | Without MSG91 keys use sandbox OTP `1234`. With keys, confirm widget mode and `WIDGET_ID` + `TOKEN_AUTH`. |
| AI answers are offline/basic | Expected without a provider key. Check Home → **AI Diagnostics**. |
| Mandi shows benchmark cards | Expected when `EXPO_PUBLIC_DATA_GOV_API_KEY` is missing or Agmarknet is unavailable. |
| Sync badge says offline | Check Supabase URL/anon key, table names, RLS policies, and internet access. |
| Notification bell appears empty | Complete profile setup first; personalized alerts are generated from profile data. |
| Native build fails | Use Expo Go for judging, or install Android Studio / Xcode and run `npx expo run:android` / `npx expo run:ios`. |

---

## 🔎 Final note for evaluators

The app is intentionally resilient: missing keys degrade to offline fallbacks instead of blank screens, and no demo/profile data is hard-coded for new users. The fastest way to evaluate the full experience is to launch with `npx expo start -c`, log in with any 10-digit mobile number using sandbox OTP `1234`, complete the profile wizard, and open the notification bell.
