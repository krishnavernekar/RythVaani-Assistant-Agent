import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Colors, spacing } from '../theme/tokens';
import { useAppStore, type ChatThreadMessage } from '../store/useAppStore';
import { analyzeCropImage, AiResponse } from '../services/agronomyAiService';
import { fetchWeather } from '../services/weatherService';
import { playIndicVoice, SarvamLang } from '../services/sarvamVoiceService';
import { speak } from '../utils/voice';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type CropKind = 'paddy' | 'chilli';

const scannerSavedId = (title: string): string =>
  `scan-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const scannerQuestion = (crop: CropKind) => ({
  en: `Scan my ${crop} leaf and diagnose the problem`,
  te: crop === 'paddy' ? 'వరి ఆకును స్కాన్ చేసి రోగాన్ని గుర్తించండి' : 'మిరప ఆకును స్కాన్ చేసి రోగాన్ని గుర్తించండి',
});

const buildScannerChatThread = (
  questionEn: string,
  questionTe: string,
  advisory: AiResponse,
): ChatThreadMessage[] => {
  const now = Date.now();
  return [
    { role: 'farmer', textEn: questionEn, textTe: questionTe, timestamp: now },
    {
      role: 'ai',
      textEn: [
        advisory.diagnosis_title_en,
        advisory.advisory_en,
        advisory.chemical_dosage_en,
        advisory.weather_warning_en,
      ]
        .filter(Boolean)
        .join('\n'),
      textTe: [
        advisory.diagnosis_title_te,
        advisory.advisory_te,
        advisory.chemical_dosage_te,
        advisory.weather_warning_te,
      ]
        .filter(Boolean)
        .join('\n'),
      timestamp: now + 1,
    },
  ];
};

export function CropScannerModal({ visible, onClose }: Props) {
  const { language, addQuestion, toggleSavedItem, savedItems } = useAppStore();
  const isTe = language === 'te';
  const sarvamLang: SarvamLang =
    language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';

  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropKind>('paddy');
  const [loading, setLoading] = useState(false);
  const [advisory, setAdvisory] = useState<AiResponse | null>(null);

  const takePhoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setAdvisory(null);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setAdvisory(null);
    }
  };

  const analyzePhoto = async () => {
    if (!image) return;
    setLoading(true);
    setAdvisory(null);
    try {
      const file = new File(image);
      const base64Image = await file.base64();
      const weather = await fetchWeather();
      const rawResult = await analyzeCropImage(base64Image, weather);
      const result: AiResponse = {
        ...rawResult,
        diagnosis_title_en: `[${crop === 'paddy' ? 'Paddy' : 'Chilli'}] ${rawResult.diagnosis_title_en}`,
      };
      setAdvisory(result);

      const question = scannerQuestion(crop);
      addQuestion({
        id: `scan-${Date.now()}`,
        questionEn: question.en,
        questionTe: question.te,
        questionText: question.en,
        answerTitle: result.diagnosis_title_en,
        diagnosisEn: result.diagnosis_title_en,
        diagnosisTe: result.diagnosis_title_te,
        fullResponseEn: result.advisory_en,
        fullResponseTe: result.advisory_te,
        chemicalDosageEn: result.chemical_dosage_en,
        chemicalDosageTe: result.chemical_dosage_te,
        weatherWarningEn: result.weather_warning_en,
        weatherWarningTe: result.weather_warning_te,
        chatThread: buildScannerChatThread(question.en, question.te, result),
        queryType: 'IMAGE_SCAN',
        askedAt: new Date().toISOString(),
        source: 'crop-scanner',
      });
    } catch (e) {
      console.error('[CropScanner] Analysis failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveAdvisory = () => {
    if (!advisory) return;
    const question = scannerQuestion(crop);
    const savedAt = Date.now();
    toggleSavedItem({
      id: scannerSavedId(advisory.diagnosis_title_en),
      type: 'advisory',
      category: 'advisory',
      title: advisory.diagnosis_title_en,
      titleTe: advisory.diagnosis_title_te,
      subtitle: advisory.chemical_dosage_en,
      questionEn: question.en,
      questionTe: question.te,
      diagnosisEn: advisory.diagnosis_title_en,
      diagnosisTe: advisory.diagnosis_title_te,
      fullResponseEn: advisory.advisory_en,
      fullResponseTe: advisory.advisory_te,
      chemicalDosageEn: advisory.chemical_dosage_en,
      chemicalDosageTe: advisory.chemical_dosage_te,
      weatherWarningEn: advisory.weather_warning_en,
      weatherWarningTe: advisory.weather_warning_te,
      chatThread: buildScannerChatThread(question.en, question.te, advisory),
      data: {
        advisory_en: advisory.advisory_en,
        advisory_te: advisory.advisory_te,
        chemical_dosage_en: advisory.chemical_dosage_en,
        chemical_dosage_te: advisory.chemical_dosage_te,
        weather_warning_en: advisory.weather_warning_en,
        weather_warning_te: advisory.weather_warning_te,
      },
      bookmarkedAt: savedAt,
      savedAt,
    });
  };

  const isSaved =
    !!advisory && savedItems.some((item) => item.id === scannerSavedId(advisory.diagnosis_title_en));

  const listenToAdvice = () => {
    if (!advisory) return;
    const text = isTe
      ? `${advisory.advisory_te} ${advisory.chemical_dosage_te}`
      : `${advisory.advisory_en} ${advisory.chemical_dosage_en}`;
    playIndicVoice(text, sarvamLang, () => speak(text, { language: sarvamLang }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <ScrollView contentContainerStyle={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{isTe ? 'పంట ఆరోగ్య స్కానర్' : 'Crop Health Scanner'}</Text>
          <Text style={styles.subtitle}>
            {isTe
              ? 'ఆకు పైభాగం ఫోటో తీయండి — AI వ్యాధిని గుర్తిస్తుంది'
              : 'Photo the upper leaf surface — AI will diagnose the pest/disease'}
          </Text>

          {/* Crop selector pill */}
          <View style={styles.cropRow}>
            {(['paddy', 'chilli'] as CropKind[]).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.cropPill, crop === c && styles.cropPillActive]}
                onPress={() => setCrop(c)}
              >
                <Text style={[styles.cropPillText, crop === c && styles.cropPillTextActive]}>
                  {c === 'paddy' ? '🌾 ' + (isTe ? 'వరి' : 'Paddy') : '🌶️ ' + (isTe ? 'మిర్చి' : 'Chilli')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Leaf-focus preview */}
          {image ? (
            <Image source={{ uri: image }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>🍃</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>{isTe ? 'AI విశ్లేషణ జరుగుతోంది…' : 'AI analysis in progress…'}</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.btn} onPress={takePhoto}>
                <Text style={styles.btnText}>📷 {isTe ? 'ఫోటో తీయండి' : 'Take Photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery}>
                <Text style={styles.secondaryText}>🖼️ {isTe ? 'గ్యాలరీ నుండి' : 'Pick from Gallery'}</Text>
              </TouchableOpacity>
              {image && (
                <TouchableOpacity style={styles.btn} onPress={analyzePhoto}>
                  <Text style={styles.btnText}>🔬 {isTe ? 'స్కాన్ చేయి' : 'Scan Now'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Structured diagnosis card */}
          {advisory && !loading && (
            <View style={styles.advisoryCard}>
              <Text style={styles.sourceChip}>🤖 {advisory.source ?? ''}</Text>
              <Text style={styles.diagnosis}>
                {isTe ? advisory.diagnosis_title_te : advisory.diagnosis_title_en}
              </Text>
              <Text style={styles.recBody}>{isTe ? advisory.advisory_te : advisory.advisory_en}</Text>
              {advisory.chemical_dosage_en.trim().length > 0 && (
                <Text style={styles.dosage}>
                  💊 {isTe ? advisory.chemical_dosage_te : advisory.chemical_dosage_en}
                </Text>
              )}
              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.listenBtn} onPress={listenToAdvice}>
                  <Text style={styles.footerBtnText}>🔊 వినండి / Listen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.listenBtn} onPress={saveAdvisory}>
                  <Text style={styles.footerBtnText}>
                    {isSaved ? '🔖 Saved' : '🔖 Save Advisory'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕ {isTe ? 'మూసివేయి' : 'Close'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.md },
  content: { backgroundColor: Colors.cardWhite, padding: spacing.lg, borderRadius: 20, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: Colors.primary, textAlign: 'center' },
  subtitle: { fontSize: 12, color: Colors.slate, textAlign: 'center' },
  cropRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  cropPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 99, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: '#F8FAFC' },
  cropPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cropPillText: { fontSize: 13, fontWeight: '700', color: Colors.slate },
  cropPillTextActive: { color: '#FFF', fontWeight: '800' },
  preview: { width: '100%', height: 200, borderRadius: 12 },
  placeholder: { width: '100%', height: 200, backgroundColor: '#E2E8F0', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 48 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md },
  loadingText: { fontSize: 13, color: Colors.slate, fontWeight: '600' },
  btn: { backgroundColor: Colors.primary, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800' },
  secondaryBtn: { padding: spacing.sm, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  secondaryText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  advisoryCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: spacing.md, borderWidth: 1, borderColor: Colors.primary },
  sourceChip: { alignSelf: 'flex-start', backgroundColor: '#E8F5E9', color: Colors.primary, fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6, overflow: 'hidden' },
  diagnosis: { fontSize: 16, fontWeight: '900', color: Colors.primary, marginBottom: 6, marginTop: 4 },
  recBody: { fontSize: 13, lineHeight: 20, color: Colors.slate },
  dosage: { fontSize: 13, fontWeight: '700', color: Colors.ink, marginTop: spacing.sm, lineHeight: 20 },
  footerRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  listenBtn: { flex: 1, backgroundColor: Colors.primarySoft, padding: spacing.sm, borderRadius: 10, alignItems: 'center' },
  footerBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  closeBtn: { padding: spacing.sm, alignItems: 'center' },
  closeText: { color: Colors.slate, fontWeight: '600' },
});
