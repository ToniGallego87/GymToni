# 🎯 Próximas Features - Roadmap Opcional

> Este documento describe features que **NO están en el MVP** pero que puedes agregar después.

## 🔐 1. Autenticación de Usuario

### Por qué después:
- MVP es local, sin usuarios
- Añade complejidad (Firebase, Supabase, etc)

### Cómo implementar:
```typescript
// Agregar a tipos
interface User {
  id: string;
  email: string;
  createdAt: number;
}

// Crear feature de auth
features/auth/AuthContext.tsx
features/auth/LoginScreen.tsx

// Proteger rutas con AuthGuard
```

### Stack recomendado:
- Firebase Auth + Firestore (sencillo)
- Supabase (alternativa open source)

---

## ☁️ 2. Sincronización en la Nube

### Plan:
1. Guardar en AsyncStorage (ya hecho)
2. Sincronizar con cloud cuando haya conexión
3. Permitir backup/restore

### Implementación:
```typescript
// lib/sync.ts
export async function syncLogs(logs: WorkoutLog[]): Promise<void> {
  // POST /api/workouts
}

// Llamar en App.tsx periodicamente
useEffect(() => {
  const interval = setInterval(() => {
    syncLogs(state.logs);
  }, 5 * 60 * 1000); // cada 5 min
  return () => clearInterval(interval);
}, [state.logs]);
```

---

## 📊 3. Gráficas de Progreso

### Features:
- [ ] Gráfico de peso en el tiempo (un ejercicio)
- [ ] Gráfico de volumen total (sets x reps x peso)
- [ ] Tabla de PRs (personal records)

### Lib recomendada:
```bash
npm install react-native-svg react-native-chart-kit
```

### Componente ejemplo:
```typescript
// components/ProgressChart.tsx
export function ProgressChart({ exerciseId }: Props) {
  const exercise Logs = getExerciseLogs(exerciseId);
  return <LineChart data={data} />;
}
```

---

## 💪 4. Cálculo de 1RM (One Rep Max)

### Fórmula de Epley:
```
1RM = peso × (1 + reps/30)
```

### Implementación:
```typescript
// lib/calculations.ts
export function calculateOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

// Mostrar en DetailScreen
```

---

## 📋 5. Planes de Entrenamiento Personalizados

### Idea:
- Crear planes alternativos a la rutina base
- Power, hypertrophy, endurance programs
- Cambiar entre planes

### Estructura:
```typescript
// types/index.ts
interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  days: WorkoutDay[];
}

// data/plans.ts
export const PLANS = {
  strength: { ... },
  hypertrophy: { ... },
  endurance: { ... },
};
```

---

## 🔔 6. Notificaciones / Recordatorios

### Stack:
```bash
npm install expo-notifications
```

### Implementación:
```typescript
// hooks/useNotifications.ts
export function scheduleWorkoutReminder(dayNumber: number, time: string) {
  // Programar notificación
}
```

---

## 📤 7. Exportar Datos

### Formatos:
- CSV (para Excel)
- PDF (reporte visual)
- JSON (backup)

### Lib recomendada:
```bash
npm install expo-sharing react-native-csv
```

### Función:
```typescript
// lib/export.ts
export async function exportToCSV(logs: WorkoutLog[]): Promise<void> {
  const csv = generateCSV(logs);
  await Share.share({ url: csv });
}
```

---

## 🎨 8. Temas / Modo Oscuro

### Implementar:
```typescript
// hooks/useTheme.ts
const theme = {
  light: { bg: '#fff', text: '#222' },
  dark: { bg: '#222', text: '#fff' },
};

// Guardar preferencia en AsyncStorage
```

---

## 🏋️ 9. Diferenciación por Rol (Coach/Atleta)

### Escenario:
- Coach ve todos los atletas
- Atleta ve solo su info

### Rutas protegidas:
```typescript
// Agregar rol a User
interface User {
  role: 'athlete' | 'coach';
}

// Guard
if (user.role === 'coach') {
  return <CoachDashboard />;
} else {
  return <AthleteApp />;
}
```

---

## 🤖 10. IA / Análisis Inteligente

### Ideas:
- Detectar desequilibrios
- Sugerir progresión de peso
- Análisis de consistencia
- Chatbot para recomendaciones

### Implementación:
```bash
npm install openai
```

```typescript
// lib/ai.ts
export async function getSuggestions(logs: WorkoutLog[]): Promise<string> {
  return await openai.generateText({
    prompt: `Analiza este entrenamiento: ${JSON.stringify(logs)}`
  });
}
```

---

## 📱 11. Versión Web (Dashboard)

### Stack:
```
next.js + supabase + tailwindcss
```

### Rutas:
```
/dashboard        - Overview
/workouts         - Historial
/progress         - Gráficas
/settings         - Config
```

---

## 🧪 12. Testing

### Unit tests (parsers):
```bash
npm install jest @testing-library/react-native
```

```typescript
// lib/__tests__/parsers.test.ts
describe('parseSeriesString', () => {
  it('should parse "60x8, 65x6"', () => {
    expect(parseSeriesString('60x8, 65x6')).toEqual([
      { weight: 60, reps: 8 },
      { weight: 65, reps: 6 }
    ]);
  });
});
```

---

## 📏 Prioridad Sugerida

1. **Corto plazo** (semana 1):
   - Testing
   - Gráficas básicas
   - Exportar a CSV

2. **Mediano plazo** (semana 2-3):
   - Autenticación
   - Sincronización en nube
   - Modo oscuro

3. **Largo plazo** (mensual):
   - Planes personalizados
   - Coach mode
   - IA suggestions

---

## 🚀 Cómo Empezar

Elige **uno** de estos features y:

1. Crea una rama: `git checkout -b feature/nombre`
2. Implementa en tu carpeta correspondiente
3. Prueba bien
4. Commit: `git commit -m "feat: agregar feature"`

---

**¡Que disfrutes expandiendo GymTrack! 💪**
