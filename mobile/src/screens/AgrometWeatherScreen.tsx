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
import { Colors, spacing, tokens } from '../theme/tokens';
import { speak, stopSpeaking } from '../utils/voice';
import { useAppStore } from '../store/useAppStore';
import { getDict, getLineHeight } from '../i18n/translations';
import { fetchWeather, WeatherData, FALLBACK_WEATHER, getWindDirection } from '../services/weatherService';

export default function AgrometWeatherScreen() {
  const navigation = useNavigation<any>();
  const { language } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';

  const [weatherData, setWeatherData] = useState<WeatherData>(FALLBACK_WEATHER);
  const [refreshing, setRefreshing] = useState(false);

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

  const playWeatherAudio = () => {
    const sprayLine = weatherData.isSafeSpray
      ? isTe
        ? 'గాలి వేగం తక్కువగా ఉంది, ఈరోజు పిచికారీకి అనుకూలం.'
        : 'Wind is calm, spraying is safe today.'
      : isTe
        ? `గాలి వేగం గంటకు ${weatherData.windSpeed} కి.మీ ఉంది, పిచికారీని వాయిదా వేయండి.`
        : `Wind is ${weatherData.windSpeed} km/h — postpone spraying.`;

    const text = isTe
      ? `నేటి వ్యవసాయ వాతావరణ బులెటిన్: గుంటూరులో ఉష్ణోగ్రత ${weatherData.temp} డిగ్రీలు, అనుభూతి ${weatherData.feelsLike} డిగ్రీలు. తేమ ${weatherData.humidity} శాతం, వర్ష సూచన ${weatherData.rainProb} శాతం. నేల తేమ ${weatherData.soilMoisture} శాతం. ${sprayLine}`
      : `Today's agromet bulletin for Guntur: ${weatherData.temp} degrees, feels like ${weatherData.feelsLike}. Humidity ${weatherData.humidity} percent, rain chance ${weatherData.rainProb} percent, soil moisture ${weatherData.soilMoisture} percent. ${sprayLine}`;
    speak(text, { language: isTe ? 'te-IN' : 'en-IN' });
  };

  const conditionLabel = weatherData.isOffline
    ? isTe
      ? 'ఆఫ్‌లైన్ బెంచ్‌మార్క్'
      : 'Offline benchmark'
    : weatherData.rainProb > 50
      ? isTe
        ? 'వర్ష అవకాశం'
        : 'Rain likely'
      : weatherData.temp > 30
        ? isTe
          ? 'ఎండ'
          : 'Sunny'
        : isTe
          ? 'పాక్షికంగా మేఘావృతం'
          : 'Partly Cloudy';

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader
        subtitle={dict.weather.subtitle}
        showBack
        onBack={() => navigation.goBack()}
      />
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
        {/* Hub & Timestamp */}
        <View style={styles.hubRow}>
          <Text style={styles.hubText}>📍 {dict.weather.hub}</Text>
          <Text
            numberOfLines={2}
            style={[styles.liveText, weatherData.isOffline && styles.offlineText]}
          >
            {weatherData.isOffline ? '⚠️' : '🟢'} {weatherData.timestamp}
            {' • '}
            {weatherData.isOffline
              ? isTe
                ? 'ఆఫ్‌లైన్ క్యాష్'
                : 'Offline Cache'
              : 'Open-Meteo Live'}
          </Text>
        </View>

        {/* Main Weather Card */}
        <View style={tokens.card}>
          <View style={styles.tempRow}>
            <View style={styles.tempInfo}>
              <Text style={styles.todayLabel}>
                ☀️ {dict.weather.todayWeather} • {dict.weather.liveNow}
              </Text>
              <Text style={styles.temperature}>
                {weatherData.temp}°C{' '}
                <Text style={styles.feelsLike}>
                  {dict.weather.feelsLike} {weatherData.feelsLike}°C
                </Text>
              </Text>
              <Text
                style={[
                  styles.condition,
                  { lineHeight: getLineHeight(12, language) },
                ]}
              >
                {conditionLabel}
              </Text>
            </View>
            <Text style={styles.weatherIcon}>⛅</Text>
          </View>

          {/* 4-Parameter Agromet Grid */}
          <View style={styles.agrometGrid}>
            {[
              {
                icon: '🌧️',
                label: dict.weather.rainForecast,
                value: `${weatherData.rainProb}%`,
                sub: isTe ? dict.weather.lowToday : 'Low Today',
                alert: `${weatherData.rainProb > 50 ? '70% on Day After Tomorrow' : ''}`,
                alertColor: weatherData.rainProb > 50 ? Colors.danger : null,
              },
              {
                icon: '💧',
                label: dict.weather.rh,
                value: `${weatherData.humidity}%`,
                sub: `${weatherData.humidity}% RH`,
                detail: isTe ? 'గాలిలో తేమ' : 'Moisture in air',
              },
              {
                icon: '🌬️',
                label: dict.weather.windSpeed,
                value: `${weatherData.windSpeed} km/h`,
                sub: getWindDirection(weatherData.windDir, language),
                detail: weatherData.isSafeSpray
                  ? dict.weather.safeSpray
                  : isTe
                    ? 'పిచికారీ వాయిదా'
                    : 'Avoid spraying',
                detailColor: weatherData.isSafeSpray ? Colors.success : Colors.danger,
              },
              {
                icon: '🌱',
                label: dict.weather.soilMoisture,
                value: `${weatherData.soilMoisture}%`,
                sub: isTe ? 'ఘనపరిమాణ తేమ %' : 'Volumetric moisture %',
                detail:
                  weatherData.soilMoisture > 20
                    ? dict.weather.adequateForPaddy
                    : isTe
                      ? 'వరికి తక్కువ'
                      : 'Low for Paddy',
                detailColor: weatherData.soilMoisture > 20 ? Colors.success : Colors.danger,
              },
            ].map((param, i) => (
              <View key={i} style={styles.agrometParam}>
                <View style={styles.paramHeader}>
                  <Text style={styles.paramLabel}>
                    {param.icon} {param.label}
                  </Text>
                  <Text style={styles.paramValue}>{param.value}</Text>
                </View>
                <Text style={styles.paramSub}>{param.sub}</Text>
                {param.alert && (
                  <Text style={{ fontSize: 10, color: param.alertColor, fontWeight: '700', marginTop: 2 }}>
                    {param.alert}
                  </Text>
                )}
                {param.detail && (
                  <Text style={[styles.paramDetail, param.detailColor && { color: param.detailColor }]}>
                    {param.detail}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Listen Bulletin Button */}
          <TouchableOpacity
            style={styles.listenBtn}
            onPress={playWeatherAudio}
            activeOpacity={0.85}
          >
            <Text style={styles.listenBtnText}>
              ▶ {dict.weather.listenBulletin} • {dict.weather.listenBulletinTe}
            </Text>
            <Text style={styles.listenDuration}>1:10 {dict.common.minutes}</Text>
          </TouchableOpacity>
        </View>

        {/* Rain alert — live probability, or the Stitch storm alert when offline */}
        {(weatherData.isOffline || weatherData.rainProb > 50) && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertTitle}>
                {weatherData.rainProb > 50 ? '⛈️' : '🌧️'} {dict.weather.severeAlert} •{' '}
                {dict.weather.severeAlertTe}
              </Text>
              <Text style={styles.alertDay}>
                {weatherData.isOffline ? 'Thursday' : `${weatherData.rainProb}%`}
              </Text>
            </View>
            <Text style={styles.alertSubtitle}>
              {isTe ? 'ఖరీఫ్ పంటలకు వర్ష హెచ్చరిక' : 'Rain alert for Kharif crops'}
            </Text>
            <Text
              style={[
                styles.alertBody,
                { lineHeight: getLineHeight(12, language) },
              ]}
            >
              {weatherData.isOffline
                ? 'గుంటూరు, కృష్ణా జిల్లాల్లో గురువారం మధ్యాహ్నం 45–60mm వర్షపాతం మరియు ఉరుములతో కూడిన భారీ వర్షాలు కురిసే అవకాశం ఉంది.'
                : isTe
                  ? `గుంటూరు ప్రాంతంలో వర్ష సూచన ${weatherData.rainProb}% ఉంది. పిచికారీ మరియు ఎరువులు వేయడాన్ని వర్షం తగ్గిన తర్వాత చేయండి.`
                  : `Rain probability is ${weatherData.rainProb}% in Guntur. Postpone spraying and fertilizer application until the rain eases.`}
            </Text>
            <View style={styles.urgentAction}>
              <Text style={styles.urgentActionText}>
                ⚠️ {dict.weather.urgentAction} / {dict.weather.urgentActionTe}:{' '}
                {isTe
                  ? 'పురుగుమందు పిచికారీ మరియు యూరియా వేయడం వాయిదా వేయండి.'
                  : 'Postpone pesticide spraying and urea application.'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  hubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  hubText: { fontSize: 12, fontWeight: '700', color: Colors.slate },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
    flexShrink: 1,
    textAlign: 'right',
  },
  offlineText: { color: Colors.warningText },
  tempRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tempInfo: { flex: 1 },
  todayLabel: { fontSize: 12, fontWeight: '700', color: Colors.warningText },
  temperature: { fontSize: 32, fontWeight: '900', color: Colors.ink, lineHeight: 38 },
  feelsLike: { fontSize: 13, fontWeight: '500', color: Colors.slate },
  condition: { fontSize: 12, color: Colors.slate },
  weatherIcon: { fontSize: 42 },
  agrometGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  agrometParam: {
    flex: 1,
    minWidth: '46%',
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 2,
  },
  paramHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paramLabel: { fontSize: 11, fontWeight: '700', color: Colors.slate },
  paramValue: { fontSize: 11, fontWeight: '800', color: Colors.ink },
  paramSub: { fontSize: 12, fontWeight: '700', color: Colors.ink, marginTop: 2 },
  paramDetail: { fontSize: 10, fontWeight: '700', color: Colors.success },
  listenBtn: {
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
  listenBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  listenDuration: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  alertCard: {
    backgroundColor: Colors.alert,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.md,
    gap: spacing.xs,
  },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertTitle: { fontSize: 13, fontWeight: '900', color: Colors.danger },
  alertDay: { fontSize: 12, fontWeight: '800', color: Colors.danger },
  alertSubtitle: { fontSize: 12, fontWeight: '700', color: Colors.ink },
  alertBody: { fontSize: 12, color: '#7F1D1D' },
  urgentAction: {
    backgroundColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  urgentActionText: { fontSize: 11, fontWeight: '800', color: '#7F1D1D' },
});
