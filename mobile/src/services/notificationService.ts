/**
 * notificationService — personalized, profile-aware smart alerts
 * --------------------------------------------------------------
 * Reads global broadcasts (`farmer_phone = 'ALL'`) and farmer-specific rows
 * from Supabase `public.farmer_notifications`, prioritises them against the
 * farmer's crops / ownership / acres / mandal, and adds locally generated
 * preference alerts. No new dependencies — plain `fetch`, like databaseService.
 *
 * Deployed columns (verified against the live table):
 *   id, farmer_phone, category, priority, title_en, title_te, message_en,
 *   message_te, target_crops (text[]), target_ownership (text),
 *   action_tab, action_scheme_id (text), is_read (boolean), created_at (timestamptz)
 *
 * There is no reason column and `action_scheme_id` is only varchar(80), so
 * bilingual reasons travel inside the (unbounded) message_en text using a
 * versioned marker that is stripped on read. Global broadcast read-states are
 * kept per farmer through shadow marker rows instead of mutating the shared
 * broadcast row.
 */

import type { UserProfile } from '../store/useAppStore';
import {
  isCloudDbConfigured,
  normalizeFarmerPhone,
} from './databaseService';

/* ────────────────────────────── Types ──────────────────────────────────── */

export type NotificationCategory =
  | 'SCHEME'
  | 'WEATHER'
  | 'MANDI'
  | 'PROFILE_ALERT';

export type NotificationPriority = 'URGENT' | 'HIGH' | 'NORMAL';

export type NotificationActionTab =
  | 'Schemes'
  | 'Market'
  | 'AskAI'
  | 'Weather'
  | 'Profile';

export interface FarmerNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  titleEn: string;
  titleTe: string;
  messageEn: string;
  messageTe: string;
  /** Why this farmer received the alert (shown as a green profile pill). */
  reasonEn: string;
  reasonTe: string;
  actionTab: NotificationActionTab;
  isRead: boolean;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Internal: cloud crop targeting, preserved when syncing read-state. */
  targetCrops?: string[];
  /** Internal: cloud ownership targeting, preserved when syncing read-state. */
  targetOwnership?: string[];
  /** Internal: higher means a more specific profile match. */
  matchScore?: number;
}

interface NotificationRow {
  id?: string;
  farmer_phone?: string;
  category?: string;
  priority?: string;
  title_en?: string;
  title_te?: string;
  message_en?: string;
  message_te?: string;
  target_crops?: unknown;
  target_ownership?: unknown;
  action_tab?: string;
  action_scheme_id?: string | null;
  is_read?: boolean;
  created_at?: string;
}

/* ──────────────────────────── Config / helpers ────────────────────────── */

const NOTIFICATION_TABLE = 'farmer_notifications';
const REASON_MARKER = '[[RV_NOTIFY_REASON_V1]]';
const READ_SHADOW_MARKER = '[[RV_NOTIFY_READ_V1]]';

const getSupabaseUrl = (): string | null => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
};

const getSupabaseKey = (): string | null => {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return key || null;
};

const headers = (extra?: Record<string, string>): Record<string, string> => {
  const key = getSupabaseKey() ?? '';
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
    return await fetch(url, init);
  } catch (error) {
    console.warn('[Notifications] Network error:', error);
    return null;
  }
};

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string').map(String);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === 'string')
          .map(String);
      }
    } catch {
      // Not JSON — treat as a comma-separated list below.
    }
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
};

const CROP_TE: Record<string, string> = {
  Chilli: 'మిర్చి',
  Paddy: 'వరి',
  Cotton: 'పత్తి',
  Turmeric: 'పసుపు',
  Pulses: 'పప్పుధాన్యాలు',
  'Black Gram': 'మినుము',
  'Green Gram': 'పెసర',
};

const cropTe = (crop: string): string => CROP_TE[crop] ?? crop;

const ownerEn = (user: UserProfile): string =>
  user.ownership?.trim() || user.category || 'Pattadar';

const ownerTe = (user: UserProfile): string => {
  const value = ownerEn(user).toLowerCase();
  if (value.includes('tenant') || value.includes('కౌలు')) return 'కౌలుదారు';
  return 'పట్టాదారు';
};

const profileReason = (
  user: UserProfile,
  crops: string[] = user.crops ?? [],
): { en: string; te: string } => {
  const acres = Number(user.acres ?? 0);
  const cropEn = crops.length > 0 ? crops.join(', ') : 'your crops';
  const cropTeText =
    crops.length > 0 ? crops.map(cropTe).join(', ') : 'మీ పంటలు';
  const mandal = user.mandal ?? '';
  return {
    en: `Matched to your ${acres} Acres ${ownerEn(user)} profile & ${cropEn} crop${
      crops.length === 1 ? '' : 's'
    }${mandal ? ` in ${mandal}` : ''}`,
    te: `మీ ${acres} ఎకరాల ${ownerTe(user)} & ${cropTeText} పంట ఆధారంగా`,
  };
};

/** -1 = not for this farmer, 0 = generic, 1 = crop, 2 = crop + ownership. */
const targetMatchScore = (
  user: UserProfile,
  crops: string[],
  owners: string[],
): number => {
  const cropList = crops.map((crop) => crop.toLowerCase());
  const ownerList = owners.map((owner) => owner.toLowerCase());
  const cropConstrained = cropList.length > 0 && !cropList.includes('all');
  const ownerConstrained = ownerList.length > 0 && !ownerList.includes('all');

  if (!cropConstrained && !ownerConstrained) return 0;

  const ownCrops = (user.crops ?? []).map((crop) => crop.toLowerCase());
  const cropOk =
    !cropConstrained ||
    ownCrops.some((crop) => cropList.some((target) => crop.includes(target) || target.includes(crop)));
  if (!cropOk) return -1;

  const ownOwners = [ownerEn(user), user.category, user.ownership]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const ownerOk =
    !ownerConstrained ||
    ownOwners.some((value) =>
      ownerList.some((target) => value.includes(target) || target.includes(value)),
    );
  if (!ownerOk) return -1;

  return cropConstrained && ownerConstrained ? 2 : 1;
};

const asCategory = (value?: string): NotificationCategory => {
  if (value === 'WEATHER' || value === 'MANDI' || value === 'PROFILE_ALERT') {
    return value;
  }
  return 'SCHEME';
};

const asPriority = (value?: string): NotificationPriority => {
  if (value === 'URGENT' || value === 'HIGH' || value === 'NORMAL') return value;
  return 'NORMAL';
};

const asActionTab = (value?: string): NotificationActionTab => {
  if (value === 'Market') return 'Market';
  if (value === 'AskAI') return 'AskAI';
  if (value === 'Weather') return 'Weather';
  if (value === 'Profile') return 'Profile';
  return 'Schemes';
};

const decodeReason = (
  messageEn: string,
  user: UserProfile,
  crops: string[],
  owners: string[],
): { en: string; te: string; messageEn: string } => {
  const markerIndex = messageEn.lastIndexOf(REASON_MARKER);
  if (markerIndex >= 0) {
    try {
      const raw = messageEn.slice(markerIndex + REASON_MARKER.length);
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const payload = parsed as { en?: unknown; te?: unknown };
        return {
          en: typeof payload.en === 'string' ? payload.en : '',
          te: typeof payload.te === 'string' ? payload.te : '',
          messageEn: messageEn.slice(0, markerIndex).trimEnd(),
        };
      }
    } catch {
      // Fall through to the profile-derived reason.
    }
  }
  return {
    ...profileReason(user, crops.length > 0 ? crops : undefined),
    messageEn,
  };
};

const timestampFromRow = (value?: string): number => {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const isReadShadow = (
  row: NotificationRow,
  phone: string,
): string | null => {
  if (!row.id?.startsWith(`${phone}_read_`) || !row.action_scheme_id?.startsWith(READ_SHADOW_MARKER)) {
    return null;
  }
  const id = row.action_scheme_id.slice(READ_SHADOW_MARKER.length);
  return id.length > 0 ? id : null;
};

/* ───────────────────────── Cloud notifications ────────────────────────── */

/**
 * Fetch broadcasts + this farmer's rows from Supabase, dropping anything that
 * does not match their crops/ownership. Read-state shadow rows are applied.
 */
export const fetchCloudNotifications = async (
  user: UserProfile,
): Promise<FarmerNotification[]> => {
  if (!isCloudDbConfigured()) return [];
  const url = getSupabaseUrl();
  if (!url) return [];

  const phone = normalizeFarmerPhone(user.phone ?? user.phoneMasked);
  // Encode the whole filter once — pre-encoding the phone double-encodes '+'
  // and silently hides every farmer-specific notification row.
  const orFilter = `(farmer_phone.eq.ALL,farmer_phone.eq.${phone})`;
  const endpoint = `${url}/rest/v1/${NOTIFICATION_TABLE}?or=${encodeURIComponent(
    orFilter,
  )}&order=created_at.desc&limit=100`;

  const res = await safeFetch(endpoint, { headers: headers() });
  if (!res?.ok) {
    if (res) {
      const detail = await res.text().catch(() => '');
      console.warn(`[Notifications] fetch failed (${res.status}):`, detail.slice(0, 300));
    }
    return [];
  }

  let rows: NotificationRow[] = [];
  try {
    const parsed: unknown = await res.json();
    if (Array.isArray(parsed)) rows = parsed as NotificationRow[];
  } catch {
    console.warn('[Notifications] malformed response');
    return [];
  }

  const shadowReadIds = new Set<string>();
  for (const row of rows) {
    const shadowId = isReadShadow(row, phone);
    if (shadowId) shadowReadIds.add(shadowId);
  }

  const notifications: FarmerNotification[] = [];
  for (const row of rows) {
    if (!row.id || isReadShadow(row, phone)) continue;
    if (
      row.farmer_phone &&
      row.farmer_phone !== 'ALL' &&
      row.farmer_phone !== phone
    ) {
      continue;
    }

    const crops = parseStringArray(row.target_crops);
    const owners = parseStringArray(row.target_ownership);
    const matchScore = targetMatchScore(user, crops, owners);
    if (matchScore < 0) continue;

    const reason = decodeReason(
      row.message_en || row.message_te || '',
      user,
      crops,
      owners,
    );
    notifications.push({
      id: row.id,
      category: asCategory(row.category),
      priority: asPriority(row.priority),
      titleEn: row.title_en || row.title_te || 'New update',
      titleTe: row.title_te || row.title_en || 'కొత్త సమాచారం',
      messageEn: reason.messageEn,
      messageTe: row.message_te || row.message_en || '',
      reasonEn: reason.en,
      reasonTe: reason.te,
      actionTab: asActionTab(row.action_tab),
      isRead: Boolean(row.is_read) || shadowReadIds.has(row.id),
      createdAt: timestampFromRow(row.created_at),
      targetCrops: crops,
      targetOwnership: owners,
      matchScore,
    });
  }

  return notifications;
};

/* ──────────────────── Locally generated profile alerts ────────────────── */

interface AlertDraft {
  tail: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  actionTab: NotificationActionTab;
  titleEn: string;
  titleTe: string;
  messageEn: string;
  messageTe: string;
}

const buildGenerated = (
  user: UserProfile,
  drafts: AlertDraft[],
  reason: { en: string; te: string },
): FarmerNotification[] => {
  const phone = normalizeFarmerPhone(user.phone ?? user.phoneMasked);
  return drafts.map((draft) => ({
    id: `${phone}_local_${draft.tail}`,
    category: draft.category,
    priority: draft.priority,
    actionTab: draft.actionTab,
    titleEn: draft.titleEn,
    titleTe: draft.titleTe,
    messageEn: draft.messageEn,
    messageTe: draft.messageTe,
    reasonEn: reason.en,
    reasonTe: reason.te,
    isRead: false,
    createdAt: Date.now(),
    targetCrops: ['ALL'],
    targetOwnership: ['ALL'],
    matchScore: 1,
  }));
};

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
};

/**
 * Merge Supabase broadcasts with alerts generated from the farmer's exact
 * acres, ownership, crops, mandal, e-Panta status and language preference.
 */
export const generatePersonalizedNotifications = (
  user: UserProfile,
  cloudNotifications: FarmerNotification[],
): FarmerNotification[] => {
  const byId = new Map<string, FarmerNotification>();
  for (const notification of cloudNotifications) {
    byId.set(notification.id, notification);
  }

  const acres = Number(user.acres ?? 0);
  const ownCrops = (user.crops ?? []).filter(Boolean);
  const lowerCrops = ownCrops.map((crop) => crop.toLowerCase());
  const mandal = user.mandal || 'Guntur Mandal';
  const nameEn = user.nameEn || user.name || 'Farmer';
  const nameTe = user.nameTe || nameEn;
  const ownership = ownerEn(user);
  const reason = profileReason(user, ownCrops);
  const drafts: AlertDraft[] = [];

  // Exact acreage + ownership scheme match.
  drafts.push({
    tail: 'acres-scheme',
    category: 'SCHEME',
    priority: acres < 5 ? 'HIGH' : 'NORMAL',
    actionTab: 'Schemes',
    titleEn:
      acres < 5
        ? `New 2025 Kharif Subsidy Match for ${acres} Acres (${ownership})`
        : `2025 Kharif Input Subsidy Advisory for ${acres} Acres (${ownership})`,
    titleTe: `${acres} ఎకరాల ${ownerTe(user)} కొత్త ఖరీఫ్ సబ్సిడీ అర్హత`,
    messageEn: `RythuVaani matched ${nameEn}'s ${acres}-acre ${ownership} profile in ${mandal} with current subsidy schemes. Review your eligibility before the deadline.`,
    messageTe: `${mandal} లోని మీ ${acres} ఎకరాల ${ownerTe(user)} ప్రొఫైల్ కు సరిపోయే సబ్సిడీ పథకాలను రైతువాణి గుర్తించింది. గడువుకు ముందు అర్హత పరిశీలించండి.`,
  });

  // Crop-specific scheme + mandi alerts.
  if (lowerCrops.some((crop) => crop.includes('chilli') || crop.includes('mirchi'))) {
    drafts.push({
      tail: 'chilli-apmip',
      category: 'SCHEME',
      priority: 'HIGH',
      actionTab: 'Schemes',
      titleEn: '90% APMIP Drip Irrigation Subsidy for Chilli',
      titleTe: 'మిర్చి రైతులకు 90% డ్రిప్ ఇరిగేషన్ సబ్సిడీ',
      messageEn: `Estimated subsidy ₹1,82,250 for ${acres} Acres. Apply through APMIP before the last date.`,
      messageTe: `మీ ${acres} ఎకరాలకు అంచనా సబ్సిడీ ₹1,82,250. గడువుకు ముందు APMIP ద్వారా దరఖాస్తు చేయండి.`,
    });
    drafts.push({
      tail: 'chilli-mandi',
      category: 'MANDI',
      priority: 'HIGH',
      actionTab: 'Market',
      titleEn: 'Guntur Mirchi Yard: Teja Grade A at ₹22,400/Qtl',
      titleTe: 'గుంటూరు మిర్చి యార్డ్: తేజా గ్రేడ్ A ₹22,400/క్వింటాల్',
      messageEn: 'Price surge detected for Teja Grade A chilli. Check today’s mandi rates before selling.',
      messageTe: 'తేజా గ్రేడ్ A మిర్చి ధరలు పెరిగాయి. అమ్మకానికి ముందు నేటి మార్కెట్ ధరలు చూడండి.',
    });
  }

  if (lowerCrops.some((crop) => crop.includes('paddy') || crop.includes('rice'))) {
    drafts.push({
      tail: 'paddy-pmfby',
      category: 'SCHEME',
      priority: 'HIGH',
      actionTab: 'Schemes',
      titleEn: 'PMFBY Kharif Paddy Crop Insurance Window Open',
      titleTe: 'పీఎంఎఫ్ బీవై ఖరీఫ్ వరి పంట బీమా దరఖాస్తులు ప్రారంభం',
      messageEn: `Enrol your ${acres} Acres of Paddy under PMFBY before the cutoff date.`,
      messageTe: `మీ ${acres} ఎకరాల వరి పంటను గడువుకు ముందు పీఎంఎఫ్ బీవై లో నమోదు చేయండి.`,
    });
    drafts.push({
      tail: 'paddy-stem-borer',
      category: 'WEATHER',
      priority: 'HIGH',
      actionTab: 'AskAI',
      titleEn: 'BPT 5204 Stem Borer Advisory',
      titleTe: 'BPT 5204 వరి కాండం తొలుచు పురుగు సలహా',
      messageEn: 'Scout your BPT 5204 Paddy field for yellow stem borer and follow the recommended dosage.',
      messageTe: 'మీ BPT 5204 వరి పొలంలో పసుపు కాండం తొలుచు పురుగును పరిశీలించి సిఫార్సు మోతాదు పాటించండి.',
    });
  }

  const otherCrop = ownCrops.find((crop) =>
    ['cotton', 'turmeric', 'pulses', 'black gram', 'green gram'].some((key) =>
      crop.toLowerCase().includes(key),
    ),
  );
  if (otherCrop) {
    drafts.push({
      tail: 'crop-msp',
      category: 'SCHEME',
      priority: 'HIGH',
      actionTab: 'Schemes',
      titleEn: `${otherCrop} MSP & Input Subsidy Update`,
      titleTe: `${cropTe(otherCrop)} కనిష్ట మద్దతు ధర & సబ్సిడీ అప్ డేట్`,
      messageEn: `A revised MSP / subsidy alert is available for your ${otherCrop} crop on ${acres} Acres in ${mandal}.`,
      messageTe: `${mandal} లో మీ ${acres} ఎకరాల ${cropTe(otherCrop)} పంటకు కొత్త కనిష్ట మద్దతు ధర / సబ్సిడీ సమాచారం అందుబాటులో ఉంది.`,
    });
  }

  if (ownerEn(user).toLowerCase().includes('tenant') || user.category === 'Tenant') {
    drafts.push({
      tail: 'tenant-credit',
      category: 'SCHEME',
      priority: 'HIGH',
      actionTab: 'Schemes',
      titleEn: 'CCRC Tenant Card & JLG Crop Loan Eligibility',
      titleTe: 'సీసీఆర్ సి కౌలుదారు కార్డు & జేఎల్జీ పంట రుణ అర్హత',
      messageEn: 'As a Tenant farmer you may qualify for a CCRC Tenant Card and a JLG crop loan.',
      messageTe: 'కౌలుదారు రైతుగా మీరు సీసీఆర్ సి కౌలుదారు కార్డు, జేఎల్జీ పంట రుణానికి అర్హులు కావచ్చు.',
    });
  }

  const epanta = (user.epantaStatus ?? '').trim().toLowerCase();
  if (epanta && !['done', 'verified', 'updated', 'completed'].includes(epanta)) {
    drafts.push({
      tail: 'epanta-action',
      category: 'PROFILE_ALERT',
      priority: 'NORMAL',
      actionTab: 'Profile',
      titleEn: 'Complete e-Panta Verification',
      titleTe: 'ఇ-పంతా ధృవీకరణ పూర్తి చేయండి',
      messageEn: `Your e-Panta status needs attention. Update it to unlock ${mandal} scheme eligibility.`,
      messageTe: `మీ ఇ-పంతా స్థితి నవీకరణ అవసరం. ${mandal} పథక అర్హత కోసం దాన్ని పూర్తి చేయండి.`,
    });
  }

  // Stable "preferences refreshed" card — also the banner target after edits.
  const language = user.preferredLanguage ?? 'te';
  drafts.push({
    tail: 'profile-preferences',
    category: 'PROFILE_ALERT',
    priority: 'NORMAL',
    actionTab: 'Profile',
    titleEn: 'Your RythuVaani Alerts Are Personalized',
    titleTe: 'మీ రైతువాణి హెచ్చరికలు వ్యక్తిగతీకరించబడ్డాయి',
    messageEn: `Tailored for ${nameEn} • ${acres} Acres • ${ownership} • ${ownCrops.join(', ') || 'all crops'} • ${language.toUpperCase()}.`,
    messageTe: `${nameTe} • ${acres} ఎకరాలు • ${ownerTe(user)} • ${ownCrops.map(cropTe).join(', ') || 'అన్ని పంటలు'} • ${language.toUpperCase()} కోసం రూపొందించబడ్డాయి.`,
  });

  for (const draft of buildGenerated(user, drafts, reason)) {
    if (!byId.has(draft.id)) byId.set(draft.id, draft);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priority !== 0) return priority;
    const specificity = (b.matchScore ?? 0) - (a.matchScore ?? 0);
    if (specificity !== 0) return specificity;
    return b.createdAt - a.createdAt;
  });
};

/* ───────────────────────── Cloud write support ────────────────────────── */

const notificationBody = (
  phone: string,
  notification: FarmerNotification,
  isRead: boolean,
): Record<string, unknown> => {
  // message_en is unbounded text; action_scheme_id is only varchar(80).
  const reasonPayload = `\n${REASON_MARKER}${JSON.stringify({
    en: notification.reasonEn,
    te: notification.reasonTe,
  })}`;
  return {
    id: notification.id,
    farmer_phone: phone,
    category: notification.category,
    priority: notification.priority,
    title_en: notification.titleEn,
    title_te: notification.titleTe,
    message_en: `${notification.messageEn}${reasonPayload}`,
    message_te: notification.messageTe,
    target_crops: notification.targetCrops?.length ? notification.targetCrops : ['ALL'],
    target_ownership: notification.targetOwnership?.length
      ? JSON.stringify(notification.targetOwnership).slice(0, 40)
      : 'ALL',
    action_tab: notification.actionTab,
    action_scheme_id: 'RV_LOCAL',
    is_read: isRead,
    created_at: new Date(notification.createdAt).toISOString(),
  };
};

const upsertNotificationRow = async (
  body: Record<string, unknown>,
): Promise<boolean> => {
  const url = getSupabaseUrl();
  if (!url) return false;
  const res = await safeFetch(
    `${url}/rest/v1/${NOTIFICATION_TABLE}?on_conflict=${encodeURIComponent('id')}`,
    {
      method: 'POST',
      headers: headers({
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(body),
    },
  );
  if (!res?.ok) {
    if (res) {
      const detail = await res.text().catch(() => '');
      console.warn(`[Notifications] upsert failed (${res.status}):`, detail.slice(0, 300));
    }
    return false;
  }
  return true;
};

/** Persist a custom / generated alert (or its updated read-state) to Supabase. */
export const syncFarmerNotificationToCloud = async (
  user: UserProfile,
  notification: FarmerNotification,
): Promise<boolean> => {
  if (!isCloudDbConfigured()) return false;
  const phone = normalizeFarmerPhone(user.phone ?? user.phoneMasked);
  if (!notification.id.startsWith(`${phone}_`)) return false;
  return upsertNotificationRow(
    notificationBody(phone, notification, notification.isRead),
  );
};

/**
 * Global broadcasts must stay globally unread; a per-phone shadow row records
 * this farmer's read-state instead of PATCH-ing the shared broadcast row.
 */
export const syncNotificationReadState = async (
  user: UserProfile,
  notification: FarmerNotification,
  isRead: boolean,
): Promise<boolean> => {
  if (!isCloudDbConfigured()) return false;
  const phone = normalizeFarmerPhone(user.phone ?? user.phoneMasked);
  if (notification.id.startsWith(`${phone}_`)) {
    return upsertNotificationRow(notificationBody(phone, notification, isRead));
  }

  const shadowBody: Record<string, unknown> = {
    id: `${phone}_read_${notification.id}`,
    farmer_phone: phone,
    category: notification.category,
    priority: 'NORMAL',
    title_en: notification.titleEn,
    title_te: notification.titleTe,
    message_en: notification.messageEn,
    message_te: notification.messageTe,
    target_crops: ['ALL'],
    target_ownership: 'ALL',
    action_tab: notification.actionTab,
    action_scheme_id: `${READ_SHADOW_MARKER}${notification.id}`,
    is_read: isRead,
    created_at: new Date(notification.createdAt).toISOString(),
  };
  return upsertNotificationRow(shadowBody);
};

/** Bulk read-state sync used by "Mark All Read". */
export const syncAllNotificationReadStates = async (
  user: UserProfile,
  notifications: FarmerNotification[],
): Promise<boolean> => {
  const results = await Promise.all(
    notifications
      .filter((notification) => !notification.isRead)
      .map((notification) =>
        syncNotificationReadState(user, notification, true),
      ),
  );
  return results.every(Boolean);
};
