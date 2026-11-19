import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { QuickToolCard } from '../components/QuickToolCard';
import { CropScannerModal } from '../components/CropScannerModal';
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getDict, getLineHeight } from '../i18n/translations';
import { fetchWeather, WeatherData, FALLBACK_WEATHER } from '../services/weatherService';

export default function HomeDashboardScreen() {
  const navigation = useNavigation<any>();
  const { language, farmer } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';

  const [weatherData, setWeatherData] = useState<WeatherData>(FALLBACK_WEATHER);
  const [refreshing, setRefreshing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const loadWeather = useCallback(async () => {
    const data = await fetchWeather();
    setWeatherData(data);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWeather();
    setRefreshing(false);
  }, [loadWeather]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const data = await fetchWeather();
      if (active) setWeatherData(data);
    })();
    return () => {
      active = false;
      stopSpeaking();
    };
  }, []);

  const playAdvisory = () => {
    const text = isTe
      ? 'ఈరోజు వ్యవసాయ సలహా: గుంటూరు వరి పంటలో కాండం తొలుచు పురుగు పట్ల అప్రమత్తంగా ఉండండి. సాయంత్రం నాలుగు గంటల లోపు మందు పిచికారీ చేయండి.'
      : "Today's advisory: Alert for Paddy stem borer in Guntur. Complete spraying before 4 PM today.";
    speak(text, { language: isTe ? 'te-IN' : 'en-IN' });
  };

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader subtitle={dict.home.subtitle} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* Greeting Card */}
        <View style={tokens.card}>
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.greetingPrefix}>
                {dict.home.greetingPrefix}{' '}
                <Text style={styles.kharifBadge}>{dict.home.kharifBadge}</Text>
              </Text>
              <Text style={styles.farmerName}>{farmer.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.askAiFab}
              onPress={() => navigation.navigate('AskAgronomistScreen' as never)}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Text style={styles.askAiFabText}>🎙️</Text>
            </TouchableOpacity>
          </View>

          {/* Today's Audio Advisory */}
          <TouchableOpacity
            style={styles.advisoryCard}
            onPress={playAdvisory}
            activeOpacity={0.85}
          >
            <View style={styles.advisoryLeft}>
              <View style={styles.playBtn}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
              <View>
                <Text style={styles.advisoryTitle}>
                  {dict.home.todayAdvisory}
                </Text>
                <Text
                  style={[
                    styles.advisorySub,
                    { lineHeight: getLineHeight(11, language) },
                  ]}
                >
                  {dict.home.advisorySubtitle}
                </Text>
              </View>
            </View>
            <Text style={styles.advisoryDuration}>1:15 {dict.common.minutes}</Text>
          </TouchableOpacity>
        </View>

        {/* Weather Snapshot */}
        <View style={tokens.card}>
          <View style={styles.weatherHeader}>
            <Text style={styles.weatherTitle}>
              ☀️ {dict.home.weatherOutlook} • గుంటూరు
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('AgrometWeather' as never)}>
              <Text style={styles.todayLink}>{'Today →'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weatherStatusRow}>
            <View
              style={[
                styles.weatherStatusDot,
                weatherData.isOffline && styles.weatherStatusDotOffline,
              ]}
            />
            <Text style={styles.weatherStatusText}>
              {weatherData.isOffline
                ? isTe
                  ? 'ఆఫ్‌లైన్ క్యాష్'
                  : 'Offline cache'
                : isTe
                  ? 'లైవ్ వాతావరణం'
                  : 'Live weather'}
              {' • '}
              {weatherData.timestamp}
            </Text>
          </View>
          <View style={styles.weatherGrid}>
            {[
              { label: dict.home.temp, value: `${weatherData.temp}°C`, sub: weatherData.temp > 30 ? dict.home.sunny : 'Cloudy', subColor: Colors.warningText },
              { label: dict.home.rain, value: `${weatherData.rainProb}%`, sub: weatherData.rainProb > 50 ? 'High' : dict.home.rainLow, subColor: weatherData.rainProb > 50 ? Colors.danger : Colors.slate },
              { label: dict.home.humidity, value: `${weatherData.humidity}%`, sub: isTe ? 'తేమ' : 'Humidity', subColor: Colors.slate },
              {
                label: dict.home.wind,
                value: `${weatherData.windSpeed} km/h`,
                sub: weatherData.isSafeSpray
                  ? dict.weather.safeSpray
                  : isTe
                    ? 'పిచికారీ వద్దు'
                    : 'Avoid spray',
                subColor: weatherData.isSafeSpray ? Colors.success : Colors.danger,
              },
            ].map((metric, i) => (
              <View key={i} style={styles.weatherMetric}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={[styles.metricSub, { color: metric.subColor }]}>
                  {metric.sub}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.adviceBanner}>
            <Text style={styles.adviceText}>
              ℹ️ <Text style={styles.adviceBold}>{dict.home.farmerAdvice}:</Text>{' '}
              {dict.home.adviceText}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.diagnosticBtn}
            onPress={() => navigation.navigate('ApiStatus' as never)}
          >
            <Text style={styles.diagnosticBtnText}>🔧 AI Diagnostics</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Tools 2×2 Grid */}
        <View>
          <View style={styles.quickToolsHeader}>
            <Text style={styles.quickToolsTitle}>
              {dict.home.quickTools}
            </Text>
            <Text style={styles.aiPowered}>{dict.home.aiPowered}</Text>
          </View>
          <View style={styles.quickToolsGrid}>
            <QuickToolCard
              icon="📷"
              labelEn="AI CAMERA"
              labelTe={dict.quickTools.cropScannerTe}
              subtitleEn={dict.quickTools.cropScanner}
              subtitleTe=""
              route="CropHealthScanner"
              accentBg="#E8F5E9"
              onPress={() => {
                stopSpeaking();
                setScannerVisible(true);
              }}
            />
            <QuickToolCard
              icon="🎙️"
              labelEn="VOICE ASSISTANT"
              labelTe={dict.quickTools.askAiTe}
              subtitleEn={dict.quickTools.askAi}
              subtitleTe=""
              route="AskAgronomistScreen"
              accentBg="#FFF8E1"
            />
            <QuickToolCard
              icon="📈"
              labelEn="LIVE PRICES"
              labelTe={dict.quickTools.mandiRatesTe}
              subtitleEn={dict.quickTools.mandiRates}
              subtitleTe=""
              route="MandiMarketRates"
              accentBg="#E8F5E9"
            />
            <QuickToolCard
              icon="🏛️"
              labelEn="SUBSIDIES"
              labelTe={dict.quickTools.govtSchemesTe}
              subtitleEn={dict.quickTools.govtSchemes}
              subtitleTe=""
              route="GovtSchemesChecker"
              accentBg="#E8F5E9"
            />
          </View>
        </View>
      </ScrollView>

      {/* AI Camera opens the scanner modal directly from Home */}
      <CropScannerModal
        visible={scannerVisible}
        onClose={() => {
          stopSpeaking();
          setScannerVisible(false);
        }}
      />
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
    gap: spacing.lg,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingPrefix: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate,
  },
  kharifBadge: {
    backgroundColor: Colors.warning,
    color: Colors.warningText,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: spacing.xs,
  },
  farmerName: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: 2,
  },
  askAiFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askAiFabText: {
    fontSize: 20,
  },
  advisoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  advisoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  advisoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  advisorySub: {
    fontSize: 11,
    color: Colors.slate,
  },
  advisoryDuration: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  todayLink: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weatherStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  weatherStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  weatherStatusDotOffline: {
    backgroundColor: Colors.warningText,
  },
  weatherStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
  },
  weatherMetric: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: spacing.sm,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.slate,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.ink,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    marginTop: 2,
  },
  adviceBanner: {
    backgroundColor: Colors.warning,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  adviceText: {
    fontSize: 11,
    color: Colors.warningText,
  },
  adviceBold: {
    fontWeight: '800',
  },
  diagnosticBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  diagnosticBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
  },
  quickToolsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  quickToolsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.ink,
  },
  aiPowered: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  quickToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
