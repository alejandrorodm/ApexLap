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
};

export type TabParamList = {
  Tiempos: undefined;
  Records: undefined;
  Ruleta: undefined;
  Liga: undefined;
  Perfil: undefined;
};
