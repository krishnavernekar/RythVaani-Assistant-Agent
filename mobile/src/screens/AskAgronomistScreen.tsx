import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getLineHeight } from '../i18n/translations';
import { fetchWeather } from '../services/weatherService';
import {
  analyzeVoiceQuery,
  AiResponse,
} from '../services/agronomyAiService';
import { playIndicVoice, transcribeAudio, SarvamLang } from '../services/sarvamVoiceService';

/** Stable id so tapping Save twice toggles instead of duplicating the bookmark. */
const advisoryBookmarkId = (title: string): string =>
  `advisory-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** Kept at module scope to keep the render pass free of impure calls. */
const getTimestamp = (): number => Date.now();

export default function AskAgronomistScreen() {
  const navigation = useNavigation<any>();
  const { language, incrementQuestions, savedItems, toggleSavedItem, addQuestion } =
    useAppStore();
  const isTe = language === 'te';
  const sarvamLang: SarvamLang =
    language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';

  // Recording State
const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

const [isRecording, setIsRecording] = useState(false);
const [recordTime, setRecordTime] = useState(0);
// The last finished recording (file:// URI) — sent to Sarvam STT / Gemini
const [lastAudioUri, setLastAudioUri] = useState<string | null>(null);
const [transcribing, setTranscribing] = useState(false);

const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // AI State
  const [loading, setLoading] = useState(false);
  const [transcriptEn, setTranscriptEn] = useState('');
  const [transcriptTe, setTranscriptTe] = useState('');
  const [advisory, setAdvisory] = useState<AiResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

useEffect(() => {
  return () => {
    stopSpeaking();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioRecorder.isRecording) {
      audioRecorder.stop().catch((err) => {
        console.error('Recording cleanup failed:', err);
      });
    }
  };
}, [audioRecorder]);

  const startRecording = async () => {
  try {
    // Never let an older advisory keep talking into the microphone.
    stopSpeaking();
    setAskError(null);

    const perm = await requestRecordingPermissionsAsync();

    if (!perm.granted) {
      console.log('Microphone permission denied');
      return;
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await audioRecorder.prepareToRecordAsync();

    audioRecorder.record();

    setIsRecording(true);
    setRecordTime(0);

    // Sarvam Saaras REST accepts ≤30s files — auto-stop at 30s
    timerRef.current = setInterval(() => {
      setRecordTime((t) => {
        if (t + 1 >= 30) {
          stopRecording();
          return 30;
        }
        return t + 1;
      });
    }, 1000);

  } catch (err) {
    console.error('Failed to start recording:', err);
  }
};

  const stopRecording = async () => {
  if (!isRecording) return;

  setIsRecording(false);

  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  try {
    await audioRecorder.stop();

    const audioUri = audioRecorder.uri;

    console.log('Recording saved at:', audioUri);
    if (audioUri) {
      setLastAudioUri(audioUri);
      // Transcribe the audio immediately so the farmer sees the text
      setTranscribing(true);
      try {
        const transcript = await transcribeAudio(audioUri, sarvamLang);
        if (transcript) {
          // Display in the appropriate transcript field based on language
          if (isTe) {
            setTranscriptTe((prev) =>
              prev.trim().length > 0 ? `${prev} ${transcript}` : transcript,
            );
          } else {
            setTranscriptEn((prev) =>
              prev.trim().length > 0 ? `${prev} ${transcript}` : transcript,
            );
          }
          // Also set the other language field as a fallback
          if (isTe) {
            setTranscriptEn((prev) =>
              prev.trim().length > 0 ? prev : transcript,
            );
          } else {
            setTranscriptTe((prev) =>
              prev.trim().length > 0 ? prev : transcript,
            );
          }
        } else {
          console.warn('[AskAI] Sarvam STT returned no transcript');
        }
      } catch (err) {
        console.error('[AskAI] Transcription failed:', err);
      } finally {
        setTranscribing(false);
      }
    }
  } catch (err) {
    console.error('Failed to stop recording:', err);
    setTranscribing(false);
  }
};

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `0${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAskAi = async () => {
    const hasQuery =
      transcriptEn.trim().length > 0 || transcriptTe.trim().length > 0 || lastAudioUri;
    if (!hasQuery) return;
    setLoading(true);
    setAdvisory(null);
    setAskError(null);
    stopSpeaking();
    try {
      const weather = await fetchWeather();
      const result = await analyzeVoiceQuery({
        audioUri: lastAudioUri,
        transcriptEn,
        transcriptTe,
        language: sarvamLang,
        weather,
      });
      // Real dual-script output from Sarvam STT / the configured AI provider
      setTranscriptEn(result.transcript_en || transcriptEn);
      setTranscriptTe(result.transcript_te || transcriptTe);
      setAdvisory(result);
      if (result.failureReason) {
        setAskError(
          isTe
            ? `AI స్పందించలేదు — ఆఫ్‍లైన్ ANGRAU సలహా చూపబడుతోంది. కారణం: ${result.failureReason}`
            : `AI could not answer — showing the offline ANGRAU advisory. Reason: ${result.failureReason}`,
        );
      }
      incrementQuestions();
      addQuestion({
        questionText: transcriptEn.trim() || result.diagnosis_title_en,
        questionTe: transcriptTe.trim() || result.diagnosis_title_te,
        answerTitle: result.diagnosis_title_en,
        askedAt: new Date().toISOString(),
        source: 'voice',
      });
    } catch (err) {
      console.error('Ask AI pipeline failed:', err);
      setAskError(
        isTe
          ? 'AI సలహా పొందలేకపోయాము. దయచేసి ఇంటర్నెట్ తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.'
          : 'Could not get an AI answer. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const saveAdvisory = () => {
    if (!advisory) return;
    toggleSavedItem({
      id: advisoryBookmarkId(advisory.diagnosis_title_en),
      type: 'advisory',
      title: advisory.diagnosis_title_en,
      titleTe: advisory.diagnosis_title_te,
      subtitle: advisory.chemical_dosage_en,
      data: {
        advisory_en: advisory.advisory_en,
        advisory_te: advisory.advisory_te,
      },
      bookmarkedAt: getTimestamp(),
    });
  };

  const isAdvisorySaved =
    !!advisory &&
    savedItems.some(
      (item) => item.id === advisoryBookmarkId(advisory.diagnosis_title_en),
    );

  const listenToAdvice = () => {
    if (!advisory) return;
    const text = isTe
      ? `${advisory.advisory_te} ${advisory.chemical_dosage_te}`
      : `${advisory.advisory_en} ${advisory.chemical_dosage_en}`;
    playIndicVoice(text, sarvamLang, () =>
      speak(text, { language: sarvamLang }),
    );
  };

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader subtitle={isTe ? 'రైతువాణి • అడగండి' : 'Ask Agronomist AI'} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Mandatory Official Guidance Banner (Rule 1.3) */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>🛡️ ప్రాథమిక AI వ్యవసాయ సలహాదారు • Official Agronomic Guidance</Text>
          <Text style={[styles.disclaimerBody, { lineHeight: getLineHeight(11, language) }]}>
            Preliminary AI agronomist advisory. Always consult your local Mandal Agriculture Officer (MAO) for severe infections or seed blight.
          </Text>
        </View>

        {/* Quick Inquiry Chips */}
        <View style={styles.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { en: '🪲 Paddy pest control', te: 'వరిలో కాండం తొలుచు పురుగు' },
              { en: '🌶️ Chilli leaf curl virus', te: 'మిరపలో ఆకుముడత తెగులు' },
              { en: '🧪 Fertilizer & Urea', te: 'ఎరువుల యాజమాన్యం' },
            ].map((chip, i) => (
              <TouchableOpacity key={i} style={styles.chip} onPress={() => {
                setTranscriptEn(chip.en);
                setTranscriptTe(chip.te);
              }}>
                <Text style={styles.chipText}>{isTe ? chip.te : chip.en}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recorder Card */}
        <View style={[styles.recorderCard, isRecording && styles.recordingActive]}>
          <View style={styles.recorderHeader}>
            <Text style={styles.recorderTitle}>{isRecording ? (isTe ? 'మాట్లాడండి / Recording...' : 'Recording Voice...') : (isTe ? 'ప్రశ్న అడగండి' : 'Ask a Question')}</Text>
            <Text style={styles.timer}>{formatTime(recordTime)} / 01:00</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.micButton, isRecording && styles.micPulsing]} 
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.micIcon}>{isRecording ? '⏸' : '🎙️'}</Text>
          </TouchableOpacity>

          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptLabel}>💬 Live Speech-to-Text</Text>
              <TouchableOpacity><Text style={styles.editLink}>✎ Edit</Text></TouchableOpacity>
            </View>
            {transcribing ? (
              <View style={styles.transcribingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.transcribingText}>
                  {isTe ? 'మాటను టెక్స్ట్‌గా మారుస్తోంది...' : 'Converting speech to text...'}
                </Text>
              </View>
            ) : (
              <TextInput 
                style={styles.input} 
                value={isTe ? transcriptTe : transcriptEn} 
                onChangeText={(val) => isTe ? setTranscriptTe(val) : setTranscriptEn(val)}
                multiline
                placeholder={isTe ? 'ఇక్కడ టైప్ చేయండి లేదా మాట్లాడండి...' : 'Type here or speak...'}
                placeholderTextColor={Colors.slateLight}
              />
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setTranscriptEn(''); setTranscriptTe(''); setAdvisory(null); }}>
              <Text style={styles.cancelText}>↻ Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.askBtn} onPress={handleAskAi}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.askText}>➤ Ask AI</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {askError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {askError}</Text>
          </View>
        )}

        {/* AI Advisory Output Card */}
        {advisory && (
          <View style={styles.advisoryCard}>
            {advisory.source ? (
              <Text style={styles.sourceChip}>🤖 {advisory.source}</Text>
            ) : null}
            <Text style={styles.diagnosis}>{isTe ? advisory.diagnosis_title_te : advisory.diagnosis_title_en}</Text>
            <View style={styles.divider} />
            <Text style={styles.recTitle}>{isTe ? 'అంగ్రావు సలహా / ANGRAU Advisory:' : 'ANGRAU Advisory:'}</Text>
            <Text style={styles.recBody}>{isTe ? advisory.advisory_te : advisory.advisory_en}</Text>
            {advisory.chemical_dosage_en.trim().length > 0 && (
              <>
                <Text style={styles.recTitle}>{isTe ? 'సిఫారసు చేసిన మందు మోతాదు / Recommended Control:' : 'ANGRAU Recommended Control:'}</Text>
                <Text style={styles.recBody}>{isTe ? advisory.chemical_dosage_te : advisory.chemical_dosage_en}</Text>
              </>
            )}
            {advisory.weather_warning_en.trim().length > 0 && (
              <View style={styles.weatherWarning}>
                <Text style={styles.weatherWarnText}>
                  {isTe ? advisory.weather_warning_te : advisory.weather_warning_en}
                </Text>
              </View>
            )}

            <View style={styles.footer}>
              <TouchableOpacity style={styles.listenBtn} onPress={listenToAdvice}>
                <Text style={styles.footerBtnText}>🔊 వినండి / Listen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveAdvisory}>
                <Text style={styles.footerBtnText}>
                  {isAdvisorySaved ? '✓ Saved' : '🔖 Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  disclaimerCard: { backgroundColor: Colors.warning, padding: spacing.md, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: Colors.warningText },
  disclaimerTitle: { fontSize: 12, fontWeight: '800', color: Colors.warningText, marginBottom: 4 },
  disclaimerBody: { fontSize: 11, color: '#78350F' },
  chipsRow: { marginBottom: spacing.sm },
  chip: { backgroundColor: Colors.cardWhite, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 99, marginRight: spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.slate },
  recorderCard: { backgroundColor: Colors.cardWhite, padding: spacing.lg, borderRadius: 24, borderWidth: 1, borderColor: Colors.cardBorder, gap: spacing.md },
  recordingActive: { borderColor: Colors.danger, borderWidth: 2 },
  recorderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  recorderTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  timer: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  micButton: { alignSelf: 'center', width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: Colors.primaryLight },
  micPulsing: { backgroundColor: Colors.alert },
  micIcon: { fontSize: 32 },
  transcriptBox: { backgroundColor: '#F8FAFC', padding: spacing.md, borderRadius: 16 },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  transcriptLabel: { fontSize: 10, fontWeight: '700', color: Colors.slate },
  editLink: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  input: { fontSize: 14, fontWeight: '700', color: Colors.ink, minHeight: 40 },
  transcribingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  transcribingText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center' },
  cancelText: { fontWeight: '700', color: Colors.slate },
  askBtn: { flex: 1, padding: spacing.md, backgroundColor: Colors.primary, borderRadius: 12, alignItems: 'center' },
  askText: { color: '#FFF', fontWeight: '800' },
  advisoryCard: { backgroundColor: Colors.cardWhite, padding: spacing.lg, borderRadius: 24, borderWidth: 2, borderColor: Colors.primary },
  diagnosis: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  scientific: { fontSize: 12, fontStyle: 'italic', color: Colors.slate, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: spacing.md },
  recTitle: { fontSize: 13, fontWeight: '800', color: Colors.ink, marginBottom: 4 },
  recBody: { fontSize: 14, lineHeight: 22, color: Colors.slate },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  listenBtn: { flex: 1, backgroundColor: Colors.primarySoft, padding: spacing.sm, borderRadius: 10, alignItems: 'center' },
  saveBtn: { flex: 1, backgroundColor: '#F1F5F9', padding: spacing.sm, borderRadius: 10, alignItems: 'center' },
  footerBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  sourceChip: { alignSelf: 'flex-start', backgroundColor: '#E8F5E9', color: Colors.primary, fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  errorCard: { backgroundColor: Colors.alert, borderRadius: 14, padding: spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.alertText },
  errorText: { fontSize: 12, fontWeight: '700', color: Colors.alertText, lineHeight: 18 },
  weatherWarning: { backgroundColor: Colors.warning, borderRadius: 14, padding: spacing.md, marginTop: spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.warningText },
  weatherWarnText: { fontSize: 12, fontWeight: '700', color: '#78350F', lineHeight: 19 },
});
