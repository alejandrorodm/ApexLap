// Navegación: tabs inferiores + stack para la pantalla de añadir vuelta.
import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { useIsWideWeb } from '../responsive';
import { withContentWidth } from '../components/ContentWidth';
import { useLeagueAlerts } from '../utils/leagueAlerts';
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
import H2HScreen from '../screens/H2HScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SeasonScreen from '../screens/SeasonScreen';
import SkillScreen from '../screens/SkillScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Todas las pantallas entran al navegador ya acotadas a un ancho máximo: es el
// único sitio donde hace falta decirlo una vez en lugar de en cada pantalla.
const Laps = withContentWidth(LapsScreen);
const Records = withContentWidth(RecordsScreen);
const Roulette = withContentWidth(RouletteScreen);
const Feed = withContentWidth(FeedScreen);
const Standings = withContentWidth(StandingsScreen);
const Profile = withContentWidth(ProfileScreen);
const AddLap = withContentWidth(AddLapScreen);
const Challenge = withContentWidth(ChallengeScreen);
const Participants = withContentWidth(ParticipantsScreen);
const TrackDetail = withContentWidth(TrackDetailScreen);
const NewChallenge = withContentWidth(NewChallengeScreen);
const Compare = withContentWidth(CompareScreen);
const H2H = withContentWidth(H2HScreen);
const Progress = withContentWidth(ProgressScreen);
const Season = withContentWidth(SeasonScreen);
const Skill = withContentWidth(SkillScreen);

const ICONS: Record<keyof TabParamList, string> = {
  Tiempos: '🏁',
  Records: '👑',
  Ruleta: '🎯',
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
      <Tab.Screen name="Tiempos" component={Laps} />
      <Tab.Screen name="Records" component={Records} options={{ title: 'Récords' }} />
      <Tab.Screen name="Ruleta" component={Roulette} options={{ title: 'Piques' }} />
      <Tab.Screen name="Muro" component={Feed} />
      <Tab.Screen name="Liga" component={Standings} />
      <Tab.Screen name="Perfil" component={Profile} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  // Aquí dentro ya hay sesión y liga: es donde tiene sentido vigilar la
  // actividad para sacar avisos del navegador.
  useLeagueAlerts();
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
        component={AddLap}
        options={{ title: 'Nueva vuelta', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Challenge"
        component={Challenge}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Participants"
        component={Participants}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Track"
        component={TrackDetail}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewChallenge"
        component={NewChallenge}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="Compare"
        component={Compare}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="H2H"
        component={H2H}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Progress"
        component={Progress}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Season"
        component={Season}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Skill"
        component={Skill}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
