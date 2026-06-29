import ExpoModulesCore
import AVFoundation
import UIKit

// Codifica una lista de fotogramas PNG (rutas de fichero) en un MP4 H.264 con
// AVAssetWriter. Sin dependencias externas.
public class VideoEncoderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoEncoder")

    AsyncFunction("encode") { (framePaths: [String], outputPath: String, fps: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try self.encode(framePaths: framePaths, outputPath: outputPath, fps: max(fps, 1))
          promise.resolve(outputPath)
        } catch {
          promise.reject("ERR_VIDEO_ENCODE", error.localizedDescription)
        }
      }
    }
  }

  private func stripScheme(_ path: String) -> String {
    return path.hasPrefix("file://") ? String(path.dropFirst("file://".count)) : path
  }

  private func encode(framePaths: [String], outputPath: String, fps: Int) throws {
    guard !framePaths.isEmpty else {
      throw EncodeError.message("No hay fotogramas que codificar")
    }

    let cleanFrames = framePaths.map { stripScheme($0) }
    let cleanOutput = stripScheme(outputPath)

    guard let firstImage = UIImage(contentsOfFile: cleanFrames[0])?.cgImage else {
      throw EncodeError.message("No se pudo leer el primer fotograma")
    }

    let width = firstImage.width - (firstImage.width % 2)
    let height = firstImage.height - (firstImage.height % 2)

    let url = URL(fileURLWithPath: cleanOutput)
    try? FileManager.default.removeItem(at: url)

    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    input.expectsMediaDataInRealTime = false

    let attributes: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: attributes
    )

    guard writer.canAdd(input) else {
      throw EncodeError.message("AVAssetWriter no acepta la entrada de vídeo")
    }
    writer.add(input)
    writer.startWriting()
    writer.startSession(atSourceTime: .zero)

    let colorSpace = CGColorSpaceCreateDeviceRGB()

    // Caché del último PNG decodificado: los fotogramas repetidos consecutivos no
    // se vuelven a leer del disco.
    var cachedPath: String?
    var cachedImage: CGImage?

    for (i, path) in cleanFrames.enumerated() {
      if path != cachedPath {
        cachedImage = UIImage(contentsOfFile: path)?.cgImage
        cachedPath = path
      }
      guard let cgImage = cachedImage else { continue }

      while !input.isReadyForMoreMediaData {
        usleep(2000)
      }

      guard let pool = adaptor.pixelBufferPool else {
        throw EncodeError.message("No se pudo crear el pool de píxeles")
      }

      var pixelBufferOut: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBufferOut)
      guard let pixelBuffer = pixelBufferOut else { continue }

      CVPixelBufferLockBaseAddress(pixelBuffer, [])
      if let context = CGContext(
        data: CVPixelBufferGetBaseAddress(pixelBuffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
      ) {
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
      }
      CVPixelBufferUnlockBaseAddress(pixelBuffer, [])

      let presentationTime = CMTime(value: Int64(i), timescale: Int32(fps))
      adaptor.append(pixelBuffer, withPresentationTime: presentationTime)
    }

    input.markAsFinished()
    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting {
      semaphore.signal()
    }
    semaphore.wait()

    if writer.status != .completed {
      throw EncodeError.message(writer.error?.localizedDescription ?? "Fallo al escribir el vídeo")
    }
  }

  enum EncodeError: Error, LocalizedError {
    case message(String)
    var errorDescription: String? {
      switch self {
      case .message(let text): return text
      }
    }
  }
}
