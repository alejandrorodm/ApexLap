import { Conditions } from '../types';

export type RootStackParamList = {
  Tabs: undefined;
  AddLap: {
    car?: string;
    track?: string;
    conditions?: Conditions;
    challengeId?: string;
  };
  Challenge: { challengeId: string };
  Participants: undefined;
  Track: { track: string };
  NewChallenge: { track?: string };
  Compare: { track: string; car?: string };
  H2H: { aId: string; aName: string; bId: string; bName: string };
  Progress: { car?: string; track?: string } | undefined;
  Season: undefined;
  Skill: undefined;
};

export type TabParamList = {
  Tiempos: undefined;
  Records: undefined;
  Ruleta: undefined;
  Muro: undefined;
  Liga: undefined;
  Perfil: undefined;
};
