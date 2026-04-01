# 🚀 GymTrack en Expo Snack (SIN INSTALAR NADA)

## 📋 Instrucciones Paso a Paso

### ✅ Requisitos
- Un navegador web
- Conexión a internet
- **Sin necesidad de instalar nada** (Node.js, npm, etc.)

---

## 🚀 Cómo usar GymTrack en Expo Snack

### **PASO 1: Abre Expo Snack**
1. Ve a: **https://snack.expo.dev** en tu navegador
2. Te pedirá que ingreses tu correo (o crea una cuenta gratuita)
3. Espera a que cargue el editor

### **PASO 2: Borra el código por defecto**
1. En el editor, presiona **Ctrl+A** para seleccionar todo
2. Presiona **Delete** o **Backspace** para borrar

### **PASO 3: Copia TODO el código de abajo**
1. Copia el código JavaScript completo (desde `import React` hasta el final)
2. **O** usa el atajo: Selecciona todo en la sección "Código" abajo

### **PASO 4: Pega en Expo Snack**
1. Haz clic en el editor izquierdo
2. Presiona **Ctrl+V** para pegar
3. **Listo.** Expo compilará automáticamente

### **PASO 5: Prueba en tu teléfono o web**
- **Opción Web:** Haz clic en **"Web"** (arriba a la derecha) → se abrirá tu app en una pestaña
- **Opción Móvil:** 
  - Descarga la app **Expo Go** (iOS o Android)
  - Escanea el código QR en Expo Snack
  - ¡Tu app abrirá en el teléfono!

---

## 📱 Cómo usar GymTrack

### **Pantalla Principal (Inicio)**
1. **"💪 GymTrack"** - Título de la app
2. **Botón "Rutina..."** (arriba derecha) - Haz clic para cambiar entre 3 rutinas diferentes
3. **"🎯 Empezar entrenamiento"** - Botón grande azul para iniciar
4. **"📊 Historial de [Rutina]"** - Tus últimos entrenamientos de esta rutina

### **Flujo de Registro**
1. Presiona **"🎯 Empezar entrenamiento"**
2. Elige uno de los 5 días de la rutina activa
3. Para cada ejercicio, ingresa: **`60x8, 65x6`** (peso x reps, separados por comas)
   - Ejemplo: `60x8` = 60kg × 8 repeticiones
   - Múltiples series: `60x8, 65x6, 70x4`
   - Decimales: `22.5x10, 25x8`
4. (Opcional) Añade **Cardio**: `Cinta: 22.5mins, 11.5kmh`
5. (Opcional) Notas por ejercicio: Presiona 📝
6. Presiona **"💾 Guardar"** → ¡Listo!

### **Ver Historial**
- **Historial de rutina activa:** En la pantalla principal, bajo el botón rojo
- **Todos los entrenamientos:** Presiona **"📊 Historial"** abajo (botón de navegación)
- Presiona cualquier entrenamiento para ver detalles

### **Cambiar Rutina**
1. Presiona el botón azul **"Rutina..."** (arriba derecha)
2. Selecciona una de las 3 rutinas:
   - **Rutina 1:** Push/Pull/Legs clásico
   - **Rutina 2:** Fuerza y volumen
   - **Rutina 3 (Activa):** Tu rutina actual optimizada
3. El historial y entrenamientos se filtran automáticamente

---

## 📊 Las 3 Rutinas Incluidas

### **Rutina 1: Push/Pull/Legs Clásico**
- Lunes: Push pesado (5 ejercicios)
- Martes: Pull pesado (5 ejercicios)
- Miércoles: Pierna + Core (5 ejercicios)
- Jueves: Push ligero/bombeo (5 ejercicios)
- Viernes: Pull ligero/bombeo (5 ejercicios)

### **Rutina 2: Fuerza y Volumen**
- Día 1: Push pesado (5 ejercicios)
- Día 2: Pull pesado (5 ejercicios)
- Día 3: Pierna + Core (5 ejercicios)
- Día 4: Push ligero/bombeo (5 ejercicios)
- Día 5: Pull ligero/bombeo (5 ejercicios)

### **Rutina 3: Tu Rutina Actual (ACTIVA por defecto)**
- Lunes: Push pesado (6 ejercicios)
- Martes: Pull pesado (6 ejercicios)
- Miércoles: Pierna A / Cuádriceps (5 ejercicios)
- Jueves: Torso mixto (6 ejercicios)
- Viernes: Pierna B / Femoral (6 ejercicios)

---

## 🔧 Personalización Rápida

### **Cambiar la rutina activa por defecto**
En el código, busca:
```javascript
const [activeRoutineId, setActiveRoutineId] = useState('routine3');
```
Cambia `'routine3'` por `'routine1'` o `'routine2'`

### **Cambiar colores**
Busca `backgroundColor: '#6200ee'` y cambia el código de color:
- `#6200ee` = Púrpura (actual)
- `#1976d2` = Azul
- `#d32f2f` = Rojo
- `#388e3c` = Verde

### **Agregar/eliminar ejercicios**
En la sección `WORKOUT_ROUTINES`, busca el día y agrega/elimina objetos en el array `exercises`

---

## ⚠️ Limitaciones de Expo Snack

1. **Sin persistencia de datos:** Los datos se pierden al cerrar la pestaña (esto es normal en Snack)
   - **Solución:** Para persistencia, usa la versión local con Node.js
2. **Solo memoria local:** Los entrenamientos se guardan en memoria durante la sesión
3. **Ideal para:** Probar la app, entrenamientos puntuales, demostración

---

## 📝 Tips de Uso

### **Formato de entrada recomendado:**
```
Pecho:     60x8, 65x6, 70x4       ← Perfecto
Espalda:   100x5, 110x5          ← Bien
Pierna:    20.5x12, 22.5x10      ← Con decimales
Cardio:    Cinta: 30mins, 12kmh   ← Formato cardio
```

### **Agregar notas a un ejercicio:**
- Presiona el ícono 📝 al lado de cada ejercicio
- Escribe: "Senti más fuerza hoy", "Fatiga en el hombro", etc.
- Aparecerá en el historial

### **Ver progreso:**
1. Registra varios entrenamientos
2. Presiona uno en el historial
3. Verás la entrada parseada: `✓ 60x8, 65x6, 70x4`

---

## ✨ Cambios en v1.1

- **Serie por serie:** Ahora registras una serie a la vez (antes: todas de golpe)
- **Botones mejorados:** ➕ Añadir, ➖ Borrar, ✓ Terminar
- **Tags visuales:** Ves las series añadidas en tiempo real
- **Contador de progreso:** "Series: 3/4"
- **Protección automática:** Input deshabilitado al alcanzar el máximo

---

## 📝 Código a Copiar

⚠️ **El código COMPLETO está en un archivo separado:**

### 👉 **[ABRE COPY_TO_SNACK.md](COPY_TO_SNACK.md)**

**Pasos:**
1. Abre el archivo [`COPY_TO_SNACK.md`](COPY_TO_SNACK.md)
2. Copia **TODO** el código JavaScript (desde `import React` hasta el final)
3. Vuelve a estos pasos de abajo (PASO 1-5)
4. Pega en Expo Snack

---

## 🆘 Problemas Comunes

| Problema | Solución |
|----------|----------|
| No aparece la app | Espera 10-15 segundos a que Expo compile |
| "Error de compilación" | Verifica no hayas modificado el código accidentalmente |
| Los datos desaparecieron | Normal en Snack (sin persistencia). Recarga y vuelve a entrar |
| Botón no responde | Presiona nuevamente o recarga la página |
| "¿Dónde está el código?" | Está en [`COPY_TO_SNACK.md`](COPY_TO_SNACK.md) |

---

## 🎯 Próximos Pasos (Si usas la versión local)

Para guardar datos de forma permanente:
```bash
git clone <tu-repo>
npm install
npm run web
```

---

**NOTA:** Este archivo contiene solo INSTRUCCIONES. El código JavaScript está en [`COPY_TO_SNACK.md`](COPY_TO_SNACK.md)

### 4. ¡Listo!

Ya debería funcionar en Expo Snack. Verás la app funcionando.

---

## 📝 Qué funciona:

✅ Ver 5 días de rutina
✅ Registrar entrenamientos  
✅ Parsear series (`60x8, 65x6`)
✅ Agregar notas
✅ Ver historial
✅ Ver detalles de sesión
✅ Navegación por tabs

---

## ⚠️ Limitaciones en Snack:

- ❌ No persiste datos (se pierden al recargar)
- Los datos son en memoria

---

## Si quieres persistencia real:

Luego lo podemos:
1. Subir a GitHub
2. Conectar a Firebase para guardar
3. O hacer una versión web con Node.js en Replit

---

**¿Te funciona en Expo Snack?**
