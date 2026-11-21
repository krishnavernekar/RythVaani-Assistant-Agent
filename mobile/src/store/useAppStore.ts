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
  upsertFarmerProfileToCloud,
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

  // Cloud sync
  cloudSyncStatus: CloudSyncStatus;
  syncNow: () => Promise<void>;
}

const DEFAULT_FARMER: FarmerProfile = {
  name: 'Venkata Reddy Garu',
  nameEn: 'Venkata Reddy Garu',
  nameTe: 'వెంకట రెడ్డి గారు',
  phone: '+919848000000',
  phoneMasked: '+919848000000',
  address: '',
  acres: 4.5,
  acreageLabel: 'Small/Marginal',
  mandal: 'Guntur Mandal',
  mandalTe: 'గుంటూరు మండలం',
  district: 'Guntur',
  state: 'Andhra Pradesh',
  category: 'Pattadar',
  crops: ['Chilli', 'Paddy'],
  cropsTe: ['మిర్చి', 'వరి'],
};

const DEFAULT_SCHEME_CHECK: SchemeCheckSnapshot = {
  wizardInputs: {},
  checkedDocuments: [],
  eligibleCount: 0,
};

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

const activePhone = (profile: FarmerProfile): string =>
  normalizePhone(profile.phone ?? profile.phoneMasked);

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

  return {
    ...current,
    name: nameEn,
    nameEn,
    nameTe: nameTe || nameEn,
    phone: normalizePhone(
      details.phone ?? current.phone ?? current.phoneMasked ?? '',
    ),
    phoneMasked: normalizePhone(
      details.phone ?? current.phone ?? current.phoneMasked ?? '',
    ),
    address,
    acres,
    acreageLabel: acreageLabelFor(acres),
    mandal,
    mandalTe: mandal ? MANDAL_TE[mandal] ?? mandal : '',
    district: (details.district ?? current.district ?? '').trim() || 'Guntur',
    state: (details.state ?? current.state ?? '').trim() || 'Andhra Pradesh',
    category: details.category ?? current.category ?? 'Pattadar',
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
): Record<string, PhoneProfileCache> => ({
  ...state.profilesByPhone,
  [phone]: cacheSnapshot(state),
});

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

const pushSnapshotToCloud = (state: CloudSnapshotSource): void => {
  if (!state.isAuthenticated || state.isGuest || !isCloudDbConfigured()) return;
  syncAllLocalDataToCloud({
    farmer: state.farmer,
    language: state.language,
    savedItems: state.savedItems,
    questionHistory: state.questionHistory,
    schemeCheck: state.schemeCheck,
  }).catch(() => undefined);
};

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
          profilesByPhone: loggedIn
            ? withCachedPhone({ ...state, language: lang }, activePhone(state.farmer))
            : state.profilesByPhone,
        });
        // Remember the choice in Supabase for the next login — guests are
        // never written to the cloud.
        if (loggedIn && isCloudDbConfigured()) {
          upsertFarmerProfileToCloud(state.farmer, lang).catch(() => undefined);
        }
      },

      // ─── Auth ──────────────────────────────────────────────────────────
      isAuthenticated: false,
      isGuest: false,
      setIsAuthenticated: (val) =>
        set({ isAuthenticated: val, isGuest: false }),
      setIsGuest: (val) => set({ isGuest: val, isAuthenticated: false }),

      login: async (rawPhone: string) => {
        const normalized = normalizePhone(rawPhone);
        const cached = get().profilesByPhone[normalized];

        set({
          isAuthenticated: true,
          isGuest: false,
          cloudSyncStatus: 'syncing',
        });

        const restoreCached = (snapshot: PhoneProfileCache) => {
          set({
            farmer: snapshot.user,
            language: snapshot.language,
            savedItems: snapshot.savedItems,
            questionHistory: snapshot.questionHistory,
            questionsAsked: snapshot.questionHistory.length,
            schemeCheck: snapshot.schemeCheck ?? DEFAULT_SCHEME_CHECK,
            needsProfileSetup: false,
            isProfileSetupOpen: false,
            cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
            profilesByPhone: {
              ...get().profilesByPhone,
              [normalized]: snapshot,
            },
          });
          pushSnapshotToCloud(get());
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
        };

        try {
          const result = await syncFarmerOnLogin(normalized);

          if (result.isExistingUser) {
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
              needsProfileSetup: false,
              isProfileSetupOpen: false,
              cloudSyncStatus: 'synced',
              profilesByPhone: {
                ...get().profilesByPhone,
                [normalized]: snapshot,
              },
            });
            pushSnapshotToCloud(get());
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
      farmer: DEFAULT_FARMER,
      setFarmer: (farmer) => {
        const normalizedFarmer: FarmerProfile = {
          ...farmer,
          nameEn: farmer.nameEn ?? farmer.name,
          phone: activePhone(farmer),
          phoneMasked: activePhone(farmer),
        };
        const state = get();
        set({
          farmer: normalizedFarmer,
          profilesByPhone: withCachedPhone(
            { ...state, farmer: normalizedFarmer },
            activePhone(normalizedFarmer),
          ),
        });
        pushSnapshotToCloud(get());
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
          syncSavedItemToCloud(
            activePhone(state.farmer),
            item,
            'UPSERT',
            state.farmer,
            state.language,
          ).catch(() => undefined);
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
          syncSavedItemToCloud(
            activePhone(state.farmer),
            removed,
            'DELETE',
            state.farmer,
            state.language,
          ).catch(() => undefined);
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
          syncSavedItemToCloud(
            activePhone(state.farmer),
            item,
            exists ? 'DELETE' : 'UPSERT',
            state.farmer,
            state.language,
          ).catch(() => undefined);
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
          insertAiQuestionToCloud(
            activePhone(state.farmer),
            question,
            state.farmer,
            state.language,
          ).catch(() => undefined);
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
          deleteAiQuestionFromCloud(activePhone(state.farmer), id).catch(
            () => undefined,
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
          upsertSchemeCheckToCloud(
            activePhone(state.farmer),
            snapshot.wizardInputs,
            snapshot.checkedDocuments,
            snapshot.eligibleCount,
            state.farmer,
            state.language,
          ).catch(() => undefined);
        }
      },

      // ─── Cloud Sync ────────────────────────────────────────────────────
      cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
      syncNow: async () => {
        set({ cloudSyncStatus: 'syncing' });
        try {
          if (!isCloudDbConfigured()) {
            set({ cloudSyncStatus: 'offline' });
            return;
          }
          const state = get();
          const ok = await syncAllLocalDataToCloud({
            farmer: state.farmer,
            language: state.language,
            savedItems: state.savedItems,
            questionHistory: state.questionHistory,
            schemeCheck: state.schemeCheck,
          });
          set({ cloudSyncStatus: ok ? 'synced' : 'offline' });
        } catch {
          set({ cloudSyncStatus: 'offline' });
        }
      },
    }),
    {
      name: 'rythuvaani-app-state',
      storage: createJSONStorage(() => AsyncStorage),
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
      }),
    },
  ),
);
