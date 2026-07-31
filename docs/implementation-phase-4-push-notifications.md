# Fase 4: Notificaciones Push

## Objetivo

Enviar notificaciones confiables usando Expo Push Service y el estado autoritativo de la API para:

- Recordatorios de pagos recurrentes proximos y vencidos.
- Pagos registrados desde otros dispositivos.
- Nuevos movimientos pendientes detectados por Gmail.

La fase se cierra para Android e iOS con validacion en dispositivos reales.

## Prerrequisitos De Fase 3

Antes de habilitar push se corrigen dos inconsistencias de pagos recurrentes:

1. La recurrencia mensual/anual debe preservar el dia ancla original cuando sea posible.
   - `31 ene -> 28 feb -> 31 mar`.
   - No debe derivar permanentemente a `28 mar`.
   - La misma regla aplica para anuales y anos bisiestos.
2. Los pagos manuales de ocurrencias fijas deben usar la categoria configurada en la regla.
   - Ejemplo: Spotify usa `Ocio`.
   - No debe caer en `Pago recurrente` salvo que la regla no tenga categoria.
   - Tarjetas mantienen el fallback `Pago de tarjeta`.

Estos prerequisitos evitan recordatorios en fechas equivocadas y reportes con categorias inconsistentes.

## Calendario Fijo

Los dias de anticipacion no son configurables.

| Evento | Momento local |
| --- | --- |
| `due_in_7_days` | 7 dias antes a las 09:00. |
| `due_in_3_days` | 3 dias antes a las 09:00. |
| `due_in_1_day` | 1 dia antes a las 09:00. |
| `due_today` | Dia de vencimiento a las 09:00. |
| `overdue` | Primer dia vencido a las 09:00. |
| `payment_recorded` | Inmediato, solo en otros dispositivos. |
| `pending_movement_detected` | Inmediato, cuando Gmail crea un pendiente nuevo. |

No se repite diariamente el aviso vencido. Una estrategia de repeticion puede evaluarse despues con datos de uso.

Los recordatorios de pagos usan la zona horaria de la regla recurrente (`recurring_payment_rules.timezone`). No se usa la zona local de cada instalacion para decidir las 09:00 del pago.

## Contenido De Las Notificaciones

Las notificaciones no muestran montos, moneda, cuenta bancaria ni datos Gmail en la pantalla bloqueada.

### 7 Dias Antes

```text
Titulo: Internet vence en 7 dias
Cuerpo: Revisa tu pago pendiente en Fint.
```

### 3 Dias Antes

```text
Titulo: Tarjeta BCP vence en 3 dias
Cuerpo: Revisa el estado del pago antes del vencimiento.
```

### 1 Dia Antes

```text
Titulo: Tu pago vence manana
Cuerpo: Internet sigue pendiente.
```

### Dia De Vencimiento

```text
Titulo: Tu pago vence hoy
Cuerpo: Abre Fint para revisar Internet.
```

### Vencido

```text
Titulo: Tienes un pago vencido
Cuerpo: Internet sigue pendiente de pago.
```

### Pago Registrado En Otro Dispositivo

```text
Titulo: Pago actualizado
Cuerpo: Se registro un pago en Tarjeta BCP.
```

Los textos deben localizarse en espanol, ingles y portugues antes del envio. API recibe el idioma preferido del perfil o instalacion.

### Movimiento Pendiente Detectado

```text
Titulo: Nuevo movimiento por revisar
Cuerpo: Revisa un movimiento detectado en Fint.
```

No se incluye remitente, asunto, fragmento de correo, cuenta Gmail, monto, moneda ni banco en la notificacion. El detalle solo se muestra al abrir la app.

## Arquitectura

```text
Supabase Cron
  -> Internal notification endpoint
  -> Due occurrence query
  -> Idempotent delivery claim
  -> Expo Push Service
  -> Push ticket
  -> Receipt verification
  -> Disable invalid token

Gmail processor
  -> Pending movement created
  -> Idempotent pending delivery claim
  -> Expo Push Service
```

Las notificaciones son remotas. No se programan alarmas locales por cada pago porque deben reflejar cambios realizados en otros dispositivos.

## Base De Datos

### Instalaciones

Crear `push_installations`:

```text
id uuid primary key
user_id uuid not null
installation_id uuid not null
expo_push_token text not null
platform android | ios
locale text not null
timezone text not null
status active | disabled
last_seen_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Restricciones:

```text
unique(user_id, installation_id)
unique(expo_push_token)
```

El token puede rotar. El upsert por instalacion reemplaza el token anterior.

### Entregas

Crear `notification_deliveries`:

```text
id uuid primary key
user_id uuid not null
payment_occurrence_id uuid null
pending_movement_id uuid null
payment_occurrence_payment_id uuid null
installation_id uuid not null
event_type text not null
scheduled_local_date date not null
expo_ticket_id text null
status claimed | sent | delivered | failed
error_code text null
attempt_count int not null default 0
next_attempt_at timestamptz null
claimed_at timestamptz null
created_at timestamptz
updated_at timestamptz
```

Restriccion idempotente:

```text
unique(payment_occurrence_id, installation_id, event_type) where payment_occurrence_id is not null and event_type <> 'payment_recorded'
unique(payment_occurrence_payment_id, installation_id, event_type) where payment_occurrence_payment_id is not null and event_type = 'payment_recorded'
unique(pending_movement_id, installation_id, event_type) where pending_movement_id is not null and event_type = 'pending_movement_detected'
```

Los recordatorios se deduplican por ocurrencia, instalacion y tipo. `payment_recorded` se deduplica por pago concreto para permitir varios pagos parciales sobre la misma ocurrencia. `pending_movement_detected` se deduplica por pendiente concreto.

Para eventos inmediatos (`payment_recorded` y `pending_movement_detected`), `scheduled_local_date` guarda la fecha local del evento para auditoria y retencion, no para postergar el envio.

El job reclama primero la entrega en base. Solo el proceso que obtiene la fila envia el push. Claims abandonados pueden recuperarse si `claimed_at` queda viejo y el estado no avanzo.

## Endpoints API

```text
PUT    /api/push/installations/:installationId
DELETE /api/push/installations/:installationId
POST   /api/jobs/payment-reminders/send
POST   /api/jobs/push-receipts/check
```

Registro de instalacion:

```json
{
  "expoPushToken": "ExponentPushToken[...]",
  "platform": "android",
  "locale": "es-PE",
  "timezone": "America/Lima"
}
```

Los endpoints internos usan secreto server-side almacenado en Supabase Vault o variables protegidas de Render. No se exponen al cliente mobile. Deben usar el mismo header interno que el resto de jobs (`x-internal-cron-secret`).

## Job De Recordatorios

Ejecutar cada hora para cubrir zonas horarias sin crear un cron por usuario.

Por cada regla activa:

1. Resolver fecha y hora local usando `recurring_payment_rules.timezone`.
2. Considerar envios cuando la hora local haya alcanzado las 09:00.
3. Seleccionar ocurrencias no pagadas en T-7, T-3, T-1, T0 o T+1.
4. Crear deliveries idempotentes por instalacion activa.
5. Enviar en lotes al Expo Push Service.
6. Guardar ticket IDs.
7. Registrar errores sin payload financiero.

Si el job estuvo caido a las 09:00, puede enviar el evento pendiente durante el resto del mismo dia local. No envia eventos de anticipacion correspondientes a dias anteriores.

## Pago Registrado

Al registrar o aplicar un pago, el request incluye `originInstallationId`.

API:

1. Confirma la operacion financiera.
2. Consulta instalaciones activas del usuario.
3. Excluye `originInstallationId`.
4. Envia `payment_recorded` a las demas instalaciones.

El dispositivo origen usa toast y actualizacion de queries, no push.

## Movimiento Pendiente Detectado

Cuando el procesador Gmail cree un pendiente nuevo:

1. La operacion de Gmail confirma que el pendiente fue insertado por primera vez.
2. API consulta instalaciones activas del usuario.
3. Crea deliveries `pending_movement_detected` idempotentes por instalacion.
4. Envia push best-effort despues de confirmar la transaccion.
5. Si el envio inmediato falla, el job de receipts/reintentos puede continuar con deliveries pendientes.

No se debe notificar cuando el parser detecta un duplicado o actualiza una fila existente sin crear un pendiente nuevo.

## Payload

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Tu pago vence manana",
  "body": "Internet sigue pendiente.",
  "sound": "default",
  "channelId": "payment-reminders",
  "data": {
    "type": "payment_reminder",
    "occurrenceId": "uuid",
    "url": "/debts?occurrenceId=uuid"
  }
}
```

El payload no incluye monto, moneda, account ID, Gmail ID ni contenido del correo.

Para pendientes:

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Nuevo movimiento por revisar",
  "body": "Revisa un movimiento detectado en Fint.",
  "sound": "default",
  "channelId": "pending-movements",
  "data": {
    "type": "pending_movement_detected",
    "pendingMovementId": "uuid",
    "url": "/pending-movements"
  }
}
```

El payload de pendientes tampoco incluye contenido Gmail, monto, moneda, remitente, asunto, banco ni cuenta.

## Mobile Expo

### Dependencia Y Configuracion

- Instalar `expo-notifications` con `bunx expo install expo-notifications` para resolver la version compatible con Expo SDK 55.
- Agregar el config plugin en `app.json`.
- Agregar un icono Android blanco con transparencia.
- Configurar color ocean-blue.
- Crear canales Android `payment-reminders` y `pending-movements` antes de solicitar permisos.
- Generar un nuevo build EAS; la configuracion nativa no funciona mediante update JS solamente.

Push remoto no se prueba en Expo Go para Android. Debe validarse en development build, preview APK y release.

### Permiso

No solicitar permiso durante login ni primer arranque.

Flujo:

1. Usuario crea su primera regla recurrente o habilita Gmail para detectar pendientes.
2. Mobile explica el beneficio de los recordatorios.
3. Usuario acepta continuar.
4. Mobile solicita permiso del sistema.
5. Si acepta, registra token.
6. Si rechaza, la regla se guarda y la app sigue funcionando sin push.

Settings debe mostrar `Notificaciones activas` o `Notificaciones desactivadas`, sin permitir cambiar los dias 7, 3 y 1. Si el permiso esta bloqueado, Settings debe permitir abrir la configuracion del sistema.

### Instalacion

- Generar `installationId` una vez y guardarlo en Secure Store.
- Obtener token con EAS `projectId`.
- Registrar token al iniciar sesion y cuando rote.
- Actualizar locale, timezone y `last_seen_at`.
- Desregistrar instalacion durante logout cuando haya red.
- No bloquear el arranque si Expo Push Service no responde.

### Navegacion

Al tocar una notificacion:

- Validar que `url` sea una ruta interna permitida.
- Para pagos, abrir la tab Pagos y resaltar o abrir la ocurrencia indicada.
- Para pendientes, abrir `Pendientes detectados`.
- Si ya no existe o no pertenece al usuario, mostrar la lista sin error fatal.

Debe manejar notificacion recibida con app abierta, en background y terminada.

## Tickets Y Receipts

- Guardar `ticket.id` por entrega.
- Consultar receipts en un job separado.
- Marcar `delivered` cuando corresponda.
- Desactivar tokens con `DeviceNotRegistered`.
- Registrar temporalmente errores recuperables.
- No reintentar errores permanentes.
- Limitar reintentos para evitar spam.

## Seguridad

- Tokens push solo son visibles para API.
- RLS restringe instalaciones y entregas por `user_id`.
- Mobile nunca puede listar tokens de otros dispositivos.
- Endpoints internos no usan claves `EXPO_PUBLIC_*`.
- Logs no incluyen token completo ni contenido financiero.
- La URL del payload se valida contra un allowlist de rutas.

## Pruebas

### API

- T-7, T-3 y T-1 producen una sola entrega.
- Regla pagada no produce recordatorio.
- T0 produce `due_today`.
- T+1 produce un solo `overdue`.
- Dos jobs simultaneos no duplican push.
- Token invalido queda desactivado.
- Pago excluye el dispositivo origen.
- Pago notifica otros dos dispositivos activos.
- Segundo pago parcial sobre la misma ocurrencia genera otro `payment_recorded`.
- Pendiente Gmail nuevo genera una sola notificacion por instalacion activa.
- Duplicado Gmail no genera notificacion nueva.
- Timezone cambia correctamente la fecha local.
- Claim abandonado puede reintentarse sin duplicar entrega.

### Mobile

- Permiso aceptado registra token.
- Permiso rechazado no bloquea reglas.
- Token rotado actualiza instalacion.
- Tap abre la ocurrencia correcta.
- Tap de pendiente abre `Pendientes detectados`.
- Payload invalido no navega fuera de la app.
- Foreground muestra comportamiento esperado.
- Logout desregistra o desactiva instalacion.

### Dispositivo Real

- Android 13 o superior solicita permiso despues de crear la regla.
- Preview APK recibe push con app abierta, cerrada y en background.
- iOS recibe push con app abierta, cerrada y en background.
- Release build abre deep link sin warning de linking.
- Icono y canal Android se muestran correctamente.

## Criterios De Aceptacion

- Todos los pagos no completados reciben avisos fijos 7, 3 y 1 dia antes.
- No existe configuracion de dias de aviso.
- Vencimiento y vencido se notifican una sola vez.
- Pago desde otro dispositivo produce confirmacion push.
- El dispositivo origen no recibe push redundante.
- Nuevo movimiento pendiente produce notificacion push sin exponer datos Gmail ni monto.
- Ninguna notificacion expone montos, cuentas, bancos, remitentes, asuntos o datos Gmail.
- Tokens invalidos se desactivan mediante receipts.

## Estado De Cierre

Fase 4 queda cerrada operativamente para Android y habilita el inicio de Fase 5.

Validado en build EAS preview Android:

- Registro de instalacion en `push_installations` con token Expo activo.
- Firebase cliente Android configurado con `google-services.json` sin versionarlo en Git.
- FCM v1 configurado en EAS con service account del proyecto Firebase correcto.
- Push `pending_movement_detected` recibido en dispositivo real.
- Receipts y rotacion de credencial FCM validados.
- Push con app abierta, en background, cerrada y con pantalla bloqueada.
- Idioma de push segun idioma seleccionado en la app: espanol, ingles y portugues.
- Payloads sin monto, moneda, banco, cuenta, remitente, asunto ni contenido Gmail.
- Logout/desregistro y reingreso validados.
- Navegacion desde push validada para pendientes y pagos.

Pendientes secundarios no bloqueantes para Fase 5:

- Validacion iOS real con APNs/Expo.
- Validacion formal de pagos entre multiples dispositivos: origen excluido y otros dispositivos notificados.
- Prueba formal de concurrencia de cron para confirmar que dos ejecuciones simultaneas no duplican deliveries.
- Recordatorios T-7, T-3, T-1, T0 y T+1 completos contra calendario real o fixture controlado.
- Las notificaciones de pagos ya mencionan que pago se notifica; queda opcional resaltar/abrir la ocurrencia exacta al tocar el push.

## Fuera De Alcance

- Dias u horarios configurables.
- Avisos vencidos diarios.
- Acciones para pagar desde la notificacion.
- Alarmas locales.
- Gasto inusual, resumen semanal o nuevo inicio de sesion.
- Reversion contable de pagos.
- Pagos automaticos.

## Dependencia De Salida

La Fase 5 puede comenzar con la validacion Android operativa completa. Las validaciones iOS, concurrencia formal y multi-dispositivo de pagos pasan al backlog secundario de QA de Fase 5.
