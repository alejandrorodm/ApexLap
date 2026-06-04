// Navegación: tabs inferiores + stack para la pantalla de añadir vuelta.
import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { RootStackParamList, TabParamList } from './types';
import LapsScreen from '../screens/LapsScreen';
import RecordsScreen from '../screens/RecordsScreen';
import RouletteScreen from '../screens/RouletteScreen';
import StandingsScreen from '../screens/StandingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddLapScreen from '../screens/AddLapScreen';
import ChallengeScreen from '../screens/ChallengeScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<keyof TabParamList, string> = {
  Tiempos: '🏁',
  Records: '👑',
  Ruleta: '🎰',
  Liga: '🏆',
  Perfil: '👤',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>
            {ICONS[route.name]}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Tiempos" component={LapsScreen} />
      <Tab.Screen name="Records" component={RecordsScreen} options={{ title: 'Récords' }} />
      <Tab.Screen name="Ruleta" component={RouletteScreen} />
      <Tab.Screen name="Liga" component={StandingsScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="AddLap"
        component={AddLapScreen}
        options={{ title: 'Nueva vuelta', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Challenge"
        component={ChallengeScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
