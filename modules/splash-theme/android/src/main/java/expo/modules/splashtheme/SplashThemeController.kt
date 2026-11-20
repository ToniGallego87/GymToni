package expo.modules.splashtheme

import android.content.Context

// El modo (claro u oscuro) con el que arrancará la app, para el splash nativo.
// El splash se pinta antes de que exista JS, así que JS lo deja guardado aquí
// (SharedPreferences, propio del nativo) cada vez que cambia el tema, y
// MainActivity lo lee al arrancar. MainActivity se suscribe con `listener` para
// rehacer en caliente lo que depende de sus recursos (splash del sistema del
// siguiente arranque y fondo de la ventana).
object SplashThemeController {
  private const val PREFS = "gymbro_splash_theme"
  private const val KEY_LIGHT = "light"

  @Volatile
  var listener: ((light: Boolean) -> Unit)? = null

  fun isLight(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_LIGHT, false)

  fun save(context: Context, light: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_LIGHT, light)
      .apply()
  }
}
