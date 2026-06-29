package expo.modules.videoencoder

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Codifica una lista de fotogramas PNG (rutas de fichero) en un MP4 H.264 usando
// MediaCodec + MediaMuxer. Sin dependencias externas: solo APIs de Android.
class VideoEncoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoEncoder")

    AsyncFunction("encode") { framePaths: List<String>, outputPath: String, fps: Int ->
      encode(framePaths, outputPath, if (fps > 0) fps else 20)
      outputPath
    }
  }

  private fun stripScheme(path: String): String =
    if (path.startsWith("file://")) path.removePrefix("file://") else path

  private fun encode(rawPaths: List<String>, rawOutput: String, fps: Int) {
    if (rawPaths.isEmpty()) throw Exception("No hay fotogramas que codificar")

    val framePaths = rawPaths.map { stripScheme(it) }
    val outputPath = stripScheme(rawOutput)

    val firstBitmap = BitmapFactory.decodeFile(framePaths[0])
      ?: throw Exception("No se pudo leer el primer fotograma")
    // Dimensiones pares (requisito de la mayoría de codecs).
    val width = firstBitmap.width and 1.inv()
    val height = firstBitmap.height and 1.inv()
    firstBitmap.recycle()

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

    // Caché del último PNG decodificado: los fotogramas repetidos consecutivos
    // (el vídeo ralentiza repitiendo cada uno) no se vuelven a decodificar.
    var cachedPath: String? = null
    var cachedBitmap: Bitmap? = null

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
            if (frameIndex >= framePaths.size) {
              codec.queueInputBuffer(
                inIndex,
                0,
                0,
                frameIndex * frameDurationUs,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM
              )
              inputDone = true
            } else {
              val path = framePaths[frameIndex]
              if (path != cachedPath) {
                cachedBitmap?.recycle()
                cachedBitmap = BitmapFactory.decodeFile(path)
                cachedPath = path
              }
              val bitmap = cachedBitmap
              val image = codec.getInputImage(inIndex)
              if (bitmap != null && image != null) {
                fillImageFromBitmap(image, bitmap, width, height)
              }
              codec.queueInputBuffer(inIndex, 0, yuvFrameSize, frameIndex * frameDurationUs, 0)
              frameIndex++
            }
          }
        }
        drainOutput(if (inputDone) 10_000 else 0)
      }
    } finally {
      cachedBitmap?.recycle()
      codec.stop()
      codec.release()
      if (muxerStarted) {
        muxer.stop()
      }
      muxer.release()
    }
  }

  // Convierte ARGB a YUV420 (BT.601) escribiendo en los planos del Image,
  // respetando rowStride/pixelStride para ser compatible entre dispositivos.
  private fun fillImageFromBitmap(image: Image, bitmap: Bitmap, width: Int, height: Int) {
    val argb = IntArray(width * height)
    bitmap.getPixels(argb, 0, width, 0, 0, width, height)

    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val yBuffer = yPlane.buffer
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val yRowStride = yPlane.rowStride
    val uvRowStride = uPlane.rowStride
    val uvPixelStride = uPlane.pixelStride

    var index = 0
    for (j in 0 until height) {
      for (i in 0 until width) {
        val color = argb[index]
        val r = (color shr 16) and 0xff
        val g = (color shr 8) and 0xff
        val b = color and 0xff

        val y = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
        yBuffer.put(j * yRowStride + i, y.coerceIn(0, 255).toByte())

        if (j and 1 == 0 && i and 1 == 0) {
          val u = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
          val v = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128
          val uvIndex = (j / 2) * uvRowStride + (i / 2) * uvPixelStride
          uBuffer.put(uvIndex, u.coerceIn(0, 255).toByte())
          vBuffer.put(uvIndex, v.coerceIn(0, 255).toByte())
        }
        index++
      }
    }
  }
}
