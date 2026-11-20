/**
 * msg91AuthService — Real MSG91 v5 OTP Authentication
 * ----------------------------------------------------
 * Supports both SMS OTP and Voice Call OTP for Indian farmers.
 * Falls back to Dev Sandbox (OTP = 1234) when EXPO_PUBLIC_MSG91_* keys
 * are absent so development never blocks.
 *
 * MSG91 v5 requires `mobile`, `template_id`, `otp_length` and `otp_expiry` as
 * QUERY parameters on POST /api/v5/otp. Putting them in the JSON body makes
 * MSG91 ignore them and silently send nothing.
 *
 * Never stores or returns Aadhaar / OTP / bank account numbers inside the
 * app — the phone number is the only PII collected at login.
 *
 * Widget mode runs the official MSG91 JS SDK in a hidden WebView because the
 * widget has invisible hCaptcha enabled; a plain fetch() cannot generate the
 * required captcha token. See Msg91WidgetBridge.tsx.
 */

import { msg91WidgetBridge } from '../components/Msg91WidgetBridge';

/* ────────────────────────────── Types ──────────────────────────────────── */

export interface SendOtpResult {
  success: boolean;
  requestId?: string;
  isLiveMsg91: boolean;
  messageEn: string;
  messageTe: string;
}

export interface VerifyOtpResult {
  success: boolean;
  messageEn: string;
  messageTe: string;
}

export interface ResendOtpResult {
  success: boolean;
  messageEn: string;
  messageTe: string;
}

/* ──────────────────────────── Config helpers ───────────────────────────── */

const getAuthKey = (): string | null => {
  const key = process.env.EXPO_PUBLIC_MSG91_AUTH_KEY?.trim();
  return key && key.length > 10 ? key : null;
};

const getTemplateId = (): string | null => {
  const id = process.env.EXPO_PUBLIC_MSG91_TEMPLATE_ID?.trim();
  return id && id.length > 0 ? id : null;
};

/** OTP Widget credentials — the only parameters needed in widget mode. */
const getWidgetId = (): string | null => {
  const id = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID?.trim();
  return (id || getTemplateId() || '').trim() || null;
};

const getTokenAuth = (): string | null => {
  const token = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH?.trim();
  return (token || getAuthKey() || '').trim() || null;
};

/**
 * MSG91 has two OTP products. The credentials in this project came from the
 * OTP Widget snippet (widgetId + tokenAuth), so set EXPO_PUBLIC_MSG91_MODE=widget.
 * Classic mode expects an OTP Template ID from the OTP section instead.
 */
const MSG91_MODE = (process.env.EXPO_PUBLIC_MSG91_MODE || '').trim().toLowerCase();
export const isMsg91WidgetMode = (): boolean =>
  MSG91_MODE === 'widget' || Boolean(process.env.EXPO_PUBLIC_MSG91_WIDGET_ID?.trim());

export const isLiveMsg91Configured = (): boolean =>
  isMsg91WidgetMode()
    ? Boolean(getWidgetId() && getTokenAuth())
    : Boolean(getAuthKey() && getTemplateId());

/** The app consistently uses a 4-digit OTP (matches the UI input length). */
export const OTP_LENGTH = 4;
export const SANDBOX_OTP = '1234';

/** Never let a hung network call leave the login screen doing "nothing". */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface Msg91BalanceResult {
  ok: boolean;
  balance: number | null;
  error?: string;
}

/**
 * Read the MSG91 wallet balance without sending an SMS. `type=1` is the SMS
 * wallet; `type=2` is voice credits. Used only in classic mode — widget mode
 * has its own billing and must not be blocked by this check.
 */
export const getMsg91Balance = async (type: 1 | 2 = 1): Promise<Msg91BalanceResult> => {
  const candidates = [getAuthKey(), getTokenAuth()].filter(
    (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index,
  );
  if (candidates.length === 0) {
    return { ok: false, balance: null, error: 'MSG91 auth key / tokenAuth is not configured' };
  }

  let lastError = 'Could not read MSG91 balance';
  for (const key of candidates) {
    try {
      const res = await fetchWithTimeout(
        `https://control.msg91.com/api/balance.php?authkey=${encodeURIComponent(key)}&type=${type}`,
        { headers: { accept: 'text/plain' } },
      );
      const body = (await res.text()).trim();
      const balance = Number(body);
      if (res.ok && !body.startsWith('{') && Number.isFinite(balance)) {
        return { ok: true, balance };
      }
      lastError = `Could not read MSG91 ${type === 1 ? 'SMS' : 'voice'} balance (HTTP ${res.status})`;
    } catch (error) {
      lastError = `MSG91 balance check failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return { ok: false, balance: null, error: lastError };
};

/** Widget-mode health check — validates credentials without sending an OTP. */
export interface Msg91WidgetStatus {
  ok: boolean;
  enabled: boolean;
  captcha: boolean;
  otpLength: number | null;
  error?: string;
}

export const probeMsg91Widget = async (): Promise<Msg91WidgetStatus> => {
  const widgetId = getWidgetId();
  const tokenAuth = getTokenAuth();
  if (!widgetId || !tokenAuth) {
    return {
      ok: false,
      enabled: false,
      captcha: false,
      otpLength: null,
      error: 'MSG91 widgetId / tokenAuth are not configured',
    };
  }
  try {
    const res = await fetchWithTimeout(
      `https://control.msg91.com/api/v5/widget/getWidgetProcess?widgetId=${encodeURIComponent(widgetId)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          tokenAuth,
        },
      },
    );
    const json = await res.json();
    const data = json?.data ?? json;
    const enabled = data?.status?.value === '1' || json?.status === 'success';
    return {
      ok: res.ok && enabled,
      enabled,
      captcha: Boolean(data?.captchaValidations),
      otpLength: typeof data?.otpLength === 'number' ? data.otpLength : null,
      error: enabled ? undefined : json?.message ?? `Widget check failed (HTTP ${res.status})`,
    };
  } catch (error) {
    return {
      ok: false,
      enabled: false,
      captcha: false,
      otpLength: null,
      error: `MSG91 widget check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/** The stored template ID must be the plain ID from the dashboard, not hex text. */
export const looksLikeHexEncodedTemplateId = (id: string): boolean => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return false;
  let decoded = '';
  for (let i = 0; i < id.length; i += 2) {
    decoded += String.fromCharCode(parseInt(id.slice(i, i + 2), 16));
  }
  return /^[\x20-\x7E]{8,}$/.test(decoded) && !/^[0-9a-fA-F]+$/.test(decoded);
};

/* ──────────────────────────── Mobile number validation ─────────────────── */

/** Strips separators and any leading country code, then validates 10 digits. */
export const cleanPhone = (phone: string): string => {
  const digits = phone.replace(/[\s\-+]/g, '');
  return digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
};

/**
 * Validates a 10-digit Indian mobile number matching /^[6-9]\d{9}$/.
 */
export const isValidIndianMobile = (phone: string): boolean =>
  /^[6-9]\d{9}$/.test(cleanPhone(phone));

/* ──────────────────────────── Send OTP ─────────────────────────────────── */

/** Base URL for MSG91 v5 OTP endpoints — useful for diagnostics. */
export const MSG91_BASE_URL = 'https://control.msg91.com/api/v5/otp';
function extractReqId(json: any): string | undefined {
  const direct = json?.reqId || json?.request_id || json?.requestId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  // Some widget versions return the reqId in `message`.
  if (typeof json?.message === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(json.message)) {
    return json.message;
  }
  return undefined;
}

/** The SDK handles captcha, request IDs and channels for widget mode. */
async function sendWidgetOtp(cleaned: string): Promise<SendOtpResult> {
  try {
    const data = await msg91WidgetBridge.call('sendOtp', { identifier: `91${cleaned}` });
    console.log('[MSG91 Widget] OTP dispatched', data);
    return {
      success: true,
      isLiveMsg91: true,
      requestId: extractReqId(data),
      messageEn: `OTP sent via SMS to +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)}. Enter the ${OTP_LENGTH}-digit code below.`,
      messageTe: `OTP MSG91 SMS ద్వారా +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)} కు పంపబడింది. క్రింద 4 అంకెల కోడ నమోదు చేయండి.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[MSG91 Widget Send]', detail);
    return {
      success: false,
      isLiveMsg91: true,
      messageEn: `MSG91: ${detail}`,
      messageTe: `MSG91: ${detail}`,
    };
  }
}

interface Msg91SendResponse {
  type?: 'success' | 'error';
  request_id?: string;
  message?: string;
}

export const sendMsg91Otp = async (
  phone10Digit: string,
): Promise<SendOtpResult> => {
  const cleaned = cleanPhone(phone10Digit);
  if (!isValidIndianMobile(cleaned)) {
    return {
      success: false,
      isLiveMsg91: false,
      messageEn: 'Please enter a valid 10-digit Indian mobile number starting with 6–9.',
      messageTe: 'దయచేసி 6–9 తో ప్రారంభమైన 10 అంకెల భారతీయ మొబైల్ నంబరను నమోదు చేయండి.',
    };
  }

  // Sandbox fallback when keys are not configured.
  if (!isLiveMsg91Configured()) {
    console.log(`[MSG91] No live keys configured — using Dev Sandbox OTP ${SANDBOX_OTP}`);
    return {
      success: true,
      isLiveMsg91: false,
      messageEn: `Sandbox mode — OTP: ${SANDBOX_OTP} (Dev only. Set EXPO_PUBLIC_MSG91_WIDGET_ID and EXPO_PUBLIC_MSG91_TOKEN_AUTH in .env to enable live MSG91 OTP.)`,
      messageTe: `సాండ్‌బాక్స్ మోడ్ — OTP: ${SANDBOX_OTP} (కేవలం డెవ్. లైవ్ MSG91 OTP కోసం .env లో EXPO_PUBLIC_MSG91_WIDGET_ID, EXPO_PUBLIC_MSG91_TOKEN_AUTH జోడించండి.)`,
    };
  }

  const authKey = (isMsg91WidgetMode() ? getTokenAuth() : getAuthKey()) as string;
  const templateId = getTemplateId() as string;

  // Widget mode goes through the official JS SDK (captcha + reqId handled there).
  if (isMsg91WidgetMode()) {
    return sendWidgetOtp(cleaned);
  }

  if (looksLikeHexEncodedTemplateId(templateId)) {
    console.warn(
      '[MSG91] Template ID looks hex-encoded. Paste the plain Template ID shown in the MSG91 dashboard.',
    );
  }

  // Classic mode only: a zero wallet stops every send, so fail loudly.
  const balance = await getMsg91Balance(1);
  if (balance.ok && balance.balance === 0) {
    return {
      success: false,
      isLiveMsg91: true,
      messageEn: 'MSG91 SMS wallet balance is 0. Recharge your MSG91 account, then try again.',
      messageTe: 'MSG91 SMS బ్యాలెన్స్ 0 గా ఉంది. దయచేసి మీ MSG91 ఖాతాను రీఛార్జ్ చేసి మళ్ళీ ప్రయత్నించండి.',
    };
  }

  try {
    // MSG91 v5 reads these from the query string, NOT the JSON body.
    const params = new URLSearchParams({
      authkey: authKey,
      mobile: `91${cleaned}`,
      template_id: templateId,
      otp_length: String(OTP_LENGTH),
      otp_expiry: '5', // MSG91 expects MINUTES, not seconds
    });

    const res = await fetchWithTimeout(`${MSG91_BASE_URL}?${params.toString()}`, {
      method: 'POST',
      headers: {
        authkey: authKey,
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[MSG91 Send] HTTP ${res.status}:`, text.slice(0, 200));
      return {
        success: false,
        isLiveMsg91: true,
        messageEn: `MSG91 SMS failed (HTTP ${res.status}). Check your template / balance.`,
        messageTe: `MSG91 SMS విఫలమైంది (HTTP ${res.status}). మీ టెంప్లేట్ / బ్యాలెన్స్ తనిఖీ చేయండి.`,
      };
    }

    const json = (await res.json()) as Msg91SendResponse;
    if (json.type === 'success') {
      console.log(`[MSG91 Send] OTP dispatched to ${cleaned}, request_id: ${json.request_id}`);
      return {
        success: true,
        isLiveMsg91: true,
        requestId: json.request_id,
        messageEn: `OTP sent via SMS to +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)}. Enter the ${OTP_LENGTH}-digit code below.${json.request_id ? ` (Ref: ${json.request_id})` : ''}`,
        messageTe: `OTP MSG91 SMS ద్వారా +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)} కు పంపబడింది. క్రింద 4 అంకెల కోడ నమోదు చేయండि.`,
      };
    }

    // MSG91 returned an error (DLT unparsed, template missing, balance zero, etc.)
    const errMsg = json.message ?? 'Unknown MSG91 error.';
    console.warn('[MSG91 Send] Error response:', errMsg);
    return {
      success: false,
      isLiveMsg91: true,
      messageEn: `MSG91: ${errMsg}`,
      messageTe: `MSG91: ${errMsg}`,
    };
  } catch (error) {
    console.error('[MSG91 Send] Request failed:', error);
    return {
      success: false,
      isLiveMsg91: true,
      messageEn: 'Network error sending OTP. Check your internet connection.',
      messageTe: 'OTP పంపడం లో నిట్వర్క్ లోపం. మీ ఇంటర్నెట్ కనెక్షన్ తనిఖీ చేయండీ.',
    };
  }
};

async function verifyWidgetOtp(otpCode: string): Promise<VerifyOtpResult> {
  try {
    await msg91WidgetBridge.call('verifyOtp', { otp: otpCode });
    return {
      success: true,
      messageEn: 'Login successful! Welcome to RythuVaani.',
      messageTe: 'లాగింపూ సఫలమైంది! రైతావాణికీ స్వార్గతం.',
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[MSG91 Widget Verify]', detail);
    return {
      success: false,
      messageEn: `OTP verification failed: ${detail}`,
      messageTe: `OTP ధృవీకరణ విఫలమైంది: ${detail}`,
    };
  }
}

async function resendWidgetOtp(
  cleaned: string,
  channel: 'text' | 'voice',
): Promise<ResendOtpResult> {
  try {
    // MSG91 widget channel codes: 11 = SMS, 4 = VOICE.
    await msg91WidgetBridge.call('retryOtp', { channel: channel === 'voice' ? '4' : '11' });
    return {
      success: true,
      messageEn: `${channel === 'voice' ? 'Voice Call OTP' : 'SMS OTP'} resent to +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)}.`,
      messageTe: `${channel === 'voice' ? 'వాయిస్ కాల్ OTP' : 'SMS OTP'} +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)} కు మళ్ళీ పంపబడింది.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[MSG91 Widget Retry]', detail);
    return {
      success: false,
      messageEn: `Resend failed: ${detail}`,
      messageTe: `మళ్ళీ పంపడం విఫలమైంది: ${detail}`,
    };
  }
}

/* ──────────────────────────── Verify OTP ───────────────────────────────── */

interface Msg91VerifyResponse {
  type?: 'success' | 'error';
  message?: string;
}

export const verifyMsg91Otp = async (
  phone10Digit: string,
  otpCode: string,
): Promise<VerifyOtpResult> => {
  const cleaned = cleanPhone(phone10Digit);
  if (otpCode.length !== OTP_LENGTH || !/^\d+$/.test(otpCode)) {
    return {
      success: false,
      messageEn: `Please enter the ${OTP_LENGTH}-digit OTP exactly.`,
      messageTe: 'దయచేసి 4 అంకెల OTP ను ఖచ్చితంగ నమోదు చేయండీ.',
    };
  }

  // Sandbox: accept the fixed code when live credentials are missing.
  if (!isLiveMsg91Configured()) {
    if (otpCode === SANDBOX_OTP) {
      return {
        success: true,
        messageEn: 'Login successful! Welcome to RythuVaani.',
        messageTe: 'లాగింపూ సఫలమైంది! రైతావాణికీ స్వార్గతం.',
      };
    }
    return {
      success: false,
      messageEn: `Sandbox mode — use OTP ${SANDBOX_OTP}.`,
      messageTe: `సాండ్‌బాక్స్ మోడ్ — OTP ${SANDBOX_OTP} ఉపయోగింఛండి.`,
    };
  }

  const authKey = (isMsg91WidgetMode() ? getTokenAuth() : getAuthKey()) as string;

  if (isMsg91WidgetMode()) {
    return verifyWidgetOtp(otpCode);
  }

  try {
    const params = new URLSearchParams({
      authkey: authKey,
      otp: otpCode,
      mobile: `91${cleaned}`,
    });
    const res = await fetchWithTimeout(
      `${MSG91_BASE_URL}/verify?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'authkey': authKey,
          'accept': 'application/json',
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[MSG91 Verify] HTTP ${res.status}:`, text.slice(0, 200));
      return {
        success: false,
        messageEn: `Verification service unavailable (HTTP ${res.status}).`,
        messageTe: `ధృవీకరణ సేవ అందుబాటులో లేదు (HTTP ${res.status}).`,
      };
    }

    const json = (await res.json()) as Msg91VerifyResponse;
    const isSuccess =
      json.type === 'success' ||
      (json.message && json.message.toLowerCase().includes('verified'));

    if (isSuccess) {
      console.log(`[MSG91 Verify] OTP verified for ${cleaned}`);
      return {
        success: true,
        messageEn: 'Login successful! Welcome to RythuVaani.',
        messageTe: 'లాగింపూ సఫలమైంది! రైతావాణికీ స్వార్గతం.',
      };
    }

    return {
      success: false,
      messageEn: json.message ?? 'OTP verification failed. Try again.',
      messageTe: json.message ?? 'OTP ధృవీకరణ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.',
    };
  } catch (error) {
    console.error('[MSG91 Verify] Request failed:', error);
    return {
      success: false,
      messageEn: 'Network error during verification. Check your internet.',
      messageTe: 'ధృవీకరణ సమయంలో నిట్వర్క్ లోపం. మీ ఇంటర్నెట్ తనిఖీ చేయండి.',
    };
  }
};

/* ──────────────────────────── Resend OTP (SMS or Voice) ────────────────── */

interface Msg91RetryResponse {
  type?: 'success' | 'error';
  message?: string;
}

export const resendMsg91Otp = async (
  phone10Digit: string,
  channel: 'text' | 'voice',
): Promise<ResendOtpResult> => {
  const cleaned = cleanPhone(phone10Digit);
  if (!isValidIndianMobile(cleaned)) {
    return {
      success: false,
      messageEn: 'Invalid mobile number.',
      messageTe: 'సరిగాని మొబైల్ నంబరు.',
    };
  }

  // Sandbox: the fixed code stays valid; no network call needed.
  if (!isLiveMsg91Configured()) {
    console.log('[MSG91] Sandbox — ignoring resend request');
    return {
      success: true,
      messageEn: `Sandbox: OTP remains ${SANDBOX_OTP}.`,
      messageTe: `సాండ్‌బాక్స్: OTP ${SANDBOX_OTP} గా ఉంటుంది.`,
    };
  }

  const authKey = (isMsg91WidgetMode() ? getTokenAuth() : getAuthKey()) as string;

  if (isMsg91WidgetMode()) {
    return resendWidgetOtp(cleaned, channel);
  }

  try {
    const params = new URLSearchParams({
      authkey: authKey,
      retrytype: channel === 'voice' ? 'voice' : 'text',
      mobile: `91${cleaned}`,
    });
    const res = await fetchWithTimeout(`${MSG91_BASE_URL}/retry?${params.toString()}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[MSG91 Retry] HTTP ${res.status}:`, text.slice(0, 200));
      return {
        success: false,
        messageEn: `Retry failed (HTTP ${res.status}).`,
        messageTe: `మళ్ళీ పంపడం విఫలమైంది (HTTP ${res.status}).`,
      };
    }

    const json = (await res.json()) as Msg91RetryResponse;
    if (json.type === 'success') {
      const channelLabel =
        channel === 'voice'
          ? 'Voice Call OTP'
          : 'SMS OTP';
      console.log(`[MSG91 Retry] ${channelLabel} sent to ${cleaned}`);
      return {
        success: true,
        messageEn: `${channelLabel} resent to +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)}.`,
        messageTe: `${channelLabel} +91 ${cleaned.slice(0, 5)}•••${cleaned.slice(5)} కు మళ్ళీ పంపబడింది.`,
      };
    }

    return {
      success: false,
      messageEn: json.message ?? 'Retry request failed.',
      messageTe: json.message ?? 'మళ్ళీ పంపడానికి విఫలమైంది.',
    };
  } catch (error) {
    console.error('[MSG91 Retry] Request failed:', error);
    return {
      success: false,
      messageEn: 'Network error during resend.',
      messageTe: 'మళ్ళీ పంపే సమయంలో నిట్వర్క్ లోపం.',
    };
  }
};

/* ──────────────────────────── Public API ───────────────────────────────── */
