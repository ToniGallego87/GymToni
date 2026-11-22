package expo.modules.videoencoder

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.view.View
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future

// Codifica fotogramas en un MP4 H.264 usando MediaCodec + MediaMuxer. Sin
// dependencias externas: solo APIs de Android. Los fotogramas clave vienen de
// ficheros (PNG/JPG) o se capturan aquí mismo de una vista (lo rápido: sin
// comprimir, escribir ni volver a leer cada imagen).
class VideoEncoderModule : Module() {
  // Claves capturadas en memoria (captureFrame) de UN vídeo, por índice, ya en
  // YUV o en camino: la conversión corre en un hilo aparte mientras la app
  // pinta la siguiente. ~1,4 MB por clave a 720×1280.
  private class Session(val width: Int, val height: Int) {
    val frames = HashMap<Int, Future<YuvFrame>>()
  }

  // Una sesión por vídeo (la elige JS): soltar o codificar uno no toca los
  // fotogramas de otro que ya ha empezado (p. ej. salir de la pantalla con uno
  // montándose y empezar otro al volver). Todo bajo `lock`.
  private val lock = Any()
  private val sessions = HashMap<String, Session>()
  // Sesiones que se están codificando: no se sueltan al empezar otra.
  private val encoding = HashSet<String>()
  // Sesiones ya soltadas (las últimas): una captura que llegue tarde (p. ej.
  // tras el tiempo límite de JS) se descarta en vez de quedarse en memoria.
  private val closed = LinkedHashSet<String>()
  private var converter: ExecutorService? = null
  // Lienzo reutilizado para dibujar la vista (se dibuja en el hilo de UI).
  private var captureBitmap: Bitmap? = null

  override fun definition() = ModuleDefinition {
    Name("VideoEncoder")

    // Un fotograma de vídeo por fichero, tal cual.
    AsyncFunction("encode") { framePaths: List<String>, outputPath: String, fps: Int ->
      encodeFromFiles(framePaths, outputPath, if (fps > 0) fps else 20, 1, 0, emptyList(), emptyList())
      outputPath
    }

    // Fotogramas CLAVE: entre cada dos se generan `steps - 1` intermedios
    // fundiendo uno en otro, y el último se mantiene `holdFrames` fotogramas
    // más. Así la app captura una fracción de los fotogramas (lo lento) y el
    // movimiento sigue siendo fluido.
    //
    // `ringGeometry` (4 números por anillo, en píxeles del fotograma: cx, cy,
    // radio y medio grosor) y `ringFractions` (cuánto lleva relleno cada anillo
    // en cada clave, clave a clave): en los intermedios, la zona de un anillo
    // que crece no se funde (se vería el arco viejo y el nuevo a la vez, a
    // medias) sino que se BARRE por ángulo hasta el punto intermedio.
    AsyncFunction("encodeKeyframes") { keyPaths: List<String>, outputPath: String, fps: Int, steps: Int, holdFrames: Int, ringGeometry: List<Double>, ringFractions: List<Double> ->
      val rings = parseRings(ringGeometry)
      encodeFromFiles(
        keyPaths,
        outputPath,
        if (fps > 0) fps else 20,
        steps.coerceAtLeast(1),
        holdFrames.coerceAtLeast(0),
        rings,
        if (ringFractions.size == rings.size * keyPaths.size) ringFractions else emptyList()
      )
      outputPath
    }

    // Dibuja la vista `viewTag` a width×height y la guarda como clave `index`
    // de `session` (en memoria; una captura repetida del mismo índice la
    // sustituye; una sesión ya soltada la descarta). En el
    // hilo de UI, como react-native-view-shot con el parche de GymToni: dibujar
    // desde otro hilo mientras React Native muta el árbol daba capturas a
    // medias.
    AsyncFunction("captureFrame") { session: String, viewTag: Int, index: Int, width: Int, height: Int ->
      if (synchronized(lock) { session in closed }) return@AsyncFunction index
      val view = appContext.findView<View>(viewTag)
        ?: throw Exception("Vista no encontrada")
      if (view.width <= 0 || view.height <= 0) throw Exception("Vista sin tamaño")
      val w = width and 1.inv()
      val h = height and 1.inv()
      val bitmap = captureBitmap?.takeIf { it.width == w && it.height == h }
        ?: Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
          captureBitmap?.recycle()
          captureBitmap = it
        }
      bitmap.eraseColor(0)
      val canvas = Canvas(bitmap)
      canvas.scale(w.toFloat() / view.width, h.toFloat() / view.height)
      view.draw(canvas)
      // Copia de los píxeles (rápida) para soltar el lienzo; la conversión a
      // YUV (lo caro) va al hilo aparte.
      val argb = IntArray(w * h)
      bitmap.getPixels(argb, 0, w, 0, 0, w, h)
      val executor = converter ?: Executors.newSingleThreadExecutor().also { converter = it }
      synchronized(lock) {
        if (session in closed) return@AsyncFunction index
        var current = sessions[session]
        if (current == null || current.width != w || current.height != h) {
          // Vídeo nuevo: lo que quede de otros que no se están codificando es
          // de vídeos abandonados (sin su discardCaptured): fuera.
          sessions.keys.filter { it != session && it !in encoding }.forEach { closeLocked(it) }
          current?.frames?.values?.forEach { it.cancel(false) }
          current = Session(w, h)
          sessions[session] = current
        }
        current.frames.put(index, executor.submit<YuvFrame> { argbToYuv(argb, w, h) })
          ?.cancel(false)
      }
      index
    }.runOnQueue(Queues.MAIN)

    // Codifica las claves capturadas de `session` (0..keyCount-1) como
    // encodeKeyframes y las suelta de memoria.
    AsyncFunction("encodeCaptured") { session: String, keyCount: Int, outputPath: String, fps: Int, steps: Int, holdFrames: Int, ringGeometry: List<Double>, ringFractions: List<Double> ->
      try {
        val current = synchronized(lock) {
          encoding.add(session)
          sessions[session]
        } ?: throw Exception("No hay fotogramas capturados")
        val frames = (0 until keyCount).map { k ->
          synchronized(lock) { current.frames[k] }?.get()
            ?: throw Exception("Falta el fotograma $k")
        }
        val rings = parseRings(ringGeometry)
        encodeFrames(
          frames.size,
          current.width,
          current.height,
          { k -> frames[k] },
          stripScheme(outputPath),
          if (fps > 0) fps else 20,
          steps.coerceAtLeast(1),
          holdFrames.coerceAtLeast(0),
          rings,
          if (ringFractions.size == rings.size * frames.size) ringFractions else emptyList()
        )
      } finally {
        synchronized(lock) {
          encoding.remove(session)
          closeLocked(session)
        }
      }
      outputPath
    }

    // Suelta lo capturado de `session` sin codificar (vídeo cancelado o
    // fallido). Las capturas que lleguen después se descartan.
    Function("discardCaptured") { session: String ->
      synchronized(lock) { closeLocked(session) }
    }

    OnDestroy {
      synchronized(lock) {
        sessions.values.forEach { s -> s.frames.values.forEach { it.cancel(false) } }
        sessions.clear()
        encoding.clear()
      }
      converter?.shutdown()
      converter = null
    }
  }

  // Suelta una sesión y la recuerda como cerrada (solo las últimas: los ids
  // no se repiten). Llamar con `lock` cogido.
  private fun closeLocked(session: String) {
    sessions.remove(session)?.frames?.values?.forEach { it.cancel(false) }
    closed.add(session)
    while (closed.size > 16) closed.remove(closed.first())
  }

  private class Ring(val cx: Double, val cy: Double, val radius: Double, val halfStroke: Double)

  private fun parseRings(geometry: List<Double>): List<Ring> =
    geometry.chunked(4).filter { it.size == 4 }.map { Ring(it[0], it[1], it[2], it[3]) }

  private fun stripScheme(path: String): String =
    if (path.startsWith("file://")) path.removePrefix("file://") else path

  // Claves desde ficheros: se decodifican y convierten bajo demanda, guardando
  // solo la actual y la siguiente.
  private fun encodeFromFiles(
    rawPaths: List<String>,
    rawOutput: String,
    fps: Int,
    steps: Int,
    holdFrames: Int,
    rings: List<Ring>,
    ringFractions: List<Double>
  ) {
    if (rawPaths.isEmpty()) throw Exception("No hay fotogramas que codificar")

    val keyPaths = rawPaths.map { stripScheme(it) }

    val firstBitmap = BitmapFactory.decodeFile(keyPaths[0])
      ?: throw Exception("No se pudo leer el primer fotograma")
    // Dimensiones pares (requisito de la mayoría de codecs).
    val width = firstBitmap.width and 1.inv()
    val height = firstBitmap.height and 1.inv()
    firstBitmap.recycle()

    // Las dos claves en uso, ya en YUV (decodificar y convertir es lo caro: una
    // vez por clave). Los repetidos consecutivos salen gratis.
    val loaded = HashMap<String, YuvFrame>()
    fun keyframe(k: Int): YuvFrame? {
      val path = keyPaths[k]
      loaded[path]?.let { return it }
      val bitmap = BitmapFactory.decodeFile(path) ?: return null
      val yuv = toYuv(bitmap, width, height)
      bitmap.recycle()
      // Solo se necesitan la clave actual y la siguiente.
      if (loaded.size >= 2) loaded.keys.retainAll(setOf(keyPaths[maxOf(0, k - 1)]))
      loaded[path] = yuv
      return yuv
    }

    encodeFrames(
      keyPaths.size,
      width,
      height,
      { k -> keyframe(k) },
      stripScheme(rawOutput),
      fps,
      steps,
      holdFrames,
      rings,
      ringFractions
    )
  }

  private fun encodeFrames(
    keyCount: Int,
    width: Int,
    height: Int,
    keyframe: (Int) -> YuvFrame?,
    outputPath: String,
    fps: Int,
    steps: Int,
    holdFrames: Int,
    rings: List<Ring>,
    ringFractions: List<Double>
  ) {
    if (keyCount <= 0) throw Exception("No hay fotogramas que codificar")

    // Fotograma de salida i → clave k (y la siguiente, con su peso s/steps).
    val animatedFrames = (keyCount - 1) * steps
    val totalFrames = animatedFrames + 1 + holdFrames

    val blended = YuvFrame(
      ByteArray(width * height),
      ByteArray((width / 2) * (height / 2)),
      ByteArray((width / 2) * (height / 2))
    )
    fun frameAt(i: Int): YuvFrame? {
      if (i >= animatedFrames) return keyframe(keyCount - 1)
      val k = i / steps
      val s = i % steps
      val a = keyframe(k) ?: return null
      if (s == 0) return a
      val b = keyframe(k + 1) ?: return a
      blend(a, b, s, steps, blended)
      if (ringFractions.isNotEmpty()) {
        val n = rings.size
        for (j in 0 until n) {
          val fa = ringFractions[k * n + j]
          val fb = ringFractions[(k + 1) * n + j]
          if (fb > fa) {
            val ft = fa + (fb - fa) * s / steps
            sweepRing(a, b, blended, rings[j], fa, fb, ft, width, height)
          }
        }
      }
      return blended
    }

    val mime = MediaFormat.MIMETYPE_VIDEO_AVC
    val format = MediaFormat.createVideoFormat(mime, width, height).apply {
      setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible
      )
      val bitRate = (width.toLong() * height.toLong() * fps / 5L).toInt().coerceAtLeast(3_000_000)
      setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    val codec = MediaCodec.createEncoderByType(mime)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()

    File(outputPath).parentFile?.mkdirs()
    val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var trackIndex = -1
    var muxerStarted = false

    val bufferInfo = MediaCodec.BufferInfo()
    val frameDurationUs = 1_000_000L / fps
    val yuvFrameSize = width * height * 3 / 2

    var frameIndex = 0
    var inputDone = false
    var outputDone = false

    fun drainOutput(timeoutUs: Long) {
      while (true) {
        val outIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
        when {
          outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> return
          outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            trackIndex = muxer.addTrack(codec.outputFormat)
            muxer.start()
            muxerStarted = true
          }
          outIndex >= 0 -> {
            val encoded = codec.getOutputBuffer(outIndex)
            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
              bufferInfo.size = 0
            }
            if (bufferInfo.size > 0 && muxerStarted && encoded != null) {
              encoded.position(bufferInfo.offset)
              encoded.limit(bufferInfo.offset + bufferInfo.size)
              muxer.writeSampleData(trackIndex, encoded, bufferInfo)
            }
            codec.releaseOutputBuffer(outIndex, false)
            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              outputDone = true
              return
            }
          }
        }
      }
    }

    try {
      while (!outputDone) {
        if (!inputDone) {
          val inIndex = codec.dequeueInputBuffer(10_000)
          if (inIndex >= 0) {
            if (frameIndex >= totalFrames) {
              codec.queueInputBuffer(
                inIndex,
                0,
                0,
                frameIndex * frameDurationUs,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM
              )
              inputDone = true
            } else {
              val yuv = frameAt(frameIndex)
              val image = codec.getInputImage(inIndex)
              if (yuv != null && image != null) {
                writeYuv(image, yuv, width, height)
              }
              codec.queueInputBuffer(inIndex, 0, yuvFrameSize, frameIndex * frameDurationUs, 0)
              frameIndex++
            }
          }
        }
        drainOutput(if (inputDone) 10_000 else 0)
      }
    } finally {
      codec.stop()
      codec.release()
      if (muxerStarted) {
        muxer.stop()
      }
      muxer.release()
    }
  }

  // Fundido lineal a → b con peso s/steps, plano a plano. En YUV vale igual
  // que en RGB (la conversión es lineal), y es lo que hace una opacidad.
  private fun blend(a: YuvFrame, b: YuvFrame, s: Int, steps: Int, out: YuvFrame) {
    blendPlane(a.y, b.y, s, steps, out.y)
    blendPlane(a.u, b.u, s, steps, out.u)
    blendPlane(a.v, b.v, s, steps, out.v)
  }

  // Barrido de un anillo que crece entre dos claves (de `fa` a `fb` de la
  // vuelta, empezando arriba y en el sentido del reloj): en la zona que gana,
  // los píxeles hasta el ángulo intermedio `ft` (más la punta redondeada) se
  // toman de la clave siguiente y el resto de la anterior. Fuera de esa zona
  // se queda el fundido (opacidades, que sí se funden bien).
  private fun sweepRing(
    a: YuvFrame,
    b: YuvFrame,
    out: YuvFrame,
    ring: Ring,
    fa: Double,
    fb: Double,
    ft: Double,
    width: Int,
    height: Int
  ) {
    val twoPi = 2 * Math.PI
    // 2 px de margen para el suavizado de los bordes del trazo.
    val half = ring.halfStroke + 2
    val inner = (ring.radius - half).coerceAtLeast(0.0)
    val outer = ring.radius + half
    // Ángulo que ocupa la punta redondeada (medio grosor sobre el radio).
    val cap = half / ring.radius
    val from = if (fa > 0) fa * twoPi - cap else -cap
    val to = fb * twoPi + cap
    val cut = ft * twoPi + cap

    fun sweepPlane(
      outPlane: ByteArray,
      aPlane: ByteArray,
      bPlane: ByteArray,
      planeW: Int,
      planeH: Int,
      scale: Int
    ) {
      val x0 = ((ring.cx - outer) / scale).toInt().coerceAtLeast(0)
      val x1 = ((ring.cx + outer) / scale).toInt().coerceAtMost(planeW - 1)
      val y0 = ((ring.cy - outer) / scale).toInt().coerceAtLeast(0)
      val y1 = ((ring.cy + outer) / scale).toInt().coerceAtMost(planeH - 1)
      val inner2 = inner * inner
      val outer2 = outer * outer
      for (py in y0..y1) {
        val dy = py * scale + 0.5 - ring.cy
        for (px in x0..x1) {
          val dx = px * scale + 0.5 - ring.cx
          val d2 = dx * dx + dy * dy
          if (d2 < inner2 || d2 > outer2) continue
          // Ángulo desde arriba en el sentido del reloj (y crece hacia abajo).
          var theta = Math.atan2(dx, -dy)
          if (theta < 0) theta += twoPi
          if (theta > twoPi - cap) theta -= twoPi
          if (theta <= from || theta > to) continue
          val idx = py * planeW + px
          outPlane[idx] = if (theta <= cut) bPlane[idx] else aPlane[idx]
        }
      }
    }

    sweepPlane(out.y, a.y, b.y, width, height, 1)
    sweepPlane(out.u, a.u, b.u, width / 2, height / 2, 2)
    sweepPlane(out.v, a.v, b.v, width / 2, height / 2, 2)
  }

  private fun blendPlane(a: ByteArray, b: ByteArray, s: Int, steps: Int, out: ByteArray) {
    val wa = steps - s
    val half = steps / 2
    for (i in out.indices) {
      out[i] = (((a[i].toInt() and 0xff) * wa + (b[i].toInt() and 0xff) * s + half) / steps).toByte()
    }
  }

  // Fotograma en YUV420 planar compacto (sin strides): Y de width×height y U/V
  // de (width/2)×(height/2).
  private class YuvFrame(val y: ByteArray, val u: ByteArray, val v: ByteArray)

  // Convierte ARGB a YUV420 (BT.601) sobre arrays de bytes normales: mucho más
  // rápido que escribir píxel a píxel en el ByteBuffer directo del codec.
  private fun toYuv(bitmap: Bitmap, width: Int, height: Int): YuvFrame {
    val argb = IntArray(width * height)
    bitmap.getPixels(argb, 0, width, 0, 0, width, height)
    return argbToYuv(argb, width, height)
  }

  private fun argbToYuv(argb: IntArray, width: Int, height: Int): YuvFrame {
    val chromaW = width / 2
    val y = ByteArray(width * height)
    val u = ByteArray(chromaW * (height / 2))
    val v = ByteArray(chromaW * (height / 2))

    var index = 0
    for (j in 0 until height) {
      val evenRow = j and 1 == 0
      val chromaRow = (j shr 1) * chromaW
      for (i in 0 until width) {
        val color = argb[index]
        val r = (color shr 16) and 0xff
        val g = (color shr 8) and 0xff
        val b = color and 0xff

        y[index] = clampByte(((66 * r + 129 * g + 25 * b + 128) shr 8) + 16)
        if (evenRow && i and 1 == 0) {
          val c = chromaRow + (i shr 1)
          u[c] = clampByte(((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128)
          v[c] = clampByte(((112 * r - 94 * g - 18 * b + 128) shr 8) + 128)
        }
        index++
      }
    }
    return YuvFrame(y, u, v)
  }

  private fun clampByte(value: Int): Byte =
    (if (value < 0) 0 else if (value > 255) 255 else value).toByte()

  // Copia el fotograma a los planos del Image respetando rowStride/pixelStride
  // (cambian entre dispositivos). Con pixelStride 1 se copia fila a fila de
  // golpe; si es intercalado (NV12/NV21, pixelStride 2), byte a byte.
  private fun writeYuv(image: Image, frame: YuvFrame, width: Int, height: Int) {
    writePlane(image.planes[0], frame.y, width, height)
    writePlane(image.planes[1], frame.u, width / 2, height / 2)
    writePlane(image.planes[2], frame.v, width / 2, height / 2)
  }

  private fun writePlane(plane: Image.Plane, data: ByteArray, w: Int, h: Int) {
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride
    if (pixelStride == 1) {
      for (row in 0 until h) {
        buffer.position(row * rowStride)
        buffer.put(data, row * w, w)
      }
    } else {
      for (row in 0 until h) {
        val rowStart = row * rowStride
        val src = row * w
        for (col in 0 until w) {
          buffer.put(rowStart + col * pixelStride, data[src + col])
        }
      }
    }
  }
}
