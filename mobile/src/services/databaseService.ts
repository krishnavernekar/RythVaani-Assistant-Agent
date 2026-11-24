/**
 * databaseService — Supabase Cloud PostgreSQL REST client
 * -------------------------------------------------------
 * Uses standard `fetch` against Supabase's PostgREST API so no extra native
 * dependencies are required. AsyncStorage remains the instant offline-first
 * cache; this service syncs in the background.
 *
 * Tables (public schema):
 *   farmers, farmer_saved_items, farmer_ai_questions, farmer_scheme_checks
 */

import type { FarmerProfile, SavedItem, Language } from '../store/useAppStore';

/* ────────────────────────────── Types ──────────────────────────────────── */

export type CloudSyncStatus = 'offline' | 'syncing' | 'synced';

export interface ChatThreadMessage {
  role: 'farmer' | 'ai';
  textEn: string;
  textTe: string;
  timestamp: number;
}

export interface QuestionRecord {
  id?: string;
  /** Legacy field kept so old persisted history still renders. */
  questionText?: string;
  questionEn: string;
  questionTe: string;
  /** Legacy field kept so old persisted history still renders. */
  answerTitle?: string;
  titleEn?: string;
  titleTe?: string;
  diagnosisEn?: string;
  diagnosisTe?: string;
  fullResponseEn: string;
  fullResponseTe: string;
  chemicalDosageEn?: string;
  chemicalDosageTe?: string;
  weatherWarningEn?: string;
  weatherWarningTe?: string;
  chatThread?: ChatThreadMessage[];
  queryType?: string;
  askedAt?: string;
  savedAt?: number;
  source?: string;
}

export interface SchemeCheckSnapshot {
  wizardInputs: Record<string, unknown>;
  checkedDocuments: string[];
  eligibleCount: number;
}

export interface CloudSyncState {
  farmer: FarmerProfile;
  language: Language;
  savedItems: SavedItem[];
  questionHistory: QuestionRecord[];
  schemeCheck?: SchemeCheckSnapshot;
}

export type SyncFarmerResult =
  | {
      isExistingUser: true;
      profile: FarmerProfile;
      preferredLanguage: Language;
      savedItems: SavedItem[];
      questionHistory: QuestionRecord[];
    }
  | { isExistingUser: false };

/* ──────────────────────────── Config ──────────────────────────────────── */

const getSupabaseUrl = (): string | null => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return url && url.length > 0 ? url.replace(/\/$/, '') : null;
};

const getSupabaseAnonKey = (): string | null => {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return key && key.length > 0 ? key : null;
};

export const isCloudDbConfigured = (): boolean =>
  Boolean(getSupabaseUrl() && getSupabaseAnonKey());

/* ──────────────────────────── Helpers ─────────────────────────────────── */

/** Strip formatting, remove a leading country code and return exactly 10 digits. */
export const normalizeFarmerPhone = (rawPhone?: string): string => {
  const stripped = (rawPhone ?? '').replace(/[\s\-()]/g, '');
  const withoutCountry = stripped.replace(/^\+?91/, '');
  const digits = withoutCountry.replace(/\D/g, '').slice(-10);
  return `+91${digits.length === 10 ? digits : '9848054321'}`;
};

/** Backwards-compatible alias used by the existing store call sites. */
export const normalizePhone = (phone: string): string =>
  normalizeFarmerPhone(phone);

const toLanguage = (value?: string): Language =>
  value === 'en' || value === 'hi' ? value : 'te';

const headers = (extra?: Record<string, string>): Record<string, string> => {
  const key = getSupabaseAnonKey() ?? '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    accept: 'application/json',
    ...extra,
  };
};

const safeFetch = async (
  url: string,
  init?: RequestInit,
): Promise<Response | null> => {
  try {
    const res = await fetch(url, init);
    return res;
  } catch (error) {
    console.warn('[DB] Network error:', error);
    return null;
  }
};

/**
 * `saved_at` and `asked_at` are bigint columns in the deployed Supabase
 * schema, so they must be epoch milliseconds — NOT ISO timestamp strings.
 * PostgreSQL rejects ISO strings with 22P02, which silently emptied both
 * child tables. Accept numbers and ISO strings from legacy local cache.
 */
const toEpochMillis = (value?: string | number | null): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.round(numeric);
  }
  return Date.now();
};

/** Convert a cloud bigint timestamp back into the ISO string the UI expects. */
const fromEpochMillis = (value?: string | number | null): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const millis = toEpochMillis(value);
  return new Date(millis).toISOString();
};

const stripPhonePrefix = (id: string, phone: string): string =>
  id.startsWith(`${phone}_`) ? id.slice(phone.length + 1) : id;

const parseCrops = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((crop) => typeof crop === 'string').map(String);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((crop) => crop.trim())
      .filter(Boolean);
  }
  return [];
};

const acreageLabelFor = (acres: number): string => {
  if (acres <= 2) return 'Small/Marginal';
  if (acres <= 5) return 'Small';
  if (acres <= 10) return 'Medium';
  return 'Large';
};

const mandalTeFor = (mandal: string): string => {
  const map: Record<string, string> = {
    'Guntur Mandal': 'గుంటూరు మండలం',
    'Tenali Mandal': 'తెనాలి మండలం',
    Mangalagiri: 'మంగళగిరి',
    Bapatla: 'బాపట్ల',
    Vijayawada: 'విజయవాడ',
  };
  return map[mandal] ?? mandal;
};

const cropTeFor = (crops: string[]): string[] => {
  const map: Record<string, string> = {
    Chilli: 'మిర్చి',
    Paddy: 'వరి',
    Cotton: 'పత్తి',
    Pulses: 'పప్పుధాన్యాలు',
    Turmeric: 'పసుపు',
  };
  return crops.map((crop) => map[crop] ?? crop);
};

/** public.farmers has no address column, so keep it inside `mandal`. */
const foldAddressIntoMandal = (address?: string, mandal?: string): string => {
  const cleanAddress = address?.trim() ?? '';
  const cleanMandal = mandal?.trim() ?? '';
  if (!cleanAddress) return cleanMandal;
  if (!cleanMandal) return cleanAddress;
  return `${cleanAddress}, ${cleanMandal}`;
};

const splitAddressFromMandal = (
  mandal: string,
): { address?: string; mandal: string } => {
  const parts = mandal
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { mandal };
  return {
    address: parts.slice(0, -1).join(', '),
    mandal: parts[parts.length - 1],
  };
};

/* ──────────────── Lossless full-conversation payload packing ─────────── */

interface PackedConversation {
  questionEn: string;
  questionTe: string;
  diagnosisEn: string;
  diagnosisTe: string;
  fullResponseEn: string;
  fullResponseTe: string;
  chemicalDosageEn: string;
  chemicalDosageTe: string;
  weatherWarningEn: string;
  weatherWarningTe: string;
  chatThread?: ChatThreadMessage[];
}

const FULL_PAYLOAD_MARKER = '[[RV_FULL_V1]]';

const packFullText = (readable: string, payload: PackedConversation): string =>
  `${readable}\n\n${FULL_PAYLOAD_MARKER}${JSON.stringify(payload)}`;

const unpackFullText = (
  value?: string | null,
): { readable: string; payload?: Partial<PackedConversation> } => {
  const raw = value ?? '';
  const markerIndex = raw.indexOf(FULL_PAYLOAD_MARKER);
  if (markerIndex < 0) return { readable: raw };
  const readable = raw.slice(0, markerIndex).trim();
  try {
    const parsed = JSON.parse(raw.slice(markerIndex + FULL_PAYLOAD_MARKER.length));
    return {
      readable,
      payload: parsed && typeof parsed === 'object' ? parsed : undefined,
    };
  } catch {
    return { readable };
  }
};

const formatChatText = (
  thread: ChatThreadMessage[] | undefined,
  isTe: boolean,
): string => {
  if (!thread || thread.length === 0) return '';
  return thread
    .map((message) => {
      const speaker = message.role === 'farmer'
        ? (isTe ? 'రైతు' : 'Farmer')
        : (isTe ? 'AI సలహాదారుడు' : 'AI Advisor');
      const text = isTe ? message.textTe || message.textEn : message.textEn || message.textTe;
      return `${speaker}: ${text}`;
    })
    .join('\n');
};

const buildSavedReadableText = (
  item: SavedItem,
  isTe: boolean,
): string => {
  const labels = isTe
    ? {
        question: 'ప్రశ్న',
        diagnosis: 'నిర్ధారణ',
        response: 'AI సలహా',
        dosage: 'మోతాదు / ప్రయోజనం',
        warning: 'హెచ్చరిక / తదుపరి చర్య',
        chat: 'సంభాషణ',
      }
    : {
        question: 'Question',
        diagnosis: 'Diagnosis',
        response: 'AI Response',
        dosage: 'Dosage / Benefit',
        warning: 'Warning / Next Action',
        chat: 'Chat Thread',
      };
  const question = isTe ? item.questionTe : item.questionEn;
  const diagnosis = isTe ? item.diagnosisTe : item.diagnosisEn;
  const response = isTe ? item.fullResponseTe : item.fullResponseEn;
  const dosage = isTe ? item.chemicalDosageTe : item.chemicalDosageEn;
  const warning = isTe ? item.weatherWarningTe : item.weatherWarningEn;

  return [
    question ? `${labels.question}: ${question}` : '',
    diagnosis ? `${labels.diagnosis}: ${diagnosis}` : '',
    response ? `${labels.response}: ${response}` : '',
    dosage ? `${labels.dosage}: ${dosage}` : '',
    warning ? `${labels.warning}: ${warning}` : '',
    formatChatText(item.chatThread, isTe)
      ? `${labels.chat}:\n${formatChatText(item.chatThread, isTe)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildQuestionReadableText = (
  question: QuestionRecord,
  isTe: boolean,
): string => {
  const labels = isTe
    ? {
        response: 'AI సలహా',
        dosage: 'మోతాదు / ప్రయోజనం',
        warning: 'హెచ్చరిక / తదుపరి చర్య',
        chat: 'సంభాషణ',
      }
    : {
        response: 'AI Response',
        dosage: 'Dosage / Benefit',
        warning: 'Warning / Next Action',
        chat: 'Chat Thread',
      };
  const response = isTe ? question.fullResponseTe : question.fullResponseEn;
  const dosage = isTe ? question.chemicalDosageTe : question.chemicalDosageEn;
  const warning = isTe ? question.weatherWarningTe : question.weatherWarningEn;
  const chat = formatChatText(question.chatThread, isTe);

  return [
    response ? `${labels.response}: ${response}` : '',
    dosage ? `${labels.dosage}: ${dosage}` : '',
    warning ? `${labels.warning}: ${warning}` : '',
    chat ? `${labels.chat}:\n${chat}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const conversationPayloadFromSaved = (item: SavedItem): PackedConversation => ({
  questionEn: item.questionEn ?? '',
  questionTe: item.questionTe ?? '',
  diagnosisEn: item.diagnosisEn ?? item.title ?? '',
  diagnosisTe: item.diagnosisTe ?? item.titleTe ?? item.title ?? '',
  fullResponseEn: item.fullResponseEn ?? '',
  fullResponseTe: item.fullResponseTe ?? '',
  chemicalDosageEn: item.chemicalDosageEn ?? item.badgeEn ?? '',
  chemicalDosageTe: item.chemicalDosageTe ?? item.badgeTe ?? '',
  weatherWarningEn: item.weatherWarningEn ?? '',
  weatherWarningTe: item.weatherWarningTe ?? '',
  chatThread: item.chatThread,
});

const conversationPayloadFromQuestion = (
  question: QuestionRecord,
): PackedConversation => ({
  questionEn: question.questionEn ?? question.questionText ?? '',
  questionTe: question.questionTe ?? question.questionText ?? '',
  diagnosisEn: question.diagnosisEn ?? question.titleEn ?? question.answerTitle ?? '',
  diagnosisTe: question.diagnosisTe ?? question.titleTe ?? question.answerTitle ?? '',
  fullResponseEn: question.fullResponseEn ?? '',
  fullResponseTe: question.fullResponseTe ?? '',
  chemicalDosageEn: question.chemicalDosageEn ?? '',
  chemicalDosageTe: question.chemicalDosageTe ?? '',
  weatherWarningEn: question.weatherWarningEn ?? '',
  weatherWarningTe: question.weatherWarningTe ?? '',
  chatThread: question.chatThread,
});

/* ──────────────────────────── Farmer sync ──────────────────────────────── */

interface DbFarmerRow {
  phone: string;
  name_en?: string;
  name_te?: string;
  acres?: number;
  mandal?: string;
  district?: string;
  state?: string;
  ownership_type?: string;
  primary_crops?: string[] | string;
  preferred_language?: string;
}

interface DbSavedItemRow {
  id?: string;
  farmer_phone?: string;
  item_id?: string;
  item_type?: string;
  title_en?: string;
  title_te?: string;
  subtitle_en?: string;
  subtitle_te?: string;
  benefit_or_dosage?: string | null;
  saved_at?: string | number | null;
}

interface DbQuestionRow {
  id?: string;
  farmer_phone?: string;
  query_type?: string;
  question_en?: string;
  question_te?: string;
  diagnosis_en?: string;
  diagnosis_te?: string;
  advisory_en?: string;
  advisory_te?: string;
  asked_at?: string | number | null;
}

const rowToFarmer = (row: DbFarmerRow): FarmerProfile => {
  const combinedMandal = row.mandal ?? '';
  const splitMandal = splitAddressFromMandal(combinedMandal);
  const nameEn = row.name_en ?? '';
  const crops = parseCrops(row.primary_crops);
  const acresRaw = Number(row.acres);
  const acres = Number.isFinite(acresRaw) ? acresRaw : 0;
  const phone = normalizeFarmerPhone(row.phone);
  const mandal = splitMandal.mandal ?? '';

  return {
    name: nameEn,
    nameEn,
    nameTe: row.name_te ?? nameEn,
    phone,
    phoneMasked: phone,
    address: splitMandal.address,
    acres,
    acreageLabel: acreageLabelFor(acres),
    mandal,
    mandalTe: mandal ? mandalTeFor(mandal) : '',
    district: row.district ?? '',
    state: row.state ?? '',
    category:
      (row.ownership_type ?? '').toLowerCase() === 'tenant'
        ? 'Tenant'
        : 'Pattadar',
    crops,
    cropsTe: cropTeFor(crops),
  };
};

const parseBenefitData = (
  value?: string | null,
): Record<string, unknown> | undefined => {
  if (!value || !value.trim().startsWith('{')) return undefined;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const rowToSavedItem = (row: DbSavedItemRow, phone: string): SavedItem => {
  const english = unpackFullText(row.subtitle_en);
  const telugu = unpackFullText(row.subtitle_te);
  const payload = english.payload ?? telugu.payload;
  const benefitData = parseBenefitData(row.benefit_or_dosage);
  const benefitRaw = benefitData ? '' : row.benefit_or_dosage ?? '';
  const savedAt = row.saved_at ? toEpochMillis(row.saved_at) : Date.now();
  const itemType = row.item_type === 'advisory' ? 'advisory' : 'scheme';
  const title = row.title_en ?? '';

  return {
    id: row.item_id || stripPhonePrefix(row.id ?? '', phone),
    type: itemType,
    category: itemType,
    title,
    titleTe: row.title_te || title,
    subtitle: english.readable || telugu.readable || undefined,
    questionEn: payload?.questionEn ?? '',
    questionTe: payload?.questionTe ?? '',
    diagnosisEn: payload?.diagnosisEn ?? title,
    diagnosisTe: payload?.diagnosisTe ?? row.title_te ?? title,
    fullResponseEn: payload?.fullResponseEn ?? english.readable,
    fullResponseTe: payload?.fullResponseTe ?? (telugu.readable || english.readable),
    chemicalDosageEn: payload?.chemicalDosageEn ?? benefitRaw,
    chemicalDosageTe: payload?.chemicalDosageTe ?? benefitRaw,
    weatherWarningEn: payload?.weatherWarningEn ?? '',
    weatherWarningTe: payload?.weatherWarningTe ?? '',
    chatThread: payload?.chatThread,
    data: benefitData,
    bookmarkedAt: savedAt,
    savedAt,
  };
};

const rowToQuestion = (row: DbQuestionRow, phone: string): QuestionRecord => {
  const english = unpackFullText(row.advisory_en);
  const telugu = unpackFullText(row.advisory_te);
  const payload = english.payload ?? telugu.payload;
  const questionEn = row.question_en ?? '';
  const questionTe = row.question_te ?? '';
  const diagnosisEn = row.diagnosis_en ?? '';
  const diagnosisTe = row.diagnosis_te ?? diagnosisEn;

  return {
    id: stripPhonePrefix(row.id ?? '', phone),
    questionText: questionEn,
    questionEn: payload?.questionEn ?? questionEn,
    questionTe: payload?.questionTe ?? questionTe,
    answerTitle: diagnosisEn,
    titleEn: diagnosisEn,
    titleTe: diagnosisTe,
    diagnosisEn: payload?.diagnosisEn ?? diagnosisEn,
    diagnosisTe: payload?.diagnosisTe ?? diagnosisTe,
    fullResponseEn: payload?.fullResponseEn ?? english.readable,
    fullResponseTe: payload?.fullResponseTe ?? (telugu.readable || english.readable),
    chemicalDosageEn: payload?.chemicalDosageEn ?? '',
    chemicalDosageTe: payload?.chemicalDosageTe ?? '',
    weatherWarningEn: payload?.weatherWarningEn ?? '',
    weatherWarningTe: payload?.weatherWarningTe ?? '',
    chatThread: payload?.chatThread,
    queryType: row.query_type ?? 'VOICE',
    askedAt: fromEpochMillis(row.asked_at),
    source: row.query_type ?? 'cloud',
  };
};

/**
 * Look up a phone in Supabase. A missing row means "brand new phone" — the
 * store owns the empty-profile/onboarding behaviour in that case.
 */
export const syncFarmerOnLogin = async (
  phone: string,
): Promise<SyncFarmerResult> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return { isExistingUser: false };

  const normalizedPhone = normalizeFarmerPhone(phone);

  try {
    const checkRes = await safeFetch(
      `${url}/rest/v1/farmers?phone=eq.${encodeURIComponent(normalizedPhone)}&select=*`,
      { headers: headers() },
    );

    if (!checkRes || !checkRes.ok) return { isExistingUser: false };

    const existing = (await checkRes.json()) as DbFarmerRow[];
    if (!Array.isArray(existing) || existing.length === 0) {
      return { isExistingUser: false };
    }

    const profile = rowToFarmer(existing[0]);

    let savedItems: SavedItem[] = [];
    const savedRes = await safeFetch(
      `${url}/rest/v1/farmer_saved_items?farmer_phone=eq.${encodeURIComponent(normalizedPhone)}&order=saved_at.desc`,
      { headers: headers() },
    );
    if (savedRes && savedRes.ok) {
      const savedRows = (await savedRes.json()) as DbSavedItemRow[];
      if (Array.isArray(savedRows)) {
        savedItems = savedRows.map((row) => rowToSavedItem(row, normalizedPhone));
      }
    }

    let questionHistory: QuestionRecord[] = [];
    const qRes = await safeFetch(
      `${url}/rest/v1/farmer_ai_questions?farmer_phone=eq.${encodeURIComponent(normalizedPhone)}&order=asked_at.desc`,
      { headers: headers() },
    );
    if (qRes && qRes.ok) {
      const qRows = (await qRes.json()) as DbQuestionRow[];
      if (Array.isArray(qRows)) {
        questionHistory = qRows.map((row) => rowToQuestion(row, normalizedPhone));
      }
    }

    return {
      isExistingUser: true,
      profile,
      preferredLanguage: toLanguage(existing[0].preferred_language),
      savedItems,
      questionHistory,
    };
  } catch (error) {
    console.warn('[DB] syncFarmerOnLogin failed:', error);
    return { isExistingUser: false };
  }
};

const defaultProfileForPhone = (phone: string): FarmerProfile => ({
  name: '',
  nameEn: '',
  nameTe: '',
  phone,
  phoneMasked: phone,
  address: '',
  acres: 0,
  acreageLabel: 'Small/Marginal',
  mandal: '',
  mandalTe: '',
  district: '',
  state: '',
  category: 'Pattadar',
  crops: [],
  cropsTe: [],
});

export const upsertFarmerProfileToCloud = async (
  profile: FarmerProfile,
  preferredLang: Language,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizeFarmerPhone(profile.phone ?? profile.phoneMasked);
  const nameEn = profile.nameEn ?? profile.name ?? '';
  const nameTe = profile.nameTe ?? nameEn;
  const mandal = foldAddressIntoMandal(profile.address, profile.mandal);
  const state = profile.state || '';
  const district = profile.district || '';
  const acres = Number.isFinite(profile.acres) ? profile.acres : 0;
  const crops = profile.crops ?? [];

  // public.farmers columns: phone, name_en, name_te, preferred_language,
  // state, district, mandal, acres, ownership_type, primary_crops.
  // `address` is intentionally folded into mandal because that column
  // does not exist in the deployed table.
  const fullPayload = {
    phone,
    name_en: nameEn,
    name_te: nameTe,
    preferred_language: preferredLang,
    state,
    district,
    mandal,
    acres,
    ownership_type:
      profile.category === 'Tenant' ? 'TENANT' : 'PATTADAR',
    primary_crops: crops,
  };

  const minimalPayload = {
    phone,
    name_en: nameEn,
    name_te: nameTe,
    preferred_language: preferredLang,
    state,
    district,
    mandal,
    acres,
  };

  try {
    for (const payload of [fullPayload, minimalPayload]) {
      const res = await safeFetch(`${url}/rest/v1/farmers`, {
        method: 'POST',
        headers: headers({
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(payload),
      });
      if (res && res.ok) return true;
    }
    return false;
  } catch (error) {
    console.warn('[DB] upsertFarmerProfileToCloud failed:', error);
    return false;
  }
};

/**
 * Every child table has farmer_phone REFERENCES farmers(phone). Upsert the
 * parent first so PostgreSQL can never reject a child row with FK 23503.
 */
const ensureParentFarmerExists = async (
  phone: string,
  profile?: FarmerProfile,
  lang?: Language,
): Promise<boolean> => {
  const normalized = normalizeFarmerPhone(phone);
  const parent = profile
    ? { ...profile, phone: normalized, phoneMasked: normalized }
    : defaultProfileForPhone(normalized);
  return upsertFarmerProfileToCloud(parent, lang ?? 'te');
};

const upsertRow = async (
  table: string,
  body: Record<string, unknown>,
  conflict: string,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  if (!url) return false;
  const res = await safeFetch(
    `${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`,
    {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(body),
    },
  );
  if (!res) return false;
  if (!res.ok) {
    // Surface the PostgREST error instead of silently leaving tables empty.
    const detail = await res.text().catch(() => '');
    console.warn(`[DB] upsert ${table} failed (${res.status}):`, detail.slice(0, 400));
  }
  return res.ok;
};

const savedItemBody = (phone: string, item: SavedItem): Record<string, unknown> => {
  const payload = conversationPayloadFromSaved(item);
  const savedAt = item.savedAt ?? item.bookmarkedAt ?? Date.now();
  return {
    id: `${phone}_${item.id}`,
    farmer_phone: phone,
    item_id: item.id,
    item_type: item.category ?? item.type,
    title_en: item.title ?? '',
    title_te: item.titleTe || item.title || '',
    subtitle_en: packFullText(buildSavedReadableText(item, false), payload),
    subtitle_te: packFullText(buildSavedReadableText(item, true), payload),
    benefit_or_dosage: item.chemicalDosageEn || item.badgeEn || '',
    saved_at: toEpochMillis(savedAt),
  };
};

/**
 * Legacy local questions may have no id. Deriving a stable id from their
 * content keeps repeated bulk syncs from creating duplicate cloud rows.
 */
const stableLegacyId = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return `legacy-${(hash >>> 0).toString(36)}`;
};

const questionBody = (
  phone: string,
  question: QuestionRecord,
): Record<string, unknown> => {
  const payload = conversationPayloadFromQuestion(question);
  const questionEn = question.questionEn ?? question.questionText ?? '';
  const questionTe = question.questionTe ?? question.questionText ?? '';
  const askedAt = toEpochMillis(question.askedAt ?? question.savedAt);
  const id =
    question.id ??
    stableLegacyId(
      `${questionEn}|${questionTe}|${askedAt}|${question.queryType ?? 'VOICE'}`,
    );
  return {
    id: `${phone}_${id}`,
    farmer_phone: phone,
    query_type: (question.queryType || 'VOICE').toUpperCase(),
    question_en: questionEn,
    question_te: questionTe,
    diagnosis_en:
      question.diagnosisEn ?? question.titleEn ?? question.answerTitle ?? '',
    diagnosis_te:
      question.diagnosisTe ?? question.titleTe ?? question.answerTitle ?? '',
    advisory_en: packFullText(buildQuestionReadableText(question, false), payload),
    advisory_te: packFullText(buildQuestionReadableText(question, true), payload),
    asked_at: askedAt,
  };
};

const schemeCheckBody = (
  phone: string,
  snapshot: SchemeCheckSnapshot,
): Record<string, unknown> => ({
  farmer_phone: phone,
  wizard_inputs: snapshot.wizardInputs ?? {},
  checked_documents: snapshot.checkedDocuments ?? [],
  eligible_count: Number.isFinite(snapshot.eligibleCount)
    ? Math.round(snapshot.eligibleCount)
    : 0,
});

export const syncSavedItemToCloud = async (
  farmerPhone: string,
  item: SavedItem,
  action: 'UPSERT' | 'DELETE',
  profile?: FarmerProfile,
  lang?: Language,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizeFarmerPhone(farmerPhone);

  try {
    if (action === 'DELETE') {
      const res = await safeFetch(
        `${url}/rest/v1/farmer_saved_items?farmer_phone=eq.${encodeURIComponent(phone)}&item_id=eq.${encodeURIComponent(item.id)}`,
        {
          method: 'DELETE',
          headers: headers(),
        },
      );
      return Boolean(res && res.ok);
    }

    const parentOk = await ensureParentFarmerExists(phone, profile, lang);
    if (!parentOk) return false;

    return upsertRow('farmer_saved_items', savedItemBody(phone, item), 'id');
  } catch (error) {
    console.warn('[DB] syncSavedItemToCloud failed:', error);
    return false;
  }
};

export const insertAiQuestionToCloud = async (
  farmerPhone: string,
  question: QuestionRecord,
  profile?: FarmerProfile,
  lang?: Language,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizeFarmerPhone(farmerPhone);

  try {
    const parentOk = await ensureParentFarmerExists(phone, profile, lang);
    if (!parentOk) return false;
    return upsertRow('farmer_ai_questions', questionBody(phone, question), 'id');
  } catch (error) {
    console.warn('[DB] insertAiQuestionToCloud failed:', error);
    return false;
  }
};

export const deleteAiQuestionFromCloud = async (
  farmerPhone: string,
  questionId: string,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizeFarmerPhone(farmerPhone);
  try {
    const res = await safeFetch(
      `${url}/rest/v1/farmer_ai_questions?farmer_phone=eq.${encodeURIComponent(phone)}&id=eq.${encodeURIComponent(`${phone}_${questionId}`)}`,
      { method: 'DELETE', headers: headers() },
    );
    return Boolean(res && res.ok);
  } catch (error) {
    console.warn('[DB] deleteAiQuestionFromCloud failed:', error);
    return false;
  }
};

export const upsertSchemeCheckToCloud = async (
  farmerPhone: string,
  wizardInputs: Record<string, unknown>,
  checkedDocs: string[],
  eligibleCount: number,
  profile?: FarmerProfile,
  lang?: Language,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizeFarmerPhone(farmerPhone);

  try {
    const parentOk = await ensureParentFarmerExists(phone, profile, lang);
    if (!parentOk) return false;

    return upsertRow(
      'farmer_scheme_checks',
      schemeCheckBody(phone, {
        wizardInputs,
        checkedDocuments: checkedDocs,
        eligibleCount,
      }),
      'farmer_phone',
    );
  } catch (error) {
    console.warn('[DB] upsertSchemeCheckToCloud failed:', error);
    return false;
  }
};

/**
 * Parent-first bulk push. Called on login/launch and from "Sync Now" so every
 * local item immediately lands in all four Supabase tables.
 */
export const syncAllLocalDataToCloud = async (
  state: CloudSyncState,
): Promise<boolean> => {
  if (!isCloudDbConfigured()) return false;

  try {
    const phone = normalizeFarmerPhone(
      state.farmer?.phone ?? state.farmer?.phoneMasked,
    );
    const parentOk = await upsertFarmerProfileToCloud(
      { ...state.farmer, phone, phoneMasked: phone },
      state.language,
    );
    if (!parentOk) return false;

    const writes: Promise<boolean>[] = [];
    for (const item of state.savedItems ?? []) {
      writes.push(upsertRow('farmer_saved_items', savedItemBody(phone, item), 'id'));
    }
    for (const question of state.questionHistory ?? []) {
      writes.push(upsertRow('farmer_ai_questions', questionBody(phone, question), 'id'));
    }
    if (state.schemeCheck) {
      writes.push(
        upsertRow(
          'farmer_scheme_checks',
          schemeCheckBody(phone, state.schemeCheck),
          'farmer_phone',
        ),
      );
    }

    const results = await Promise.all(writes);
    return results.every(Boolean);
  } catch (error) {
    console.warn('[DB] syncAllLocalDataToCloud failed:', error);
    return false;
  }
};
