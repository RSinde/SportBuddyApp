import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IconName, WeatherCategory, WEATHER_CATEGORY_COLORS } from '@/utils/weather-codes';

type Props = {
  icon: IconName;
  category: WeatherCategory;
  size?: number;
  color?: string;
};

const AnimatedIonicon = Animated.createAnimatedComponent(Ionicons);

// Duração (ida) de cada ciclo de animação, por categoria — trovoada "pisca"
// depressa, nuvens e nevoeiro andam devagar, à semelhança dos ícones do IPMA.
function durationFor(category: WeatherCategory): number {
  switch (category) {
    case 'clear':
      return 4000;
    case 'storm':
      return 650;
    case 'rain':
    case 'drizzle':
      return 850;
    case 'snow':
      return 1500;
    default:
      return 2400;
  }
}

function styleFor(category: WeatherCategory, progress: Animated.Value) {
  switch (category) {
    case 'clear':
      return {
        transform: [
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '30deg'] }) },
        ],
      };
    case 'partly-cloud':
    case 'cloud':
    case 'fog':
      return {
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-5, 1] }) },
        ],
      };
    case 'rain':
    case 'drizzle':
      return {
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-1, 3] }) },
        ],
      };
    case 'snow':
      return {
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) },
        ],
      };
    case 'storm':
      return { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) };
    default:
      return {};
  }
}

function useMotionStyle(category: WeatherCategory) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const duration = durationFor(category);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [category, progress]);

  return styleFor(category, progress);
}

// "Sol com nuvem": o Ionicons não permite duas cores no mesmo glifo, por isso
// compomos dois ícones sobrepostos — sol amarelo por trás, nuvem cinza/branca à frente.
function PartlyCloudyIcon({ size }: { size: number }) {
  const sunStyle = useMotionStyle('clear');
  const cloudStyle = useMotionStyle('cloud');

  return (
    <View style={{ width: size * 1.3, height: size * 1.15 }}>
      <AnimatedIonicon
        name="sunny"
        size={size * 0.62}
        color={WEATHER_CATEGORY_COLORS.clear}
        style={[{ position: 'absolute', top: 0, left: 0 }, sunStyle]}
      />
      <AnimatedIonicon
        name="cloud"
        size={size * 0.85}
        color={WEATHER_CATEGORY_COLORS.cloud}
        style={[{ position: 'absolute', bottom: -2, right: -4 }, cloudStyle]}
      />
    </View>
  );
}

export function AnimatedWeatherIcon({ icon, category, size = 22, color }: Props) {
  const motionStyle = useMotionStyle(category);

  if (category === 'partly-cloud') {
    return <PartlyCloudyIcon size={size} />;
  }

  return (
    <AnimatedIonicon
      name={icon}
      size={size}
      color={color ?? WEATHER_CATEGORY_COLORS[category]}
      style={motionStyle}
    />
  );
}
