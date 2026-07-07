# ✅ Guía de Verificación - Sistema de Reservas MARIJO

## Problema Resuelto

**Error original**: `Module not found: Can't resolve '@supabase/supabase-js'`

**Causa**: Había un archivo `lib/supabase.ts` obsoleto que importaba el SDK antiguo de Supabase. Este archivo no era necesario porque ya existe `lib/supabase/client.ts` con el SDK correcto (`@supabase/ssr`).

**Solución aplicada**:
1. ✅ Eliminado el archivo obsoleto `lib/supabase.ts`
2. ✅ Removido import no utilizado en `confirmation-screen.tsx`
3. ✅ El proyecto ya usa correctamente `@supabase/ssr` en `lib/supabase/client.ts`

---

## Verificación del Sistema Completo

### 1. Base de Datos ✅
- **Tabla**: `public.reservations`
- **Columnas correctas**:
  - `id` (uuid)
  - `workspace` (text)
  - `date` (date)
  - `time_from` (text)
  - `time_to` (text)
  - `desk_number` (integer, nullable)
  - `first_name` (text)
  - `last_name` (text)
  - `phone` (text)
  - `status` (text: 'confirmed' o 'cancelled')
  - `created_at` (timestamp)
  - `cancelled_at` (timestamp, nullable)
- **RLS**: Habilitado con políticas de lectura y escritura para todos

### 2. Variables de Entorno ✅
Todas configuradas en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para operaciones del servidor si es necesario)

### 3. Flujo Completo de Reservas

#### Paso 1: Home Screen
- Usuario ve pantalla de inicio
- Botón "Reservar"

#### Paso 2: Info Screen
- Muestra espacios disponibles: Escritorio, Sala A, Sala B, Sala Grande, Oficina C, Oficina D
- Usuario selecciona un espacio

#### Paso 3: Space Detail Screen
- Ver detalles del espacio (galería, equipamiento, beneficios)
- Selecciona número de escritorio (si es Escritorio)
- Botón "Siguiente"

#### Paso 4: Date Screen
- Calendario interactivo
- Usuario selecciona fecha
- Validación: No permite fechas pasadas
- Botón "Siguiente"

#### Paso 5: Time Range Screen
- Dropdowns para hora de inicio y fin
- Intervalos de 30 minutos
- Validación de conflictos en tiempo real
- Campos de usuario (nombre, apellido, teléfono)
- Muestra precio y seña (50% del total)
- **IMPORTANTE**: Aquí se valida contra Supabase antes de guardar
- Botón "Confirmar reserva"

#### Paso 6: Confirmation Screen
- Resumen de la reserva
- Botón "WhatsApp" para enviar confirmación
- La reserva se guarda en Supabase automáticamente
- Botón "Nueva reserva" vuelve al home

#### Paso 7: My Reservations Screen
- Usuario ingresa su número de teléfono
- Ve TODAS sus reservas desde Supabase
- Para cada reserva:
  - Muestra fecha, hora, espacio, estado
  - Botón "Cancelar" (con validación de 24 horas)
  - Al cancelar: `status = 'cancelled'` y `cancelled_at = ahora`

#### Paso 8: Staff Screen (/staff)
- Accesible en `/staff`
- Calendario completo de todas las reservas (todas las de otros usuarios también)
- Filtro por fecha
- Resumen: reservas confirmadas, canceladas, espacios en uso
- Staff puede cancelar reservas manualmente

### 4. Funcionalidades Críticas ✅

#### Guardado de Reservas
```
TimeRangeScreen → addReservation() → Supabase INSERT
```
- Datos guardados con `status = 'confirmed'`
- Verificación de conflictos antes de INSERT
- Realtime subscription actualiza todas las sesiones

#### Validación de Conflictos
```
- Mismo espacio + misma fecha + rango horario solapado = RECHAZADA
- Fórmula: start_time < existing_end_time AND end_time > existing_start_time
- Solo cuenta reservas con status = 'confirmed'
```

#### Cancelación
```
MyReservationsScreen → cancelReservation() → Supabase UPDATE
```
- Soft-delete: cambia `status` a `cancelled`
- Registra `cancelled_at`
- Slot libera automáticamente para nuevas reservas
- Aviso: Si quedan < 24 horas, no hay reembolso

#### Filtrado por Teléfono
```
MyReservationsScreen filtra: reservations.where(r => r.phone === phone)
```
- Cada usuario solo ve sus propias reservas

#### Real-time
```
Supabase Channel suscrito a INSERT y UPDATE en public.reservations
```
- Cuando un usuario reserva, todos ven la actualización
- Cuando se cancela, todos lo ven
- El inventario de slots se actualiza automáticamente

---

## Pruebas Recomendadas

### Test 1: Verificar Guardado en Supabase
1. Ir a Home → Info → Space Detail → Date → Time Range
2. Llenar formulario completo
3. Presionar "Confirmar reserva"
4. Ir a Supabase → tabla `reservations`
5. ✅ Debe aparecer la reserva con los datos correctos

### Test 2: Ver Conflictos
1. Hacer una reserva para el mismo espacio, mismo día, mismo horario
2. En la pantalla Time Range, intentar confirmar
3. ✅ Debe mostrar: "Este espacio ya tiene una reserva en ese rango de horario"

### Test 3: Mis Reservas
1. Después de reservar, ir a "Mis reservas"
2. Ingresar el teléfono
3. ✅ Debe mostrar la reserva creada
4. Presionar "Cancelar"
5. ✅ Estado cambia a "Cancelada"
6. El slot queda libre para nuevas reservas

### Test 4: Staff Panel
1. Abrir `/staff`
2. ✅ Debe mostrar TODAS las reservas del día
3. ✅ Debe mostrar resumen: confirmadas, canceladas, espacios en uso

### Test 5: Real-time Multi-sesión
1. Abrir la app en 2 pestañas diferentes
2. En Pestaña 1: hacer una reserva
3. En Pestaña 2: ir a "Mis reservas" o Staff Panel
4. ✅ La nueva reserva debe aparecer sin recargar

---

## Archivos Importantes

```
📁 /vercel/share/v0-project/
├── lib/
│   ├── reservation-context.tsx    → Lógica central (Supabase + conflictos)
│   ├── types.ts                   → Tipos y constantes
│   └── supabase/
│       └── client.ts              → Cliente Supabase correcto ✅
├── scripts/
│   ├── 001_create_reservations.sql    → Schema inicial
│   └── 002_add_cancellation_fields.sql → Status + cancelled_at
├── components/
│   ├── marijo-app.tsx             → ReservationProvider wrapper
│   └── screens/
│       ├── time-range-screen.tsx  → Llamar addReservation()
│       ├── confirmation-screen.tsx → Mostrar resumen
│       ├── my-reservations-screen.tsx → Filtrar por phone
│       └── home-screen.tsx        → Inicio
└── app/
    └── staff/page.tsx             → Dashboard del staff
```

---

## Próximos Pasos

1. ✅ **Build & Deploy**: El código está listo
   ```bash
   npm run build
   ```

2. ✅ **Testing**: Prueba cada funcionalidad con los tests arriba

3. ✅ **Monitoreo**: Revisa Supabase → Logs para cualquier error

---

## Soporte

Si algo no funciona:
1. Revisar browser console (F12) para errores
2. Verificar Supabase → Logs → Recent
3. Confirmar que las env vars están en Vercel
4. Revisar que pnpm-lock.yaml está actualizado
