Pod::Spec.new do |s|
  s.name           = 'VideoEncoder'
  s.version        = '0.1.0'
  s.summary        = 'Codifica fotogramas PNG en un MP4 (AVAssetWriter)'
  s.description    = 'Módulo local de GymToni para exportar la imagen de logros como vídeo.'
  s.author         = ''
  s.homepage       = 'https://gymtoni.app'
  s.license        = 'MIT'
  s.platforms      = { :ios => '13.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
