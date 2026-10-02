# COMMANDS

## Lanza el proyecto en web

- npx expo start -c
- Pulsa w

## Reconstruye la apk

```powershell
cd "c:\Users\toni_\Desktop\Projects\GymToni"
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

`adb` no está en el PATH: se invoca por ruta completa, como en el bloque de la
APK de arriba.

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

## Medir rendimiento

Frames del proceso con `gfxinfo` (release, sin Metro). El móvil garnet bloquea
`adb shell input`: el recorrido lo hace la persona.

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"; $p="com.tonigallego.gymbro"
& $adb shell dumpsys gfxinfo $p reset
# Recorrido fijo: registro de hoy → tres series → volver → las cinco pestañas arrastrando
& $adb shell dumpsys gfxinfo $p | Select-String "Total frames|Janky|50th|90th|95th|99th|Slow UI|HISTOGRAM"
```

Referencia 2026-09-22 (garnet, con `TabStateBoundary`):

- con blur (`GLASS_BLUR_ENABLED = true`): 3988 frames, mediana 26 ms, p90 40, p99 69, 123 frames UI lentos.
- sin ningún blur: 1278 frames, mediana 15 ms, p90 25, p99 48, 14 frames UI lentos.
- un blur en la barra superior, `blurReductionFactor={12}` (lo que va en la app): 2704 frames, mediana 16 ms, p90 22, p99 32, 6 frames UI lentos.
- dos blurs (superior + inferior), reducción 12: 998 frames, mediana 23 ms, p90 30, p99 61.
- cuatro blurs (superior, inferior, Volver, descanso), reducción 12: 1226 frames, mediana 28 ms, p90 48, p99 73.
  → el coste de dimezis es POR `BlurView` (cada uno redibuja la pantalla), no por radio: ~7 ms/frame cada barra.
- cuatro barras con `modules/glass-blur` (una captura compartida, lo que va en la app): 3501 frames, mediana 20 ms, p90 31, p99 44, 22 frames UI lentos.

## Medir el arranque en frío

Sin instrumentar la app: los tres marcadores ya están en el log de release.

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"; $p="com.tonigallego.gymbro"
& $adb shell am force-stop $p
& $adb logcat -c
& $adb shell "am start -W -n $p/.MainActivity; sleep 14; logcat -d -v time ReactNativeJS:I ReactNative:I Choreographer:I Zygote:E *:S"
& $adb shell dumpsys gfxinfo $p
```

- `E/Zygote: process_name_ptr` → **t0**, nace el proceso.
- `I/ReactNativeJS: Running "main"` → **t1**, RN empieza a evaluar el bundle.
- `I/ReactNative: [GESTURE HANDLER] Initialize…` → **t2**, primer render montado.
- `TotalTime` de `am start -W` mide solo hasta el primer frame (el splash), así
  que NO refleja el trabajo de JS: para eso está t1→t2.
- `gfxinfo` al cerrar la ventana de 14 s sin tocar nada: los frames que la app
  pinta sola al arrancar, con sus percentiles.

**El filtro por tags no es opcional**: el log de MIUI (WindowManager, bluetooth)
es tan ruidoso que roba CPU al arranque y hace perder líneas — sin filtrar, las
mismas medidas salían ~300 ms peores y con marcadores ausentes.

Dos avisos más, aprendidos a base de medir:

- Tras ~50 arranques seguidos con `force-stop`, el móvil empieza a colgar la app
  después de `Running "main"` (sin traza ni error). No es el código: se arregla
  reiniciando el móvil. Descartar esas rondas.
- Comparar antes/después exige ALTERNAR (instalar A, medir, instalar B, medir,
  repetir) y tirar la primera ejecución de cada bloque: entre tandas separadas
  hay deriva de ~100 ms que se lleva por delante la diferencia que se busca.

Referencia 2026-09-26 (garnet, medianas; antes n=6, después n=8), midiendo el
aligerado del arranque de la versión sin publicar:

|                                               | antes       | después     |
| --------------------------------------------- | ----------- | ----------- |
| TotalTime (primer frame, splash)              | 368 ms      | 362 ms      |
| t0→t1 (init nativo + carga del bundle)        | 448 ms      | 461 ms      |
| **t1→t2 (evaluar el bundle + primer render)** | **314 ms**  | **260 ms**  |
| t0→t2                                         | 750 ms      | 726 ms      |
| frames en 14 s sin tocar                      | 144         | 181         |
| frames janky                                  | 27 %        | 21 %        |
| p90 / p99 de frame                            | 63 / 300 ms | 53 / 200 ms |

Los rangos de t1→t2 (296-336 vs 250-271) y de p99 (250-300 vs 200) no se solapan
en ninguna muestra. Que se pinten MÁS frames es lo buscado: las pestañas de fondo
se montan de una en una, en commits pequeños, en vez de todas en uno enorme.

## Verificación

```bash
npm run type-check   # TypeScript
npm test             # Jest (lib/)
npm run format       # Prettier
```
