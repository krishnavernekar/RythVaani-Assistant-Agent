/**
 * FullConversationModal — complete saved advisory / AI question viewer.
 * Renders the exact farmer question, diagnosis, full bilingual response,
 * dosage or financial breakdown, warning banner, follow-up chat thread,
 * audio playback and a delete action.
 */
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, spacing } from '../theme/tokens';
import {
  Language,
  QuestionRecord,
  SavedItem,
} from '../store/useAppStore';
import { speak, stopSpeaking } from '../utils/voice';
import { playIndicVoice, SarvamLang } from '../services/sarvamVoiceService';

interface Props {
  visible: boolean;
  item: SavedItem | QuestionRecord | null;
  isTe: boolean;
  language: Language;
  onClose: () => void;
  onDelete: () => void;
}

interface ViewerData {
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
  chatThread: NonNullable<SavedItem['chatThread']>;
}

const asViewerData = (item: SavedItem | QuestionRecord): ViewerData => {
  const isSaved = 'bookmarkedAt' in item;
  if (isSaved) {
    const saved = item as SavedItem;
    return {
      questionEn: saved.questionEn || '',
      questionTe: saved.questionTe || '',
      diagnosisEn: saved.diagnosisEn || saved.title || '',
      diagnosisTe: saved.diagnosisTe || saved.titleTe || saved.title || '',
      fullResponseEn: saved.fullResponseEn || '',
      fullResponseTe: saved.fullResponseTe || '',
      chemicalDosageEn: saved.chemicalDosageEn || '',
      chemicalDosageTe: saved.chemicalDosageTe || '',
      weatherWarningEn: saved.weatherWarningEn || '',
      weatherWarningTe: saved.weatherWarningTe || '',
      chatThread: saved.chatThread ?? [],
    };
  }

  const asked = item as QuestionRecord;
  return {
    questionEn: asked.questionEn || asked.questionText || '',
    questionTe: asked.questionTe || asked.questionText || '',
    diagnosisEn: asked.diagnosisEn || asked.titleEn || asked.answerTitle || '',
    diagnosisTe: asked.diagnosisTe || asked.titleTe || asked.answerTitle || '',
    fullResponseEn: asked.fullResponseEn || '',
    fullResponseTe: asked.fullResponseTe || '',
    chemicalDosageEn: asked.chemicalDosageEn || '',
    chemicalDosageTe: asked.chemicalDosageTe || '',
    weatherWarningEn: asked.weatherWarningEn || '',
    weatherWarningTe: asked.weatherWarningTe || '',
    chatThread: asked.chatThread ?? [],
  };
};

export default function FullConversationModal({
  visible,
  item,
  isTe,
  language,
  onClose,
  onDelete,
}: Props) {
  React.useEffect(() => () => stopSpeaking(), []);

  if (!visible || !item) return null;

  const data = asViewerData(item);
  const sarvamLang: SarvamLang =
    language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';
  const label = (en: string, te: string) => (isTe ? te : en);

  const close = () => {
    stopSpeaking();
    onClose();
  };

  const listen = () => {
    const threadText = data.chatThread
      .map((message) => {
        const speaker =
          message.role === 'farmer'
            ? label('Farmer', 'రైతు')
            : label('AI Advisor', 'AI సలహాదారుడు');
        return `${speaker}: ${
          isTe ? message.textTe || message.textEn : message.textEn || message.textTe
        }`;
      })
      .join('\n');
    const text = [
      label("Farmer's question", 'రైతు ప్రశ్న'),
      isTe ? data.questionTe || data.questionEn : data.questionEn || data.questionTe,
      label('Diagnosis', 'నిర్ధారణ'),
      isTe ? data.diagnosisTe || data.diagnosisEn : data.diagnosisEn || data.diagnosisTe,
      label('AI response', 'AI సలహా'),
      isTe ? data.fullResponseTe || data.fullResponseEn : data.fullResponseEn || data.fullResponseTe,
      data.chemicalDosageEn || data.chemicalDosageTe
        ? label('Dosage / financial breakdown', 'మోతాదు / ఆర్థిక వివరాలు')
        : '',
      isTe ? data.chemicalDosageTe : data.chemicalDosageEn,
      data.weatherWarningEn || data.weatherWarningTe
        ? label('Warning / next action', 'హెచ్చరిక / తదుపరి చర్య')
        : '',
      isTe ? data.weatherWarningTe : data.weatherWarningEn,
      threadText ? label('Chat thread', 'సంభాషణ') : '',
      threadText,
    ]
      .filter(Boolean)
      .join('\n\n');
    playIndicVoice(text, sarvamLang, () => speak(text, { language: sarvamLang }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={close}
          />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>
                📖 {label('Full Chat & AI Response', 'పూర్తి సంభాషణ & AI సలహా')}
              </Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Section
                title={label("Farmer's Original Question", 'రైతు అసలు ప్రశ్న')}
              >
                <BilingualBlock
                  isTe={isTe}
                  english={data.questionEn}
                  telugu={data.questionTe}
                />
              </Section>

              <Section
                title={label('Diagnosis & Full AI Advisory', 'నిర్ధారణ & పూర్తి AI సలహా')}
              >
                <Text style={styles.diagnosis}>
                  {isTe
                    ? data.diagnosisTe || data.diagnosisEn
                    : data.diagnosisEn || data.diagnosisTe}
                </Text>
                <BilingualBlock
                  isTe={isTe}
                  english={data.fullResponseEn}
                  telugu={data.fullResponseTe}
                />
              </Section>

              {(data.chemicalDosageEn || data.chemicalDosageTe).length > 0 ? (
                <View style={styles.dosageCard}>
                  <Text style={styles.sectionTitle}>
                    💊 {label('Recommended Dosage / Financial Breakdown', 'సిఫార్సు మోతాదు / ఆర్థిక వివరాలు')}
                  </Text>
                  <BilingualBlock
                    isTe={isTe}
                    english={data.chemicalDosageEn}
                    telugu={data.chemicalDosageTe}
                  />
                </View>
              ) : null}

              {(data.weatherWarningEn || data.weatherWarningTe).length > 0 ? (
                <View style={styles.warningCard}>
                  <Text style={styles.warningTitle}>
                    ⚠️ {label('Weather / Action Warning', 'వాతావరణ / చర్య హెచ్చరిక')}
                  </Text>
                  <BilingualBlock
                    isTe={isTe}
                    english={data.weatherWarningEn}
                    telugu={data.weatherWarningTe}
                  />
                </View>
              ) : null}

              {data.chatThread.length > 0 ? (
                <Section title={label('Follow-up Chat Thread', 'తదుపరి ప్రశ్నల సంభాషణ')}>
                  {data.chatThread.map((message, index) => (
                    <View
                      key={`${message.timestamp}-${index}`}
                      style={[
                        styles.chatBubble,
                        message.role === 'farmer' && styles.farmerBubble,
                      ]}
                    >
                      <Text style={styles.chatSpeaker}>
                        {message.role === 'farmer'
                          ? label('👨‍🌾 Farmer', '👨‍🌾 రైతు')
                          : label('🤖 AI Advisor', '🤖 AI సలహాదారుడు')}
                      </Text>
                      <Text style={styles.chatText}>
                        {isTe
                          ? message.textTe || message.textEn
                          : message.textEn || message.textTe}
                      </Text>
                    </View>
                  ))}
                </Section>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.listenBtn} onPress={listen}>
                <Text style={styles.listenText}>
                  🔊 {label('Listen Complete Response', 'పూర్తి సలహా వినండి')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                <Text style={styles.deleteText}>
                  🗑️ {label('Remove', 'తొలగించండి')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BilingualBlock({
  isTe,
  english,
  telugu,
}: {
  isTe: boolean;
  english: string;
  telugu: string;
}) {
  const primary = isTe ? telugu || english : english || telugu;
  const secondary = isTe ? english : telugu;
  const showSecondary = secondary.trim().length > 0 && secondary !== primary;

  return (
    <View>
      <Text style={styles.bodyText}>{primary || '—'}</Text>
      {showSecondary ? (
        <View style={styles.secondaryBlock}>
          <Text style={styles.secondaryLabel}>
            {isTe ? 'English' : 'తెలుగు'}
          </Text>
          <Text style={styles.secondaryText}>{secondary}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.cardWhite,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
  },
  closeText: {
    fontSize: 18,
    color: Colors.slate,
    fontWeight: '700',
  },
  scrollContent: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
    marginBottom: 4,
  },
  diagnosis: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.ink,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.slate,
  },
  secondaryBlock: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  secondaryLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.slateLight,
    marginBottom: 2,
  },
  secondaryText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.slate,
  },
  dosageCard: {
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  warningCard: {
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#92400E',
    marginBottom: 4,
  },
  chatBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    marginVertical: 4,
  },
  farmerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
  },
  chatSpeaker: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primary,
    marginBottom: 2,
  },
  chatText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.ink,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  listenBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  listenText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  deleteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  deleteText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '900',
  },
});
