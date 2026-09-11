package com.tonigallego.gymbro

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.graphics.Color
import android.util.Rational
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.annotation.RequiresApi
import androidx.core.graphics.toColorInt
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import expo.modules.piptimer.PipTimerController

class MainActivity : ReactActivity() {
  private fun applySystemBarStyle() {
    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
    // En pantallas con muesca/cámara el modo por defecto reserva la franja del cutout
    // (status bar), impidiendo que el contenido se dibuje detrás. shortEdges lo permite.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes = window.attributes.apply {
        layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
    }
    // Edge-to-edge: el contenido se dibuja detrás de las barras de sistema. Requiere
    // targetSdk >= 35 para que Android 15+ no fuerce el inset del status bar.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.statusBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
    }
    // RN aplica el inset superior como padding del content view, empujando todo bajo
    // el status bar. Forzamos padding 0 y dejamos pasar los insets a los hijos para
    // que react-native-safe-area-context los siga leyendo (la barra glass se dimensiona
    // con ellos y cubre el status bar).
    findViewById<View>(android.R.id.content)?.let { content ->
      ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
        v.setPadding(0, 0, 0, 0)
        insets
      }
      ViewCompat.requestApplyInsets(content)
    }
    WindowCompat.getInsetsController(window, window.decorView)?.isAppearanceLightStatusBars = false

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.insetsController?.setSystemBarsAppearance(
        0,
        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
      )
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility =
        window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
    }
  }

  // ─────────────────────── Atrás del sistema (Android 13+) ───────────────────────
  // Desde targetSdk 36 el atrás predictivo es obligatorio: el sistema deja de
  // llamar a onBackPressed() y entrega el evento por OnBackInvokedCallback.
  // React Native 0.74 solo escucha el camino clásico, así que sin este puente
  // BackHandler (app/App.tsx, que resuelve el destino de cada pantalla) nunca se
  // entera y Android cierra la Activity: el atrás salía de la app desde
  // cualquier pantalla en vez de comportarse como el "Volver" de la barra.
  //
  // El callback se reenvía a onBackPressed(), que es la puerta de entrada del
  // delegate de RN: de ahí el evento llega a JS y, solo si nadie lo gestiona
  // (Inicio), vuelve por invokeDefaultOnBackPressed() para cerrar de verdad.
  // Se guarda como Any? a propósito: un campo tipado con la clase de API 33 se
  // cargaría también en dispositivos antiguos (minSdk 23).
  private var backInvokedCallback: Any? = null

  @RequiresApi(Build.VERSION_CODES.TIRAMISU)
  private fun registerOnBackInvokedCallback() {
    if (backInvokedCallback != null) return
    @Suppress("DEPRECATION")
    val callback = OnBackInvokedCallback { onBackPressed() }
    onBackInvokedDispatcher.registerOnBackInvokedCallback(
      OnBackInvokedDispatcher.PRIORITY_DEFAULT,
      callback
    )
    backInvokedCallback = callback
  }

  @RequiresApi(Build.VERSION_CODES.TIRAMISU)
  private fun unregisterOnBackInvokedCallback() {
    (backInvokedCallback as? OnBackInvokedCallback)?.let {
      onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it)
    }
    backInvokedCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    applySystemBarStyle()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerOnBackInvokedCallback()
    }
  }

  override fun onDestroy() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      unregisterOnBackInvokedCallback()
    }
    super.onDestroy()
  }

  override fun onResume() {
    super.onResume()
    applySystemBarStyle()
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
