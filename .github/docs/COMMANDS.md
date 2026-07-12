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
./gradlew.bat clean
./gradlew.bat assembleRelease --no-configuration-cache
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app/build/outputs/apk/release/app-release.apk
```

⚠️ **`./gradlew.bat clean` es obligatorio siempre que haya cambiado `app.json`
(típicamente al subir de versión).** La tarea de `expo-constants` que embebe
`app.json` en `app.config` (assets del APK, lo que lee `Constants.expoConfig`
en runtime — p. ej. la versión mostrada en Inicio) no declara `app.json` como
input, así que Gradle la puede dar por "up to date" y dejar una versión vieja
embebida aunque `versionCode`/`versionName` del manifiesto sí se actualicen.
Sin `clean`, la app puede mostrar una versión distinta a la real. Si solo se
recompila sin tocar `app.json`, el `clean` no es necesario.

## Hacer la apk (sin reconstrucción)

```powershell
cd android
./gradlew.bat assembleRelease
```

Solo válido si `app.json` no ha cambiado desde el último `clean` (ver aviso arriba).

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
