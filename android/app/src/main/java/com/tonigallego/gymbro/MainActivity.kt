package com.tonigallego.gymbro
import expo.modules.splashscreen.SplashScreenManager

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.Rational
import androidx.core.view.WindowCompat

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import expo.modules.piptimer.PipTimerController
import expo.modules.splashtheme.SplashThemeController
import expo.modules.splashtheme.SplashThemeHost

// Barras del sistema: edge-to-edge lo pone React Native (edgeToEdgeEnabled en
// gradle.properties) y el color de los iconos de la barra de estado lo decide
// cada pantalla con <StatusBar> de expo-status-bar. Los botones de la barra de
// navegación siguen el tema de la APP (no el del sistema): los pone App.tsx
// con expo-navigation-bar. Hasta que JS los pone, los del splash (onCreate).
//
// Atrás del sistema: ReactActivity (RN 0.81) ya escucha el atrás predictivo de
// targetSdk 36 por el dispatcher de AndroidX y se lo pasa a BackHandler; el
// puente casero que hacía falta con RN 0.74 sobra.
class MainActivity : ReactActivity(), SplashThemeHost {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    // El splash del sistema (negro, sin icono: ver Theme.App.SplashScreen) no
    // se retiene hasta que JS esté listo: en cuanto la Activity pinta se ve su
    // fondo, el titular a tamaño completo, y SplashFade hace la salida.
    SplashScreenManager.hide()
    // Splash del color con el que va a arrancar la app: en modo claro, blanco
    // con el titular de día (AppTheme.Light). El modo es el espejo que JS deja
    // en modules/splash-theme (sin espejo todavía, oscuro). Va después de
    // registerOnActivity, que pone AppTheme (postSplashScreenTheme) y lo pisaría.
    val light = SplashThemeController.isLight(this)
    if (light) setTheme(R.style.AppTheme_Light)
    windowLight = light
    super.onCreate(null)
    // RN (enableEdgeToEdge, en super.onCreate) pinta los iconos de las barras
    // según el tema del SISTEMA: con el móvil en claro y la app en oscuro salían
    // oscuros sobre el splash negro hasta que JS ponía los suyos (App.tsx, según
    // el tema de la app). Mientras tanto, los que pide el splash.
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = light
      isAppearanceLightNavigationBars = light
    }
  }

  // Modo del fondo de la ventana, para no rehacerlo si no cambia.
  private var windowLight = false

  /**
   * Lo pide JS (SplashThemeModule.setMode) al arrancar y en cada cambio de
   * tema:
   * - El splash del SISTEMA se pinta antes de que exista la app, así que no
   *   puede leer el tema: en Android 13+ se le deja dicho cuál usar en el
   *   siguiente arranque (Android lo olvida tras instalar, actualizar o forzar
   *   el cierre; por eso se repite en cada arranque). En Android 12 o menos, y
   *   en 13+ en el primer arranque tras instalar, actualizar o forzar el
   *   cierre, sale el negro.
   * - El fondo de la ventana asoma en cualquier hueco entre capas: el del tema
   *   de ahora, no el del arranque. Solo con [updateWindow] (la app ya tapa la
   *   ventana; antes el cambio se vería).
   */
  override fun applySplashTheme(light: Boolean, updateWindow: Boolean) {
    // Llega por runOnUiThread: la Activity puede haber muerto entre medias. Su
    // ventana ya no importa, pero el splash del sistema sí (es de la app).
    val windowAlive = !isFinishing && !isDestroyed
    if (windowAlive && updateWindow && light != windowLight) {
      runCatching {
        window.setBackgroundDrawableResource(
          if (light) R.drawable.splashscreen_light else R.drawable.splashscreen
        )
        windowLight = light
      }.onFailure { Log.w(TAG, "No se pudo cambiar el fondo de la ventana", it) }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      runCatching {
        splashScreen.setSplashScreenTheme(
          if (light) R.style.Theme_App_SplashScreen_Light else Resources.ID_NULL
        )
      }.onFailure { Log.w(TAG, "No se pudo fijar el splash del sistema", it) }
    }
  }

  override fun onResume() {
    super.onResume()
    // De vuelta a pantalla completa: RN ya está resumido por el ciclo normal,
    // así que la muleta de abajo deja de estar puesta.
    pipHostResumed = false
  }

  // ──────────── Repintado de React dentro de la ventanita (PiP) ────────────
  // Entrar en PiP PAUSA la Activity, y al pausarse React Native deja de volcar
  // cambios a las vistas nativas (UIManagerModule.onHostPause corta el
  // DISPATCH_UI del choreographer). El árbol seguía vivo —al volver a pantalla
  // completa la cuenta atrás estaba al día— pero la ventanita se quedaba con el
  // último fotograma: un temporizador congelado.
  //
  // Aquí se le devuelve a RN el estado "resumido" mientras dura la ventanita,
  // que es lo honesto: en PiP la app SIGUE VISIBLE. Se deshace en onStop(), por
  // donde pasa siempre que la ventanita se cierra y la app se va al fondo.
  private var pipHostResumed = false

  private fun keepReactRenderingInPip() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (!isInPictureInPictureMode) return
    pipHostResumed = true
    runCatching {
      (application as? ReactApplication)
        ?.reactNativeHost
        ?.reactInstanceManager
        ?.onHostResume(this)
    }
  }

  override fun onPause() {
    // super.onPause() es donde RN se pausa: rearmar DESPUÉS. Se hace también
    // aquí (y no solo en onPictureInPictureModeChanged) porque el orden de las
    // dos llamadas al entrar en PiP no es el mismo en todas las versiones de
    // Android, y quien llegue el último tiene que dejar RN despierto.
    super.onPause()
    keepReactRenderingInPip()
  }

  override fun onStop() {
    if (pipHostResumed) {
      pipHostResumed = false
      runCatching {
        (application as? ReactApplication)
          ?.reactNativeHost
          ?.reactInstanceManager
          ?.onHostPause(this)
      }
    }
    super.onStop()
  }

  // ───────────────── Ventana flotante del descanso (Picture-in-Picture) ─────────────────
  // Con un descanso corriendo, minimizar la app deja el temporizador en una
  // ventanita movible encima de lo que sea que estés mirando (igual que el vídeo
  // de YouTube). Quién manda es JS: enciende y apaga la bandera de
  // PipTimerController al arrancar y parar la cuenta atrás.
  //
  // En Android 12+ el sistema entra solo (setAutoEnterEnabled, ver
  // PipTimerModule) y este onUserLeaveHint no llega a hacer nada. En 8.0-11 no
  // existe esa opción y hay que pedirlo aquí: es el último aviso que recibe la
  // Activity mientras todavía está visible, cuando ya es tarde para JS.
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
    if (!PipTimerController.autoEnterEnabled) return
    runCatching {
      enterPictureInPictureMode(
        PictureInPictureParams.Builder()
          .setAspectRatio(
            Rational(
              PipTimerController.aspectWidth,
              PipTimerController.aspectHeight
            )
          )
          .build()
      )
    }
  }

  // El árbol de React sigue montado dentro de la ventanita: se avisa a JS para
  // que pinte encima la vista compacta (components/PipRestTimer.tsx) y la quite
  // al volver a pantalla completa.
  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    if (isInPictureInPictureMode) keepReactRenderingInPip()
    PipTimerController.notifyPipMode(isInPictureInPictureMode)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
   * Atrás en Inicio (nadie en JS lo gestiona): la app pasa al fondo, sin
   * cerrarse, en todas las versiones.
   *
   * NO llamar a super salvo que moveTaskToBack falle: el de ReactActivity
   * (RN 0.81) apaga para siempre su callback del atrás predictivo, y como la
   * Activity no muere, al volver a la app el atrás de cualquier pantalla ya no
   * llegaba a BackHandler y mandaba la app al fondo. Si falla (no es la raíz de
   * la tarea), super la cierra y el callback muere con ella.
   */
  override fun invokeDefaultOnBackPressed() {
    if (!moveTaskToBack(false)) {
      super.invokeDefaultOnBackPressed()
    }
  }

  private companion object {
    const val TAG = "MainActivity"
  }
}
