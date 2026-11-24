/**
 * RythuVaani Global Zustand Store
 * Persisted with @react-native-async-storage/async-storage.
 * Language switch flips instantly (<16ms) across all screens without unmounting.
 *
 * Cloud sync: Supabase PostgreSQL is the source of truth for returning
 * farmers; AsyncStorage is the instant offline-first cache.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizePhone,
  syncFarmerOnLogin,
  syncSavedItemToCloud,
  insertAiQuestionToCloud,
  deleteAiQuestionFromCloud,
  upsertSchemeCheckToCloud,
  syncAllLocalDataToCloud,
  isCloudDbConfigured,
  type QuestionRecord,
  type ChatThreadMessage,
  type SchemeCheckSnapshot,
  type CloudSyncStatus,
} from '../services/databaseService';
import {
  fetchCloudNotifications,
  generatePersonalizedNotifications,
  syncNotificationReadState,
  syncAllNotificationReadStates,
  syncFarmerNotificationToCloud,
  type FarmerNotification,
} from '../services/notificationService';

export type Language = 'te' | 'en' | 'hi';

export interface FarmerProfile {
  /** Legacy English display name. Kept for backwards compatibility. */
  name: string;
  /** Explicit English name (populated from onboarding / cloud name_en). */
  nameEn?: string;
  nameTe: string;
  /** Normalized +91 phone. */
  phone?: string;
  /** Legacy phone field used by existing cloud bindings. */
  phoneMasked: string;
  address?: string;
  acres: number;
  acreageLabel: string;
  mandal: string;
  mandalTe: string;
  district: string;
  state: string;
  category: 'Pattadar' | 'Tenant';
  /** Optional explicit ownership label used by notification personalization. */
  ownership?: string;
  /** Optional e-Panta verification status used by preference alerts. */
  epantaStatus?: string;
  /** Optional language carried on the profile for notification personalization. */
  preferredLanguage?: Language;
  crops: string[];
  cropsTe: string[];
}

export type UserProfile = FarmerProfile;

export type ProfileSetupDetails = Partial<FarmerProfile> & {
  preferredLanguage?: Language;
  /** Convenience field when a single name input populates both scripts. */
  fullName?: string;
};

export interface SavedItem {
  id: string;
  type: 'scheme' | 'advisory';
  /** Cloud alias for item_type; optional so legacy items keep compiling. */
  category?: 'scheme' | 'advisory';
  title: string;
  titleTe: string;
  subtitle?: string;
  /** Farmer's exact question in both scripts. */
  questionEn: string;
  questionTe: string;
  diagnosisEn?: string;
  diagnosisTe?: string;
  /** Complete multi-paragraph advisory / scheme detail. */
  fullResponseEn: string;
  fullResponseTe: string;
  chemicalDosageEn?: string;
  chemicalDosageTe?: string;
  weatherWarningEn?: string;
  weatherWarningTe?: string;
  chatThread?: ChatThreadMessage[];
  /** Optional badge alias used by the cloud dosage column. */
  badgeEn?: string;
  badgeTe?: string;
  data?: Record<string, unknown>;
  bookmarkedAt: number;
  /** Cloud alias for saved_at. */
  savedAt?: number;
}

export interface PhoneProfileCache {
  user: UserProfile;
  language: Language;
  savedItems: SavedItem[];
  questionHistory: QuestionRecord[];
  schemeCheck?: SchemeCheckSnapshot;
}

export {
  QuestionRecord,
  ChatThreadMessage,
  SchemeCheckSnapshot,
  CloudSyncStatus,
};

interface AppState {
  // Language
  language: Language;
  setLanguage: (lang: Language) => void;

  // Auth state
  isAuthenticated: boolean;
  isGuest: boolean;
  setIsAuthenticated: (val: boolean) => void;
  setIsGuest: (val: boolean) => void;
  login: (phone: string) => Promise<void>;

  // Farmer profile
  farmer: FarmerProfile;
  setFarmer: (farmer: FarmerProfile) => void;
  updateUserProfile: (details: ProfileSetupDetails) => void;

  // First-time / edit profile onboarding
  needsProfileSetup: boolean;
  isProfileSetupOpen: boolean;
  openProfileSetup: () => void;
  closeProfileSetup: () => void;
  completeProfileSetup: (details: ProfileSetupDetails) => void;

  // Offline per-phone cache
  profilesByPhone: Record<string, PhoneProfileCache>;

  // Saved items (bookmarked schemes & AI advisories)
  savedItems: SavedItem[];
  addSavedItem: (item: SavedItem) => void;
  removeSavedItem: (id: string) => void;
  toggleSavedItem: (item: SavedItem) => void;

  // Question history
  questionsAsked: number;
  incrementQuestions: () => void;
  questionHistory: QuestionRecord[];
  addQuestion: (question: QuestionRecord) => void;
  removeQuestion: (id: string) => void;

  // Latest scheme eligibility check (mirrors farmer_scheme_checks)
  schemeCheck: SchemeCheckSnapshot;
  setSchemeCheck: (snapshot: SchemeCheckSnapshot) => void;

  // Personalized smart alerts
  notifications: FarmerNotification[];
  unreadNotificationCount: number;
  isNotificationModalOpen: boolean;
  /** Transient top toast for a new urgent alert or a profile-preference edit. */
  activeBannerNotification: FarmerNotification | null;
  refreshNotifications: (showProfileBanner?: boolean) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setNotificationModalOpen: (open: boolean) => void;
  dismissBannerNotification: () => void;

  // Cloud sync
  /** True once AsyncStorage hydration has finished — gates auto-sync on launch. */
  hasHydrated: boolean;
  cloudSyncStatus: CloudSyncStatus;
  syncNow: () => Promise<void>;
}

/**
 * No identity is populated until a farmer logs in with OTP and completes
 * onboarding. Guest / logged-out sessions must never inherit sample data.
 */
const EMPTY_FARMER: FarmerProfile = {
  name: '',
  nameEn: '',
  nameTe: '',
  phone: '',
  phoneMasked: '',
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
};

const DEFAULT_SCHEME_CHECK: SchemeCheckSnapshot = {
  wizardInputs: {},
  checkedDocuments: [],
  eligibleCount: 0,
};

const makeEmptyFarmer = (): FarmerProfile => ({
  ...EMPTY_FARMER,
  crops: [],
  cropsTe: [],
});

const LEGACY_PLACEHOLDER_PHONES = new Set(['+919848000000', '+919848054321']);
const LEGACY_PLACEHOLDER_NAMES = new Set([
  'Venkata Reddy Garu',
  'వెంకట రెడ్డి గారు',
]);

const isLegacyPlaceholderProfile = (profile?: FarmerProfile): boolean =>
  Boolean(
    profile &&
      (LEGACY_PLACEHOLDER_NAMES.has(profile.nameEn ?? '') ||
        LEGACY_PLACEHOLDER_NAMES.has(profile.name ?? '') ||
        LEGACY_PLACEHOLDER_NAMES.has(profile.nameTe ?? '') ||
        LEGACY_PLACEHOLDER_PHONES.has(profile.phone ?? '') ||
        LEGACY_PLACEHOLDER_PHONES.has(profile.phoneMasked ?? '')),
  );

const purgePlaceholderCaches = (
  cache: Record<string, PhoneProfileCache> | undefined,
): Record<string, PhoneProfileCache> =>
  Object.fromEntries(
    Object.entries(cache ?? {}).filter(
      ([phone, snapshot]) =>
        !LEGACY_PLACEHOLDER_PHONES.has(phone) &&
        !isLegacyPlaceholderProfile(snapshot.user),
    ),
  );

const isProfileComplete = (profile: FarmerProfile): boolean =>
  Boolean(
    profile.nameEn?.trim() || profile.name?.trim() || profile.nameTe?.trim(),
  );

/** Reset everything tied to a previous farmer when auth context changes. */
const emptySessionPatch = (): Partial<AppState> => ({
  farmer: makeEmptyFarmer(),
  savedItems: [],
  questionHistory: [],
  questionsAsked: 0,
  schemeCheck: DEFAULT_SCHEME_CHECK,
  needsProfileSetup: false,
  isProfileSetupOpen: false,
  notifications: [],
  unreadNotificationCount: 0,
  isNotificationModalOpen: false,
  activeBannerNotification: null,
  cloudSyncStatus: 'offline',
});

const MANDAL_TE: Record<string, string> = {
  'Guntur Mandal': 'గుంటూరు మండలం',
  'Tenali Mandal': 'తెనాలి మండలం',
  Mangalagiri: 'మంగళగిరి',
  Bapatla: 'బాపట్ల',
  Vijayawada: 'విజయవాడ',
};

const CROP_TE: Record<string, string> = {
  Chilli: 'మిర్చి',
  Paddy: 'వరి',
  Cotton: 'పత్తి',
  Pulses: 'పప్పుధాన్యాలు',
  Turmeric: 'పసుపు',
};

const acreageLabelFor = (acres: number): string => {
  if (acres <= 2) return 'Small/Marginal';
  if (acres <= 5) return 'Small';
  if (acres <= 10) return 'Medium';
  return 'Large';
};

const cropTeFor = (crops: string[]): string[] =>
  crops.map((crop) => CROP_TE[crop] ?? crop);

const activePhone = (profile: FarmerProfile): string => {
  const raw = profile.phone ?? profile.phoneMasked ?? '';
  return raw.trim() ? normalizePhone(raw) : '';
};

const makeCleanProfile = (phone: string): FarmerProfile => {
  const normalized = normalizePhone(phone);
  return {
    name: '',
    nameEn: '',
    nameTe: '',
    phone: normalized,
    phoneMasked: normalized,
    address: '',
    acres: 0,
    acreageLabel: 'Small/Marginal',
    mandal: '',
    mandalTe: '',
    district: '',
    state: 'Andhra Pradesh',
    category: 'Pattadar',
    crops: [],
    cropsTe: [],
  };
};

const buildUpdatedProfile = (
  current: FarmerProfile,
  details: ProfileSetupDetails,
): FarmerProfile => {
  const enteredName = (
    details.fullName ??
    details.nameEn ??
    details.name ??
    current.nameEn ??
    current.name ??
    ''
  ).trim();
  const nameEn =
    enteredName || (current.nameEn ?? current.name ?? '').trim() || '';
  const nameUnchanged = enteredName === (current.nameEn ?? current.name ?? '').trim();
  const nameTe = (
    details.nameTe ??
    (nameUnchanged ? current.nameTe : enteredName) ??
    ''
  ).trim();
  const mandal = (details.mandal ?? current.mandal ?? '').trim();
  const address = (details.address ?? current.address ?? '').trim();
  const acresRaw = details.acres ?? current.acres ?? 0;
  const acres = Number.isFinite(Number(acresRaw)) ? Number(acresRaw) : 0;
  const crops = details.crops ?? current.crops ?? [];
  const rawPhone = (
    details.phone ??
    current.phone ??
    current.phoneMasked ??
    ''
  ).trim();
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : '';

  return {
    ...current,
    name: nameEn,
    nameEn,
    nameTe: nameTe || nameEn,
    phone: normalizedPhone,
    phoneMasked: normalizedPhone,
    address,
    acres,
    acreageLabel: acreageLabelFor(acres),
    mandal,
    mandalTe: mandal ? MANDAL_TE[mandal] ?? mandal : '',
    district: (details.district ?? current.district ?? '').trim(),
    state: (details.state ?? current.state ?? '').trim(),
    category: details.category ?? current.category ?? 'Pattadar',
    ownership: details.ownership ?? current.ownership,
    epantaStatus: details.epantaStatus ?? current.epantaStatus,
    preferredLanguage: details.preferredLanguage ?? current.preferredLanguage,
    crops,
    cropsTe: cropTeFor(crops),
  };
};

type CacheSource = Pick<
  AppState,
  'farmer' | 'language' | 'savedItems' | 'questionHistory' | 'schemeCheck'
>;

const cacheSnapshot = (state: CacheSource): PhoneProfileCache => ({
  user: state.farmer,
  language: state.language,
  savedItems: state.savedItems,
  questionHistory: state.questionHistory,
  schemeCheck: state.schemeCheck ?? DEFAULT_SCHEME_CHECK,
});

const withCachedPhone = (
  state: CacheSource & Pick<AppState, 'profilesByPhone'>,
  phone: string,
): Record<string, PhoneProfileCache> =>
  phone
    ? {
        ...state.profilesByPhone,
        [phone]: cacheSnapshot(state),
      }
    : state.profilesByPhone;

const normalizeSavedItem = (item: SavedItem): SavedItem => ({
  ...item,
  category: item.category ?? item.type,
  questionEn: item.questionEn ?? '',
  questionTe: item.questionTe ?? '',
  fullResponseEn: item.fullResponseEn ?? '',
  fullResponseTe: item.fullResponseTe ?? '',
  savedAt: item.savedAt ?? item.bookmarkedAt ?? Date.now(),
});

const makeQuestionId = (): string =>
  `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeQuestion = (question: QuestionRecord): QuestionRecord => ({
  ...question,
  id: question.id ?? makeQuestionId(),
  questionEn: question.questionEn ?? question.questionText ?? '',
  questionTe: question.questionTe ?? question.questionText ?? '',
  fullResponseEn: question.fullResponseEn ?? '',
  fullResponseTe: question.fullResponseTe ?? '',
  queryType: question.queryType ?? 'VOICE',
});

type CloudSnapshotSource = Pick<
  AppState,
  | 'isAuthenticated'
  | 'isGuest'
  | 'farmer'
  | 'language'
  | 'savedItems'
  | 'questionHistory'
  | 'schemeCheck'
>;

/**
 * Every cloud write goes through these guards so the Profile status pill
 * always reflects a real in-flight request instead of a stale "synced" flag.
 * The counter prevents a fast follow-up write from clearing "syncing" while
 * an earlier request is still running.
 */
let cloudWritesInFlight = 0;

const beginCloudWrite = (): void => {
  cloudWritesInFlight += 1;
  useAppStore.setState({ cloudSyncStatus: 'syncing' });
};

const endCloudWrite = (ok: boolean): void => {
  cloudWritesInFlight = Math.max(0, cloudWritesInFlight - 1);
  if (cloudWritesInFlight === 0) {
    useAppStore.setState({ cloudSyncStatus: ok ? 'synced' : 'offline' });
  }
};

/** Fire-and-forget wrapper for a single-table cloud write. */
const runCloudWrite = (task: Promise<boolean>): void => {
  beginCloudWrite();
  task.then(
    (ok) => endCloudWrite(ok),
    () => endCloudWrite(false),
  );
};

/** Push the entire per-phone snapshot to all four Supabase tables. */
const pushSnapshotToCloud = (state: CloudSnapshotSource): void => {
  if (
    !state.isAuthenticated ||
    state.isGuest ||
    !activePhone(state.farmer) ||
    !isCloudDbConfigured()
  ) {
    return;
  }
  runCloudWrite(
    syncAllLocalDataToCloud({
      farmer: state.farmer,
      language: state.language,
      savedItems: state.savedItems,
      questionHistory: state.questionHistory,
      schemeCheck: state.schemeCheck,
    }),
  );
};

/* ───────────────────── Smart alert helpers ────────────────────────────── */

/** Avoid a startup banner for alerts that were already unread on disk. */
let notificationsLoadedOnce = false;
const seenUrgentNotificationIds = new Set<string>();

/** Notification writes are silent — the Profile pill tracks the 4 sync tables. */
const runNotificationWrite = (task: Promise<boolean>): void => {
  void (async () => {
    try {
      await task;
    } catch (error) {
      console.warn('[Notifications] background write failed:', error);
    }
  })();
};

const countUnread = (notifications: FarmerNotification[]): number =>
  notifications.reduce((total, item) => total + (item.isRead ? 0 : 1), 0);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ─── Language ──────────────────────────────────────────────────────
      language: 'te',
      setLanguage: (lang) => {
        const state = get();
        const loggedIn = state.isAuthenticated && !state.isGuest;
        set({
          language: lang,
          farmer: { ...state.farmer, preferredLanguage: lang },
          profilesByPhone: loggedIn
            ? withCachedPhone({ ...state, language: lang }, activePhone(state.farmer))
            : state.profilesByPhone,
        });
        // Language is stored on public.farmers — push the whole snapshot so
        // all four tables stay current. Guests are never written to the cloud.
        if (loggedIn) {
          pushSnapshotToCloud(get());
          void get().refreshNotifications();
        }
      },

      // ─── Auth ──────────────────────────────────────────────────────────
      isAuthenticated: false,
      isGuest: false,
      setIsAuthenticated: (val) => {
        if (!val) {
          set({
            isAuthenticated: false,
            isGuest: false,
            ...emptySessionPatch(),
          });
          return;
        }
        set({ isAuthenticated: true, isGuest: false });
      },
      setIsGuest: (val) => {
        if (val) {
          // Guest mode is a clean slate — no previous farmer may leak through.
          set({
            isGuest: true,
            isAuthenticated: false,
            ...emptySessionPatch(),
          });
          return;
        }
        set({ isGuest: false });
      },

      login: async (rawPhone: string) => {
        const normalized = normalizePhone(rawPhone);
        const cachedSnapshot = get().profilesByPhone[normalized];
        // Never restore a stale cache that belongs to a different/placeholder
        // farmer, even if it was stored under this phone number.
        const cached =
          cachedSnapshot &&
          !isLegacyPlaceholderProfile(cachedSnapshot.user) &&
          activePhone(cachedSnapshot.user) === normalized
            ? cachedSnapshot
            : undefined;

        set({
          isAuthenticated: true,
          isGuest: false,
          cloudSyncStatus: 'syncing',
          // Alerts are personalized per phone — never carry the previous
          // farmer's notifications into a new login.
          notifications: [],
          unreadNotificationCount: 0,
          isNotificationModalOpen: false,
          activeBannerNotification: null,
        });

        const restoreCached = (snapshot: PhoneProfileCache) => {
          const needsSetup = !isProfileComplete(snapshot.user);
          set({
            farmer: snapshot.user,
            language: snapshot.language,
            savedItems: snapshot.savedItems,
            questionHistory: snapshot.questionHistory,
            questionsAsked: snapshot.questionHistory.length,
            schemeCheck: snapshot.schemeCheck ?? DEFAULT_SCHEME_CHECK,
            needsProfileSetup: needsSetup,
            isProfileSetupOpen: needsSetup,
            cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
            profilesByPhone: {
              ...get().profilesByPhone,
              [normalized]: snapshot,
            },
          });
          pushSnapshotToCloud(get());
          void get().refreshNotifications();
        };

        const startNewPhone = () => {
          const cleanProfile = makeCleanProfile(normalized);
          const language = get().language;
          set({
            farmer: cleanProfile,
            savedItems: [],
            questionHistory: [],
            questionsAsked: 0,
            schemeCheck: DEFAULT_SCHEME_CHECK,
            needsProfileSetup: true,
            isProfileSetupOpen: true,
            cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
            profilesByPhone: {
              ...get().profilesByPhone,
              [normalized]: {
                user: cleanProfile,
                language,
                savedItems: [],
                questionHistory: [],
                schemeCheck: DEFAULT_SCHEME_CHECK,
              },
            },
          });
          void get().refreshNotifications();
        };

        try {
          const result = await syncFarmerOnLogin(normalized);

          if (result.isExistingUser) {
            const needsSetup = !isProfileComplete(result.profile);
            const snapshot: PhoneProfileCache = {
              user: result.profile,
              language: result.preferredLanguage,
              savedItems: result.savedItems,
              questionHistory: result.questionHistory,
              schemeCheck: get().schemeCheck ?? DEFAULT_SCHEME_CHECK,
            };
            set({
              farmer: result.profile,
              language: result.preferredLanguage,
              savedItems: result.savedItems,
              questionHistory: result.questionHistory,
              questionsAsked: result.questionHistory.length,
              schemeCheck: snapshot.schemeCheck,
              needsProfileSetup: needsSetup,
              isProfileSetupOpen: needsSetup,
              cloudSyncStatus: 'synced',
              profilesByPhone: {
                ...get().profilesByPhone,
                [normalized]: snapshot,
              },
            });
            pushSnapshotToCloud(get());
            void get().refreshNotifications();
            return;
          }

          if (cached) {
            // Offline / cloud row not yet created: use this phone's local cache.
            restoreCached(cached);
            return;
          }

          startNewPhone();
        } catch {
          if (cached) restoreCached(cached);
          else startNewPhone();
          set({ cloudSyncStatus: 'offline' });
        }
      },

      // ─── Farmer Profile ────────────────────────────────────────────────
      farmer: makeEmptyFarmer(),
      setFarmer: (farmer) => {
        const rawPhone = farmer.phone ?? farmer.phoneMasked ?? '';
        const phone = rawPhone.trim() ? activePhone(farmer) : '';
        const normalizedFarmer: FarmerProfile = {
          ...farmer,
          nameEn: farmer.nameEn ?? farmer.name,
          nameTe: farmer.nameTe || farmer.nameEn || farmer.name || '',
          phone,
          phoneMasked: phone,
        };
        const state = get();
        set({
          farmer: normalizedFarmer,
          profilesByPhone: withCachedPhone(
            { ...state, farmer: normalizedFarmer },
            phone,
          ),
        });
        if (phone && state.isAuthenticated && !state.isGuest) {
          pushSnapshotToCloud(get());
        }
      },

      updateUserProfile: (details) => {
        const state = get();
        const nextFarmer = buildUpdatedProfile(state.farmer, details);
        const nextLanguage = details.preferredLanguage ?? state.language;
        set({
          farmer: nextFarmer,
          language: nextLanguage,
          needsProfileSetup: false,
          isProfileSetupOpen: false,
          profilesByPhone: withCachedPhone(
            { ...state, farmer: nextFarmer, language: nextLanguage },
            activePhone(nextFarmer),
          ),
        });
        pushSnapshotToCloud(get());
        void get().refreshNotifications(true);
      },

      // ─── Profile setup modal ───────────────────────────────────────────
      needsProfileSetup: false,
      isProfileSetupOpen: false,
      openProfileSetup: () => set({ isProfileSetupOpen: true }),
      closeProfileSetup: () => set({ isProfileSetupOpen: false }),
      completeProfileSetup: (details) => {
        const state = get();
        const nextFarmer = buildUpdatedProfile(state.farmer, details);
        const nextLanguage = details.preferredLanguage ?? state.language;
        set({
          farmer: nextFarmer,
          language: nextLanguage,
          needsProfileSetup: false,
          isProfileSetupOpen: false,
          profilesByPhone: withCachedPhone(
            { ...state, farmer: nextFarmer, language: nextLanguage },
            activePhone(nextFarmer),
          ),
        });
        pushSnapshotToCloud(get());
        void get().refreshNotifications(true);
      },

      // ─── Per-phone offline cache ───────────────────────────────────────
      profilesByPhone: {},

      // ─── Saved Items ───────────────────────────────────────────────────
      savedItems: [],
      addSavedItem: (rawItem) => {
        const state = get();
        const item = normalizeSavedItem(rawItem);
        const nextSaved = [...state.savedItems, item];
        set({
          savedItems: nextSaved,
          profilesByPhone: withCachedPhone(
            { ...state, savedItems: nextSaved },
            activePhone(state.farmer),
          ),
        });
        if (isCloudDbConfigured() && state.isAuthenticated && !state.isGuest) {
          runCloudWrite(
            syncSavedItemToCloud(
              activePhone(state.farmer),
              item,
              'UPSERT',
              state.farmer,
              state.language,
            ),
          );
        }
      },
      removeSavedItem: (id) => {
        const state = get();
        const removed = state.savedItems.find((item) => item.id === id);
        const nextSaved = state.savedItems.filter((item) => item.id !== id);
        set({
          savedItems: nextSaved,
          profilesByPhone: withCachedPhone(
            { ...state, savedItems: nextSaved },
            activePhone(state.farmer),
          ),
        });
        if (
          removed &&
          isCloudDbConfigured() &&
          state.isAuthenticated &&
          !state.isGuest
        ) {
          runCloudWrite(
            syncSavedItemToCloud(
              activePhone(state.farmer),
              removed,
              'DELETE',
              state.farmer,
              state.language,
            ),
          );
        }
      },
      toggleSavedItem: (rawItem) => {
        const state = get();
        const item = normalizeSavedItem(rawItem);
        const exists = state.savedItems.some((saved) => saved.id === item.id);
        const nextSaved = exists
          ? state.savedItems.filter((saved) => saved.id !== item.id)
          : [...state.savedItems, item];
        set({
          savedItems: nextSaved,
          profilesByPhone: withCachedPhone(
            { ...state, savedItems: nextSaved },
            activePhone(state.farmer),
          ),
        });
        if (isCloudDbConfigured() && state.isAuthenticated && !state.isGuest) {
          runCloudWrite(
            syncSavedItemToCloud(
              activePhone(state.farmer),
              item,
              exists ? 'DELETE' : 'UPSERT',
              state.farmer,
              state.language,
            ),
          );
        }
      },

      // ─── Question History ──────────────────────────────────────────────
      questionsAsked: 0,
      incrementQuestions: () =>
        set((state) => ({ questionsAsked: state.questionsAsked + 1 })),
      questionHistory: [],
      addQuestion: (rawQuestion) => {
        const state = get();
        const question = normalizeQuestion(rawQuestion);
        const nextHistory = [question, ...state.questionHistory];
        set({
          questionHistory: nextHistory,
          questionsAsked: state.questionsAsked + 1,
          profilesByPhone: withCachedPhone(
            { ...state, questionHistory: nextHistory },
            activePhone(state.farmer),
          ),
        });
        if (isCloudDbConfigured() && state.isAuthenticated && !state.isGuest) {
          runCloudWrite(
            insertAiQuestionToCloud(
              activePhone(state.farmer),
              question,
              state.farmer,
              state.language,
            ),
          );
        }
      },
      removeQuestion: (id) => {
        const state = get();
        const nextHistory = state.questionHistory.filter(
          (question) => question.id !== id,
        );
        if (nextHistory.length === state.questionHistory.length) return;
        set({
          questionHistory: nextHistory,
          questionsAsked: Math.max(0, state.questionsAsked - 1),
          profilesByPhone: withCachedPhone(
            { ...state, questionHistory: nextHistory },
            activePhone(state.farmer),
          ),
        });
        if (isCloudDbConfigured() && state.isAuthenticated && !state.isGuest) {
          runCloudWrite(
            deleteAiQuestionFromCloud(activePhone(state.farmer), id),
          );
        }
      },

      // ─── Scheme eligibility check ─────────────────────────────────────
      schemeCheck: DEFAULT_SCHEME_CHECK,
      setSchemeCheck: (snapshot) => {
        const state = get();
        set({
          schemeCheck: snapshot,
          profilesByPhone: withCachedPhone(
            { ...state, schemeCheck: snapshot },
            activePhone(state.farmer),
          ),
        });
        if (isCloudDbConfigured() && state.isAuthenticated && !state.isGuest) {
          runCloudWrite(
            upsertSchemeCheckToCloud(
              activePhone(state.farmer),
              snapshot.wizardInputs,
              snapshot.checkedDocuments,
              snapshot.eligibleCount,
              state.farmer,
              state.language,
            ),
          );
        }
      },

      // ─── Personalized Smart Alerts ─────────────────────────────────────
      notifications: [],
      unreadNotificationCount: 0,
      isNotificationModalOpen: false,
      activeBannerNotification: null,

      refreshNotifications: async (showProfileBanner = false) => {
        const state = get();
        if (
          !state.isAuthenticated ||
          state.isGuest ||
          !activePhone(state.farmer)
        ) {
          return;
        }
        const farmer = state.farmer;
        const localReadById = new Map(
          state.notifications.map((item) => [item.id, item.isRead]),
        );

        try {
          const cloud = await fetchCloudNotifications(farmer);
          const personalized = generatePersonalizedNotifications(farmer, cloud);
          const cloudIds = new Set(cloud.map((item) => item.id));
          const notifications = personalized.map((item) => {
            const stillRead = localReadById.get(item.id) === true;
            const merged = { ...item, isRead: item.isRead || stillRead };
            // Persist a custom/generated alert the first time it appears.
            if (merged.id.includes('_local_') && !cloudIds.has(merged.id)) {
              runNotificationWrite(syncFarmerNotificationToCloud(farmer, merged));
            }
            return merged;
          });

          const unreadUrgent = notifications.filter(
            (item) =>
              !item.isRead &&
              item.priority === 'URGENT' &&
              item.category === 'SCHEME',
          );
          let banner: FarmerNotification | null = null;
          if (showProfileBanner) {
            banner =
              notifications.find((item) => item.category === 'PROFILE_ALERT') ??
              notifications[0] ??
              null;
          } else if (notificationsLoadedOnce) {
            banner =
              unreadUrgent.find(
                (item) => !seenUrgentNotificationIds.has(item.id),
              ) ?? null;
          }
          for (const item of unreadUrgent) {
            seenUrgentNotificationIds.add(item.id);
          }
          notificationsLoadedOnce = true;

          set({
            notifications,
            unreadNotificationCount: countUnread(notifications),
            activeBannerNotification:
              banner ?? get().activeBannerNotification,
          });
        } catch (error) {
          console.warn('[Notifications] refresh failed:', error);
        }
      },

      markNotificationRead: (id) => {
        const state = get();
        const target = state.notifications.find((item) => item.id === id);
        if (!target || target.isRead) return;
        const notifications = state.notifications.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        );
        set({
          notifications,
          unreadNotificationCount: countUnread(notifications),
          activeBannerNotification:
            state.activeBannerNotification?.id === id
              ? null
              : state.activeBannerNotification,
        });
        if (state.isAuthenticated && !state.isGuest) {
          runNotificationWrite(
            syncNotificationReadState(state.farmer, { ...target, isRead: true }, true),
          );
        }
      },

      markAllNotificationsRead: () => {
        const state = get();
        const notifications = state.notifications.map((item) => ({
          ...item,
          isRead: true,
        }));
        set({
          notifications,
          unreadNotificationCount: 0,
          activeBannerNotification: null,
        });
        if (state.isAuthenticated && !state.isGuest) {
          runNotificationWrite(
            syncAllNotificationReadStates(state.farmer, state.notifications),
          );
        }
      },

      setNotificationModalOpen: (open) =>
        set({ isNotificationModalOpen: open }),

      dismissBannerNotification: () =>
        set({ activeBannerNotification: null }),

      // ─── Cloud Sync ────────────────────────────────────────────────────
      hasHydrated: false,
      cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
      syncNow: async () => {
        const state = get();
        if (!isCloudDbConfigured() || !activePhone(state.farmer)) {
          set({ cloudSyncStatus: 'offline' });
          return;
        }
        beginCloudWrite();
        try {
          const ok = await syncAllLocalDataToCloud({
            farmer: state.farmer,
            language: state.language,
            savedItems: state.savedItems,
            questionHistory: state.questionHistory,
            schemeCheck: state.schemeCheck,
          });
          endCloudWrite(ok);
        } catch {
          endCloudWrite(false);
        }
      },
    }),
    {
      name: 'rythuvaani-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('[DB] AsyncStorage hydration failed:', error);
        const persisted = useAppStore.getState();
        const hasSession = Boolean(
          persisted.isAuthenticated && !persisted.isGuest,
        );
        const hasLegacyPlaceholder =
          isLegacyPlaceholderProfile(persisted.farmer) ||
          Object.values(persisted.profilesByPhone ?? {}).some((snapshot) =>
            isLegacyPlaceholderProfile(snapshot.user),
          );

        const patch: Partial<AppState> = {
          hasHydrated: true,
          unreadNotificationCount: (persisted.notifications ?? []).reduce(
            (total, item) => total + (item.isRead ? 0 : 1),
            0,
          ),
        };

        if (!hasSession || hasLegacyPlaceholder) {
          Object.assign(patch, emptySessionPatch());
          patch.profilesByPhone = purgePlaceholderCaches(
            persisted.profilesByPhone,
          );
          if (hasSession && hasLegacyPlaceholder) {
            // Stale sample profile: force a fresh OTP login instead of
            // trusting any data restored from the old persisted state.
            patch.isAuthenticated = false;
            patch.isGuest = false;
          }
        } else if (!isProfileComplete(persisted.farmer)) {
          // Cloud auto-sync may have created a phone-only row. Ask for real
          // details rather than showing an empty or inherited profile.
          patch.needsProfileSetup = true;
          patch.isProfileSetupOpen = true;
        }

        useAppStore.setState(patch);

        // The very first background sync + alert refresh happens here the
        // instant persisted per-phone data is available — no button, no focus.
        const current = useAppStore.getState();
        if (
          current.isAuthenticated &&
          !current.isGuest &&
          activePhone(current.farmer)
        ) {
          setTimeout(() => {
            void (async () => {
              await useAppStore.getState().syncNow();
              await useAppStore.getState().refreshNotifications();
            })();
          }, 0);
        }
      },
      partialize: (state) => ({
        language: state.language,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        farmer: state.farmer,
        savedItems: state.savedItems,
        questionsAsked: state.questionsAsked,
        questionHistory: state.questionHistory,
        schemeCheck: state.schemeCheck,
        needsProfileSetup: state.needsProfileSetup,
        profilesByPhone: state.profilesByPhone,
        notifications: state.notifications,
      }),
    },
  ),
);
