import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';

export default function CreateTabFallback() {
  // Este separador não é um ecrã real — só serve para abrir o modal
  // /create-activity. Sem este "hasOpened", ao voltar atrás a partir do
  // modal isto ganha foco outra vez e volta logo a empurrar o modal,
  // impedindo de sair (o "piscar" preso na mesma página).
  const hasOpened = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasOpened.current) {
        hasOpened.current = false;
        router.replace('/');
        return;
      }
      hasOpened.current = true;
      router.push('/create-activity');
    }, [])
  );

  return <View />;
}
