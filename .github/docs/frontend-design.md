# Sistema de diseño — GymBro

Guía de referencia para cualquier cambio visual. Objetivo: interfaces rápidas,
claras y móviles, con todas las vistas coherentes entre sí.

## Principios

- Minimizar fricción: velocidad al registrar entrenamientos es la prioridad máxima
- Priorizar acciones principales; jerarquía clara; feedback inmediato
- Uso con una mano: botones grandes, inputs rápidos (ej: `60x8`)
- Evitar sobrecarga visual, modales innecesarios y formularios largos
- Componentes pequeños, reutilizables, con props simples

## Paleta (fuente única: `lib/theme.ts`)

Dos temas (noche por defecto y día) con las MISMAS claves; el modo se resuelve una
sola vez al evaluar el módulo, así que cambiarlo exige relanzar el bundle.
**Ningún hex suelto en pantallas/componentes**: los únicos archivos con valores hex
son `lib/theme.ts` y `components/glassTokens.ts`.

Los roles no siempre se invierten: varios tokens (`accentLine`, `shadow`,
`gradients.cardSheen`) tienen valor propio en día porque su inverso literal queda
mal (ver "Reglas de color"). La tabla lista los valores de noche.

| Rol                | Token                             | Valor                 |
| ------------------ | --------------------------------- | --------------------- |
| Primario (tinta)   | `colors.primary`                  | `#F7CC3D` (dorado)    |
| Primario (línea)   | `colors.primaryLine`              | `#F7CC3D` (dorado)    |
| Primario (relleno) | `colors.primaryFill`              | `#F7CC3D` (dorado)    |
| Fondo              | `colors.background`               | `#0F1115`             |
| Superficie (cards) | `colors.surface` / `surfaceAlt`   | `#171A21` / `#1C2029` |
| Borde              | `colors.border`                   | `#232734`             |
| Texto              | `colors.text` / `textSecondary`   | `#F5F7FA` / `#98A0AE` |
| Éxito / Error      | `colors.success` / `colors.error` | `#52C878` / `#F06A6A` |
| Overlay de modal   | `colors.overlay`                  | `rgba(6,8,12,0.72)`   |

Reglas de color:

- **El oro tiene TRES tokens según el rol**, porque sobre el lienzo claro un solo
  tono no puede servir a los tres (en noche los tres son el mismo oro brillante):
  - `colors.primary` es **tinta**: texto e iconos sobre el fondo/las tarjetas, y
    tintes `+'1A'`. Necesita 4.5:1 → en día es un ámbar oscuro (`#966100`).
  - `colors.primaryLine` es **línea/acento estructural**: bordes, aro del día en
    curso, borde izquierdo de la semana, barras de gráfica, `accent` de
    `GradientFill`. Como no es texto le basta 3:1 → en día es más amarillo
    (`#B87A00`); con la tinta se veía marrón.
  - `colors.primaryFill` (+ `primaryFillLight` / `primaryFillDark`) es **relleno**
    (heros, botones, badges, checkboxes) y lleva `onGold` encima. En día es un oro
    vivo (`#F2B307`); como línea sobre el lienzo claro se perdería (1.6:1).
  - Regla rápida: ¿`backgroundColor` sólido con texto encima? → `primaryFill`.
    ¿`borderColor` / acento gráfico? → `primaryLine`. ¿`color` de texto/icono? →
    `primary`.
  - `gradients.primary` / `gradients.amber` son relleno: siempre con `onGold`.
  - Ojo con los colores compartidos entre una barra y su etiqueta (gráficas): la
    barra es `primaryLine` y la etiqueta `primary`, no el mismo valor.
- **Texto/iconos sobre dorado siempre `colors.onGold`** (tinta oscura en ambos
  temas) — nunca un blanco/negro suelto.
- **Texto/iconos sobre rellenos sólidos de estado (rojo/verde): `colors.onDanger`**
  (blanca en día, oscura en noche). No reutilizar `onGold` ahí: sobre el rojo
  profundo de día la tinta oscura no contrasta.
- Verde/rojo solo para datos de mejora/empeoramiento; el acento estructural
  (bordes de tarjetas, barras de semana, tinte de `GradientFill`) es uniforme y
  sale SIEMPRE de `colors.accentLine` / `getTrainingAccent()`.
- **`colors.white` es la TINTA de texto/iconos, no un borde.** Los dos roles no se
  invierten igual: en noche el aro blanco sobre superficie oscura lee como un halo
  suave, pero en día su inverso (`#171B23`) da un aro casi negro con aspecto de
  pegatina. Por eso el día usa un pizarra medio (`accentLine: #6B7385`) que además
  deja el oro como único acento fuerte.
- Amarillo reservado a: semana/día en curso, rutina activa, acciones primarias.

## Degradados (`theme.gradients`)

Tríos claro→base→oscuro, aplicados en diagonal (`start 0,0 → end 1,1`):

- `primary` (dorado) — héroe de Inicio, botón Guardar, CTAs
- `success` (verde) — entrenamiento completado
- `danger` (rojo) — rutina cerrada, acciones destructivas
- `warning` (naranja) — añadir rutina
- `amber` (ámbar) — semana completada
- `sheen` — brillo superior blanco (55% de alto) que da volumen a cualquier superficie con gradiente

No duplicar estos tríos: consumir siempre `theme.gradients.*`.

## Tipografía

- **Display: Anton** (`theme.fonts.display`, cargada en `App.tsx`) — titulares de
  tarjeta, números grandes, badges. Anton pega el glifo arriba: usar
  `includeFontPadding: false` + `translateY` para centrarla junto a iconos
  (patrón ya presente en `HeroCard`, `CardioScreen`).
- **Sistema (peso 700–800)** — títulos de top bar, botones, labels.
- Escala en `theme.typography` (h1 28 / h2 22 / h3 18 / body 16 / label 14 / caption 12).

## Glass UI

- `GlassTopBar`: barra superior fija con blur. Título estándar = prop `icon`
  (MaterialCommunityIcons 18px + texto 20/800). `titleElement` **solo** para
  casos especiales: logo de Inicio, `DayAccentIcon` del día en registro/detalle.
- `FloatingPrimaryNav` / `FloatingBackButton`: navegación flotante inferior.
- Tokens de blur/opacidad/bordes en `components/glassTokens.ts`.
- Todas las pantallas son edge-to-edge; el scroll se compensa con
  `GLASS_TOP_BAR_BASE_HEIGHT + insets.top` arriba y
  `getFloatingPrimaryNavMetrics(insets.bottom)` abajo.

## Patrones de componentes

- **`Button`** — acción estándar. Variants: `primary` (gradiente dorado),
  `secondary` (surface + borde), `danger` (gradiente rojo). Sizes s/m/l.
- **`GradientCtaButton`** — el CTA hero (gradiente dorado + sheen + encogido al
  pulsar) de "Guardar" del registro y "Crear rutina". No recrearlo a mano.
- **`GymIconGrid`** — rejilla del selector de icono de día (modales de Nueva
  rutina y detalle de rutina).
- **`ConfirmModal`** — TODA confirmación (eliminar, importar, limpiar).
  Overlay `colors.overlay`, tarjeta surface centrada (max 340), título 18/800
  centrado con icono, botones `Button`. No montar `Modal` a mano para un confirm.
- **`HeroCard`** — tarjeta principal de Inicio, una por estado (`HeroVariant`).
- **`GradientFill`** — relleno sutil de acento en tarjetas con borde.
- **`Toast`** — feedback flotante global (éxito/error) sobre la barra inferior.
- **`WhatsNewModal`** — novedades tras actualizar (contenido en `data/changelog.ts`).

## Iconografía

- Set único: **MaterialCommunityIcons** (`@expo/vector-icons`).
- Días de rutina: siluetas monocromo propias (`GymIcon` + `lib/gymIcons.ts`),
  mostradas vía `DayAccentIcon`. No emojis de color para distinguir días.

## Espaciado y radios

- `theme.spacing` (xs 6 → xxl 36); margen horizontal de pantalla: `spacing.md`.
- `theme.borderRadius` (sm 10 / md 16 / lg 22 / xl 28 / pill).
- Sombras: `theme.shadow.card` (elevada) y `theme.shadow.soft` (tarjetas de lista).

## Checklist antes de cerrar un cambio visual

1. ¿Algún hex nuevo fuera de `theme.ts`/`glassTokens.ts`? → moverlo a token.
2. ¿Texto sobre dorado? → `colors.onGold`. ¿Sobre rojo/verde sólido? → `colors.onDanger`.
3. ¿`colors.primary` en un `backgroundColor` sólido? → es relleno: `primaryFill`.
   ¿En un `borderColor` o acento gráfico? → es línea: `primaryLine`.
4. ¿`colors.white` usado como borde o tinte? → es tinta de texto: usar `accentLine`.
5. ¿Modal de confirmación a mano? → `ConfirmModal`.
6. ¿Row icono+título recreado en una top bar? → prop `icon` de `GlassTopBar`.
7. ¿Gradiente duplicado? → `theme.gradients`.
8. ¿Fondo translúcido (`primaryMuted`, `+'1A'`…) en una tarjeta con
   `theme.shadow.*`? → en Android, `elevation` sin fondo opaco pinta el relleno
   como un rectángulo con esquinas vivas dentro del redondeo. Marcar el estado
   con `GradientFill` sobre el fondo opaco, como hacen las tarjetas de "hoy".
9. ¿Revisado en los DOS temas? El día no es el negativo del noche.
