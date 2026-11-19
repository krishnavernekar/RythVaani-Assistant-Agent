import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getDict, getLineHeight } from '../i18n/translations';

export default function AskAgronomistVoiceScreen() {
  const navigation = useNavigation<any>();
  const { language } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';

  const [isRecording, setIsRecording] = useState(false);
  const [transcriptEn, setTranscriptEn] = useState(
    'How to control yellow stem borer in my BPT 5204 paddy crop in Guntur?',
  );
  const [transcriptTe] = useState(
    'నా గుంటూరు BPT 5204 వరి పంటలో పసుపు కాండం తొలచు పురుగును ఎలా నియంత్రించాలి?',
  );

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const playResponseAudio = () => {
    const text = isTe
      ? 'ANGRAU సిఫారసు ప్రకారం: BPT 5204 వరిలో కాండం తొలచు పురుగు నివారణకు ఎకరాకు కార్టాప్ హైడ్రోక్లోరైడ్ 4G గుళికలు 8 కిలోలు వేయండి లేదా క్లోరాంట్రానిలీప్రోల్ 0.4 మి.లీ లీటరు నీటికి కలిపి పిచికారీ చేయండి.'
      : "According to ANGRAU guidelines: For BPT 5204 paddy yellow stem borer, apply Cartap Hydrochloride 4G granules at 8 kg per acre or spray Chlorantraniliprole at 0.4 ml per liter of water.";
    speak(text, { language: isTe ? 'te-IN' : 'en-IN' });
  };

  const toggleRecording = () => {
    setIsRecording(prev => !prev);
  };

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader
        subtitle={`${dict.app.name} • ${dict.askAi.subtitle}`}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* MAO Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>
            🛡️ {dict.askAi.maDisclaimerTitle}
          </Text>
          <Text
            style={[
              styles.disclaimerBody,
              { lineHeight: getLineHeight(11, language) },
            ]}
          >
            {dict.askAi.maDisclaimerBody}
          </Text>
        </View>

        {/* Quick Inquiry Chips */}
        <View>
          <View style={styles.chipsHeader}>
            <Text style={styles.chipsTitle}>{dict.askAi.quickInquiries}</Text>
            <Text style={styles.viewAll}>{dict.common.viewAll}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {[
              { en: '🪲 Paddy pest control', te: 'వరి కీటక నియంత్రణ' },
              { en: '🌶️ Chilli leaf curl virus', te: 'మిర్చి ఆకు సంకుచిత వైరస్' },
              { en: '🧪 Fertilizer dosage', te: 'ఎరువు పరిమాణం' },
              { en: '💧 Irrigation timing', te: 'కల్లు పారుదల సమయం' },
            ].map((chip, i) => (
              <TouchableOpacity
                key={i}
                style={styles.chip}
                activeOpacity={0.8}
              >
                <Text style={styles.chipText}>{chip.en}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recording Area */}
        <View style={styles.recorderCard}>
          <View style={styles.recorderHeader}>
            <Text style={styles.recorderLabel}>
              {isRecording
                ? dict.askAi.recording
                : '🎙️ ' + (isTe ? 'మాట్లాడండి / Tap to Record' : 'Tap to Record')}
            </Text>
            <Text style={styles.timer}>⏱ 00:14 / 01:00</Text>
          </View>

          <TouchableOpacity
            style={styles.recordButton}
            onPress={toggleRecording}
            activeOpacity={0.85}
          >
            <Text style={styles.recordIcon}>{isRecording ? '⏸' : '🎙️'}</Text>
          </TouchableOpacity>

          {/* Transcript */}
          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptTitle}>
                💬 {dict.askAi.liveTranscript}
              </Text>
              <Text style={styles.editBtn}>{dict.askAi.editTranscript}</Text>
            </View>
            <TextInput
              style={styles.transcriptInput}
              value={transcriptEn}
              onChangeText={setTranscriptEn}
              multiline
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.transcriptTe,
                { lineHeight: getLineHeight(11, language) },
              ]}
            >
              {transcriptTe}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>↻ {dict.askAi.cancelRetry}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.askBtn}
              onPress={playResponseAudio}
              activeOpacity={0.85}
            >
              <Text style={styles.askBtnText}>➤ {dict.askAi.stopAndAsk}</Text>
            </TouchableOpacity>
          </View>
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
  disclaimerCard: {
    backgroundColor: Colors.warning,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.md,
    gap: spacing.xs,
  },
  disclaimerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.warningText,
  },
  disclaimerBody: {
    fontSize: 11,
    color: '#78350F',
  },
  chipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chipsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.slate,
  },
  viewAll: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  chipsScroll: {
    marginLeft: -spacing.sm,
  },
  chipsContent: {
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    backgroundColor: Colors.cardWhite,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginRight: spacing.sm,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ink,
  },
  recorderCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  recorderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recorderLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  timer: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
  },
  recordButton: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    borderWidth: 4,
    borderColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIcon: {
    fontSize: 28,
  },
  transcriptBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transcriptTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editBtn: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  transcriptInput: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ink,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  transcriptTe: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardWhite,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate,
  },
  askBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
