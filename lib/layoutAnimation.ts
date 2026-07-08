import { LayoutAnimation, Platform, UIManager } from 'react-native';

// LayoutAnimation en Android requiere activarse explícitamente (una sola vez,
// al importar este módulo).
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Animación suave para expandir/colapsar secciones (semanas, gráfico). */
export function animateLayout(): void {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      220,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
}
