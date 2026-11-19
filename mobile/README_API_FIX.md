# 🔧 RythuVaani API Fix Instructions

## ✅ Diagnostic Results

| Service | Status | Key Format | Result |
|---------|--------|------------|--------|
| **Sarvam AI** | ✅ CONNECTED | `sk_...` (valid) | Working! |
| **Gemini AI** | ❌ INVALID KEY | `AQ.` (WRONG) | Needs fix |

---

## 🚨 THE PROBLEM

Your Gemini API key is **wrong format**:
```
Current: AQ.<redacted-invalid-key>  ← INVALID
Required: <google-ai-studio-key>  ← VALID (starts with AIza)
```

The `AQ.` prefix means this is some other type of token (not a Google AI Studio key).

---

## ✅ STEP-BY-STEP FIX (2 minutes)

### Step 1: Get a REAL Gemini API Key
1. Open: https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (it will look like: `<google-ai-studio-key>`)

### Step 2: Update Your .env File
1. Open: `D:\RythuVaani\mobile\.env`
2. Replace the CURRENT line:
   ```
   EXPO_PUBLIC_GEMINI_API_KEY="<your-invalid-gemini-key>"
   ```
   With YOUR new key:
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=<your-gemini-api-key>
   ```

   **IMPORTANT:** No quotes around the value!

### Step 3: Restart the App
```powershell
cd D:\RythuVaani\mobile
npx expo start -c
```

Then scan QR code in Expo Go.

---

## 🧪 Test After Fix

Run this to verify:
```powershell
cd D:\RythuVaani\mobile
$env:EXPO_PUBLIC_GEMINI_API_KEY="AIzaSyDyour_key_here"
$env:EXPO_PUBLIC_SARVAM_API_KEY="<your-sarvam-api-key>"
node test-apis.mjs
```

You should see:
```
✅ Gemini: CONNECTED
✅ Sarvam: CONNECTED
```

---

## 📱 What Works Now

Even WITHOUT fixing Gemini, these features work:
- ✅ **Sarvam Voice** (Telugu TTS audio playback)
- ✅ **Offline ANGRAU Knowledge Base** (pesticide recommendations)
- ✅ **All UI screens** (no crashes)

After fixing Gemini key:
- ✅ **Live AI advisory** (Gemini 3.8 Flash)
- ✅ **Voice-to-text** (Sarvam Saaras STT)
- ✅ **Image diagnosis** (Gemini Vision)

---

## 🔍 In-App Diagnostics

After starting the app:
1. Go to **Home Dashboard**
2. Tap **"🔧 AI Diagnostics"** button (below weather card)
3. You'll see live status of both APIs

---

## 🆘 Still Not Working?

If you get errors after following these steps:
1. Make sure the key starts with `AIza` (not `AQ.` or anything else)
2. Make sure there are NO quotes around the value in `.env`
3. Run `npx expo start -c` to clear cache
4. Check the AI Diagnostics screen in the app
