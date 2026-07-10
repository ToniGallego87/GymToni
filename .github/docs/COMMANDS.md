# COMMANDS

## Lanza el proyecto en web

- npx expo start -c
- Pulsa w

## Reconstruye la apk

```powershell
cd "c:\Users\toni_\Desktop\Proyectos Visual Studio Code\GymToni"
npm run postinstall
cd android
./gradlew.bat --stop
./gradlew.bat assembleRelease --no-configuration-cache
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app/build/outputs/apk/release/app-release.apk
```

## Hacer la apk (sin reconstrucción)

```powershell
cd android
./gradlew.bat assembleRelease
```

## Depurar en móvil

```powershell
adb devices
```

## Verificación

```bash
npm run type-check   # TypeScript
npm test             # Jest (lib/)
npm run format       # Prettier
```
