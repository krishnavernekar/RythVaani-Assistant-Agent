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
  syncFarmerOnLogin,
  upsertFarmerProfileToCloud,
  syncSavedItemToCloud,
  insertAiQuestionToCloud,
  isCloudDbConfigured,
  type QuestionRecord,
  type CloudSyncStatus,
} from '../services/databaseService';

export type Language = 'te' | 'en' | 'hi';

export interface FarmerProfile {
  name: string;
  nameTe: string;
  phoneMasked: string;
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

export interface SavedItem {
  id: string;
  type: 'scheme' | 'advisory';
  title: string;
  titleTe: string;
  subtitle?: string;
  data?: Record<string, unknown>;
  bookmarkedAt: number;
}

export { QuestionRecord, CloudSyncStatus };

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

  // Farmer profile (Venkata Reddy Garu default)
  farmer: FarmerProfile;
  setFarmer: (farmer: FarmerProfile) => void;
  updateUserProfile: (profile: FarmerProfile) => void;

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

  // Cloud sync
  cloudSyncStatus: CloudSyncStatus;
  syncNow: () => Promise<void>;
}

const DEFAULT_FARMER: FarmerProfile = {
  name: 'Venkata Reddy Garu',
  nameTe: 'వెంకట రెడ్డి గారు',
  phoneMasked: '+91 98480 •••••',
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ─── Language ──────────────────────────────────────────────────────
      language: 'te',
      setLanguage: (lang) => {
        set({ language: lang });
        // Sync to cloud in background
        const { farmer } = get();
        if (isCloudDbConfigured()) {
          upsertFarmerProfileToCloud(farmer, lang).catch(() => undefined);
        }
      },

      // ─── Auth ──────────────────────────────────────────────────────────
      isAuthenticated: false,
      isGuest: false,
      setIsAuthenticated: (val) =>
        set({ isAuthenticated: val, isGuest: false }),
      setIsGuest: (val) => set({ isGuest: val, isAuthenticated: false }),

      login: async (phone: string) => {
        set({ isAuthenticated: true, isGuest: false, cloudSyncStatus: 'syncing' });
        const { farmer, language } = get();
        try {
          const result = await syncFarmerOnLogin(phone, farmer, language);
          if (result.isRestoredFromCloud) {
            set({
              farmer: result.profile,
              savedItems: result.savedItems ?? get().savedItems,
              questionHistory: result.questionHistory ?? get().questionHistory,
              cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
            });
          } else {
            set({
              cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
            });
            // Upsert to cloud
            if (isCloudDbConfigured()) {
              upsertFarmerProfileToCloud(result.profile, language).catch(
                () => undefined,
              );
            }
          }
        } catch {
          set({ cloudSyncStatus: 'offline' });
        }
      },

      // ─── Farmer Profile ────────────────────────────────────────────────
      farmer: DEFAULT_FARMER,
      setFarmer: (farmer) => {
        set({ farmer });
        // Sync to cloud in background
        const { language } = get();
        if (isCloudDbConfigured()) {
          upsertFarmerProfileToCloud(farmer, language).catch(() => undefined);
        }
      },
      updateUserProfile: (profile) => {
        set({ farmer: profile });
        const { language } = get();
        if (isCloudDbConfigured()) {
          upsertFarmerProfileToCloud(profile, language).catch(() => undefined);
        }
      },

      // ─── Saved Items ───────────────────────────────────────────────────
      savedItems: [],
      addSavedItem: (item) => {
        set((state) => ({ savedItems: [...state.savedItems, item] }));
        const { farmer } = get();
        if (isCloudDbConfigured()) {
          syncSavedItemToCloud(farmer.phoneMasked, item, 'UPSERT').catch(
            () => undefined,
          );
        }
      },
      removeSavedItem: (id) => {
        set((state) => {
          const removed = state.savedItems.find((i) => i.id === id);
          if (removed && isCloudDbConfigured()) {
            const { farmer } = get();
            syncSavedItemToCloud(farmer.phoneMasked, removed, 'DELETE').catch(
              () => undefined,
            );
          }
          return {
            savedItems: state.savedItems.filter((i) => i.id !== id),
          };
        });
      },
      toggleSavedItem: (item) => {
        set((state) => {
          const exists = state.savedItems.find((i) => i.id === item.id);
          if (exists) {
            if (isCloudDbConfigured()) {
              const { farmer } = get();
              syncSavedItemToCloud(farmer.phoneMasked, exists, 'DELETE').catch(
                () => undefined,
              );
            }
            return {
              savedItems: state.savedItems.filter((i) => i.id !== item.id),
            };
          }
          if (isCloudDbConfigured()) {
            const { farmer } = get();
            syncSavedItemToCloud(farmer.phoneMasked, item, 'UPSERT').catch(
              () => undefined,
            );
          }
          return { savedItems: [...state.savedItems, item] };
        });
      },

      // ─── Question History ──────────────────────────────────────────────
      questionsAsked: 0,
      incrementQuestions: () =>
        set((state) => ({ questionsAsked: state.questionsAsked + 1 })),
      questionHistory: [],
      addQuestion: (question) => {
        set((state) => ({
          questionHistory: [question, ...state.questionHistory],
          questionsAsked: state.questionsAsked + 1,
        }));
        const { farmer } = get();
        if (isCloudDbConfigured()) {
          insertAiQuestionToCloud(farmer.phoneMasked, question).catch(
            () => undefined,
          );
        }
      },

      // ─── Cloud Sync ────────────────────────────────────────────────────
      cloudSyncStatus: isCloudDbConfigured() ? 'synced' : 'offline',
      syncNow: async () => {
        set({ cloudSyncStatus: 'syncing' });
        const { farmer, language } = get();
        try {
          if (isCloudDbConfigured()) {
            const ok = await upsertFarmerProfileToCloud(farmer, language);
            set({ cloudSyncStatus: ok ? 'synced' : 'offline' });
          } else {
            set({ cloudSyncStatus: 'offline' });
          }
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
      }),
    },
  ),
);
