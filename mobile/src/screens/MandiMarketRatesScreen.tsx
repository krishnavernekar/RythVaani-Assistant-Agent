import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getDict } from '../i18n/translations';

export default function MandiMarketRatesScreen() {
  const navigation = useNavigation<any>();
  const { language } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';

  useEffect(() => () => stopSpeaking(), []);

  const playMandiAudio = () => {
    const text = isTe
      ? 'గుంటూరు మిరచి యార్డు నేటి ధరలు: తేజ మిరచి గ్రేడ్ A క్వింటాలుకు సగటు ధర ఇరవై రెండు వేలు నాలుగు వందల రూపాయలు. నిన్నటి కంటే మూడు వందలు యాభై రూపాయలు పెరిగింది.'
      : "Guntur Mirchi Yard report: Teja Chilli Grade A modal price is 22,400 rupees per quintal, up 350 rupees from yesterday.";
    speak(text, { language: isTe ? 'te-IN' : 'en-IN' });
  };

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader
        subtitle={`${dict.market.subtitle} / మార కెట్ ధరలు`}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Yard Selector */}
        <View style={styles.yardCard}>
          <View style={styles.yardHeader}>
            <Text style={styles.yardTitle}>⚙️ {'Select Market Yard'}</Text>
            <Text style={styles.changeYard}>{dict.market.changeYard}</Text>
          </View>
          <View style={styles.yardSelectGrid}>
            <View style={styles.yardSelectItem}>
              <Text style={styles.yardSelectLabel}>{dict.market.state}</Text>
              <Text style={styles.yardSelectValue}>Andhra Pradesh ▾</Text>
            </View>
            <View style={styles.yardSelectItem}>
              <Text style={styles.yardSelectLabel}>{dict.market.district}</Text>
              <Text style={styles.yardSelectValue}>Guntur ▾</Text>
            </View>
          </View>
          <View style={styles.selectedYard}>
            <Text style={styles.selectedYardText}>
              🏢 Guntur Mirchi Yard (గుంటూరు యార్డు)
            </Text>
            <Text style={styles.yardCheck}>✔</Text>
          </View>
        </View>

        {/* Live Status */}
        <View style={styles.liveStatus}>
          <Text style={styles.liveDot}>🟢</Text>
          <Text style={styles.liveText}>
            {dict.market.liveStatus}:{' '}
            {dict.market.liveStatusSub}
          </Text>
          <Text style={styles.liveTime}>11:30 AM • e-NAM</Text>
        </View>

        {/* Commodity Card */}
        <View style={styles.commodityCard}>
          <View style={styles.commodityHeader}>
            <View>
              <Text style={styles.commodityName}>
                Guntur Teja Chilli{' '}
                <Text style={styles.gradeBadge}>Grade A</Text>
              </Text>
              <Text style={styles.commoditySub}>
                తేజ మిరచి • Drying Lot
              </Text>
            </View>
            <Text style={styles.apmcBadge}>✔ APMC Guntur</Text>
          </View>

          {/* Modal Price */}
          <View style={styles.modalPriceBox}>
            <View>
              <Text style={styles.modalLabel}>
                {dict.market.modalPrice} / {dict.market.modalPriceTe}
              </Text>
              <Text style={styles.modalPriceValue}>
                ₹22,400{' '}
                <Text style={styles.perQuintal}>/ Quintal</Text>
              </Text>
            </View>
            <View style={styles.deltaBox}>
              <Text style={styles.deltaPositive}>↑ +₹350 (1.6%)</Text>
              <Text style={styles.deltaSub}>vs Yesterday</Text>
            </View>
          </View>

          {/* Min/Max Grid */}
          <View style={styles.minMaxGrid}>
            <View style={styles.minMaxItem}>
              <Text style={styles.minMaxLabel}>{dict.market.minPrice} ({dict.market.minPriceTe})</Text>
              <Text style={styles.minMaxValue}>₹18,500</Text>
            </View>
            <View style={styles.minMaxItem}>
              <Text style={styles.minMaxLabel}>{dict.market.maxPrice} ({dict.market.maxPriceTe})</Text>
              <Text style={[styles.minMaxValue, styles.maxValue]}>₹24,200</Text>
            </View>
          </View>

          {/* Arrivals / Traded */}
          <View style={styles.volumeRow}>
            <Text style={styles.volumeText}>
              📦 {dict.market.arrivals}: <Text style={styles.volumeBold}>42,500 Bags</Text>
            </Text>
            <Text style={styles.volumeText}>
              🤝 {dict.market.traded}: <Text style={styles.volumeBold}>38,200 Bags</Text>
            </Text>
          </View>
        </View>

        {/* Daily Mandi Audio Bulletin */}
        <TouchableOpacity
          style={styles.audioBulletinCard}
          onPress={playMandiAudio}
          activeOpacity={0.85}
        >
          <View style={styles.audioBulletinLeft}>
            <Text style={styles.audioPlayIcon}>▶</Text>
            <View>
              <Text style={styles.audioBulletinTitle}>
                {dict.market.audioBulletin}
              </Text>
              <Text style={styles.audioBulletinSub}>
                {dict.market.audioBulletinSub}
              </Text>
            </View>
          </View>
          <Text style={styles.audioBulletinIcon}>🔊</Text>
        </TouchableOpacity>
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
  yardCard: {
    padding: spacing.md,
    gap: spacing.sm,
    ...tokens.card,
  },
  yardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.ink,
  },
  changeYard: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  yardSelectGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yardSelectItem: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  yardSelectLabel: {
    fontSize: 10,
    color: Colors.slateLight,
    fontWeight: '600',
  },
  yardSelectValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ink,
  },
  selectedYard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  selectedYardText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  yardCheck: {
    fontSize: 16,
    color: Colors.primary,
  },
  liveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  liveDot: {
    fontSize: 12,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    flex: 1,
  },
  liveTime: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  commodityCard: {
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.card,
  },
  commodityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  commodityName: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.ink,
  },
  gradeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.warningText,
    backgroundColor: Colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
    marginLeft: spacing.xs,
  },
  commoditySub: {
    fontSize: 11,
    color: Colors.slate,
  },
  apmcBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalPriceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
  },
  modalPriceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  perQuintal: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.slate,
  },
  deltaBox: {
    alignItems: 'flex-end',
  },
  deltaPositive: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.success,
  },
  deltaSub: {
    fontSize: 10,
    color: Colors.slate,
  },
  minMaxGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  minMaxItem: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  minMaxLabel: {
    fontSize: 10,
    color: Colors.slate,
    fontWeight: '600',
    textAlign: 'center',
  },
  minMaxValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.ink,
    marginTop: 2,
  },
  maxValue: {
    color: Colors.primary,
  },
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  volumeText: {
    fontSize: 12,
    color: Colors.slate,
    fontWeight: '600',
  },
  volumeBold: {
    fontWeight: '800',
    color: Colors.ink,
  },
  audioBulletinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  audioBulletinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  audioPlayIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  audioBulletinTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  audioBulletinSub: {
    fontSize: 11,
    color: '#A5D6A7',
  },
  audioBulletinIcon: {
    fontSize: 20,
  },
});
