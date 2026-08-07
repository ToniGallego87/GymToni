// Estilos de texto compartidos con la fuente display (Anton). Nacen para que el
// nombre de día y el título de semana —que Inicio, Cardio y el selector de día
// pintaban IDÉNTICOS por copia— tengan una sola fuente y no puedan divergir.
//
// Son FÁBRICAS (funciones), no objetos de módulo, a propósito: el tema se aplica
// en caliente y cada `makeStyles()` de pantalla se recalcula al cambiarlo
// (subscribeTheme). Llamar a estas fábricas DENTRO de cada `makeStyles()` hace
// que releen el `theme` vivo en cada recálculo, como cualquier estilo local.
//
// OJO con el lineHeight: Anton pega el glifo al borde superior de su caja y
// Android recorta el ascendente si el lineHeight va justo. El translateY solo
// reposiciona, NO agranda la caja. El ratio lineHeight/fontSize debe seguir
// siendo holgado (>= 1.35); lo vigila lib/__tests__/antonLineHeight.test.ts, que
// analiza también este archivo.
import { Platform, TextStyle } from 'react-native';
import { theme } from './theme';

// Empujón vertical para centrar Anton frente a iconos/texto de sistema (mismo
// patrón que HeroCard/CardioScreen). No agranda la caja de línea.
const antonCenterNudge: Pick<TextStyle, 'transform'> = {
  transform: [{ translateY: Platform.OS === 'android' ? 3 : 5 }],
};

// Nombre de un día de rutina. Compartido por la tarjeta de día de Inicio
// (historial), la tarjeta diaria de Cardio y el selector de día. Color por
// defecto = texto principal; quien lo use puede sobreescribirlo inline.
export const dayNameText = (): TextStyle => ({
  fontSize: 19,
  fontFamily: theme.fonts.display,
  letterSpacing: 0.3,
  color: theme.colors.text,
  lineHeight: 27,
  includeFontPadding: false,
  textAlignVertical: 'center',
  ...antonCenterNudge,
});

// Título de una tarjeta de semana ("Semana N" en Inicio, rango de fechas en
// Cardio). Sin color: cada pantalla lo tiñe inline (hoy va en blanco).
export const weekTitleText = (): TextStyle => ({
  fontSize: 21,
  fontFamily: theme.fonts.display,
  letterSpacing: 0.5,
  lineHeight: 30,
  includeFontPadding: false,
  textAlignVertical: 'center',
  ...antonCenterNudge,
});
