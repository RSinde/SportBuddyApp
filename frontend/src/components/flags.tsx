import Svg, { Path, Rect, Circle } from 'react-native-svg';

type FlagProps = {
  size?: number;
};

export function PortugalFlag({ size = 20 }: FlagProps) {
  const width = size;
  const height = (size * 2) / 3;

  return (
    <Svg width={width} height={height} viewBox="0 0 30 20">
      <Rect x={0} y={0} width={30} height={20} fill="#FF0000" />
      <Rect x={0} y={0} width={12} height={20} fill="#006600" />
      <Circle cx={12} cy={10} r={5} fill="#FFCC00" stroke="#FFFFFF" strokeWidth={0.6} />
    </Svg>
  );
}

export function UnitedKingdomFlag({ size = 20 }: FlagProps) {
  const width = size;
  const height = (size * 2) / 3;

  return (
    <Svg width={width} height={height} viewBox="0 0 30 20">
      <Rect x={0} y={0} width={30} height={20} fill="#012169" />
      <Path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFFFFF" strokeWidth={4} />
      <Path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth={1.5} />
      <Path d="M15,0 L15,20 M0,10 L30,10" stroke="#FFFFFF" strokeWidth={6.5} />
      <Path d="M15,0 L15,20 M0,10 L30,10" stroke="#C8102E" strokeWidth={4} />
    </Svg>
  );
}
