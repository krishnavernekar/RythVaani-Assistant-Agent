import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getDict } from '../i18n/translations';
import { playIndicVoice, SarvamLang } from '../services/sarvamVoiceService';
import {
  fetchMandiCommodities,
  getBenchmarkFeed,
  MANDI_YARDS,
  MandiCommodity,
  MandiFeed,
  MandiYardId,
} from '../services/mandiService';

type CropFilter = 'all' | 'chilli' | 'paddy' | 'cotton';

// ─── Helpers ──────────────────────────────────────────────────────────────
const formatINR = (amount: number): string =>
  '₹' + amount.toLocaleString('en-IN');

const formatBags = (bags: number): string => bags.toLocaleString('en-IN');

const CROP_FILTERS: { key: CropFilter; labelEn: string; labelTe: string }[] = [
  { key: 'all', labelEn: '🌱 All Crops', labelTe: '🌱 అన్ని పంటలు' },
  { key: 'chilli', labelEn: '🌶️ Chilli', labelTe: '🌶️ మిర్చి' },
  { key: 'paddy', labelEn: '🌾 Paddy', labelTe: '🌾 వరి' },
  { key: 'cotton', labelEn: '🧶 Cotton', labelTe: '🧶 పత్తి' },
];

// ─── Component ────────────────────────────────────────────────────────────
export default function MandiMarketScreen() {
  const navigation = useNavigation<any>();
  const { language } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';
  const sarvamLang: SarvamLang =
    language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';

  // Yard / crop filters
  const [selectedYardId, setSelectedYardId] =
    useState<MandiYardId>('guntur-mirchi');
  const [cropFilter, setCropFilter] = useState<CropFilter>('all');

  // Feed starts with verified benchmarks so cards never flash empty.
  const [feed, setFeed] = useState<MandiFeed>(() => getBenchmarkFeed());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Audio bulletin playback
  const [playing, setPlaying] = useState(false);

  const loadRates = useCallback(async () => {
    const next = await fetchMandiCommodities();
    setFeed(next);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await fetchMandiCommodities();
      if (!active) return;
      setFeed(next);
      setLoading(false);
    })();
    return () => {
      active = false;
      stopSpeaking();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRates();
    setRefreshing(false);
  }, [loadRates]);

  const filtered = feed.commodities.filter(
    (commodity) =>
      commodity.yardId === selectedYardId &&
      (cropFilter === 'all' || commodity.category === cropFilter),
  );

  // Generate Telugu voice bulletin text from the currently visible cards.
  const generateBulletin = (): string => {
    if (filtered.length === 0) {
      return isTe
        ? 'ఎంపిక చేసిన యార్డులో ఈ పంటకు ధరలు అందుబాటులో లేవు.'
        : 'No commodity prices are available for the selected yard and crop.';
    }
    const lines = filtered.map((commodity) => {
      const delta = commodity.priceChange >= 0 ? '↑' : '↓';
      const deltaText = isTe
        ? `${delta} ${formatINR(Math.abs(commodity.priceChange))} (${commodity.priceChangePct.toFixed(1)}% ${commodity.source === 'live' ? 'APMC బెంచ్‌మార్క్‌తో పోలిస్తే' : 'నిన్నటితో పోలిస్తే'})`
        : `${delta} ${formatINR(Math.abs(commodity.priceChange))} (${commodity.priceChangePct.toFixed(1)}% ${commodity.source === 'live' ? 'vs APMC baseline' : 'vs yesterday'})`;
      return `${isTe ? commodity.varietyTe : commodity.varietyEn}, ${isTe ? commodity.gradeTe : commodity.grade}, ${isTe ? 'మాడల్ ధర' : 'Modal'}: ${formatINR(commodity.modalPrice)} / ${isTe ? 'క్వింటాల్' : 'quintal'}. ${deltaText}.`;
    });
    return lines.join(' ');
  };

  const playBulletin = async () => {
    const text = generateBulletin();
    setPlaying(true);
    try {
      await playIndicVoice(text, sarvamLang, () =>
        speak(text, { language: sarvamLang }),
      );
    } finally {
      setPlaying(false);
    }
  };

  const feedTime = new Date(feed.fetchedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isLive = feed.source === 'live';

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader
        subtitle={`${dict.market.selectYard} • RythuVaani`}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Yard selector card ── */}
        <View style={styles.yardCard}>
          <Text style={styles.cardTitle}>
            {isTe ? '🏛️ యార్డు ఎంపిక' : '🏛️ Select Market Yard'}
          </Text>
          <View style={styles.yardRow}>
            {MANDI_YARDS.map((yard) => (
              <TouchableOpacity
                key={yard.id}
                style={[
                  styles.yardPill,
                  selectedYardId === yard.id && styles.yardPillActive,
                ]}
                onPress={() => setSelectedYardId(yard.id)}
              >
                <Text
                  style={[
                    styles.yardPillText,
                    selectedYardId === yard.id && styles.yardPillTextActive,
                  ]}
                >
                  {isTe ? yard.nameTe : yard.nameEn}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Crop filter pills ── */}
        <View style={styles.cropRow}>
          {CROP_FILTERS.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.chip,
                cropFilter === chip.key && styles.chipActive,
              ]}
              onPress={() => setCropFilter(chip.key)}
            >
              <Text
                style={[
                  styles.chipText,
                  cropFilter === chip.key && styles.chipTextActive,
                ]}
              >
                {isTe ? chip.labelTe : chip.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Live / benchmark status banner ── */}
        <View
          style={[
            styles.statusBanner,
            !isLive && styles.statusBannerBenchmark,
          ]}
        >
          <View
            style={[styles.statusDot, !isLive && styles.statusDotBenchmark]}
          />
          <Text style={styles.statusText}>
            {isLive ? '🟢 Live Agmarknet' : '📊 APMC Benchmark'}
            {' • '}
            <Text style={isLive ? styles.statusOpen : styles.statusClosed}>
              {isLive
                ? `${feed.liveCount} ${isTe ? 'లైవ్ రికార్డులు' : 'live records'}`
                : isTe
                  ? 'ఆఫ్‌లైన్-సేఫ్ ధరలు'
                  : 'Offline-safe rates'}
            </Text>
            {' • '}
            <Text style={styles.timeText}>{feedTime}</Text>
            {loading ? '  ' : ''}
          </Text>
          {loading && <ActivityIndicator size="small" color={Colors.primary} />}
        </View>

        {!!feed.message && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>ℹ️ {feed.message}</Text>
          </View>
        )}

        {/* ── Loading hint (benchmarks are already visible) ── */}
        {loading && (
          <Text style={styles.loadingHint}>
            {isTe
              ? 'లైవ్ Agmarknet ధరలు తనిఖీ చేస్తోంది…'
              : 'Checking live Agmarknet rates…'}
          </Text>
        )}

        {/* ── Commodity rate cards ── */}
        {filtered.map((commodity) => (
          <CommodityCard
            key={commodity.id}
            commodity={commodity}
            isTe={isTe}
          />
        ))}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {isTe
                ? 'ఈ యార్డులో ఎంపిక చేసిన పంట ధరలు లేవు. వేరొక యార్డు లేదా పంట ఎంపిక చేయండి.'
                : 'No commodities found for this yard/filter. Try another selection.'}
            </Text>
          </View>
        )}

        {/* Bottom spacer for sticky audio */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Sticky audio bulletin bar ── */}
      <View style={styles.audioBar}>
        <TouchableOpacity
          style={[styles.audioBtn, playing && styles.audioBtnPlaying]}
          onPress={playBulletin}
          disabled={playing}
        >
          <Text style={styles.audioIcon}>{playing ? '🔊' : '▶'}</Text>
          <View style={styles.audioTextContainer}>
            <Text style={styles.audioTitle}>
              {isTe ? 'రోజువారీ మండి ఆడియో బులెటిన్' : 'Daily Mandi Audio Bulletin'}
            </Text>
            <Text style={styles.audioSub}>
              {isTe
                ? '🎧 ఈరోజు ధరలు — 1 నిమిషం తెలుగు వాయిస్ రిపోర్ట్'
                : "🎧 Today's rates — 1 Min Telugu Voice Report"}
            </Text>
          </View>
          {playing && <ActivityIndicator size="small" color="#FFF" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Sub-component: commodity card ──────────────────────────────────────── */
function CommodityCard({
  commodity,
  isTe,
}: {
  commodity: MandiCommodity;
  isTe: boolean;
}) {
  const isLive = commodity.source === 'live';
  const deltaLabel = isLive
    ? isTe
      ? 'APMC బెంచ్‌మార్క్‌తో'
      : 'vs APMC baseline'
    : isTe
      ? 'నిన్నటితో'
      : 'vs Yesterday';

  return (
    <View style={styles.commodityCard}>
      <View style={styles.commodityHeader}>
        <View style={styles.commodityHeaderText}>
          <Text style={styles.commodityVariety}>
            {isTe ? commodity.varietyTe : commodity.varietyEn}
          </Text>
          <Text style={styles.commodityGrade}>
            {isTe ? commodity.gradeTe : commodity.grade}
            {commodity.dryingLot ? ` • ${commodity.dryingLot}` : ''}
          </Text>
        </View>
        <View style={styles.yardBadge}>
          <Text style={styles.yardBadgeText}>{commodity.yard}</Text>
        </View>
      </View>

      <View style={styles.sourceRow}>
        <Text
          style={[styles.sourceChip, isLive ? styles.sourceLive : styles.sourceBench]}
        >
          {isLive ? '🟢 Live Agmarknet' : '📊 APMC Benchmark'}
        </Text>
        {!!commodity.arrivalDate && (
          <Text style={styles.arrivalDate}>📅 {commodity.arrivalDate}</Text>
        )}
      </View>

      {!!commodity.marketName && (
        <Text style={styles.marketLine}>
          📍 {commodity.marketName}
          {commodity.district ? `, ${commodity.district}` : ''}
        </Text>
      )}

      <View style={styles.priceRow}>
        <View style={styles.modalPriceBlock}>
          <Text style={styles.modalLabel}>
            {isTe ? 'మాడల్ ధర' : 'Modal Price'}
          </Text>
          <Text style={styles.modalPrice}>
            {formatINR(commodity.modalPrice)}
            <Text style={styles.perUnit}> / {isTe ? 'క్వింటాల్' : 'Quintal'}</Text>
          </Text>
          <Text
            style={[
              styles.priceChange,
              commodity.priceChange >= 0 ? styles.priceUp : styles.priceDown,
            ]}
          >
            {commodity.priceChange >= 0 ? '↑' : '↓'}{' '}
            {formatINR(Math.abs(commodity.priceChange))} (
            {commodity.priceChangePct >= 0 ? '+' : ''}
            {commodity.priceChangePct.toFixed(1)}% {deltaLabel})
          </Text>
        </View>
      </View>

      <View style={styles.minMaxRow}>
        <View style={styles.minMaxItem}>
          <Text style={styles.minLabel}>{isTe ? 'కనిష్ట' : 'Min'}</Text>
          <Text style={styles.minValue}>{formatINR(commodity.minPrice)}</Text>
        </View>
        <View style={styles.minMaxItem}>
          <Text style={styles.maxLabel}>{isTe ? 'గరిష్ట' : 'Max'}</Text>
          <Text style={styles.maxValue}>{formatINR(commodity.maxPrice)}</Text>
        </View>
      </View>

      {(commodity.arrivals > 0 || commodity.traded > 0) && (
        <View style={styles.arrivalsTradedRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statLabel}>
              {isTe ? 'ఆగమనాలు' : 'Arrivals'}
            </Text>
            <Text style={styles.statValue}>
              {formatBags(commodity.arrivals)}{' '}
              {isTe ? 'బ్యాగులు' : 'Bags'}
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statIcon}>🤝</Text>
            <Text style={styles.statLabel}>
              {isTe ? 'వ్యాపారం' : 'Traded'}
            </Text>
            <Text style={styles.statValue}>
              {formatBags(commodity.traded)} {isTe ? 'బ్యాగులు' : 'Bags'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  // Yard selector
  yardCard: {
    backgroundColor: Colors.cardWhite,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: spacing.sm,
  },
  yardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  yardPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
  },
  yardPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yardPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate,
  },
  yardPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  // Crop filter pills
  cropRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardWhite,
  },
  chipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  statusBannerBenchmark: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FCD34D',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: spacing.sm,
  },
  statusDotBenchmark: {
    backgroundColor: Colors.warningText,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ink,
    flex: 1,
  },
  statusOpen: {
    color: '#15803D',
    fontWeight: '700',
  },
  statusClosed: {
    color: Colors.warningText,
    fontWeight: '700',
  },
  timeText: {
    color: Colors.slate,
    fontWeight: '700',
  },
  notice: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: {
    fontSize: 11,
    color: Colors.slate,
    lineHeight: 17,
  },
  loadingHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slate,
    textAlign: 'center',
  },
  // Commodity cards
  commodityCard: {
    backgroundColor: Colors.cardWhite,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: spacing.sm,
  },
  commodityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  commodityHeaderText: {
    flex: 1,
  },
  commodityVariety: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    lineHeight: 22,
  },
  commodityGrade: {
    fontSize: 12,
    color: Colors.slate,
    fontWeight: '600',
  },
  yardBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    maxWidth: '45%',
  },
  yardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sourceChip: {
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceLive: {
    color: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  sourceBench: {
    color: Colors.warningText,
    backgroundColor: '#FEF3C7',
  },
  arrivalDate: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.slate,
  },
  marketLine: {
    fontSize: 11,
    color: Colors.slate,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalPriceBlock: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 30,
  },
  perUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.slate,
  },
  priceChange: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  priceUp: {
    color: '#15803D',
  },
  priceDown: {
    color: '#DC2626',
  },
  minMaxRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  minMaxItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  minLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
    marginBottom: 2,
  },
  minValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
  },
  maxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
    marginBottom: 2,
  },
  maxValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
  },
  arrivalsTradedRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    borderRadius: 10,
  },
  statIcon: {
    fontSize: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.ink,
  },
  // Empty state
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.slate,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Audio bulletin bar
  audioBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.md,
  },
  audioBtnPlaying: {
    backgroundColor: '#15803D',
  },
  audioIcon: {
    fontSize: 20,
    color: '#FFF',
  },
  audioTextContainer: {
    flex: 1,
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  audioSub: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 2,
  },
});
