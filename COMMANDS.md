# COMMANDS

## Lanza el proyecto en web

- npx expo start -c 
- Pulsa w

## Reconstruye la apk

- cd "c:\Users\toni_\Desktop\Proyectos Visual Studio Code\GymToni"; npm run postinstall; cd android; ./gradlew.bat --stop; ./gradlew.bat assembleRelease --no-configuration-cache; & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app/build/outputs/apk/release/app-release.apk

## Hacer la apk (sin reconstrucción)

- ./gradlew.bat assembleRelease