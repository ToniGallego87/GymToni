package expo.modules.splashtheme

import android.content.Context

// ESPEJO del modo de tema (claro u oscuro) para el splash nativo: el tema lo
// manda la base de ajustes de JS (lib/appSettings.ts), pero el splash se pinta
// antes de que exista JS. JS lo mantiene al día (lib/splashTheme.ts) y
// MainActivity lo lee al arrancar. Si alguna vez queda desfasado, solo sale
// de otro color un splash: JS lo corrige en ese mismo arranque.
object SplashThemeController {
  private const val PREFS = "gymbro_splash_theme"
  private const val KEY_LIGHT = "light"

  /** Modo guardado; sin ninguno todavía (instalación nueva), oscuro. */
  fun isLight(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_LIGHT, false)

  /**
   * Guarda el modo si cambia. apply(): actualiza la memoria al momento y escribe
   * a disco en segundo plano, sin bloquear el hilo de JS (se llama en plena
   * animación del cambio de tema). Android espera a que termine antes de dar
   * por parada la Activity.
   */
  fun save(context: Context, light: Boolean) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    // Sin valor guardado, el defecto (!light) nunca coincide: se escribe.
    if (prefs.getBoolean(KEY_LIGHT, !light) == light) return
    prefs.edit().putBoolean(KEY_LIGHT, light).apply()
  }
}

/** La Activity que pinta el splash: aplica el modo a sus recursos en caliente. */
interface SplashThemeHost {

  /**
   * Splash del sistema del siguiente arranque y, con [updateWindow], el fondo
   * de la ventana (solo cuando la app ya la tapa: si no, el cambio se vería).
   */
  fun applySplashTheme(light: Boolean, updateWindow: Boolean)
}
