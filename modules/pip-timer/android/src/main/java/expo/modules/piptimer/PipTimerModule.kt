package expo.modules.piptimer

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.annotation.RequiresApi
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Ventana flotante del temporizador de descanso: el Picture-in-Picture nativo de
// Android, el mismo que usa YouTube al minimizar. La ventanita la dibuja, la
// mueve y la cierra el sistema; la app solo pinta su contenido (React sigue
// renderizando dentro, ver components/PipRestTimer.tsx).
//
// Desde Android 12 (API 31) basta con declarar `setAutoEnterEnabled`: el sistema
// entra solo con el gesto de inicio, sin saltos. Por debajo (API 26-30) hay que
// pedirlo a mano en `onUserLeaveHint()`, que es lo que hace MainActivity leyendo
// la bandera de PipTimerController.
class PipTimerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PipTimer")

    Events("onPipModeChanged")

    OnCreate {
      PipTimerController.setListener { inPip ->
        sendEvent("onPipModeChanged", mapOf("inPip" to inPip))
      }
    }

    OnDestroy {
      PipTimerController.setListener(null)
      PipTimerController.autoEnterEnabled = false
    }

    Function("isSupported") {
      isSupported()
    }

    // JS avisa de si hay un descanso corriendo. En Android 12+ se traslada ya a
    // los parámetros de la Activity (auto-entrada); en versiones viejas solo se
    // guarda la bandera y la lee MainActivity al minimizar.
    Function("setAutoEnter") { enabled: Boolean ->
      PipTimerController.autoEnterEnabled = enabled
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        onUiThread { activity ->
          runCatching { activity.setPictureInPictureParams(buildParams(enabled)) }
        }
      }
    }

    // Entrada manual: por si en algún sitio interesa mandar el descanso a la
    // ventanita sin esperar a que el usuario minimice.
    Function("enter") {
      if (isSupported()) {
        onUiThread { activity ->
          runCatching { activity.enterPictureInPictureMode(buildParams(false)) }
        }
      }
    }
  }

  private fun currentActivity(): Activity? =
    appContext.activityProvider?.currentActivity

  private fun isSupported(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    val activity = currentActivity() ?: return false
    return activity.packageManager.hasSystemFeature(
      PackageManager.FEATURE_PICTURE_IN_PICTURE
    )
  }

  // Las llamadas de PiP exigen hilo de UI y las Function de Expo llegan por el
  // hilo de JS: se encolan sin bloquear (ninguna devuelve dato a JS).
  private fun onUiThread(block: (Activity) -> Unit) {
    val activity = currentActivity() ?: return
    activity.runOnUiThread { block(activity) }
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun buildParams(autoEnter: Boolean): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()
      .setAspectRatio(
        Rational(PipTimerController.aspectWidth, PipTimerController.aspectHeight)
      )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoEnter)
      // Sin "seamless": el contenido no es un vídeo, así que al encoger conviene
      // el fundido cruzado y no el estirado del último fotograma.
      builder.setSeamlessResizeEnabled(false)
    }
    return builder.build()
  }
}
