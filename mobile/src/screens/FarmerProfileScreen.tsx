/**
 * FarmerProfileScreen — EPIC-08 (FR-06)
 * -------------------------------------
 * • Farmer Identity Card: logged-in farmer, masked phone, ownership badge,
 *   acreage, mandal, crop pills, Edit button
 * • 3-Stat Row: questionsAsked, savedItems.length, Kharif '25
 * • Tabbed vault: Saved (schemes + AI advisories), Questions (history), Settings
 * • Bookmark toggle linked to useAppStore.savedItems
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { stopSpeaking } from '../utils/voice';
import {
  Language,
  QuestionRecord,
  SavedItem,
  useAppStore,
} from '../store/useAppStore';
import FullConversationModal from '../components/FullConversationModal';
import { getDict, getLineHeight } from '../i18n/translations';

type TabKey = 'saved' | 'questions' | 'settings';

export default function FarmerProfileScreen() {
  const navigation = useNavigation<any>();
  const {
    language,
    isAuthenticated,
    isGuest,
    farmer,
    savedItems,
    questionHistory,
    removeSavedItem,
    removeQuestion,
    setLanguage,
    setIsAuthenticated,
    setIsGuest,
    cloudSyncStatus,
    syncNow,
    openProfileSetup,
  } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';

  const [activeTab, setActiveTab] = useState<TabKey>('saved');
  const [viewer, setViewer] = useState<
    { kind: 'saved' | 'question'; id: string } | null
  >(null);

  React.useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Every visit to the Profile tab refreshes the cloud snapshot silently.
  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated || isGuest) return;
      void (async () => {
        await syncNow();
      })();
    }, [isAuthenticated, isGuest, syncNow]),
  );

  // Per-phone bindings — exact values restored from Supabase / local cache.
  const displayName =
    (isTe
      ? farmer.nameTe || farmer.nameEn || farmer.name
      : farmer.nameEn || farmer.name) || (isTe ? 'రైతు' : 'Farmer');
  const displayPhone =
    farmer.phone ||
    farmer.phoneMasked ||
    (isTe ? 'ఫోన్ నమోదు చేయలేదు' : 'Phone not added');
  const displayMandal = isTe
    ? farmer.mandalTe || farmer.mandal
    : farmer.mandal;
  const displayAddress = farmer.address || '';

  // Derived counts — questionHistory is the per-phone source of truth.
  const questionCount = questionHistory.length;
  const savedCount = savedItems.length;

  // Crop pills from store
  const cropPills = farmer.crops.map((crop, i) => ({
    emoji: i === 0 ? '🌶️' : '🌾',
    label: isTe ? farmer.cropsTe[i] : crop,
    bg: i === 0 ? '#FEE2E2' : Colors.primarySoft,
    color: i === 0 ? '#991B1B' : Colors.primary,
  }));

  // Saved items grouped
  const schemeItems = savedItems.filter((i) => i.type === 'scheme');
  const advisoryItems = savedItems.filter((i) => i.type === 'advisory');

  const viewerItem: SavedItem | QuestionRecord | null = viewer
    ? viewer.kind === 'saved'
      ? savedItems.find((item) => item.id === viewer.id) ?? null
      : questionHistory.find((item) => item.id === viewer.id) ?? null
    : null;

  const handleDeleteViewerItem = () => {
    if (!viewer) return;
    if (viewer.kind === 'saved') removeSavedItem(viewer.id);
    else removeQuestion(viewer.id);
    setViewer(null);
  };

  const handleSelectLanguage = (lang: Language) => {
    if (lang === language) return;
    stopSpeaking();
    setLanguage(lang);
  };

  const handleLogout = () => {
    Alert.alert(
      isTe ? 'లాగౌట్' : 'Logout',
      isTe
        ? 'మీరు ఖచ్చితంగా లాగౌట్ చేసి స్వాగత స్క్రీన్‌కు వెళ్లాలనుకుంటున్నారా?'
        : 'Are you sure you want to log out and return to the welcome screen?',
      [
        { text: isTe ? 'రద్దు' : 'Cancel', style: 'cancel' },
        {
          text: isTe ? 'లాగౌట్' : 'Logout',
          style: 'destructive',
          onPress: () => {
            stopSpeaking();
            setIsAuthenticated(false);
            setIsGuest(false);
          },
        },
      ],
    );
  };

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader
        subtitle={isTe ? 'రైతావాణి • ప్రొఫైల్' : 'RythuVaani Profile'}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Farmer Identity Card ── */}
        <View style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatar}>👨‍🌾</Text>
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.farmerName}>{displayName}</Text>
              <Text style={styles.farmerPhone}>{displayPhone}</Text>
              <Text style={styles.farmerLocation}>📍 {displayMandal}</Text>
              {displayAddress ? (
                <Text style={styles.farmerAddress}>{displayAddress}</Text>
              ) : null}
            </View>
            <View style={styles.pattadarBadge}>
              <Text style={styles.pattadarBadgeText}>
                🛡️{' '}
                {farmer.category === 'Tenant'
                  ? isTe
                    ? 'కౌలు రైతు'
                    : 'Tenant'
                  : isTe
                    ? 'పట్టాదారు'
                    : 'Pattadar'}
              </Text>
            </View>
          </View>

          <View style={styles.acreageRow}>
            <Text style={styles.acreageValue}>{farmer.acres} Acres</Text>
            <Text style={styles.acreageLabel}>({farmer.acreageLabel})</Text>
            <TouchableOpacity onPress={openProfileSetup}>
              <Text style={styles.editBtn}>Edit Profile / ప్రాధాన్యతలు</Text>
            </TouchableOpacity>
          </View>

          {/* Cloud sync badge */}
          <View style={styles.cloudSyncRow}>
            <Text style={styles.cloudSyncBadge}>
              {cloudSyncStatus === 'synced'
                ? isTe
                  ? '☁️ క్లౌడ్ బ్యాకప్ యాక్టివ్ (Supabase PostgreSQL)'
                  : '☁️ Cloud Backup Active (Supabase PostgreSQL)'
                : cloudSyncStatus === 'syncing'
                  ? isTe
                    ? '🔄 సింక్ అవుతోంది...'
                    : '🔄 Syncing...'
                  : isTe
                    ? '📱 లోకల్ ఆఫ్‌లైన్ స్టోరేజ్'
                    : '📱 Local Offline Storage'}
            </Text>
            <View style={styles.autoSyncPill}>
              <Text style={styles.autoSyncText}>
                {cloudSyncStatus === 'syncing'
                  ? isTe
                    ? '🔄 స్వయంచాలకంగా సింక్ అవుతోంది...'
                    : '🔄 Auto-Syncing...'
                  : cloudSyncStatus === 'synced'
                    ? isTe
                      ? '☁️ క్లౌడ్ తో స్వయంచాలకంగా సింక్ అయ్యింది'
                      : '☁️ Auto-Synced with Cloud'
                    : isTe
                      ? '📱 లోకల్ ఆఫ్ లైన్ స్టోరేజ్'
                      : '📱 Local Offline Storage'}
              </Text>
            </View>
          </View>

          <View style={styles.cropsRow}>
            <Text style={styles.cropsLabel}>
              {dict.profile.primaryCrops}:
            </Text>
            {cropPills.map((pill, i) => (
              <View
                key={i}
                style={[styles.cropPill, { backgroundColor: pill.bg }]}
              >
                <Text style={{ fontSize: 12 }}>{pill.emoji}</Text>
                <Text style={[styles.cropPillText, { color: pill.color }]}>
                  {pill.label}
                </Text>
              </View>
            ))}
          </View>

          {/* 3-Stat Row */}
          <View style={styles.countersGrid}>
            {[
              {
                value: String(questionCount),
                label: dict.profile.questions,
                sub: dict.profile.questionsTe,
              },
              {
                value: String(savedCount),
                label: dict.profile.saved,
                sub: dict.profile.savedTe,
              },
              {
                value: "Kharif '25",
                label: dict.profile.season,
                sub: 'ఖరీఫ్ సీజన్',
              },
            ].map((counter, i) => (
              <View key={i} style={styles.counterItem}>
                <Text style={styles.counterValue}>{counter.value}</Text>
                <Text style={styles.counterLabel}>{counter.label}</Text>
                <Text
                  style={[
                    styles.counterSub,
                    { lineHeight: getLineHeight(10, language) },
                  ]}
                >
                  {counter.sub}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabsContainer}>
          {(
            [
              { key: 'saved', emoji: '🔖', label: 'Saved', labelTe: 'దాచినవి' },
              { key: 'questions', emoji: '💬', label: 'Questions', labelTe: 'ప్రశ్నలను' },
              { key: 'settings', emoji: '⚙️', label: 'Settings', labelTe: 'సెట్టింగ్స్' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {isTe ? tab.labelTe : tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Content ── */}
        {activeTab === 'saved' && (
          <View style={styles.tabContent}>
            {schemeItems.length === 0 && advisoryItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>
                  {isTe ? 'ఇంకా ఏమీ దాచబడలేదు' : 'Nothing saved yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {isTe
                    ? 'పథకాలు లేదా AI సలహాలను బుక్‌మార్క్ చేయండి'
                    : 'Bookmark schemes or AI advisories to see them here'}
                </Text>
              </View>
            ) : (
              <>
                {schemeItems.map((item) => (
                  <ConversationPreviewCard
                    key={item.id}
                    item={item}
                    kind="saved"
                    isTe={isTe}
                    onPress={() => setViewer({ kind: 'saved', id: item.id })}
                  />
                ))}
                {advisoryItems.map((item) => (
                  <ConversationPreviewCard
                    key={item.id}
                    item={item}
                    kind="saved"
                    isTe={isTe}
                    onPress={() => setViewer({ kind: 'saved', id: item.id })}
                  />
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'questions' && (
          <View style={styles.tabContent}>
            {questionCount === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {isTe ? 'ఎవైనా ప్రశ్నలను అడగండి' : 'No questions asked yet'}
                </Text>
              </View>
            ) : (
              <>
              <View style={styles.questionSummary}>
                <Text style={styles.questionSummaryTitle}>
                  {isTe ? `మీరు ${questionCount} ప్రశ్నలను అడిగారు` : `You've asked ${questionCount} questions`}
                </Text>
                <Text style={styles.questionSummarySub}>
                  {isTe
                    ? 'AI వ్యవసాయ సలహాదారుతో మాట్లాడండి'
                    : 'Chat with the AI Agronomist for more guidance'}
                </Text>
                <TouchableOpacity
                  style={styles.askAgainBtn}
                  onPress={() => navigation.navigate('AskAgronomistScreen' as never)}
                >
                  <Text style={styles.askAgainText}>
                    {isTe ? 'మళ్లీ AI ని అడగండి' : 'Ask AI Again'} →
                  </Text>
                </TouchableOpacity>
              </View>
              {questionHistory.map((item) => (
                <ConversationPreviewCard
                  key={item.id ?? item.askedAt}
                  item={item}
                  kind="question"
                  isTe={isTe}
                  onPress={() =>
                    item.id ? setViewer({ kind: 'question', id: item.id }) : undefined
                  }
                />
              ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            <SettingsSection
              isTe={isTe}
              farmer={farmer}
              language={language}
              onSelectLanguage={handleSelectLanguage}
              onLogout={handleLogout}
            />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FullConversationModal
        visible={viewerItem !== null}
        item={viewerItem}
        isTe={isTe}
        language={language}
        onClose={() => setViewer(null)}
        onDelete={handleDeleteViewerItem}
      />
    </View>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

/** Preview shared by both the Saved and Questions tabs. */
function ConversationPreviewCard({
  item,
  kind,
  isTe,
  onPress,
}: {
  item: SavedItem | QuestionRecord;
  kind: 'saved' | 'question';
  isTe: boolean;
  onPress: () => void;
}) {
  const isSaved = 'bookmarkedAt' in item;
  const saved = item as SavedItem;
  const asked = item as QuestionRecord;
  const questionEn =
    (isSaved ? saved.questionEn : asked.questionEn || asked.questionText) || '';
  const questionTe =
    (isSaved ? saved.questionTe : asked.questionTe || asked.questionText) || '';
  const diagnosisEn =
    (isSaved
      ? saved.diagnosisEn || saved.title
      : asked.diagnosisEn || asked.titleEn || asked.answerTitle) || '';
  const diagnosisTe =
    (isSaved
      ? saved.diagnosisTe || saved.titleTe || saved.title
      : asked.diagnosisTe || asked.titleTe || asked.answerTitle) || '';
  const responseEn = (isSaved ? saved.fullResponseEn : asked.fullResponseEn) || '';
  const responseTe = (isSaved ? saved.fullResponseTe : asked.fullResponseTe) || '';
  const tag = isTe
    ? kind === 'question'
      ? '💬 ప్రశ్నల చరిత్ర'
      : isSaved && saved.type === 'scheme'
        ? '🛡️ ప్రభుత్వ పథకం'
        : '🤖 AI సలహా'
    : kind === 'question'
      ? '💬 Question History'
      : isSaved && saved.type === 'scheme'
        ? '🛡️ Government Scheme'
        : '🤖 AI Advisory';

  return (
    <TouchableOpacity style={styles.bookmarkCard} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.bookmarkTag}>{tag}</Text>
      <Text style={styles.bookmarkName} numberOfLines={2}>
        {isTe ? diagnosisTe || diagnosisEn : diagnosisEn || diagnosisTe}
      </Text>
      <Text style={styles.previewLabel}>
        {isTe ? 'ప్రశ్న' : 'Question'}
      </Text>
      <Text style={styles.previewText} numberOfLines={2}>
        {isTe ? questionTe || questionEn : questionEn || questionTe}
      </Text>
      <Text style={styles.previewLabel}>
        {isTe ? 'AI పరిష్కారం' : 'AI Solution'}
      </Text>
      <Text style={styles.previewText} numberOfLines={3}>
        {isTe ? responseTe || responseEn : responseEn || responseTe}
      </Text>
      <Text style={styles.viewFullText}>
        📖 {isTe ? 'పూర్తి వివరాలు చూడండి' : 'View Full Chat & AI Response'}
      </Text>
    </TouchableOpacity>
  );
}

const LANGUAGE_OPTIONS: { key: Language; label: string }[] = [
  { key: 'te', label: 'తెలుగు' },
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'हिंदी' },
];

function SettingsSection({
  isTe,
  farmer,
  language,
  onSelectLanguage,
  onLogout,
}: {
  isTe: boolean;
  farmer: {
    name: string;
    mandal: string;
    mandalTe: string;
    phone?: string;
    phoneMasked: string;
    address?: string;
  };
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.settingsTitle}>{isTe ? 'సెట్టింగ్స్' : 'Settings'}</Text>

      {/* Language switch — instant, no app restart */}
      <Text style={styles.settingsLabel}>
        🌐 {isTe ? 'భాష మార్చండి' : 'Switch Language'}
      </Text>
      <View style={styles.languageRow}>
        {LANGUAGE_OPTIONS.map((option) => {
          const active = language === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.languagePill,
                active && styles.languagePillActive,
              ]}
              onPress={() => onSelectLanguage(option.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.languagePillText,
                  active && styles.languagePillTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {[
        { icon: '🔔', label: isTe ? 'జాబులు' : 'Notifications', value: isTe ? 'ఆన్' : 'On' },
        {
          icon: '📍',
          label: isTe ? 'మండలం' : 'Mandal',
          value: isTe ? farmer.mandalTe : farmer.mandal,
        },
        {
          icon: '📞',
          label: isTe ? 'ఫోను' : 'Phone',
          value: farmer.phone || farmer.phoneMasked,
        },
      ].map((row, i) => (
        <View key={i} style={styles.settingRow}>
          <Text style={styles.settingIcon}>{row.icon}</Text>
          <Text style={styles.settingLabel}>{row.label}</Text>
          <Text style={styles.settingValue}>{row.value}</Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={onLogout}
        activeOpacity={0.85}
      >
        <Text style={styles.logoutText}>
          {isTe
            ? '↩ లాగౌట్ / స్వాగత స్క్రీన్‌కు'
            : '↩ Logout / Back to Welcome'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },

  // Identity card
  identityCard: {
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.card,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primarySoft,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { fontSize: 26 },
  identityInfo: { flex: 1, gap: 2 },
  farmerName: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.ink,
  },
  farmerPhone: {
    fontSize: 12,
    color: Colors.slate,
  },
  farmerLocation: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },
  farmerAddress: {
    fontSize: 11,
    color: Colors.slate,
    marginTop: 2,
  },
  pattadarBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  pattadarBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  acreageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cloudSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cloudSyncBadge: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  autoSyncPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  autoSyncText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  acreageValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.ink,
  },
  acreageLabel: {
    fontSize: 12,
    color: Colors.slate,
  },
  editBtn: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  cropsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cropsLabel: {
    fontSize: 12,
    color: Colors.slate,
    fontWeight: '700',
  },
  cropPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cropPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countersGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  counterItem: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.ink,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
  },
  counterSub: {
    fontSize: 10,
    color: Colors.slateLight,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    ...tokens.card,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    gap: 2,
  },
  tabActive: {
    backgroundColor: Colors.primarySoft,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slate,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  tabEmoji: { fontSize: 14 },
  tabContent: { gap: spacing.sm },

  // Empty state
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.slate,
    marginTop: 4,
    textAlign: 'center',
  },

  // Question summary
  questionSummary: {
    padding: spacing.lg,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    gap: spacing.sm,
  },
  questionSummaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  questionSummarySub: {
    fontSize: 12,
    color: Colors.slate,
    textAlign: 'center',
  },
  askAgainBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  askAgainText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // Bookmarked cards
  bookmarkCard: {
    padding: spacing.md,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: spacing.sm,
  },
  bookmarkTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  bookmarkName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
    marginTop: 4,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: 4,
  },
  previewText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.slate,
  },
  viewFullText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: spacing.sm,
  },

  // Settings
  settingsSection: {
    padding: spacing.md,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: spacing.sm,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  settingIcon: { fontSize: 18 },
  settingLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
  },
  settingValue: {
    fontSize: 12,
    color: Colors.slate,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ink,
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languagePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  languagePillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  languagePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate,
  },
  languagePillTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  logoutBtn: {
    marginTop: spacing.sm,
    backgroundColor: Colors.alert,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.danger,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 14,
    color: Colors.ink,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate,
  },
  modalSaveBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
});
