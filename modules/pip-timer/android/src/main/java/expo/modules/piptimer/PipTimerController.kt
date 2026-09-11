package expo.modules.piptimer

// Puente entre el módulo Expo (JS) y la Activity de la app.
//
// El modo Picture-in-Picture no se puede pedir desde JS cuando el usuario ya ha
// minimizado: para entonces la Activity está en pausa y Android rechaza la
// petición. Hay que pedirlo ANTES, en `onUserLeaveHint()`, que solo la Activity
// recibe. Así que JS deja aquí una bandera ("hay un descanso en marcha") y la
// Activity la consulta al salir; de vuelta, la Activity avisa de los cambios de
// modo para que JS pinte la vista compacta.
//
// Es un singleton a propósito: la Activity no puede depender del módulo por
// gradle, pero el módulo se enlaza con `api` (ver node_modules/expo/android/
// build.gradle), así que sus clases SÍ son visibles desde la app.
object PipTimerController {
  /** ¿Hay un descanso corriendo? Solo entonces se entra en PiP al minimizar. */
  @Volatile
  var autoEnterEnabled: Boolean = false

  /** Ancho:alto de la ventanita. Lo fija JS para que cuadre con lo que pinta. */
  @Volatile
  var aspectWidth: Int = 16

  @Volatile
  var aspectHeight: Int = 9

  private var listener: ((Boolean) -> Unit)? = null

  fun setListener(next: ((Boolean) -> Unit)?) {
    listener = next
  }

  /** La llama la Activity desde `onPictureInPictureModeChanged`. */
  fun notifyPipMode(inPip: Boolean) {
    listener?.invoke(inPip)
  }
}
