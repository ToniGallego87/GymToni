package expo.modules.splashtheme

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Puente JS → nativo del tema para el splash (ver SplashThemeController). JS
// llama a setMode al arrancar y en cada cambio de tema (lib/splashTheme.ts).
class SplashThemeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplashTheme")

    Function("setMode") { mode: String ->
      val context = appContext.reactContext ?: return@Function
      val light = mode == "light"
      SplashThemeController.save(context, light)
      // Se reaplica aunque no haya cambiado: el splash del sistema se pierde
      // al reinstalar o forzar el cierre, y la ventana puede ser nueva.
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        runCatching { SplashThemeController.listener?.invoke(light) }
      }
    }
  }
}
