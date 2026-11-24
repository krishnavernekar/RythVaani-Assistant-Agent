import React from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AppState, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, spacing } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { getDict } from '../i18n/translations';
import { stopSpeaking } from '../utils/voice';
import FarmerOnboardingModal from '../components/FarmerOnboardingModal';
import {
  NotificationCenterModal,
  NotificationToastBanner,
  type NotificationNavigationParamList,
} from '../components/NotificationCenterModal';

// Screens
import WelcomeAuthScreen from '../screens/WelcomeAuthScreen';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import CropScannerScreen from '../screens/CropScannerScreen';
import AskAgronomistScreen from '../screens/AskAgronomistScreen';
import GovtSchemesScreen from '../screens/GovtSchemesScreen';
import MandiMarketScreen from '../screens/MandiMarketScreen';
import FarmerProfileScreen from '../screens/FarmerProfileScreen';
import AgrometWeatherScreen from '../screens/AgrometWeatherScreen';
import ApiStatusScreen from '../screens/ApiStatusScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * 5-Tab Bottom Navigator (Home • Ask AI • Schemes • Market • Profile)
 */
function BottomTabNavigator() {
  const { language } = useAppStore();
  const dict = getDict(language);
  const insets = useSafeAreaInsets();

  const tabs = [
    {
      name: 'HomeDashboard',
      component: HomeDashboardScreen,
      icon: '🏠',
      labelEn: dict.bottomNav.home,
      labelTe: dict.bottomNav.homeTe,
    },
    {
      name: 'AskAgronomistScreen',
      component: AskAgronomistScreen,
      icon: '🎙️',
      labelEn: dict.bottomNav.askAi,
      labelTe: dict.bottomNav.askAiTe,
    },
    {
      name: 'GovtSchemesChecker',
      component: GovtSchemesScreen,
      icon: '📄',
      labelEn: dict.bottomNav.schemes,
      labelTe: dict.bottomNav.schemesTe,
    },
    {
      name: 'MandiMarketRates',
      component: MandiMarketScreen,
      icon: '🏪',
      labelEn: dict.bottomNav.market,
      labelTe: dict.bottomNav.marketTe,
    },
    {
      name: 'FarmerProfile',
      component: FarmerProfileScreen,
      icon: '👤',
      labelEn: dict.bottomNav.profile,
      labelTe: dict.bottomNav.profileTe,
    },
  ];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = tabs.find(t => t.name === route.name);
        const label = language === 'te' ? tab?.labelTe : tab?.labelEn;
        return {
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconFocused]}>
              <Text style={styles.tabIcon}>{tab?.icon}</Text>
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text
              style={[
                styles.tabLabel,
                focused && { color: Colors.primary, fontWeight: '800' },
              ]}
            >
              {label}
            </Text>
          ),
          tabBarStyle: {
            paddingBottom: insets.bottom + spacing.sm,
            paddingTop: spacing.sm,
            height: 60 + insets.bottom,
            backgroundColor: Colors.cardWhite,
            borderTopColor: Colors.cardBorder,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.slateLight,
        };
      }}
    >
      {tabs.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ title: tab.labelEn }}
        />
      ))}
    </Tab.Navigator>
  );
}

/**
 * Root Stack Navigator
 *   - WelcomeAuthScreen (entry point)
 *   - BottomTabNavigator (main app after auth/guest)
 *   - AgrometWeatherScreen (stack navigates into it from Home)
 */
export default function RootNavigator() {
  const navigationRef =
    useNavigationContainerRef<NotificationNavigationParamList>();
  const { isAuthenticated, isGuest, hasHydrated, syncNow } = useAppStore();
  const hasAccess = isAuthenticated || isGuest;

  // App launch / login: as soon as AsyncStorage hydration finishes, push any
  // cached farmer, questions, bookmarks and scheme check to all four tables.
  React.useEffect(() => {
    if (!hasHydrated || !isAuthenticated || isGuest) return;
    void (async () => {
      await syncNow();
    })();
  }, [hasHydrated, isAuthenticated, isGuest, syncNow]);

  // Returning from the background is an equally strong sync trigger.
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      const current = useAppStore.getState();
      if (!current.hasHydrated || !current.isAuthenticated || current.isGuest) return;
      void (async () => {
        await useAppStore.getState().syncNow();
        await useAppStore.getState().refreshNotifications();
      })();
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.root}>
      <NavigationContainer
        ref={navigationRef}
        // Global audio guard: any tab switch, push, modal or auth transition
        // stops both expo-speech TTS and Sarvam Bulbul playback.
        onReady={stopSpeaking}
        onStateChange={stopSpeaking}
      >
        <StatusBar style="dark" />
        <Stack.Navigator
          screenOptions={{
            gestureEnabled: true,
          }}
        >
          {!hasAccess ? (
            <Stack.Screen name="WelcomeAuth" component={WelcomeAuthScreen} />
          ) : (
            <>
              <Stack.Screen
                name="MainTabs"
                component={BottomTabNavigator}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="AgrometWeather"
                component={AgrometWeatherScreen}
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="CropHealthScanner"
                component={CropScannerScreen}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen
                name="ApiStatus"
                component={ApiStatusScreen}
                options={{ title: 'AI Diagnostics' }}
              />
            </>
          )}
        </Stack.Navigator>

        {/* Global smart alerts: bell badge opens this modal from any screen. */}
        <NotificationCenterModal navigation={navigationRef} />
        <NotificationToastBanner navigation={navigationRef} />
      </NavigationContainer>

      {/* First-time setup / Edit Profile is global so it appears right after OTP. */}
      <FarmerOnboardingModal />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconFocused: {
    backgroundColor: Colors.primarySoft,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slateLight,
    marginTop: 2,
  },
});