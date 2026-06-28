import React from 'react';
import { View, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartasBosque } from '@/constants/colors';

const TAPIZ_HEIGHT = 36;

export default function BarraSuperior() {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <View style={{ height: insets.top, backgroundColor: cartasBosque.sidebar }} />
      <ImageBackground
        source={require('../../../assets/papel-tapiz.jpg')}
        resizeMode="cover"
        style={{ height: TAPIZ_HEIGHT }}
      />
    </View>
  );
}
