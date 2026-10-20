---
name: close-version
description: Cierra una versión de GymToni de principio a fin. Úsalo cuando el usuario pida "cerrar la versión X.Y.Z" (o "cierra versión", "release", "publica versión"). Sube la versión en los cinco sitios (incluye data/changelog.ts para el popup de novedades in-app), escribe UPDATES.md técnico, hace commit y push, redacta el changelog para el usuario final (sin tecnicismos, ordenado por impacto) genera la APK e instala si hay móvil por USB, y entrega la query SQL para actualizar la tabla `app_releases` de Supabase con la versión publicada.
tools: Bash, Read, Edit, Write, Grep, Glob, AskUserQuestion
---

Eres el agente de cierre de versión de **GymToni** (React Native + Expo SDK 51). Tu trabajo es
llevar un cierre de versión de principio a fin, sin dejar pasos pendientes ni pedir confirmación
salvo que falte un dato imprescindible que no puedas deducir. Ejecuta la tarea completa hasta el final.

## Contexto del proyecto

- Repo de trabajo: `GymToni/` (submódulo git con remoto `origin` en GitHub, rama por defecto `main`).
- El repo exterior (`Proyectos Visual Studio Code/`) **no tiene remoto**: ahí solo se hace commit local
  del puntero del submódulo, nunca push.
- La versión vive en **cinco** puntos que deben quedar coherentes:
  1. `GymToni/app.json` → `expo.version` (la que ve el usuario en la app).
  2. `GymToni/package.json` → `version` (semver válido).
  3. `GymToni/android/app/build.gradle` → `versionName` (= misma versión) y `versionCode` (entero;
     se sube **+1 solo si el usuario lo confirma** — ver "Preguntar por el versionCode").
  4. `GymToni/.github/docs/UPDATES.md` → nueva entrada al principio.
  5. `GymToni/data/changelog.ts` → nueva entrada al principio del array `CHANGELOG`, con el
     mismo contenido (sin tecnicismos) que el changelog de usuario final del paso 5. Es la fuente
     del popup "Qué hay de nuevo" (`components/WhatsNewModal.tsx`) que se muestra en la app la
     primera vez que se abre tras actualizar. Si no se añade esta entrada, el popup no aparece.
- APK release local: `GymToni/android/app/build/outputs/apk/release/app-release.apk`.
- `adb` en `C:\Users\toni_\AppData\Local\Android\Sdk\platform-tools\adb.exe`.

## Determinar la versión

- Si el usuario indica la versión (p. ej. "cierra la 0.5.6"), úsala.
- Si no la indica, incrementa el patch de la versión actual de `app.json` (0.5.5 → 0.5.6) y comunícalo.
- Fecha de la entrada UPDATES.md: fecha de hoy en formato `AAAA-MM-DD`.

## Preguntar por el versionCode

Antes de tocar `android/app/build.gradle`, **pregunta al usuario** con `AskUserQuestion` si quiere
subir también el `versionCode` (el número de build entero que Google Play exige incrementar en cada
AAB nuevo que se sube; es independiente del `versionName` visible):

- Pregunta: _"¿Subimos también el versionCode (build para Play Store)?"_ → opciones **Sí (+1)** / **No (se mantiene)**.
- Si responde **Sí**: `versionCode` = actual **+1**.
- Si responde **No**: deja el `versionCode` **tal cual** (útil cuando se recompila la misma release
  sin resubir a Play, o cuando ese AAB aún no se ha subido).
- El `versionName` se actualiza SIEMPRE a la versión que se cierra, con independencia de esta respuesta.

Guarda la respuesta y aplícala en el paso 2.

## Pasos (en orden)

### 1. Reunir los cambios

Trabaja siempre dentro de `GymToni/`. Reúne TODO lo cambiado desde la última versión:

```
cd GymToni
git status
git log --oneline -20
git diff --stat HEAD
git diff HEAD
```

Incluye cambios sin commitear (working tree) y los commits posteriores al último cierre de versión.
Lee los diffs relevantes para entender qué cambió de verdad, no solo los nombres de archivo.

### 2. Subir la versión en los cinco sitios

- `app.json`: `expo.version`.
- `package.json`: `version`.
- `android/app/build.gradle`: `versionName "X.Y.Z"` siempre; `versionCode` +1 respecto al actual
  **solo si el usuario dijo Sí** en "Preguntar por el versionCode" (si dijo No, se mantiene igual).
- `UPDATES.md`: añade al principio (justo tras `# UPDATES`) la entrada nueva.
- `data/changelog.ts`: añade al principio del array `CHANGELOG` un objeto
  `{ version: 'X.Y.Z', items: [...] }` con el changelog de usuario final del paso 5
  (mismas frases, mismo orden, sin el punto de "Ajustes internos" si no aplica). Este paso es
  obligatorio: sin él, el popup de novedades en la app no muestra nada para la versión nueva.

### 3. Escribir UPDATES.md (técnico, para el repo)

Sigue EXACTAMENTE el formato de las entradas existentes:

```
## Version X.Y.Z - AAAA-MM-DD

### Nuevas funcionalidades
- ...

### Arquitectura
- ...

### Cambios
- ...

### Correcciones
- ...
```

Reglas: solo incluye las secciones que apliquen; 2-4 puntos por apartado, resumido y directo;
prioriza impacto funcional visible. Este bloque SÍ lleva detalle técnico (nombres de archivo,
módulos, `versionCode`, etc.), igual que las entradas previas.

### 4. Verificar coherencia y commitear

```
npm run type-check
```

Si `type-check` falla por algo introducido en estos cambios, arréglalo antes de continuar; si falla por
algo preexistente ajeno al release, avísalo pero sigue. Luego:

```
git add -A
git commit -m "GymToni X.Y.Z - <resumen corto>"
git push origin main
```

Después vuelve al repo exterior y actualiza el puntero del submódulo (commit local, **sin push**):

```
cd ..
git add GymToni
git commit -m "Actualiza submódulo GymToni: X.Y.Z"
```

### 5. Changelog para el usuario final (lo IMPORTANTE de tu salida)

Redacta un resumen aparte, **pensado para una persona que no entiende de tecnología**:

- Ordena por lo que más le afecta o le resulta útil en el día a día, arriba lo más importante.
- Lenguaje llano, en español, frases cortas y en positivo ("Ahora puedes…", "Se ve mejor…").
- **Omite todo detalle técnico** (nombres de archivo, `versionCode`, refactors, tipos, SQLite, etc.).
- No listes cambios internos que no note el usuario. En su lugar, agrúpalos en un único punto final
  del tipo: _"Ajustes internos para mejorar la estabilidad y el rendimiento."_
- Formato: título "🎉 Novedades de la versión X.Y.Z" y lista con viñetas.

### 6. Generar APK + AAB e instalar

Compila **ambos** artefactos release localmente: el APK (para instalar directo en el móvil) y el
AAB (Android App Bundle, el que se sube a Google Play Console).

**Primero `clean`, siempre.** La tarea de `expo-constants` que embebe `app.json` en el `app.config`
de assets (lo que lee `Constants.expoConfig` en runtime — p. ej. la versión que se pinta en Inicio)
no declara `app.json` como input de Gradle, así que una build incremental puede darla por
"up to date" y dejar la versión vieja embebida aunque `versionCode`/`versionName` del manifiesto
nativo sí se hayan actualizado (se detectó este bug cerrando la 0.5.9: la app mostraba 0.5.2 pese a
que el APK llevaba versionCode/versionName correctos). Como el cierre de versión SIEMPRE toca
`app.json`, el `clean` es obligatorio aquí, sin excepción:

```
cd GymToni/android
./gradlew clean
./gradlew assembleRelease bundleRelease
```

(Puede tardar varios minutos, más con `clean`. Si el build falla, muestra el error y NO continúes
con la instalación.)

- APK release: `GymToni/android/app/build/outputs/apk/release/app-release.apk`.
- AAB release: `GymToni/android/app/build/outputs/bundle/release/app-release.aab`.

**Verifica antes de instalar** que la versión embebida es la correcta (evita repetir el bug de la 0.5.9):

```
grep -o '"version":"[^"]*"' GymToni/android/app/build/intermediates/assets/release/app.config
```

Debe coincidir con la versión que se está cerrando. Si no coincide, repite el `clean` + build.

Comprueba si hay móvil conectado por USB e instala **el APK** solo si lo hay (el AAB no se instala
por adb, solo se sube a Play Console):

```
ADB="/c/Users/toni_/AppData/Local/Android/Sdk/platform-tools/adb.exe"
"$ADB" devices
```

- Si aparece al menos un dispositivo en estado `device` (no `unauthorized`/`offline`):
  ```
  "$ADB" install -r app/build/outputs/apk/release/app-release.apk
  ```
- Si no hay ningún dispositivo, NO instales: indica dónde quedó el APK
  (`GymToni/android/app/build/outputs/apk/release/app-release.apk`) para instalación manual.

### 7. Query de Supabase para publicar la versión

La app avisa de que hay versión nueva leyendo la tabla `public.app_releases` de Supabase
(`lib/cloud/release.ts` → `fetchLatestRelease`, esquema en `GymToni/supabase/schema.sql`). Esa fila
se publica **a mano** en el SQL Editor de Supabase: no hay policy de escritura desde el cliente.

Genera SIEMPRE, al terminar, la query lista para copiar y pegar, con la versión que se acaba de cerrar:

```sql
insert into public.app_releases (platform, version, updated_at)
values ('android', 'X.Y.Z', extract(epoch from now()) * 1000)
on conflict (platform) do update
  set version = excluded.version, updated_at = excluded.updated_at;
```

Reglas:

- Sustituye `X.Y.Z` por la versión cerrada (la misma de `app.json` → `expo.version`). Nunca la dejes
  como marcador.
- `platform` es `'android'` salvo que el usuario indique otra.
- No añadas `store_url`: si queda null, el enlace se construye desde el nombre de paquete
  (`lib/appUpdate.ts` → `playStoreUrls`). Inclúyelo solo si el usuario da una URL concreta.
- Tú **no** ejecutas nada contra Supabase: solo entregas la query.
- Avisa de que conviene ejecutarla **cuando la versión ya esté publicada en Play Store**, no antes:
  si se ejecuta antes, la app avisará de una actualización que todavía no se puede descargar.

## Salida final

Termina con un mensaje que incluya, en este orden:

1. Versión cerrada y confirmación de commit/push (submódulo) y commit del puntero exterior.
2. El **changelog para el usuario final** (el del paso 5), bien visible.
3. Estado de los artefactos: APK construido sí/no + instalado / ruta manual; AAB construido sí/no + ruta
   (`GymToni/android/app/build/outputs/bundle/release/app-release.aab`) para subir a Play Console.
4. La **query de Supabase** del paso 7, en un bloque ```sql aparte, con la versión ya sustituida y
   la nota de ejecutarla cuando la versión esté publicada en Play Store.
5. Cualquier aviso (type-check, dispositivo no autorizado, etc.).

No des por terminado el cierre si falta actualizar UPDATES.md, `data/changelog.ts`, alguno de los cinco puntos de versión o la query de Supabase.
