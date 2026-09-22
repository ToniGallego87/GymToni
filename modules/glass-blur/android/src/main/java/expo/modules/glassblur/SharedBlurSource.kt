package expo.modules.glassblur

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver

/**
 * UNA captura desenfocada de la pantalla por frame, compartida por todas las
 * GlassBlurView montadas.
 *
 * El BlurView de dimezis (expo-blur) redibuja la jerarquía entera de vistas en
 * un bitmap en CADA instancia y en cada frame: con cuatro barras borrosas eran
 * cuatro pasadas (~7 ms cada una en un gama media-alta). Aquí la pasada se hace
 * una vez, a escala 1/reduction, y cada barra pinta el recorte que le toca.
 *
 * Ciclo: en el preDraw de la raíz (layout hecho, aún sin dibujar) se captura la
 * pantalla, se desenfoca y se invalidan las barras, que en su onDraw pintan su
 * recorte. La invalidación que provocamos nosotros mismos dispara otro preDraw:
 * se detecta con `selfInvalidate` y se ignora, así en reposo no hay bucle de
 * redibujado (a diferencia de dimezis, que redibuja siempre).
 */
object SharedBlurSource {
  private val views = ArrayList<GlassBlurView>()
  private var root: ViewGroup? = null
  private var listener: ViewTreeObserver.OnPreDrawListener? = null

  private var stale = true
  private var selfInvalidate = false
  /** Mientras se dibuja la raíz en el bitmap, las barras no pintan nada (evita
   *  que la captura contenga la captura). */
  var capturing = false
    private set

  private var scratch: Bitmap? = null
  private var canvas: Canvas? = null
  private var blurred: Bitmap? = null
  private var pixels: IntArray = IntArray(0)
  private var temp: IntArray = IntArray(0)

  /** Factor de reducción efectivo (el de la primera vista; todas usan el mismo). */
  var reduction = 12f
    private set

  fun attach(view: GlassBlurView) {
    if (!views.contains(view)) views.add(view)
    val r = view.rootView as? ViewGroup ?: return
    if (root !== r) {
      detachRoot()
      root = r
      val l = ViewTreeObserver.OnPreDrawListener {
        if (selfInvalidate) {
          selfInvalidate = false
        } else if (views.isNotEmpty()) {
          stale = true
          capture(views[0].blurRadius)
          selfInvalidate = true
          for (v in views) v.invalidate()
        }
        true
      }
      r.viewTreeObserver.addOnPreDrawListener(l)
      listener = l
    }
    reduction = view.reduction
  }

  fun detach(view: GlassBlurView) {
    views.remove(view)
    if (views.isEmpty()) {
      detachRoot()
      scratch?.recycle(); scratch = null
      blurred?.recycle(); blurred = null
      canvas = null
      pixels = IntArray(0); temp = IntArray(0)
    }
  }

  private fun detachRoot() {
    val r = root ?: return
    val l = listener
    if (l != null && r.viewTreeObserver.isAlive) r.viewTreeObserver.removeOnPreDrawListener(l)
    root = null
    listener = null
  }

  /** El último bitmap desenfocado (escala 1/reduction), o null si aún no hay. */
  fun frame(): Bitmap? = blurred

  private fun capture(radius: Int) {
    val r = root ?: return
    val w = (r.width / reduction).toInt().coerceAtLeast(1)
    val h = (r.height / reduction).toInt().coerceAtLeast(1)
    if (r.width == 0 || r.height == 0) return

    var s = scratch
    if (s == null || s.width != w || s.height != h) {
      s?.recycle()
      s = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      scratch = s
      canvas = Canvas(s)
      blurred?.recycle()
      blurred = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      pixels = IntArray(w * h)
      temp = IntArray(w * h)
      stale = true
    }
    val out = blurred ?: return
    if (!stale) return

    val c = canvas ?: return
    c.save()
    c.scale(1f / reduction, 1f / reduction)
    capturing = true
    try {
      r.draw(c)
    } finally {
      capturing = false
      c.restore()
    }
    s.getPixels(pixels, 0, w, 0, 0, w, h)
    boxBlur(pixels, temp, w, h, radius)
    boxBlur(pixels, temp, w, h, radius)
    out.setPixels(pixels, 0, w, 0, 0, w, h)
    stale = false
  }

  /**
   * Desenfoque de caja separable (horizontal + vertical) con suma acumulada:
   * O(píxeles) por pasada, sin RenderScript. Dos pasadas se parecen bastante a
   * una gaussiana y el bitmap es minúsculo (a reducción 12, ~100×220).
   */
  private fun boxBlur(src: IntArray, dst: IntArray, w: Int, h: Int, radius: Int) {
    if (radius <= 0) return
    blurPass(src, dst, w, h, radius)      // horizontal: src → dst
    blurPassVertical(dst, src, w, h, radius) // vertical: dst → src
  }

  private fun blurPass(src: IntArray, dst: IntArray, w: Int, h: Int, radius: Int) {
    val div = radius * 2 + 1
    for (y in 0 until h) {
      val row = y * w
      var a = 0; var rr = 0; var g = 0; var b = 0
      for (i in -radius..radius) {
        val p = src[row + i.coerceIn(0, w - 1)]
        a += p ushr 24; rr += (p shr 16) and 0xff; g += (p shr 8) and 0xff; b += p and 0xff
      }
      for (x in 0 until w) {
        dst[row + x] = ((a / div) shl 24) or ((rr / div) shl 16) or ((g / div) shl 8) or (b / div)
        val pOut = src[row + (x - radius).coerceIn(0, w - 1)]
        val pIn = src[row + (x + radius + 1).coerceIn(0, w - 1)]
        a += (pIn ushr 24) - (pOut ushr 24)
        rr += ((pIn shr 16) and 0xff) - ((pOut shr 16) and 0xff)
        g += ((pIn shr 8) and 0xff) - ((pOut shr 8) and 0xff)
        b += (pIn and 0xff) - (pOut and 0xff)
      }
    }
  }

  private fun blurPassVertical(src: IntArray, dst: IntArray, w: Int, h: Int, radius: Int) {
    val div = radius * 2 + 1
    for (x in 0 until w) {
      var a = 0; var rr = 0; var g = 0; var b = 0
      for (i in -radius..radius) {
        val p = src[i.coerceIn(0, h - 1) * w + x]
        a += p ushr 24; rr += (p shr 16) and 0xff; g += (p shr 8) and 0xff; b += p and 0xff
      }
      for (y in 0 until h) {
        dst[y * w + x] = ((a / div) shl 24) or ((rr / div) shl 16) or ((g / div) shl 8) or (b / div)
        val pOut = src[(y - radius).coerceIn(0, h - 1) * w + x]
        val pIn = src[(y + radius + 1).coerceIn(0, h - 1) * w + x]
        a += (pIn ushr 24) - (pOut ushr 24)
        rr += ((pIn shr 16) and 0xff) - ((pOut shr 16) and 0xff)
        g += ((pIn shr 8) and 0xff) - ((pOut shr 8) and 0xff)
        b += (pIn and 0xff) - (pOut and 0xff)
      }
    }
  }
}
