package expo.modules.glassblur

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Cristal esmerilado con UNA captura por frame compartida entre todas las
// vistas (ver SharedBlurSource). Sustituye al BlurView de expo-blur en las
// barras de la app: aquel redibujaba la pantalla entera por instancia.
class GlassBlurModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GlassBlur")

    View(GlassBlurView::class) {
      // Color ARGB ya procesado en JS (processColor).
      Prop("tintColor") { view: GlassBlurView, color: Int ->
        view.tintColor = color
      }
      // Factor de reducción del bitmap capturado (12 → ~100×220 px).
      Prop("reduction") { view: GlassBlurView, reduction: Float ->
        view.reduction = reduction.coerceAtLeast(1f)
      }
      // Radio del desenfoque de caja, en píxeles del bitmap reducido.
      Prop("blurRadius") { view: GlassBlurView, radius: Int ->
        view.blurRadius = radius.coerceIn(0, 12)
      }
    }
  }
}
