package expo.modules.glassblur

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * Cristal esmerilado: pinta el recorte que le toca de la captura compartida
 * (SharedBlurSource) escalado a tamaño real y, encima, el tinte. La forma
 * (esquinas redondeadas) la recorta el padre de React Native con
 * `overflow: hidden`, igual que hacía con el BlurView de expo-blur.
 */
class GlassBlurView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var tintColor: Int = Color.TRANSPARENT
    set(value) { field = value; invalidate() }
  var reduction: Float = 12f
  var blurRadius: Int = 2

  private val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG)
  private val location = IntArray(2)

  init {
    setWillNotDraw(false)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    SharedBlurSource.attach(this)
  }

  override fun onDetachedFromWindow() {
    SharedBlurSource.detach(this)
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    // Durante la captura de la raíz no se pinta nada: si no, la foto llevaría
    // dentro el cristal anterior.
    if (SharedBlurSource.capturing) return
    val bitmap = SharedBlurSource.frame()
    if (bitmap != null) {
      getLocationInWindow(location)
      val scale = SharedBlurSource.reduction
      canvas.save()
      canvas.scale(scale, scale)
      canvas.translate(-location[0] / scale, -location[1] / scale)
      canvas.drawBitmap(bitmap, 0f, 0f, paint)
      canvas.restore()
    }
    if (tintColor != Color.TRANSPARENT) canvas.drawColor(tintColor)
  }
}
