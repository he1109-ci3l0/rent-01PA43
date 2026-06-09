import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  useFonts as useBricolage,
} from '@expo-google-fonts/bricolage-grotesque';

import {
  PermanentMarker_400Regular,
  useFonts as usePermanentMarker,
} from '@expo-google-fonts/permanent-marker';

import {
  Raleway_400Regular,
  Raleway_600SemiBold,
  Raleway_700Bold,
  useFonts as useRaleway,
} from '@expo-google-fonts/raleway';

import {
  Zeyada_400Regular,
  useFonts as useZeyada,
} from '@expo-google-fonts/zeyada';

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  Philosopher_400Regular_Italic,
  useFonts as usePhilosopher,
} from '@expo-google-fonts/philosopher';

import {
  Nobile_400Regular,
  Nobile_500Medium,
  useFonts as useNobile,
} from '@expo-google-fonts/nobile';

import {
  MonaSans_400Regular,
  MonaSans_600SemiBold,
  useFonts as useMonaSans,
} from '@expo-google-fonts/mona-sans';

import RootNavigator from './src/navigation';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [bricolageLoaded, bricolageError] = useBricolage({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });

  const [markerLoaded, markerError] = usePermanentMarker({
    PermanentMarker_400Regular,
  });

  const [ralewayLoaded, ralewayError] = useRaleway({
    Raleway_400Regular,
    Raleway_600SemiBold,
    Raleway_700Bold,
  });

  const [zeyadaLoaded, zeyadaError] = useZeyada({
    Zeyada_400Regular,
  });

  const [philosopherLoaded, philosopherError] = usePhilosopher({
    Philosopher_400Regular,
    Philosopher_700Bold,
    Philosopher_400Regular_Italic,
  });

  const [nobileLoaded, nobileError] = useNobile({
    Nobile_400Regular,
    Nobile_500Medium,
  });

  const [monaSansLoaded, monaSansError] = useMonaSans({
    MonaSans_400Regular,
    MonaSans_600SemiBold,
  });

  const loaded = bricolageLoaded && markerLoaded && ralewayLoaded &&
    zeyadaLoaded && philosopherLoaded && nobileLoaded && monaSansLoaded;

  const error = bricolageError ?? markerError ?? ralewayError ??
    zeyadaError ?? philosopherError ?? nobileError ?? monaSansError;

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <RootNavigator />;
}
