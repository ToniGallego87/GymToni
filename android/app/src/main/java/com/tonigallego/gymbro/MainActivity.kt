package com.tonigallego.gymbro
import expo.modules.splashscreen.SplashScreenManager

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.util.Rational

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import expo.modules.piptimer.PipTimerController

// Barras del sistema: edge-to-edge lo pone React Native (edgeToEdgeEnabled en
// gradle.properties) y el color de los iconos de la barra de estado lo decide
// cada pantalla con <StatusBar> de expo-status-bar. Los botones de la barra de
// navegación siguen el tema de la APP (no el del sistema): los pone App.tsx
// con expo-navigation-bar.
//
// Atrás del sistema: ReactActivity (RN 0.81) ya escucha el atrás predictivo de
// targetSdk 36 por el dispatcher de AndroidX y se lo pasa a BackHandler; el
// puente casero que hacía falta con RN 0.74 sobra.
class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    // El splash del sistema (negro, sin icono: ver Theme.App.SplashScreen) no
    // se retiene hasta que JS esté listo: en cuanto la Activity pinta se ve su
    // fondo, el titular a tamaño completo, y SplashFade hace la salida.
    SplashScreenManager.hide()
    super.onCreate(null)
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
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
