import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from './src/store/authStore';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MapScreen from './src/screens/MapScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AdminScreen from './src/screens/AdminScreen';
import RoutesScreen from './src/screens/RoutesScreen';
import AreasScreen from './src/screens/AreasScreen';
import { socketManager } from './src/lib/socket';
import GlobalAlerts from './src/components/GlobalAlerts';

type Screen = 'map' | 'alerts' | 'admin' | 'routes' | 'areas';

export default function App() {
  const [showRegister, setShowRegister] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('map');

  // Store Selectors
  const token = useAuthStore((state) => state.token);
  const isHydrated = useAuthStore((state) => state.isHydrated); // Wait for storage load
  const user = useAuthStore((state) => state.user);
  const [socketInitialized, setSocketInitialized] = useState(false);

  // Socket Connection Management
  useEffect(() => {
    if (user?.id) {
      socketManager.connect(user.id);
      setSocketInitialized(true);
    } else {
      socketManager.disconnect();
      setSocketInitialized(false);
    }
  }, [user]);

  // Loading / Hydration Check
  if (!isHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Auth Flow
  if (!token) {
    if (showRegister) {
      return <RegisterScreen onSwitchToLogin={() => setShowRegister(false)} />;
    }
    return <LoginScreen onSwitchToRegister={() => setShowRegister(true)} />;
  }

  // Main App
  return (
    <View style={styles.container}>
      {/* Global Alerts Overlay */}
      {socketInitialized && <GlobalAlerts />}

      {/* Screen Content */}
      <View style={styles.screenContainer}>
        {currentScreen === 'map' && <MapScreen />}
        {currentScreen === 'alerts' && (
          <AlertsScreen onBack={() => setCurrentScreen('map')} />
        )}
        {currentScreen === 'admin' && (
          <AdminScreen onBack={() => setCurrentScreen('map')} />
        )}
        {currentScreen === 'routes' && (
          <RoutesScreen onBack={() => setCurrentScreen('map')} />
        )}
        {currentScreen === 'areas' && (
          <AreasScreen onBack={() => setCurrentScreen('map')} />
        )}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentScreen('map')}
        >
          <FontAwesome
            name="globe"
            size={20}
            color={currentScreen === 'map' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, currentScreen === 'map' && styles.activeTab]}>
            Map
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentScreen('areas')}
        >
          <FontAwesome5
            name="map"
            size={18}
            color={currentScreen === 'areas' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, currentScreen === 'areas' && styles.activeTab]}>
            Zones
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentScreen('routes')}
        >
          <FontAwesome5
            name="route"
            size={18}
            color={currentScreen === 'routes' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, currentScreen === 'routes' && styles.activeTab]}>
            Routes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentScreen('alerts')}
        >
          <FontAwesome5
            name="bell"
            size={18}
            color={currentScreen === 'alerts' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, currentScreen === 'alerts' && styles.activeTab]}>
            Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentScreen('admin')}
        >
          <FontAwesome
            name="group"
            size={18}
            color={currentScreen === 'admin' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, currentScreen === 'admin' && styles.activeTab]}>
            Admin
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  activeTab: {
    color: '#3b82f6',
  },
});
