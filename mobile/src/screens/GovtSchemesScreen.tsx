/**
 * GovtSchemesScreen — EPIC-07 Pro (FR-04)
 * ---------------------------------------
 * • 3-step Zero-PII wizard (9 inputs): district/state, social category,
 *   income-tax exclusion, exact acres, ownership, e-Panta, crops, irrigation
 *   and the farmer's priority need.
 * • Ranked decision report: ELIGIBLE / ACTION_REQUIRED / NOT_ELIGIBLE with a
 *   match score, dynamically calculated ₹ benefit and decision priority.
 * • Full-screen scheme modal: personalised banner, ₹ breakdown, complete audio
 *   guide, tappable document checklist with progress, offline + online
 *   application steps, VAA/MAO/bank contacts, helplines and a scheme-specific
 *   Gemini/offline AI advisor with voice input.
 * • The official portal is deliberately the *secondary* action at the bottom.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
import {
  playIndicVoice,
  stopIndicVoice,
  transcribeAudio,
  SarvamLang,
} from '../services/sarvamVoiceService';
import { useAppStore } from '../store/useAppStore';
import { getDict, getLineHeight } from '../i18n/translations';
import {
  CROP_LABELS,
  DISTRICTS,
  EPANTA_LABELS,
  IRRIGATION_LABELS,
  LANDHOLDING_CLASS_LABELS,
  OWNERSHIP_LABELS,
  PRIORITY_LABELS,
  SOCIAL_CATEGORY_LABELS,
  askSchemeAiAdvisor,
  createDefaultProfile,
  evaluateSchemes,
  formatAcres,
  getStateForDistrict,
  landholdingClassOf,
  type DistrictId,
  type EPantaStatus,
  type FarmerSchemeProfile,
  type Irrigation,
  type Ownership,
  type PriorityNeed,
  type Scheme,
  type SchemeAiAnswer,
  type SchemeCategory,
  type SchemeCrop,
  type SchemeEvaluation,
  type SocialCategory,
} from '../services/schemesService';

type FilterKey = 'all' | SchemeCategory;
type WizardStep = 1 | 2 | 3;

const ALL_CROPS: SchemeCrop[] = [
  'paddy',
  'chilli',
  'cotton',
  'turmeric',
  'pulses',
];
const ALL_OWNERSHIP: Ownership[] = [
  'PATTADAR',
  'TENANT_CCRC',
  'TENANT_NO_CCRC',
  'ROFR_ASSIGNED',
];
const ALL_CATEGORIES: SocialCategory[] = ['OC_GENERAL', 'BC', 'SC', 'ST'];
const ALL_IRRIGATION: Irrigation[] = ['BOREWELL', 'CANAL', 'RAINFED'];
const ALL_PRIORITIES: PriorityNeed[] = [
  'ALL',
  'INCOME_SUPPORT',
  'IRRIGATION_SUBSIDY',
  'CROP_INSURANCE',
  'INTEREST_FREE_LOAN',
  'MACHINERY_SOLAR',
];
const ACRE_PRESETS = [1.5, 4.5, 7.5, 12];

const FILTER_PILLS: { key: FilterKey; labelEn: string; labelTe: string }[] = [
  { key: 'all', labelEn: 'All Schemes', labelTe: 'అన్ని పథకాలు' },
  { key: 'income', labelEn: 'Income Support', labelTe: 'ఆదాయ సహాయం' },
  { key: 'insurance', labelEn: 'Crop Insurance', labelTe: 'పంట బీమా' },
  { key: 'credit', labelEn: 'Credit / Loan', labelTe: 'రుణం / అప్పు' },
  { key: 'input', labelEn: 'Input Subsidy', labelTe: 'ఇన్‌పుట్ సబ్సిడీ' },
  { key: 'solar', labelEn: 'Solar & Machinery', labelTe: 'సోలార్ & యంత్రాలు' },
];

const STATUS_META = {
  ELIGIBLE: {
    icon: '✅',
    bg: '#DCFCE7',
    border: '#16A34A',
    text: '#15803D',
    en: 'ELIGIBLE',
    te: 'అర్హత ఉంది',
  },
  ACTION_REQUIRED: {
    icon: '⚠️',
    bg: '#FEF3C7',
    border: '#D97706',
    text: '#92400E',
    en: 'ACTION REQUIRED',
    te: 'చర్య అవసరం',
  },
  NOT_ELIGIBLE: {
    icon: '⛔',
    bg: '#FEF2F2',
    border: '#DC2626',
    text: '#991B1B',
    en: 'NOT ELIGIBLE',
    te: 'అర్హత లేదు',
  },
} as const;

/** Kept out of the component so render passes stay free of impure calls. */
const getBookmarkTimestamp = (): number => Date.now();

const districtLabel = (id: DistrictId, isTe: boolean): string => {
  const found = DISTRICTS.find((district) => district.id === id);
  if (!found) return id;
  return isTe ? found.te : found.en;
};

const stateLabel = (state: 'AP' | 'TG', isTe: boolean): string => {
  if (state === 'TG') return isTe ? 'తెలంగాణ' : 'Telangana';
  return isTe ? 'ఆంధ్రప్రదేశ్' : 'Andhra Pradesh';
};

const buildGuideText = (
  evaluation: SchemeEvaluation,
  isTe: boolean,
): string => {
  const { scheme } = evaluation;
  const lines: string[] = [];
  lines.push(isTe ? scheme.nameTe : scheme.nameEn);
  lines.push(
    isTe
      ? `మీకు లభించే ప్రయోజనం: ${evaluation.calculatedBenefitTe}`
      : `Your benefit: ${evaluation.calculatedBenefitEn}`,
  );
  lines.push(
    isTe
      ? `అర్హత: ${STATUS_META[evaluation.status].te}, ${evaluation.matchScore} శాతం పోలిక.`
      : `Status: ${STATUS_META[evaluation.status].en}, ${evaluation.matchScore} percent match.`,
  );
  lines.push(
    isTe
      ? `కారణం: ${evaluation.verdictReasonTe}`
      : `Reason: ${evaluation.verdictReasonEn}`,
  );
  lines.push(
    isTe
      ? `తదుపరి చర్య: ${evaluation.nextActionTe}`
      : `Next step: ${evaluation.nextActionEn}`,
  );
  lines.push(
    isTe
      ? `డబ్బు వివరాలు: ${evaluation.financialBreakdown
          .map((row) => `${row.labelTe} ${row.value}`)
          .join(', ')}.`
      : `Money breakdown: ${evaluation.financialBreakdown
          .map((row) => `${row.labelEn} ${row.value}`)
          .join(', ')}.`,
  );
  lines.push(
    isTe ? 'అవసరమైన పత్రాలు:' : 'Required documents:',
  );
  scheme.documentGuides.forEach((guide, index) => {
    lines.push(
      isTe
        ? `${index + 1}. ${guide.te}. ఇక్కడ పొందండి: ${guide.whereTe}.`
        : `${index + 1}. ${guide.en}. Get it at ${guide.whereEn}.`,
    );
  });
  lines.push(
    isTe
      ? 'ఆఫీసులో దరఖాస్తు దశలు:'
      : 'Offline application steps:',
  );
  scheme.offlineSteps.forEach((step, index) => {
    lines.push(
      isTe
        ? `${index + 1}. ${step.titleTe}. ${step.detailTe}`
        : `${index + 1}. ${step.titleEn}. ${step.detailEn}`,
    );
  });
  lines.push(
    isTe
      ? `సంప్రదించండి: ${scheme.contacts
          .map((contact) => `${contact.roleTe}, ${contact.detailTe}`)
          .join('; ')}.`
      : `Contacts: ${scheme.contacts
          .map((contact) => `${contact.roleEn}, ${contact.detailEn}`)
          .join('; ')}.`,
  );
  lines.push(
    isTe
      ? `హెల్ప్‌లైన్: ${scheme.helplines
          .map((item) => `${item.number}, ${item.labelTe}`)
          .join('; ')}.`
      : `Helplines: ${scheme.helplines
          .map((item) => `${item.number}, ${item.labelEn}`)
          .join('; ')}.`,
  );
  return lines.join(' ');
};

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function GovtSchemesScreen() {
  const navigation = useNavigation<any>();
  const {
    language,
    farmer,
    savedItems,
    addSavedItem,
    removeSavedItem,
    incrementQuestions,
  } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';
  const sarvamLang: SarvamLang =
    language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';

  const [profile, setProfile] = useState<FarmerSchemeProfile>(() =>
    createDefaultProfile(farmer),
  );
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [showResults, setShowResults] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [playingGuide, setPlayingGuide] = useState(false);
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(null);

  // Scheme modal state (kept keyed by scheme so switching never leaks data).
  const [checkedDocs, setCheckedDocs] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [aiAnswers, setAiAnswers] = useState<Record<string, SchemeAiAnswer>>(
    {},
  );
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [playingSchemeAudio, setPlayingSchemeAudio] = useState(false);
  const [playingAnswer, setPlayingAnswer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const stopRecordingRef = useRef<() => void>(() => {});

  useEffect(() => () => stopSpeaking(), []);

  // Auto-stop voice input at 30s (Sarvam Saaras accepts <= 30s files).
  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = setTimeout(() => stopRecordingRef.current(), 30000);
    return () => clearTimeout(timer);
  }, [isRecording]);

  // Cleanup an in-flight recording if the user leaves the screen.
  useEffect(
    () => () => {
      if (audioRecorder.isRecording) {
        audioRecorder.stop().catch(() => undefined);
      }
    },
    [audioRecorder],
  );

  const updateProfile = useCallback(
    <K extends keyof FarmerSchemeProfile,>(
      key: K,
      value: FarmerSchemeProfile[K],
    ) => {
      setProfile((current) => {
        const next = { ...current, [key]: value };
        if (key === 'district') {
          next.state = getStateForDistrict(value as DistrictId);
        }
        return next;
      });
    },
    [],
  );

  const evaluations = useMemo(() => {
    const list = evaluateSchemes(profile);
    return [...list].sort((a, b) => {
      if (a.decisionPriority === 0 && b.decisionPriority === 0) {
        return b.matchScore - a.matchScore;
      }
      if (a.decisionPriority === 0) return 1;
      if (b.decisionPriority === 0) return -1;
      return a.decisionPriority - b.decisionPriority;
    });
  }, [profile]);

  const actionableCount = evaluations.filter(
    (evaluation) => evaluation.status !== 'NOT_ELIGIBLE',
  ).length;
  const eligibleCount = evaluations.filter(
    (evaluation) => evaluation.status === 'ELIGIBLE',
  ).length;

  const activeEvaluation =
    evaluations.find(
      (evaluation) => evaluation.scheme.id === activeSchemeId,
    ) ?? null;

  const matchesFilters = useCallback(
    (scheme: Scheme) => {
      const term = query.trim().toLowerCase();
      const matchQuery =
        term.length === 0 ||
        scheme.nameEn.toLowerCase().includes(term) ||
        scheme.nameTe.includes(query.trim()) ||
        scheme.shortNameEn.toLowerCase().includes(term) ||
        scheme.shortNameTe.includes(query.trim());
      const matchCategory = filter === 'all' || scheme.category === filter;
      return matchQuery && matchCategory;
    },
    [filter, query],
  );

  const visibleEvaluations = evaluations.filter((evaluation) =>
    matchesFilters(evaluation.scheme),
  );
  const visibleAllSchemes = evaluations
    .map((evaluation) => evaluation.scheme)
    .filter(matchesFilters);

  const bookmarkedIds = useMemo(
    () =>
      new Set(
        savedItems
          .filter((item) => item.type === 'scheme')
          .map((item) => item.id),
      ),
    [savedItems],
  );

  const toggleBookmark = useCallback(
    (scheme: Scheme) => {
      if (bookmarkedIds.has(scheme.id)) {
        removeSavedItem(scheme.id);
        return;
      }
      addSavedItem({
        id: scheme.id,
        type: 'scheme',
        title: scheme.nameEn,
        titleTe: scheme.nameTe,
        subtitle: scheme.benefitEn,
        data: {
          category: scheme.category,
          // FarmerProfileScreen renders this as string[].
          docs: scheme.docs.map((item) => (isTe ? item.te : item.en)),
          portalUrl: scheme.portalUrl,
          source: scheme.source,
        },
        bookmarkedAt: getBookmarkTimestamp(),
      });
    },
    [addSavedItem, bookmarkedIds, isTe, removeSavedItem],
  );

  const playAudioGuide = async () => {
    const text = isTe
      ? 'గమనిక: ఆధార్, OTP లేదా బ్యాంక్ వివరాలు అవసరం లేదు. తొమ్మిది సులభమైన ఎంపికలతో మీ అర్హతను తనిఖీ చేయండి — జిల్లా, వర్గం, భూ విస్తీర్ణం, యాజమాన్యం, ఈ-పంట, పంటలు, నీటి ఆధారం మరియు ప్రాధాన్యత. వెంటనే లభించే ప్రభుత్వ పథకాలను, డబ్బు లెక్కను చూపిస్తాము.'
      : 'Note: No Aadhaar, OTP, or bank details needed. Check your eligibility with nine simple choices — district, category, exact acres, ownership, e-Panta, crops, irrigation and priority. We instantly rank the official schemes you qualify for and calculate the money.';
    setPlayingGuide(true);
    try {
      await playIndicVoice(text, sarvamLang, () =>
        speak(text, { language: sarvamLang }),
      );
    } finally {
      setPlayingGuide(false);
    }
  };

  const openScheme = useCallback((scheme: Scheme) => {
    stopSpeaking();
    stopIndicVoice();
    setQuestion('');
    setActiveSchemeId(scheme.id);
  }, []);

  const closeScheme = useCallback(() => {
    stopSpeaking();
    stopIndicVoice();
    setPlayingSchemeAudio(false);
    setPlayingAnswer(false);
    setActiveSchemeId(null);
  }, []);

  const openPortal = (scheme: Scheme) => {
    Linking.openURL(scheme.portalUrl).catch(() => {
      Alert.alert(
        isTe ? 'లింక్ తెరవలేకపోయింది' : 'Could not open link',
        `${scheme.portalUrl}\n\n${isTe ? 'దయచేసి బ్రౌజర్‌లో తెరవండి.' : 'Please open it in your browser.'}`,
      );
    });
  };

  const callNumber = (number: string) => {
    const digits = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${digits}`).catch(() => {
      Alert.alert(
        isTe ? 'కాల్ చేయలేకపోయింది' : 'Could not start call',
        number,
      );
    });
  };

  const toggleDoc = (schemeId: string, docKey: string) => {
    setCheckedDocs((current) => {
      const forScheme = current[schemeId] ?? {};
      return {
        ...current,
        [schemeId]: { ...forScheme, [docKey]: !forScheme[docKey] },
      };
    });
  };

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          isTe ? 'మైక్రోఫోన్ అనుమతి లేదు' : 'Microphone permission needed',
          isTe
            ? 'సెట్టింగ్స్‌లో మైక్రోఫోన్ అనుమతి ఇవ్వండి, లేదా ప్రశ్నను టైప్ చేయండి.'
            : 'Allow microphone access in Settings, or type your question instead.',
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (error) {
      console.error('[Schemes] Failed to start recording:', error);
      Alert.alert(
        isTe ? 'రికార్డింగ్ ప్రారంభించలేకపోయింది' : 'Could not start recording',
        isTe ? 'దయచేసి మళ్లీ ప్రయత్నించండి.' : 'Please try again.',
      );
    }
  };

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;
      setTranscribing(true);
      const transcript = await transcribeAudio(uri, sarvamLang);
      if (transcript) {
        setQuestion((current) =>
          current.trim().length > 0 ? `${current} ${transcript}` : transcript,
        );
      } else {
        Alert.alert(
          isTe ? 'వాయిస్ టైపింగ్ అందుబాటులో లేదు' : 'Voice typing unavailable',
          isTe
            ? 'దయచేసి మీ ప్రశ్నను టైప్ చేయండి. మైక్రోఫోన్ రికార్డింగ్ మాత్రమే పరిక్షించబడింది.'
            : 'Please type your question. The recording is safe but speech-to-text is not configured.',
        );
      }
    } catch (error) {
      console.error('[Schemes] Failed to stop recording:', error);
    } finally {
      setTranscribing(false);
    }
  }, [audioRecorder, isTe, sarvamLang]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const askAdvisor = useCallback(
    async (evaluation: SchemeEvaluation, preset?: string) => {
      const asked = (preset ?? question).trim();
      if (asked.length === 0 || asking) return;
      setAsking(true);
      try {
        const answer = await askSchemeAiAdvisor(
          evaluation.scheme,
          profile,
          asked,
          language,
        );
        setAiAnswers((current) => ({
          ...current,
          [evaluation.scheme.id]: answer,
        }));
        incrementQuestions();
      } catch (error) {
        console.error('[Schemes] AI advisor failed:', error);
        Alert.alert(
          isTe ? 'సలహాదారు లోపం' : 'Advisor error',
          isTe
            ? 'దయచేసి మళ్లీ ప్రయత్నించండి.'
            : 'Please try again in a moment.',
        );
      } finally {
        setAsking(false);
      }
    },
    [asking, incrementQuestions, isTe, language, profile, question],
  );

  const listenSchemeGuide = async (evaluation: SchemeEvaluation) => {
    if (playingSchemeAudio) {
      stopSpeaking();
      stopIndicVoice();
      setPlayingSchemeAudio(false);
      return;
    }
    const text = buildGuideText(evaluation, isTe);
    setPlayingSchemeAudio(true);
    try {
      await playIndicVoice(text, sarvamLang, () =>
        speak(text, { language: sarvamLang }),
      );
    } finally {
      setPlayingSchemeAudio(false);
    }
  };

  const listenAnswer = async (answer: SchemeAiAnswer) => {
    if (playingAnswer) {
      stopSpeaking();
      stopIndicVoice();
      setPlayingAnswer(false);
      return;
    }
    const text = isTe ? answer.answerTe : answer.answerEn;
    setPlayingAnswer(true);
    try {
      await playIndicVoice(text, sarvamLang, () =>
        speak(text, { language: sarvamLang }),
      );
    } finally {
      setPlayingAnswer(false);
    }
  };

  const steps = [
    {
      num: 1 as WizardStep,
      labelEn: 'State & District',
      labelTe: 'రాష్ట్రం & జిల్లా',
    },
    {
      num: 2 as WizardStep,
      labelEn: 'Land & Ownership',
      labelTe: 'భూమి & యాజమాన్యం',
    },
    {
      num: 3 as WizardStep,
      labelEn: 'Crops & Priority',
      labelTe: 'పంటలు & ప్రాధాన్యత',
    },
  ];

  const profileSummary = [
    `${districtLabel(profile.district, isTe)} • ${stateLabel(profile.state, isTe)}`,
    formatAcres(profile.acres),
    isTe
      ? SOCIAL_CATEGORY_LABELS[profile.socialCategory].te
      : SOCIAL_CATEGORY_LABELS[profile.socialCategory].en,
    isTe
      ? OWNERSHIP_LABELS[profile.ownership].te
      : OWNERSHIP_LABELS[profile.ownership].en,
    profile.crops.length > 0
      ? profile.crops
          .map((crop) => (isTe ? CROP_LABELS[crop].te : CROP_LABELS[crop].en))
          .join(', ')
      : isTe
        ? 'పంట ఎంపిక లేదు'
        : 'No crop selected',
    isTe
      ? PRIORITY_LABELS[profile.priorityNeed].te
      : PRIORITY_LABELS[profile.priorityNeed].en,
  ];

  const activeChecks = activeEvaluation
    ? (checkedDocs[activeEvaluation.scheme.id] ?? {})
    : {};
  const activeAnswer = activeEvaluation
    ? aiAnswers[activeEvaluation.scheme.id]
    : undefined;
  const checkedCount = activeEvaluation
    ? activeEvaluation.scheme.documentGuides.filter(
        (guide) => activeChecks[guide.key],
      ).length
    : 0;

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader
        subtitle={isTe ? 'రైతువాణి • పథకాలు' : 'RythuVaani Schemes'}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Search Bar ── */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={dict.schemes.searchPlaceholder}
            placeholderTextColor={Colors.slateLight}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="always"
          />
          <TouchableOpacity
            onPress={() => setQuery('')}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.micBtn}
            onPress={playAudioGuide}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.micIcon}>{playingGuide ? '🔊' : '🎙️'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Audio Guide Banner ── */}
        <TouchableOpacity
          style={[
            styles.audioGuideCard,
            playingGuide && styles.audioGuidePlaying,
          ]}
          onPress={playAudioGuide}
          activeOpacity={0.85}
        >
          <View style={styles.audioGuideLeft}>
            <View
              style={[styles.playBtn, playingGuide && styles.playBtnPlaying]}
            >
              <Text style={styles.playIcon}>{playingGuide ? '⏸' : '▶'}</Text>
            </View>
            <View style={styles.audioGuideText}>
              <Text style={styles.audioGuideTitle}>
                {dict.schemes.audioGuide}
              </Text>
              <Text style={styles.audioGuideSub}>
                {dict.schemes.audioGuideSub}
              </Text>
            </View>
          </View>
          <Text style={styles.listenPill}>
            {playingGuide ? '⏸' : dict.common.listen}
          </Text>
        </TouchableOpacity>

        {/* ── Filter Pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_PILLS.map((pill) => (
            <TouchableOpacity
              key={pill.key}
              style={[
                styles.filterPill,
                filter === pill.key && styles.filterPillActive,
              ]}
              onPress={() => setFilter(pill.key)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filter === pill.key && styles.filterPillTextActive,
                ]}
              >
                {isTe ? pill.labelTe : pill.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── 3-Step Wizard Card ── */}
        <View style={styles.wizardCard}>
          <View style={styles.stepIndicatorRow}>
            {steps.map((step, index) => (
              <View key={step.num} style={styles.stepIndicatorCol}>
                <View
                  style={[
                    styles.stepCircle,
                    step.num <= wizardStep && styles.stepCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      step.num <= wizardStep && styles.stepCircleTextActive,
                    ]}
                  >
                    {step.num < wizardStep || showResults ? '✓' : step.num}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    step.num <= wizardStep && styles.stepLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {isTe ? step.labelTe : step.labelEn}
                </Text>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      step.num < wizardStep && styles.stepLineActive,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          <View style={styles.privacyBadge}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>{dict.schemes.privacyNote}</Text>
          </View>

          {/* ── Step 1: district / category / exclusion ── */}
          {wizardStep === 1 && (
            <>
              <View style={styles.stepTitleRow}>
                <Text style={styles.sectionTitle}>
                  {isTe
                    ? 'దశ 1/3 — రాష్ట్రం & జిల్లా'
                    : 'Step 1/3 — State & District'}
                </Text>
                <Text style={styles.sectionProgress}>33%</Text>
              </View>

              <Text style={styles.fieldLabel}>
                {isTe ? 'జిల్లా ఎంచుకోండి' : 'Select your district'}
              </Text>
              <View style={styles.optionRow}>
                {DISTRICTS.map((district) => {
                  const active = profile.district === district.id;
                  return (
                    <TouchableOpacity
                      key={district.id}
                      style={[
                        styles.optionPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() => updateProfile('district', district.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {isTe ? district.te : district.en}
                        {district.state === 'TG' ? ' ⊙' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.stateBadge}>
                <Text style={styles.stateBadgeText}>
                  🏛️{' '}
                  {isTe
                    ? `రాష్ట్రం: ${stateLabel(profile.state, true)}`
                    : `State: ${stateLabel(profile.state, false)}`}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>
                {isTe ? 'సామాజిక వర్గం' : 'Social category'}
              </Text>
              <View style={styles.optionRow}>
                {ALL_CATEGORIES.map((category) => {
                  const active = profile.socialCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.optionPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() => updateProfile('socialCategory', category)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {isTe
                          ? SOCIAL_CATEGORY_LABELS[category].te
                          : SOCIAL_CATEGORY_LABELS[category].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                {isTe
                  ? 'కుటుంబంలో ఆదాయపు పన్ను చెల్లింపుదారు / ప్రభుత్వ ఉద్యోగి / నెలకు ₹10,000కు పైగా పెన్షన్ ఉందా?'
                  : 'Does anyone in the family pay income tax, work for the government, or receive a pension above ₹10,000/month?'}
              </Text>
              <View style={styles.optionRow}>
                {[
                  { value: false, en: 'No', te: 'లేదు' },
                  { value: true, en: 'Yes', te: 'ఉంది' },
                ].map((choice) => {
                  const active = profile.excludedByIncomeTax === choice.value;
                  return (
                    <TouchableOpacity
                      key={String(choice.value)}
                      style={[
                        styles.optionPill,
                        active && styles.optionPillActive,
                        active &&
                          choice.value &&
                          styles.optionPillWarning,
                      ]}
                      onPress={() =>
                        updateProfile('excludedByIncomeTax', choice.value)
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                          active &&
                            choice.value &&
                            styles.optionTextWarning,
                        ]}
                      >
                        {isTe ? choice.te : choice.en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.helperText}>
                {isTe
                  ? 'ఆధార్, OTP లేదా బ్యాంక్ వివరాలు అడగము. ఈ సమాధానాలు మీ ఫోన్‌లోనే ఉంటాయి.'
                  : 'We never ask for Aadhaar, OTP or bank details. These answers stay on your phone.'}
              </Text>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => {
                  setShowResults(false);
                  setWizardStep(2);
                }}
              >
                <Text style={styles.continueBtnText}>
                  {isTe
                    ? 'తదుపరి — భూమి & యాజమాన్యం (2/3) →'
                    : 'Next — Land & Ownership (2/3) →'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: acres / ownership / e-Panta ── */}
          {wizardStep === 2 && (
            <>
              <View style={styles.stepTitleRow}>
                <Text style={styles.sectionTitle}>
                  {isTe
                    ? 'దశ 2/3 — భూమి & యాజమాన్యం'
                    : 'Step 2/3 — Land & Ownership'}
                </Text>
                <Text style={styles.sectionProgress}>66%</Text>
              </View>

              <Text style={styles.fieldLabel}>
                {isTe ? 'సాగు చేసే ఖచ్చితమైన ఎకరాలు' : 'Exact cultivated acres'}
              </Text>
              <View style={styles.acreBox}>
                <TouchableOpacity
                  style={styles.acreAdjust}
                  onPress={() =>
                    updateProfile(
                      'acres',
                      Math.max(0.5, Math.round((profile.acres - 0.5) * 10) / 10),
                    )
                  }
                >
                  <Text style={styles.acreAdjustText}>−</Text>
                </TouchableOpacity>
                <View style={styles.acreCenter}>
                  <Text style={styles.acreValue}>
                    {formatAcres(profile.acres)}
                  </Text>
                  <Text style={styles.acreClass}>
                    {isTe
                      ? LANDHOLDING_CLASS_LABELS[
                          landholdingClassOf(profile.acres)
                        ].te
                      : LANDHOLDING_CLASS_LABELS[
                          landholdingClassOf(profile.acres)
                        ].en}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.acreAdjust}
                  onPress={() =>
                    updateProfile(
                      'acres',
                      Math.min(50, Math.round((profile.acres + 0.5) * 10) / 10),
                    )
                  }
                >
                  <Text style={styles.acreAdjustText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.optionRow}>
                {ACRE_PRESETS.map((preset) => {
                  const active = profile.acres === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.cropPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() => updateProfile('acres', preset)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {preset === 12 ? '12+' : preset} ac
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                {isTe ? 'భూ యాజమాన్యం' : 'Land ownership'}
              </Text>
              <View style={styles.optionRow}>
                {ALL_OWNERSHIP.map((ownership) => {
                  const active = profile.ownership === ownership;
                  return (
                    <TouchableOpacity
                      key={ownership}
                      style={[
                        styles.optionPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() => updateProfile('ownership', ownership)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                          { lineHeight: getLineHeight(12, language) },
                        ]}
                      >
                        {isTe
                          ? OWNERSHIP_LABELS[ownership].te
                          : OWNERSHIP_LABELS[ownership].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                {isTe
                  ? 'RBK / RSK లో ఈ-పంట నమోదు'
                  : 'e-Panta (e-Crop) registration at RBK/RSK'}
              </Text>
              <View style={styles.optionRow}>
                {(['REGISTERED', 'NOT_REGISTERED'] as EPantaStatus[]).map(
                  (status) => {
                    const active = profile.ePanta === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.optionPill,
                          active && styles.optionPillActive,
                        ]}
                        onPress={() => updateProfile('ePanta', status)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            active && styles.optionTextActive,
                          ]}
                        >
                          {isTe
                            ? EPANTA_LABELS[status].te
                            : EPANTA_LABELS[status].en}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              <View style={styles.liveCountBadge}>
                <Text style={styles.liveCountText}>
                  {isTe
                    ? `✅ ${actionableCount} పథకాలు మీకు అందుబాటులో ఉన్నాయి`
                    : `✅ ${actionableCount} schemes are within reach`}
                </Text>
              </View>

              <View style={styles.wizardActions}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setWizardStep(1)}
                >
                  <Text style={styles.backBtnText}>
                    {isTe ? '← వెనుక' : '← Back'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.continueBtnFlex}
                  onPress={() => {
                    setShowResults(false);
                    setWizardStep(3);
                  }}
                >
                  <Text style={styles.continueBtnText}>
                    {isTe
                      ? 'తదుపరి — పంటలు & ప్రాధాన్యత (3/3) →'
                      : 'Next — Crops & Priority (3/3) →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 3: crops / irrigation / priority ── */}
          {wizardStep === 3 && (
            <>
              <View style={styles.stepTitleRow}>
                <Text style={styles.sectionTitle}>
                  {isTe
                    ? 'దశ 3/3 — పంటలు & ప్రాధాన్యత'
                    : 'Step 3/3 — Crops & Priority'}
                </Text>
                <Text style={styles.sectionProgress}>100%</Text>
              </View>

              <Text style={styles.fieldLabel}>
                {isTe
                  ? 'సాగు చేసే పంటలు (ఒకటి లేదా ఎక్కువ)'
                  : 'Crops cultivated (select one or more)'}
              </Text>
              <View style={styles.optionRow}>
                {ALL_CROPS.map((crop) => {
                  const active = profile.crops.includes(crop);
                  return (
                    <TouchableOpacity
                      key={crop}
                      style={[
                        styles.cropPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() =>
                        updateProfile(
                          'crops',
                          active
                            ? profile.crops.filter((item) => item !== crop)
                            : [...profile.crops, crop],
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {active ? '✓ ' : ''}
                        {isTe ? CROP_LABELS[crop].te : CROP_LABELS[crop].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                {isTe ? 'ప్రధాన నీటి ఆధారం' : 'Main irrigation source'}
              </Text>
              <View style={styles.optionRow}>
                {ALL_IRRIGATION.map((irrigation) => {
                  const active = profile.irrigation === irrigation;
                  return (
                    <TouchableOpacity
                      key={irrigation}
                      style={[
                        styles.optionPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() => updateProfile('irrigation', irrigation)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {isTe
                          ? IRRIGATION_LABELS[irrigation].te
                          : IRRIGATION_LABELS[irrigation].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                {isTe
                  ? 'ఇప్పుడు మీకు అత్యంత ముఖ్యమైన అవసరం'
                  : 'What do you need most right now?'}
              </Text>
              <View style={styles.optionRow}>
                {ALL_PRIORITIES.map((priority) => {
                  const active = profile.priorityNeed === priority;
                  return (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.optionPill,
                        active && styles.optionPillActive,
                      ]}
                      onPress={() => updateProfile('priorityNeed', priority)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {isTe
                          ? PRIORITY_LABELS[priority].te
                          : PRIORITY_LABELS[priority].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.liveCountBadge}>
                <Text style={styles.liveCountText}>
                  {isTe
                    ? `✅ ${eligibleCount} పథకాలకు పూర్తి అర్హత, ${actionableCount} పథకాలు చర్యతో అందుబాటులో`
                    : `✅ ${eligibleCount} fully eligible, ${actionableCount} within reach with one action`}
                </Text>
              </View>

              <View style={styles.wizardActions}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setWizardStep(2)}
                >
                  <Text style={styles.backBtnText}>
                    {isTe ? '← వెనుక' : '← Back'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.continueBtnFlex}
                  onPress={() => setShowResults(true)}
                >
                  <Text style={styles.continueBtnText}>
                    {isTe
                      ? 'నా నిర్ణయ నివేదిక చూడండి →'
                      : 'View my decision report →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── Ranked decision report ── */}
        {showResults && (
          <View style={styles.reportWrap}>
            <View style={styles.reportHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle}>
                  {isTe
                    ? '📋 మీ నిర్ణయ నివేదిక'
                    : '📋 Your Decision Report'}
                </Text>
                <Text
                  style={[
                    styles.reportSub,
                    { lineHeight: getLineHeight(11, language) },
                  ]}
                >
                  {isTe
                    ? 'ఆర్థిక ప్రయోజనం మరియు అత్యవసరత ఆధారంగా క్రమబద్ధీకరించబడింది. మొదటి పథకం నుండి ప్రారంభించండి.'
                    : 'Ranked by net financial impact and urgency. Start from #1 and work down.'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setShowResults(false);
                  setWizardStep(2);
                }}
              >
                <Text style={styles.editBtnText}>
                  {isTe ? 'మార్చండి' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileSummary}>
              <Text
                style={[
                  styles.profileSummaryText,
                  { lineHeight: getLineHeight(11, language) },
                ]}
              >
                {profileSummary.join(' • ')}
              </Text>
            </View>

            {visibleEvaluations.length === 0 ? (
              <View style={styles.noMatch}>
                <Text style={styles.noMatchText}>
                  {isTe
                    ? 'ఈ శోధన/ఫిల్టర్‌కు పథకాలు లేవు. వేరొక ఫిల్టర్ ఎంచుకోండి.'
                    : 'No schemes match this search/filter. Try another filter.'}
                </Text>
              </View>
            ) : (
              visibleEvaluations.map((evaluation) => (
                <EvaluationCard
                  key={evaluation.scheme.id}
                  evaluation={evaluation}
                  isTe={isTe}
                  language={language}
                  isBookmarked={bookmarkedIds.has(evaluation.scheme.id)}
                  onBookmark={() => toggleBookmark(evaluation.scheme)}
                  onOpen={() => openScheme(evaluation.scheme)}
                />
              ))
            )}
          </View>
        )}

        {/* ── Official scheme directory ── */}
        {!showResults && (
          <>
            <View style={styles.directoryHeader}>
              <Text style={styles.directoryTitle}>
                {isTe ? '🏛️ అధికారిక పథకాలు' : '🏛️ Official Schemes'} •{' '}
                {visibleAllSchemes.length}
              </Text>
              <Text
                style={[
                  styles.directorySub,
                  { lineHeight: getLineHeight(11, language) },
                ]}
              >
                {isTe
                  ? 'పథకంపై నొక్కి పూర్తి వివరాలు, పత్రాలు మరియు AI సలహా పొందండి'
                  : 'Tap any scheme for full details, documents and AI advice'}
              </Text>
            </View>

            {visibleAllSchemes.map((scheme) => (
              <DirectoryCard
                key={scheme.id}
                scheme={scheme}
                isTe={isTe}
                language={language}
                isBookmarked={bookmarkedIds.has(scheme.id)}
                onBookmark={() => toggleBookmark(scheme)}
                onOpen={() => openScheme(scheme)}
              />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Full-screen scheme guide + AI advisor ── */}
      <Modal
        visible={activeEvaluation !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeScheme}
      >
        {activeEvaluation !== null && (
          <View style={styles.modalScreen}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={closeScheme}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalCategory}>
                  {isTe
                    ? activeEvaluation.scheme.categoryLabelTe
                    : activeEvaluation.scheme.categoryLabelEn}
                </Text>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {isTe
                    ? activeEvaluation.scheme.nameTe
                    : activeEvaluation.scheme.nameEn}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalBookmarkBtn}
                onPress={() => toggleBookmark(activeEvaluation.scheme)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalBookmarkIcon}>
                  {bookmarkedIds.has(activeEvaluation.scheme.id) ? '🔖' : '📑'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Personalised banner */}
              <View
                style={[
                  styles.verdictBanner,
                  {
                    backgroundColor:
                      STATUS_META[activeEvaluation.status].bg,
                    borderColor: STATUS_META[activeEvaluation.status].border,
                  },
                ]}
              >
                <View style={styles.verdictTopRow}>
                  <Text style={styles.verdictIcon}>
                    {STATUS_META[activeEvaluation.status].icon}
                  </Text>
                  <Text
                    style={[
                      styles.verdictLabel,
                      { color: STATUS_META[activeEvaluation.status].text },
                    ]}
                  >
                    {isTe
                      ? STATUS_META[activeEvaluation.status].te
                      : STATUS_META[activeEvaluation.status].en}
                  </Text>
                  {activeEvaluation.decisionPriority > 0 && (
                    <Text style={styles.priorityChip}>
                      #{activeEvaluation.decisionPriority}{' '}
                      {isTe ? 'ప్రాధాన్యత' : 'priority'}
                    </Text>
                  )}
                  <Text style={styles.scoreChip}>
                    {activeEvaluation.matchScore}% {isTe ? 'పోలిక' : 'match'}
                  </Text>
                </View>
                <View style={styles.scoreTrack}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        width: `${activeEvaluation.matchScore}%`,
                        backgroundColor:
                          STATUS_META[activeEvaluation.status].border,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.verdictBenefit,
                    { lineHeight: getLineHeight(14, language) },
                  ]}
                >
                  {isTe
                    ? activeEvaluation.calculatedBenefitTe
                    : activeEvaluation.calculatedBenefitEn}
                </Text>
              </View>

              {/* Why / next action */}
              <View style={styles.reasonCard}>
                <Text
                  style={[
                    styles.reasonText,
                    { lineHeight: getLineHeight(12, language) },
                  ]}
                >
                  {isTe
                    ? activeEvaluation.verdictReasonTe
                    : activeEvaluation.verdictReasonEn}
                </Text>
                <Text style={styles.nextActionLabel}>
                  {isTe ? '👉 తదుపరి చర్య' : '👉 Next action'}
                </Text>
                <Text
                  style={[
                    styles.nextActionText,
                    { lineHeight: getLineHeight(12, language) },
                  ]}
                >
                  {isTe
                    ? activeEvaluation.nextActionTe
                    : activeEvaluation.nextActionEn}
                </Text>
              </View>

              {/* ₹ breakdown */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeading}>
                  💰 {isTe ? 'డబ్బు వివరాలు' : 'Money breakdown'}
                </Text>
                {activeEvaluation.financialBreakdown.map((row, index) => (
                  <View
                    key={`${activeEvaluation.scheme.id}-row-${index}`}
                    style={[
                      styles.breakdownRow,
                      row.emphasis && styles.breakdownRowEmphasis,
                    ]}
                  >
                    <Text
                      style={[
                        styles.breakdownLabel,
                        row.emphasis && styles.breakdownLabelEmphasis,
                        { lineHeight: getLineHeight(12, language) },
                      ]}
                    >
                      {isTe ? row.labelTe : row.labelEn}
                    </Text>
                    <Text
                      style={[
                        styles.breakdownValue,
                        row.emphasis && styles.breakdownValueEmphasis,
                      ]}
                    >
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Listen complete guide */}
              <TouchableOpacity
                style={[
                  styles.listenGuideBtn,
                  playingSchemeAudio && styles.listenGuideBtnActive,
                ]}
                onPress={() => listenSchemeGuide(activeEvaluation)}
                activeOpacity={0.85}
              >
                <Text style={styles.listenGuideIcon}>
                  {playingSchemeAudio ? '⏸' : '🔊'}
                </Text>
                <Text style={styles.listenGuideText}>
                  {playingSchemeAudio
                    ? isTe
                      ? 'వినిపిస్తోంది… ఆపడానికి నొక్కండి'
                      : 'Playing… tap to stop'
                    : isTe
                      ? 'వినండి / Listen Complete Guide'
                      : '🔊 వినండి / Listen Complete Guide'}
                </Text>
              </TouchableOpacity>

              {/* Document checklist */}
              <View style={styles.sectionCard}>
                <View style={styles.docHeaderRow}>
                  <Text style={styles.sectionHeading}>
                    📄 {isTe ? 'పత్రాల జాబితా' : 'Document checklist'}
                  </Text>
                  <Text style={styles.docProgressText}>
                    {checkedCount}/{activeEvaluation.scheme.documentGuides.length}{' '}
                    {isTe ? 'సిద్ధం' : 'ready'}
                  </Text>
                </View>
                <View style={styles.docProgressTrack}>
                  <View
                    style={[
                      styles.docProgressFill,
                      {
                        width: `${
                          activeEvaluation.scheme.documentGuides.length === 0
                            ? 0
                            : Math.round(
                                (checkedCount /
                                  activeEvaluation.scheme.documentGuides
                                    .length) *
                                  100,
                              )
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.docTapHint}>
                  {isTe
                    ? 'మీరు సిద్ధం చేసుకున్న పత్రాలను నొక్కి గుర్తించండి'
                    : 'Tap each document once you have it ready'}
                </Text>
                {activeEvaluation.scheme.documentGuides.map((guide) => {
                  const done = Boolean(activeChecks[guide.key]);
                  return (
                    <TouchableOpacity
                      key={guide.key}
                      style={[
                        styles.docItem,
                        done && styles.docItemDone,
                      ]}
                      onPress={() =>
                        toggleDoc(activeEvaluation.scheme.id, guide.key)
                      }
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.docCheckbox,
                          done && styles.docCheckboxDone,
                        ]}
                      >
                        <Text style={styles.docCheckboxText}>
                          {done ? '✓' : ''}
                        </Text>
                      </View>
                      <View style={styles.docItemBody}>
                        <Text
                          style={[
                            styles.docName,
                            done && styles.docNameDone,
                            { lineHeight: getLineHeight(12, language) },
                          ]}
                        >
                          {isTe ? guide.te : guide.en}
                        </Text>
                        <Text
                          style={[
                            styles.docWhere,
                            { lineHeight: getLineHeight(11, language) },
                          ]}
                        >
                          📍 {isTe ? guide.whereTe : guide.whereEn}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Offline application steps */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeading}>
                  🏢{' '}
                  {isTe
                    ? 'ఆఫ్‌లైన్ దరఖాస్తు — RSK / RBK'
                    : 'Offline application — RSK / RBK'}
                </Text>
                {activeEvaluation.scheme.offlineSteps.map((step, index) => (
                  <View
                    key={`${activeEvaluation.scheme.id}-offline-${index}`}
                    style={styles.stepItem}
                  >
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepBody}>
                      <Text
                        style={[
                          styles.stepTitle,
                          { lineHeight: getLineHeight(12, language) },
                        ]}
                      >
                        {isTe ? step.titleTe : step.titleEn}
                      </Text>
                      <Text
                        style={[
                          styles.stepDetail,
                          { lineHeight: getLineHeight(11, language) },
                        ]}
                      >
                        {isTe ? step.detailTe : step.detailEn}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Online application steps */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeading}>
                  🌐 {isTe ? 'ఆన్‌లైన్ దరఖాస్తు' : 'Online application'}
                </Text>
                {activeEvaluation.scheme.onlineSteps.map((step, index) => (
                  <View
                    key={`${activeEvaluation.scheme.id}-online-${index}`}
                    style={styles.stepItem}
                  >
                    <View style={[styles.stepNumber, styles.stepNumberOnline]}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepBody}>
                      <Text
                        style={[
                          styles.stepTitle,
                          { lineHeight: getLineHeight(12, language) },
                        ]}
                      >
                        {isTe ? step.titleTe : step.titleEn}
                      </Text>
                      <Text
                        style={[
                          styles.stepDetail,
                          { lineHeight: getLineHeight(11, language) },
                        ]}
                      >
                        {isTe ? step.detailTe : step.detailEn}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Contacts + helplines */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeading}>
                  ☎️ {isTe ? 'ఎవరిని సంప్రదించాలి' : 'Who to contact'}
                </Text>
                {activeEvaluation.scheme.contacts.map((contact, index) => (
                  <View
                    key={`${activeEvaluation.scheme.id}-contact-${index}`}
                    style={styles.contactItem}
                  >
                    <Text style={styles.contactRole}>
                      {isTe ? contact.roleTe : contact.roleEn}
                    </Text>
                    <Text
                      style={[
                        styles.contactDetail,
                        { lineHeight: getLineHeight(11, language) },
                      ]}
                    >
                      {isTe ? contact.detailTe : contact.detailEn}
                    </Text>
                  </View>
                ))}
                <View style={styles.helplineRow}>
                  {activeEvaluation.scheme.helplines.map((item, index) => (
                    <TouchableOpacity
                      key={`${activeEvaluation.scheme.id}-helpline-${index}`}
                      style={styles.helplineBtn}
                      onPress={() => callNumber(item.number)}
                    >
                      <Text style={styles.helplineLabel}>
                        {isTe ? item.labelTe : item.labelEn}
                      </Text>
                      <Text style={styles.helplineNumber}>
                        📞 {item.number}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* AI advisor */}
              <View style={styles.aiCard}>
                <Text style={styles.sectionHeading}>
                  🤖{' '}
                  {isTe
                    ? 'ఈ పథకం గురించి AI ను అడగండి'
                    : 'Ask AI about this scheme'}
                </Text>
                <Text
                  style={[
                    styles.aiSub,
                    { lineHeight: getLineHeight(11, language) },
                  ]}
                >
                  {isTe
                    ? 'మీ ప్రొఫైల్ + అధికారిక నిబంధనల ఆధారంగా సమాధానం. ఆధార్, OTP లేదా బ్యాంక్ వివరాలు అడగము.'
                    : 'Answers use your profile + the official rulebook. Never asks for Aadhaar, OTP or bank details.'}
                </Text>

                <View style={styles.chipWrap}>
                  {activeEvaluation.scheme.followUps.map((followUp, index) => (
                    <TouchableOpacity
                      key={`${activeEvaluation.scheme.id}-follow-${index}`}
                      style={styles.followChip}
                      onPress={() => {
                        const text = isTe ? followUp.te : followUp.en;
                        setQuestion(text);
                        askAdvisor(activeEvaluation, text);
                      }}
                    >
                      <Text
                        style={[
                          styles.followChipText,
                          { lineHeight: getLineHeight(11, language) },
                        ]}
                      >
                        {isTe ? followUp.te : followUp.en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.askRow}>
                  <TextInput
                    style={styles.askInput}
                    placeholder={
                      isTe
                        ? 'మీ ప్రశ్న ఇక్కడ టైప్ చేయండి…'
                        : 'Type your question here…'
                    }
                    placeholderTextColor={Colors.slateLight}
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.voiceBtn,
                      isRecording && styles.voiceBtnActive,
                    ]}
                    onPress={
                      isRecording
                        ? () => stopRecordingRef.current()
                        : startRecording
                    }
                    disabled={transcribing}
                  >
                    {transcribing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.voiceBtnIcon}>
                        {isRecording ? '⏹' : '🎙️'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.askBtn,
                      (asking || question.trim().length === 0) &&
                        styles.askBtnDisabled,
                    ]}
                    onPress={() => askAdvisor(activeEvaluation)}
                    disabled={asking || question.trim().length === 0}
                  >
                    {asking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.askBtnText}>
                        {isTe ? 'అడగండి' : 'Ask'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {isRecording && (
                  <Text style={styles.recordingHint}>
                    ●{' '}
                    {isTe
                      ? 'రికార్డింగ్… ఆపడానికి ⏹ నొక్కండి (గరిష్ఠం 30 సెకన్లు)'
                      : 'Recording… tap ⏹ to stop (max 30 seconds)'}
                  </Text>
                )}

                {activeAnswer && (
                  <View style={styles.answerCard}>
                    <View style={styles.answerTopRow}>
                      <Text style={styles.answerBadge}>
                        {activeAnswer.source === 'gemini'
                          ? '✨ AI'
                          : isTe
                            ? '📚 నియమ ఆధారం'
                            : '📚 Rule-based'}
                      </Text>
                      <TouchableOpacity
                        style={styles.listenAnswerBtn}
                        onPress={() => listenAnswer(activeAnswer)}
                      >
                        <Text style={styles.listenAnswerText}>
                          {playingAnswer
                            ? isTe
                              ? '⏸ ఆపండి'
                              : '⏸ Stop'
                            : isTe
                              ? '🔊 వినండి'
                              : '🔊 Listen Answer'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[
                        styles.answerText,
                        { lineHeight: getLineHeight(12, language) },
                      ]}
                    >
                      {isTe
                        ? activeAnswer.answerTe
                        : activeAnswer.answerEn}
                    </Text>
                  </View>
                )}
              </View>

              {/* Secondary official portal action */}
              <TouchableOpacity
                style={styles.portalSecondaryBtn}
                onPress={() => openPortal(activeEvaluation.scheme)}
                activeOpacity={0.85}
              >
                <Text style={styles.portalSecondaryText}>
                  🔗{' '}
                  {isTe
                    ? activeEvaluation.scheme.portalLabelTe
                    : activeEvaluation.scheme.portalLabelEn}{' '}
                  ↗
                </Text>
                <Text style={styles.portalSecondarySub}>
                  {isTe
                    ? 'అధికారిక ప్రభుత్వ పోర్టల్ — ఇక్కడే దరఖాస్తు చేయండి'
                    : 'Official government portal — apply here'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.sourceLine}>
                {isTe ? 'మూలం' : 'Source'}: {activeEvaluation.scheme.source}
              </Text>
              <Text style={styles.disclaimerLine}>
                {isTe ? activeEvaluation.scheme.eligibilityNoteTe : activeEvaluation.scheme.eligibilityNoteEn}
              </Text>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

/* ─── Sub-component: ranked evaluation card ──────────────────────────────── */
function EvaluationCard({
  evaluation,
  isTe,
  language,
  isBookmarked,
  onBookmark,
  onOpen,
}: {
  evaluation: SchemeEvaluation;
  isTe: boolean;
  language: 'te' | 'en' | 'hi';
  isBookmarked: boolean;
  onBookmark: () => void;
  onOpen: () => void;
}) {
  const meta = STATUS_META[evaluation.status];
  const { scheme } = evaluation;

  return (
    <TouchableOpacity
      style={[styles.evalCard, { borderLeftColor: meta.border }]}
      onPress={onOpen}
      activeOpacity={0.88}
    >
      <View style={styles.evalTopRow}>
        <View style={styles.schemeTagRow}>
          <Text style={styles.categoryChip}>
            {isTe ? scheme.categoryLabelTe : scheme.categoryLabelEn}
          </Text>
          {evaluation.decisionPriority > 0 && (
            <Text style={styles.priorityBadge}>
              #{evaluation.decisionPriority}{' '}
              {isTe ? 'చేయండి' : 'do first'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={onBookmark}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.bookmarkIcon}>
            {isBookmarked ? '🔖' : '📑'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.evalName}>
        {isTe ? scheme.nameTe : scheme.nameEn}
      </Text>

      <View style={styles.evalStatusRow}>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: meta.bg, borderColor: meta.border },
          ]}
        >
          <Text style={[styles.statusPillText, { color: meta.text }]}>
            {meta.icon} {isTe ? meta.te : meta.en}
          </Text>
        </View>
        <Text style={styles.evalScore}>
          {evaluation.matchScore}% {isTe ? 'పోలిక' : 'match'}
        </Text>
      </View>

      <View style={styles.evalScoreTrack}>
        <View
          style={[
            styles.evalScoreFill,
            {
              width: `${evaluation.matchScore}%`,
              backgroundColor: meta.border,
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.evalBenefit,
          { lineHeight: getLineHeight(14, language) },
        ]}
      >
        {isTe
          ? evaluation.calculatedBenefitTe
          : evaluation.calculatedBenefitEn}
      </Text>

      <Text
        style={[
          styles.evalReason,
          { lineHeight: getLineHeight(11, language) },
        ]}
        numberOfLines={3}
      >
        {isTe
          ? evaluation.verdictReasonTe
          : evaluation.verdictReasonEn}
      </Text>

      <View style={styles.evalFooter}>
        <Text style={styles.evalDocs}>
          📄 {scheme.documentGuides.length}{' '}
          {isTe ? 'పత్రాలు' : 'documents'}
        </Text>
        <Text style={styles.evalOpen}>
          {isTe ? 'పూర్తి గైడ్ →' : 'Full guide →'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Sub-component: directory card (browse mode) ────────────────────────── */
function DirectoryCard({
  scheme,
  isTe,
  language,
  isBookmarked,
  onBookmark,
  onOpen,
}: {
  scheme: Scheme;
  isTe: boolean;
  language: 'te' | 'en' | 'hi';
  isBookmarked: boolean;
  onBookmark: () => void;
  onOpen: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.schemeCard}
      onPress={onOpen}
      activeOpacity={0.88}
    >
      <View style={styles.schemeHeader}>
        <View style={styles.schemeTagRow}>
          <Text style={styles.categoryChip}>
            {isTe ? scheme.categoryLabelTe : scheme.categoryLabelEn}
          </Text>
          <Text style={styles.docCountChip}>
            📄 {scheme.documentGuides.length}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onBookmark}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.bookmarkIcon}>
            {isBookmarked ? '🔖' : '📑'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.schemeName}>
        {isTe ? scheme.nameTe : scheme.nameEn}
      </Text>

      <Text
        style={[
          styles.benefitText,
          { lineHeight: getLineHeight(13, language) },
        ]}
      >
        {isTe ? scheme.benefitTe : scheme.benefitEn}
      </Text>

      <Text
        style={[
          styles.schemeDescription,
          { lineHeight: getLineHeight(11, language) },
        ]}
        numberOfLines={2}
      >
        {isTe ? scheme.descriptionTe : scheme.descriptionEn}
      </Text>

      <View style={styles.schemeFooter}>
        <Text style={styles.schemeSource} numberOfLines={1}>
          {scheme.source}
        </Text>
        <Text style={styles.evalOpen}>
          {isTe ? 'వివరాలు →' : 'Details →'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },

  // Search
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
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink },
  clearBtn: { padding: 4 },
  clearText: { fontSize: 14, color: Colors.slate },
  micBtn: { padding: 4 },
  micIcon: { fontSize: 16 },

  // Audio guide
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
  audioGuidePlaying: { borderColor: Colors.primary, borderWidth: 2 },
  audioGuideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnPlaying: { backgroundColor: Colors.danger },
  playIcon: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  audioGuideText: { flex: 1 },
  audioGuideTitle: { fontSize: 13, fontWeight: '800', color: Colors.ink },
  audioGuideSub: { fontSize: 11, color: Colors.slate },
  listenPill: { fontSize: 12, fontWeight: '800', color: Colors.primary },

  // Filter pills
  filterScroll: { marginLeft: -spacing.sm },
  filterContent: { gap: spacing.sm },
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
  filterPillText: { fontSize: 12, fontWeight: '600', color: Colors.slate },
  filterPillTextActive: { color: Colors.primary, fontWeight: '800' },

  // Wizard card
  wizardCard: {
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.card,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepIndicatorCol: { flex: 1, alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: Colors.primary },
  stepCircleText: { fontSize: 12, color: Colors.slate, fontWeight: '700' },
  stepCircleTextActive: { color: '#FFF' },
  stepLine: {
    position: 'absolute',
    top: 14,
    left: '55%',
    width: '90%',
    height: 2,
    backgroundColor: '#E2E8F0',
  },
  stepLineActive: { backgroundColor: Colors.primary },
  stepLabel: {
    fontSize: 9,
    color: Colors.slate,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  stepLabelActive: { color: Colors.primary, fontWeight: '700' },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  privacyIcon: { fontSize: 16 },
  privacyText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.primary },
  sectionProgress: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.ink,
    marginTop: spacing.xs,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
    maxWidth: '100%',
  },
  optionPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  optionPillWarning: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.danger,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate,
    lineHeight: 18,
  },
  optionTextActive: { color: Colors.primary, fontWeight: '800' },
  optionTextWarning: { color: Colors.danger },
  stateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  stateBadgeText: { fontSize: 11, fontWeight: '800', color: '#3730A3' },
  helperText: { fontSize: 11, color: Colors.slate, lineHeight: 17 },

  // Acres
  acreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  acreAdjust: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardWhite,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acreAdjustText: { fontSize: 22, color: Colors.primary, fontWeight: '800' },
  acreCenter: { alignItems: 'center', gap: 2 },
  acreValue: { fontSize: 22, fontWeight: '900', color: Colors.ink },
  acreClass: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  cropPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
  },
  liveCountBadge: {
    backgroundColor: Colors.successBg,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  liveCountText: { fontSize: 12, fontWeight: '800', color: '#15803D' },
  wizardActions: { flexDirection: 'row', gap: spacing.sm },
  backBtn: {
    paddingHorizontal: spacing.lg,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 13, fontWeight: '800', color: Colors.slate },
  continueBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  continueBtnFlex: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Report
  reportWrap: { gap: spacing.md },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reportTitle: { fontSize: 17, fontWeight: '900', color: Colors.ink },
  reportSub: { fontSize: 11, color: Colors.slate, marginTop: 2 },
  editBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editBtnText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  profileSummary: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slate,
    lineHeight: 17,
  },
  noMatch: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
  },
  noMatchText: {
    fontSize: 13,
    color: Colors.slate,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Directory
  directoryHeader: { gap: 2, marginTop: spacing.sm },
  directoryTitle: { fontSize: 15, fontWeight: '900', color: Colors.ink },
  directorySub: { fontSize: 11, color: Colors.slate },

  // Evaluation card
  evalCard: {
    ...tokens.card,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  evalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schemeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    flex: 1,
  },
  categoryChip: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  priorityBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bookmarkIcon: { fontSize: 20 },
  evalName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
    lineHeight: 21,
  },
  evalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 10, fontWeight: '900' },
  evalScore: { fontSize: 11, fontWeight: '800', color: Colors.slate },
  evalScoreTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  evalScoreFill: { height: 6, borderRadius: 3 },
  evalBenefit: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  evalReason: { fontSize: 11, color: Colors.slate },
  evalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingTop: spacing.sm,
  },
  evalDocs: { fontSize: 11, fontWeight: '700', color: Colors.slate },
  evalOpen: { fontSize: 12, fontWeight: '900', color: Colors.primary },

  // Directory card
  schemeCard: {
    ...tokens.card,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  schemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docCountChip: { fontSize: 10, fontWeight: '700', color: Colors.slate },
  schemeName: { fontSize: 14, fontWeight: '800', color: Colors.ink, lineHeight: 21 },
  benefitText: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  schemeDescription: { fontSize: 11, color: Colors.slate },
  schemeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  schemeSource: { flex: 1, fontSize: 9, color: Colors.slateLight },

  // Modal shell
  modalScreen: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: spacing.md,
    backgroundColor: Colors.cardWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { fontSize: 16, fontWeight: '800', color: Colors.slate },
  modalHeaderText: { flex: 1, gap: 2 },
  modalCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  modalTitle: { fontSize: 14, fontWeight: '900', color: Colors.ink, lineHeight: 20 },
  modalBookmarkBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBookmarkIcon: { fontSize: 18 },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 60,
  },

  // Verdict banner
  verdictBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  verdictTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  verdictIcon: { fontSize: 18 },
  verdictLabel: { fontSize: 13, fontWeight: '900', flex: 1 },
  priorityChip: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scoreChip: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.ink,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scoreTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.65)',
    overflow: 'hidden',
  },
  scoreFill: { height: 8, borderRadius: 4 },
  verdictBenefit: { fontSize: 14, fontWeight: '900', color: Colors.ink },

  // Reason
  reasonCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: spacing.md,
    gap: 4,
  },
  reasonText: { fontSize: 12, color: Colors.ink },
  nextActionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: spacing.sm,
  },
  nextActionText: { fontSize: 12, color: Colors.slate },

  // Generic section
  sectionCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeading: { fontSize: 13, fontWeight: '900', color: Colors.ink },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  breakdownRowEmphasis: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0,
  },
  breakdownLabel: { flex: 1, fontSize: 12, color: Colors.slate },
  breakdownLabelEmphasis: { color: Colors.ink, fontWeight: '800' },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.ink,
    textAlign: 'right',
  },
  breakdownValueEmphasis: { color: Colors.primary, fontWeight: '900' },

  // Listen guide
  listenGuideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    paddingHorizontal: spacing.md,
  },
  listenGuideBtnActive: { backgroundColor: Colors.danger },
  listenGuideIcon: { fontSize: 18, color: '#FFFFFF' },
  listenGuideText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Documents
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  docProgressText: { fontSize: 11, fontWeight: '900', color: Colors.primary },
  docProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  docProgressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  docTapHint: { fontSize: 10, color: Colors.slate, fontStyle: 'italic' },
  docItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
  },
  docItemDone: {
    backgroundColor: Colors.successBg,
    borderColor: '#86EFAC',
  },
  docCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.slateLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  docCheckboxDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  docCheckboxText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  docItemBody: { flex: 1, gap: 2 },
  docName: { fontSize: 12, fontWeight: '700', color: Colors.ink },
  docNameDone: { textDecorationLine: 'line-through', color: '#15803D' },
  docWhere: { fontSize: 11, color: Colors.slate },

  // Steps
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberOnline: { backgroundColor: '#2563EB' },
  stepNumberText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 12, fontWeight: '800', color: Colors.ink },
  stepDetail: { fontSize: 11, color: Colors.slate },

  // Contacts
  contactItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  contactRole: { fontSize: 12, fontWeight: '800', color: Colors.ink },
  contactDetail: { fontSize: 11, color: Colors.slate },
  helplineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helplineBtn: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    gap: 2,
  },
  helplineLabel: { fontSize: 10, fontWeight: '700', color: Colors.slate },
  helplineNumber: { fontSize: 13, fontWeight: '900', color: Colors.primary },

  // AI advisor
  aiCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: spacing.md,
    gap: spacing.sm,
  },
  aiSub: { fontSize: 11, color: '#5B21B6' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  followChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: Colors.cardWhite,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    maxWidth: '100%',
  },
  followChipText: { fontSize: 11, fontWeight: '700', color: '#5B21B6' },
  askRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  askInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    backgroundColor: Colors.cardWhite,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 12,
    color: Colors.ink,
  },
  voiceBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtnActive: { backgroundColor: Colors.danger },
  voiceBtnIcon: { fontSize: 18 },
  askBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtnDisabled: { backgroundColor: '#C4B5FD' },
  askBtnText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  recordingHint: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  answerCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: spacing.md,
    gap: spacing.sm,
  },
  answerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  answerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5B21B6',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  listenAnswerBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#EDE9FE',
  },
  listenAnswerText: { fontSize: 11, fontWeight: '900', color: '#5B21B6' },
  answerText: { fontSize: 12, color: Colors.ink },

  // Secondary portal
  portalSecondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
    gap: 2,
    alignItems: 'center',
  },
  portalSecondaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.slate,
    textAlign: 'center',
  },
  portalSecondarySub: { fontSize: 10, color: Colors.slateLight },
  sourceLine: { fontSize: 10, color: Colors.slateLight, textAlign: 'center' },
  disclaimerLine: {
    fontSize: 10,
    color: Colors.slate,
    textAlign: 'center',
    lineHeight: 15,
  },
});
