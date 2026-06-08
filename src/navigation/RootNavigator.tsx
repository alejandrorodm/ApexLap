// Navegación: tabs inferiores + stack para la pantalla de añadir vuelta.
import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { useIsWideWeb } from '../responsive';
import { RootStackParamList, TabParamList } from './types';
import LapsScreen from '../screens/LapsScreen';
import RecordsScreen from '../screens/RecordsScreen';
import RouletteScreen from '../screens/RouletteScreen';
import FeedScreen from '../screens/FeedScreen';
import StandingsScreen from '../screens/StandingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddLapScreen from '../screens/AddLapScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import ParticipantsScreen from '../screens/ParticipantsScreen';
import TrackDetailScreen from '../screens/TrackDetailScreen';
import NewChallengeScreen from '../screens/NewChallengeScreen';
import CompareScreen from '../screens/CompareScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SeasonScreen from '../screens/SeasonScreen';
import SkillScreen from '../screens/SkillScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<keyof TabParamList, string> = {
  Tiempos: '🏁',
  Records: '👑',
  Ruleta: '🎰',
  Muro: '🔥',
  Liga: '🏆',
  Perfil: '👤',
};

function Tabs() {
  // En web ancho (portátil/escritorio): navegación ARRIBA. En móvil: abajo.
  const isWide = useIsWideWeb();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Fondo opaco de cada escena: evita que se vean solapadas al cambiar.
        sceneStyle: { backgroundColor: colors.bg },
        tabBarPosition: isWide ? 'top' : 'bottom',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelPosition: isWide ? 'beside-icon' : undefined,
        tabBarStyle: isWide
          ? {
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              height: 54,
            }
          : {
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
      <Tab.Screen name="Muro" component={FeedScreen} />
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
        contentStyle: { backgroundColor: colors.bgScreen },
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
      <Stack.Screen
        name="Participants"
        component={ParticipantsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Track"
        component={TrackDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewChallenge"
        component={NewChallengeScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="Compare"
        component={CompareScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Season"
        component={SeasonScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Skill"
        component={SkillScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
