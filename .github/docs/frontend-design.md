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

Tema oscuro fijo. **Ningún hex suelto en pantallas/componentes**: los únicos
archivos con valores hex son `lib/theme.ts` y `components/glassTokens.ts`.

| Rol                | Token                             | Valor                 |
| ------------------ | --------------------------------- | --------------------- |
| Primario (marca)   | `colors.primary`                  | `#F7CC3D` (dorado)    |
| Fondo              | `colors.background`               | `#0F1115`             |
| Superficie (cards) | `colors.surface` / `surfaceAlt`   | `#171A21` / `#1C2029` |
| Borde              | `colors.border`                   | `#232734`             |
| Texto              | `colors.text` / `textSecondary`   | `#F5F7FA` / `#98A0AE` |
| Éxito / Error      | `colors.success` / `colors.error` | `#52C878` / `#F06A6A` |
| Overlay de modal   | `colors.overlay`                  | `rgba(6,8,12,0.72)`   |

Reglas de color:

- **Texto/iconos sobre amarillo (`primary`) siempre `colors.darkGray`** — nunca blanco (contraste).
- Verde/rojo solo para datos de mejora/empeoramiento; el acento estructural
  (bordes de tarjetas, gradientes de fondo) es blanco uniforme (`getTrainingAccent`).
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
2. ¿Texto claro sobre amarillo? → cambiarlo a `darkGray`.
3. ¿Modal de confirmación a mano? → `ConfirmModal`.
4. ¿Row icono+título recreado en una top bar? → prop `icon` de `GlassTopBar`.
5. ¿Gradiente duplicado? → `theme.gradients`.
