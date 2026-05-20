import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts as useDMSans,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
  useFonts as useDMMono,
} from '@expo-google-fonts/dm-mono';
import RootNavigator from './src/navigation';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [sansLoaded, sansError] = useDMSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [monoLoaded, monoError] = useDMMono({
    DMMono_400Regular,
    DMMono_500Medium,
  });

  const loaded = sansLoaded && monoLoaded;
  const error = sansError ?? monoError;

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <RootNavigator />;
}
