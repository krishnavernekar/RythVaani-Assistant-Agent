import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getDict, getLineHeight } from '../i18n/translations';

export default function GovtSchemesCheckerScreen() {
  const { language } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';

  useEffect(() => () => stopSpeaking(), []);

  const playAudioGuide = () => {
    const text = isTe
      ? 'ఆధార్ లేదా బ్యాంక్ వివరాలు అవసరం లేకుండా మూడు సులభమైన ప్రశ్నలతో ప్రభుత్వ పథకాల అర్హతను తనిఖీ చేయండి.'
      : "Check your eligibility for government schemes in 3 simple questions without entering Aadhaar or bank details.";
    speak(text, { language: isTe ? 'te-IN' : 'en-IN' });
  };

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader subtitle={dict.schemes.subtitle} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{dict.schemes.searchPlaceholder}</Text>
          <TouchableOpacity>
            <Text style={styles.voiceSearchIcon}>🔊 🎙️</Text>
          </TouchableOpacity>
        </View>

        {/* Audio Guide */}
        <TouchableOpacity
          style={styles.audioGuideCard}
          onPress={playAudioGuide}
          activeOpacity={0.85}
        >
          <View style={styles.audioGuideLeft}>
            <View style={styles.playBtn}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
            <View>
              <Text style={styles.audioGuideTitle}>{dict.schemes.audioGuide}</Text>
              <Text style={styles.audioGuideSub}>
                {dict.schemes.audioGuideSub}
              </Text>
            </View>
          </View>
          <Text style={styles.listenPill}>{dict.common.listen}</Text>
        </TouchableOpacity>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {[
            { label: dict.schemes.allSchemes, active: true },
            { label: dict.schemes.incomeSupport, active: false },
            { label: dict.schemes.cropInsurance, active: false },
          ].map((pill, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.filterPill,
                pill.active && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  pill.active && styles.filterPillTextActive,
                ]}
              >
                {pill.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 3-Step Eligibility Wizard */}
        <View style={styles.wizardCard}>
          <View style={styles.wizardHeader}>
            <View>
              <Text style={styles.wizardTitle}>🤖 {dict.schemes.eligibilityChecker}</Text>
              <Text
                style={[
                  styles.wizardSub,
                  { lineHeight: getLineHeight(11, language) },
                ]}
              >
                {dict.schemes.eligibilitySub}
              </Text>
            </View>
            <Text style={styles.instantBadge}>Instant</Text>
          </View>

          <Text style={styles.privacyNote}>
            {dict.schemes.privacyNote}
          </Text>

          <View style={styles.stepHeader}>
            <Text style={styles.stepLabel}>2. {dict.schemes.stepDone} of 3: {'Land & Farming Profile'}</Text>
            <Text style={styles.stepProgress}>66% Done</Text>
          </View>

          {/* Step 2 selections */}
          <View style={styles.selections}>
            {[
              { label: 'భూమి విస్తీర్ణం / Landholding', value: 'Small & Marginal (< 2 Hectares / 5 Acres)' },
              { label: 'యాజమాన్యం / Land Ownership', value: 'Patta Landholder (Self-Owned Pattadar)' },
              { label: 'ప్రధాన పంటలు / Crops Cultivated', value: 'Paddy (వరి) & Chilli (మిరప)' },
            ].map((item, i) => (
              <View key={i} style={styles.selectionItem}>
                <View style={styles.selectionInner}>
                  <Text style={styles.selectionLabel}>{item.label}</Text>
                  <Text style={styles.selectionValue}>{item.value}</Text>
                </View>
                <Text style={styles.checkmark}>✔</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.nextBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              ✅ 2 Schemes Likely Eligible — {dict.schemes.viewMatch} (3/3) →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: Colors.slateLight,
  },
  voiceSearchIcon: {
    fontSize: 14,
  },
  audioGuideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  audioGuideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  audioGuideTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  audioGuideSub: {
    fontSize: 11,
    color: Colors.slate,
  },
  listenPill: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  filterScroll: {
    marginLeft: -spacing.sm,
  },
  filterContent: {
    gap: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardWhite,
  },
  filterPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate,
  },
  filterPillTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  wizardCard: {
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.card,
  },
  wizardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wizardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.ink,
  },
  wizardSub: {
    fontSize: 11,
    color: Colors.slate,
  },
  instantBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: '#D1FAE5',
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  privacyNote: {
    fontSize: 11,
    color: Colors.slate,
    lineHeight: 17,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
  stepProgress: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  selections: {
    gap: spacing.sm,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  selectionInner: {
    flex: 1,
    gap: 2,
  },
  selectionLabel: {
    fontSize: 10,
    color: Colors.slate,
  },
  selectionValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
  checkmark: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '800',
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
