# Fase 1: Pendientes Seguros

## Objetivo

Convertir el pendiente actual en una sugerencia revisable y garantizar que una confirmacion, descarte o reintento no pueda duplicar movimientos ni dejar estados contradictorios.

## Problemas Que Resuelve

- Actualmente solo se corrige la categoria antes de confirmar.
- Dos confirmaciones concurrentes pueden crear dos movimientos.
- Un timeout puede llevar al usuario a reintentar una operacion ya aplicada.
- El descarte puede cambiar el estado de un pendiente previamente confirmado.
- La cuenta inferida se resuelve por nombre y puede terminar en `null`.
- Realtime retira el pendiente en otro dispositivo, pero no actualiza todos los datos financieros.
- Los errores de confirmacion y descarte no tienen feedback suficiente en mobile.

## Alcance De Base De Datos

### Restricciones

- Agregar un indice unico parcial sobre `transactions.pending_movement_id` cuando no sea `null`.
- Agregar foreign key owner-aware entre pendiente y transaccion confirmada.
- Agregar foreign key owner-aware entre transaccion y pendiente.
- Agregar checks de monto positivo y moneda ISO de tres letras.
- Conservar `source_reference` unico por usuario y fuente conectada.
- Restringir las transiciones a `pending -> confirmed` o `pending -> discarded`.

### Idempotencia

Crear una tabla `operation_requests`:

```text
id
user_id
operation_type
idempotency_key
payload_hash
result_entity_id
created_at
```

Restriccion requerida:

```text
unique(user_id, operation_type, idempotency_key)
```

Si se repite la misma clave con el mismo payload, API devuelve el resultado original. Si se reutiliza con otro payload, responde `409 idempotency_conflict`.

## Contrato API

### Confirmar Como Movimiento

```http
POST /api/pending-movements/:id/confirm
Idempotency-Key: <uuid>
```

```json
{
  "mode": "transaction",
  "title": "Compra con tarjeta",
  "type": "expense",
  "amount": 89.9,
  "currency": "PEN",
  "transactionDate": "2026-07-27",
  "accountId": "uuid",
  "categoryId": "uuid",
  "note": null
}
```

Respuesta:

```json
{
  "pendingMovementId": "uuid",
  "transactionId": "uuid",
  "status": "confirmed"
}
```

### Aplicar A Pago

El contrato se define desde esta fase, pero se habilita cuando la Fase 3 este desplegada.

```json
{
  "mode": "payment",
  "paymentOccurrenceId": "uuid",
  "title": "Pago de tarjeta",
  "type": "expense",
  "amount": 250,
  "currency": "PEN",
  "transactionDate": "2026-07-27",
  "accountId": "uuid",
  "categoryId": null,
  "note": null,
  "originInstallationId": "uuid"
}
```

`categoryId` es obligatorio para un servicio fijo si la regla no tiene categoria. No es obligatorio para tarjeta porque API usa la categoria de sistema `Pago de tarjeta` y crea un movimiento `debt_payment`.

### Descartar

```http
POST /api/pending-movements/:id/discard
Idempotency-Key: <uuid>
```

La actualizacion debe incluir `WHERE status = 'pending'`. Una repeticion devuelve el estado final sin aplicar otra mutacion.

## Transaccion De Confirmacion

La API debe ejecutar en una sola transaccion:

1. Reclamar la clave de idempotencia.
2. Seleccionar el pendiente owner-scoped con `FOR UPDATE`.
3. Verificar que siga `pending`.
4. Validar ownership de cuenta y categoria mediante IDs.
5. Validar moneda de la cuenta y del movimiento.
6. Crear un solo movimiento.
7. Aplicar el cambio de saldo.
8. Marcar el pendiente como `confirmed`.
9. Guardar el resultado de idempotencia.
10. Registrar auditoria con valores originales y finales.

El indice unico de `pending_movement_id` es la ultima defensa ante dos solicitudes concurrentes.

## Datos Originales Y Corregidos

Los datos producidos por el parser no deben sobrescribirse. El pendiente conserva internamente:

- Titulo original.
- Tipo detectado.
- Monto detectado.
- Moneda detectada.
- Fecha detectada.
- Parser y version.
- Referencia Gmail.
- Advertencias internas.

La resolucion guarda por separado los valores confirmados por el usuario. Mobile no muestra parser, fuente Gmail, remitente, referencia ni advertencias tecnicas.

## Cambios Mobile

### Presentacion

El acordeon actual se reemplaza por cards compactas y un sheet de revision.

La card muestra:

- Titulo.
- Tipo con etiqueta `Ingreso` o `Gasto`.
- Monto y moneda.
- Fecha, cuando exista.

El sheet muestra solamente:

- Titulo editable como descripcion.
- Selector de ingreso o gasto.
- Monto.
- Moneda.
- Fecha.
- Cuenta.
- Categoria.
- Destino: movimiento o pago.

No se muestra:

- Direccion Gmail.
- Remitente.
- Message ID.
- Referencia tecnica.
- Confidence.
- Texto original del correo.
- Nombre del parser.

### Validacion

- Tipo, monto, moneda, fecha y cuenta son obligatorios para confirmar.
- Categoria es obligatoria para movimiento normal.
- No se habilita `Aplicar a pago` hasta que exista una ocurrencia compatible.
- El monto debe ser mayor que cero.
- La moneda debe coincidir con la cuenta seleccionada.
- Si cambia el tipo, el selector de categorias limpia una categoria incompatible.

### Acciones

- `Crear movimiento`.
- `Aplicar a pago`.
- `Descartar`.

Descartar requiere confirmacion breve. Todas las mutaciones muestran progreso, error localizado y resultado exitoso.

### Cache Y Realtime

Una confirmacion local o remota invalida:

- Pendientes.
- Movimientos.
- Cuentas.
- Resumen.
- Reportes.
- Pagos, si corresponde.

Realtime debe reaccionar solo a filas del usuario autenticado.

## Cambios API

- Ampliar contratos Zod con discriminated union por `mode`.
- Resolver cuentas y categorias por ID.
- Mantener temporalmente el endpoint actual durante el despliegue coordinado si hay builds instaladas con el contrato anterior.
- Devolver IDs creados en respuestas de confirmacion.
- Usar codigos `409 already_resolved` y `409 idempotency_conflict`.
- No incluir metadata Gmail en el DTO publico de revision.
- Exponer solo un `requiresReview` boolean cuando falten datos confiables.

## Pruebas API

- Confirmacion correcta crea un movimiento.
- Dos confirmaciones simultaneas crean un solo movimiento.
- Repetir la misma idempotency key devuelve el mismo resultado.
- Reutilizar la clave con otro monto responde `409`.
- Confirmar un pendiente descartado no crea movimiento.
- Descartar un pendiente confirmado no cambia su estado.
- Account ID de otro usuario responde `404`.
- Category ID de otro usuario responde `404`.
- Moneda distinta a la cuenta responde `422`.
- Fallo entre movimiento y actualizacion de saldo hace rollback completo.

## Pruebas Mobile

- Pendiente incompleto mantiene CTA deshabilitado.
- Cambio ingreso/gasto limpia categoria incompatible.
- Error API conserva los datos editados.
- Doble tap envia una sola solicitud.
- Confirmacion remota refresca datos financieros.
- Descarte requiere confirmacion.
- Ninguna pantalla de revision muestra datos tecnicos de Gmail.

## Criterios De Aceptacion

- Un pendiente solo puede producir una transaccion.
- Reintentos de red no duplican saldo ni movimiento.
- Todos los datos financieros pueden revisarse antes de confirmar.
- La UI contiene solo informacion necesaria para el usuario.
- Las mutaciones tienen feedback de exito y error.
- Los valores originales permanecen disponibles para auditoria interna.

## Dependencia De Salida

La Fase 2 puede desplegarse despues de esta fase. El modo `payment` permanece deshabilitado mediante capability de API hasta completar la Fase 3.
