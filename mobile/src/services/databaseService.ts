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

export interface QuestionRecord {
  id?: string;
  questionText?: string;
  questionTe?: string;
  answerTitle?: string;
  askedAt?: string;
  source?: string;
}

export interface SyncFarmerResult {
  profile: FarmerProfile;
  savedItems?: SavedItem[];
  questionHistory?: QuestionRecord[];
  isRestoredFromCloud: boolean;
}

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

const cleanPhone10 = (phone: string): string =>
  phone.replace(/[\s\-+]/g, '').replace(/^91/, '').slice(-10);

export const normalizePhone = (phone: string): string =>
  `+91${cleanPhone10(phone)}`;

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

/* ──────────────────────────── Farmer sync ──────────────────────────────── */

interface DbFarmerRow {
  phone: string;
  name_en?: string;
  name_te?: string;
  acres?: number;
  mandal?: string;
  mandal_te?: string;
  district?: string;
  state?: string;
  category?: string;
  crops?: string[];
  crops_te?: string[];
  ownership?: string;
  preferred_language?: string;
  acreage_label?: string;
}

interface DbSavedItemRow {
  id?: string;
  item_id: string;
  type: 'scheme' | 'advisory';
  title: string;
  title_te: string;
  subtitle?: string;
  data?: Record<string, unknown>;
  saved_at?: string;
}

interface DbQuestionRow {
  id?: string;
  question_text?: string;
  question_te?: string;
  answer_title?: string;
  asked_at?: string;
  source?: string;
}

const rowToFarmer = (row: DbFarmerRow): FarmerProfile => ({
  name: row.name_en ?? 'Venkata Reddy Garu',
  nameTe: row.name_te ?? 'వెంకట రెడ్డి గారు',
  phoneMasked: row.phone,
  acres: row.acres ?? 4.5,
  acreageLabel: row.acreage_label ?? 'Small/Marginal',
  mandal: row.mandal ?? 'Guntur Mandal',
  mandalTe: row.mandal_te ?? 'గుంటూరు మండలం',
  district: row.district ?? 'Guntur',
  state: row.state ?? 'Andhra Pradesh',
  category: (row.category === 'Tenant' ? 'Tenant' : 'Pattadar') as
    | 'Pattadar'
    | 'Tenant',
  crops: row.crops ?? ['Chilli', 'Paddy'],
  cropsTe: row.crops_te ?? ['మిర్చి', 'వరి'],
});

const rowToSavedItem = (row: DbSavedItemRow): SavedItem => ({
  id: row.item_id,
  type: row.type,
  title: row.title,
  titleTe: row.title_te,
  subtitle: row.subtitle,
  data: row.data,
  bookmarkedAt: row.saved_at ? new Date(row.saved_at).getTime() : Date.now(),
});

const rowToQuestion = (row: DbQuestionRow): QuestionRecord => ({
  id: row.id,
  questionText: row.question_text,
  questionTe: row.question_te,
  answerTitle: row.answer_title,
  askedAt: row.asked_at,
  source: row.source,
});

export const syncFarmerOnLogin = async (
  phone: string,
  currentProfile: FarmerProfile,
  preferredLang: Language,
): Promise<SyncFarmerResult> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return {
      profile: currentProfile,
      isRestoredFromCloud: false,
    };
  }

  const cleanPhone = cleanPhone10(phone);
  const phoneE164 = `+91${cleanPhone}`;

  try {
    // 1. Check if farmer exists
    const checkRes = await safeFetch(
      `${url}/rest/v1/farmers?phone=eq.${encodeURIComponent(phoneE164)}&select=*`,
      { headers: headers() },
    );

    if (!checkRes) {
      return { profile: currentProfile, isRestoredFromCloud: false };
    }

    const existing = (await checkRes.json()) as DbFarmerRow[];
    const hasExisting = Array.isArray(existing) && existing.length > 0;

    if (hasExisting) {
      const row = existing[0];
      const profile = rowToFarmer(row);

      // Fetch saved items
      let savedItems: SavedItem[] = [];
      const savedRes = await safeFetch(
        `${url}/rest/v1/farmer_saved_items?farmer_phone=eq.${encodeURIComponent(phoneE164)}&order=saved_at.desc`,
        { headers: headers() },
      );
      if (savedRes && savedRes.ok) {
        const savedRows = (await savedRes.json()) as DbSavedItemRow[];
        if (Array.isArray(savedRows)) {
          savedItems = savedRows.map(rowToSavedItem);
        }
      }

      // Fetch AI questions
      let questionHistory: QuestionRecord[] = [];
      const qRes = await safeFetch(
        `${url}/rest/v1/farmer_ai_questions?farmer_phone=eq.${encodeURIComponent(phoneE164)}&order=asked_at.desc`,
        { headers: headers() },
      );
      if (qRes && qRes.ok) {
        const qRows = (await qRes.json()) as DbQuestionRow[];
        if (Array.isArray(qRows)) {
          questionHistory = qRows.map(rowToQuestion);
        }
      }

      return {
        profile,
        savedItems,
        questionHistory,
        isRestoredFromCloud: true,
      };
    }

    // First-time login: upsert new record
    const upsertBody = {
      phone: phoneE164,
      name_en: currentProfile.name,
      name_te: currentProfile.nameTe,
      acres: currentProfile.acres,
      mandal: currentProfile.mandal,
      mandal_te: currentProfile.mandalTe,
      district: currentProfile.district,
      state: currentProfile.state,
      category: currentProfile.category,
      crops: currentProfile.crops,
      crops_te: currentProfile.cropsTe,
      acreage_label: currentProfile.acreageLabel,
      preferred_language: preferredLang,
    };

    const upsertRes = await safeFetch(`${url}/rest/v1/farmers`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(upsertBody),
    });

    if (upsertRes && upsertRes.ok) {
      console.log('[DB] New farmer upserted to cloud');
    }

    return {
      profile: currentProfile,
      isRestoredFromCloud: false,
    };
  } catch (error) {
    console.warn('[DB] syncFarmerOnLogin failed:', error);
    return {
      profile: currentProfile,
      isRestoredFromCloud: false,
    };
  }
};

export const upsertFarmerProfileToCloud = async (
  profile: FarmerProfile,
  preferredLang: Language,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizePhone(profile.phoneMasked);

  try {
    const body = {
      phone,
      name_en: profile.name,
      name_te: profile.nameTe,
      acres: profile.acres,
      mandal: profile.mandal,
      mandal_te: profile.mandalTe,
      district: profile.district,
      state: profile.state,
      category: profile.category,
      crops: profile.crops,
      crops_te: profile.cropsTe,
      acreage_label: profile.acreageLabel,
      preferred_language: preferredLang,
    };

    const res = await safeFetch(`${url}/rest/v1/farmers`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(body),
    });

    return Boolean(res && res.ok);
  } catch (error) {
    console.warn('[DB] upsertFarmerProfileToCloud failed:', error);
    return false;
  }
};

export const syncSavedItemToCloud = async (
  farmerPhone: string,
  item: SavedItem,
  action: 'UPSERT' | 'DELETE',
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizePhone(farmerPhone);

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

    const body = {
      farmer_phone: phone,
      item_id: item.id,
      type: item.type,
      title: item.title,
      title_te: item.titleTe,
      subtitle: item.subtitle,
      data: item.data ?? {},
      saved_at: new Date(item.bookmarkedAt).toISOString(),
    };

    const res = await safeFetch(`${url}/rest/v1/farmer_saved_items`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(body),
    });

    return Boolean(res && res.ok);
  } catch (error) {
    console.warn('[DB] syncSavedItemToCloud failed:', error);
    return false;
  }
};

export const insertAiQuestionToCloud = async (
  farmerPhone: string,
  question: QuestionRecord,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizePhone(farmerPhone);

  try {
    const body = {
      farmer_phone: phone,
      question_text: question.questionText ?? '',
      question_te: question.questionTe ?? '',
      answer_title: question.answerTitle ?? '',
      asked_at: question.askedAt
        ? new Date(question.askedAt).toISOString()
        : new Date().toISOString(),
      source: question.source ?? 'offline',
    };

    const res = await safeFetch(`${url}/rest/v1/farmer_ai_questions`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(body),
    });

    return Boolean(res && res.ok);
  } catch (error) {
    console.warn('[DB] insertAiQuestionToCloud failed:', error);
    return false;
  }
};

export const upsertSchemeCheckToCloud = async (
  farmerPhone: string,
  wizardInputs: Record<string, unknown>,
  checkedDocs: string[],
  eligibleCount: number,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;

  const phone = normalizePhone(farmerPhone);

  try {
    const body = {
      farmer_phone: phone,
      wizard_inputs: wizardInputs,
      checked_docs: checkedDocs,
      eligible_count: eligibleCount,
      updated_at: new Date().toISOString(),
    };

    const res = await safeFetch(`${url}/rest/v1/farmer_scheme_checks`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(body),
    });

    return Boolean(res && res.ok);
  } catch (error) {
    console.warn('[DB] upsertSchemeCheckToCloud failed:', error);
    return false;
  }
};
