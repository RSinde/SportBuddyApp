import { ImageSourcePropType } from 'react-native';

// Imagem de fundo de cada desporto nos cartões de atividade.
// A chave é o id do desporto no Firestore. Desporto sem imagem → o cartão
// usa o fundo liso de sempre (ver onde este mapa é usado).
export const sportImages: Record<string, ImageSourcePropType> = {
  basquetebol: require('../../assets/images/sports/basquetebol.jpg'),
  ciclismo:    require('../../assets/images/sports/ciclismo.jpg'),
  corrida:     require('../../assets/images/sports/corrida.jpg'),
  futebol:     require('../../assets/images/sports/futebol.jpg'),
  natacao:     require('../../assets/images/sports/natacao.jpg'),
  padel:       require('../../assets/images/sports/padel.jpg'),
  tenis:       require('../../assets/images/sports/tenis.jpg'),
  voleibol:    require('../../assets/images/sports/voleibol.jpg'),
};
