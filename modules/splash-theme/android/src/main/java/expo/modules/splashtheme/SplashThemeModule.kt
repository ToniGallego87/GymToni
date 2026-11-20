package expo.modules.splashtheme

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Puente JS ↔ nativo del espejo del tema (ver SplashThemeController).
class SplashThemeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplashTheme")

    // Modo del splash que hay en pantalla: "light" | "dark". Es el espejo, con el
    // que MainActivity pinta su ventana en onCreate; App.tsx lo lee al montarse
    // (antes de su primer setMode) para que SplashFade lo copie.
    Function("getWindowMode") {
      val context = appContext.reactContext
      if (context != null && SplashThemeController.isLight(context)) "light" else "dark"
    }

    // Guarda el modo y lo aplica a la Activity (splash del sistema del
    // siguiente arranque y, con updateWindow, el fondo de la ventana). Sin
    // Activity basta con guardarlo: MainActivity lo lee en su onCreate.
    // (currentActivity sigue siendo MainActivity aunque haya otra encima: React
    // la suelta solo al destruirla.) Sin contexto no hace nada: JS sincroniza
    // en cada arranque y cada cambio de tema, y lo corrige la siguiente vez.
    Function("setMode") { mode: String, updateWindow: Boolean ->
      val context = appContext.reactContext ?: return@Function
      val light = mode == "light"
      SplashThemeController.save(context, light)
      val activity = appContext.currentActivity ?: return@Function
      val host = activity as? SplashThemeHost ?: return@Function
      activity.runOnUiThread { host.applySplashTheme(light, updateWindow) }
    }
  }
}
