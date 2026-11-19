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
 */

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

export const isLiveMsg91Configured = (): boolean =>
  Boolean(getAuthKey() && getTemplateId());

/** The app consistently uses a 4-digit OTP (matches the UI input length). */
export const OTP_LENGTH = 4;
export const SANDBOX_OTP = '1234';

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
      messageEn: `Sandbox mode — OTP: ${SANDBOX_OTP} (Dev only. Set EXPO_PUBLIC_MSG91_AUTH_KEY in .env to enable live MSG91 SMS/Voice OTP.)`,
      messageTe: `సాండ్‌బాక్స్ మోడ్ — OTP: ${SANDBOX_OTP} (కేవలం డెవ్. లైవ్ MSG91 SMS/వాయ్స్ OTP సక్రమీకరించడం కోసం .env లో EXPO_PUBLIC_MSG91_AUTH_KEY జోడించండి.)`,
    };
  }

  const authKey = getAuthKey() as string;
  const templateId = getTemplateId() as string;

  try {
    // MSG91 v5 reads these from the query string, NOT the JSON body.
    const params = new URLSearchParams({
      authkey: authKey,
      mobile: `91${cleaned}`,
      template_id: templateId,
      otp_length: String(OTP_LENGTH),
      otp_expiry: '5', // MSG91 expects MINUTES, not seconds
    });

    const res = await fetch(`${MSG91_BASE_URL}?${params.toString()}`, {
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

  const authKey = getAuthKey() as string;

  try {
    const params = new URLSearchParams({
      authkey: authKey,
      otp: otpCode,
      mobile: `91${cleaned}`,
    });
    const res = await fetch(
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

  const authKey = getAuthKey() as string;

  try {
    const params = new URLSearchParams({
      authkey: authKey,
      retrytype: channel === 'voice' ? 'voice' : 'text',
      mobile: `91${cleaned}`,
    });
    const res = await fetch(`${MSG91_BASE_URL}/retry?${params.toString()}`, {
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
