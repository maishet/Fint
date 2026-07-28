# Fase 3: Pagos Recurrentes

## Objetivo

Transformar la seccion Deudas en una experiencia simple de pagos recurrentes para servicios fijos y tarjetas de credito, reutilizando los pagos y ocurrencias existentes donde sea seguro.

## Alcance Funcional

### Tipos De Regla

| Tipo | Uso |
| --- | --- |
| `fixed_payment` | Luz, agua, internet, alquiler, suscripciones y otros servicios con monto fijo. |
| `credit_card` | Recordatorio mensual de una tarjeta asociada con total y minimo ingresados por el usuario. |

### Frecuencias

| Frecuencia | Calculo |
| --- | --- |
| `weekly` | Cada 7 dias desde la fecha inicial. |
| `biweekly` | Cada 14 dias desde la fecha inicial. |
| `monthly` | Mismo dia del mes; si no existe, ultimo dia del mes. |
| `yearly` | Mismo mes y dia; 29 de febrero se ajusta al ultimo dia de febrero cuando aplique. |

No se incluye frecuencia personalizada en esta version.

## Regla Recurrente

Crear `recurring_payment_rules`:

```text
id uuid primary key
user_id uuid not null
title text not null
kind fixed_payment | credit_card
frequency weekly | biweekly | monthly | yearly
currency char(3) not null
fixed_amount numeric(14,2) null
category_id uuid null
card_account_id uuid null
timezone text not null
start_date date not null
next_due_date date not null
status active | paused | ended
created_at timestamptz
updated_at timestamptz
```

### Reglas De Integridad

- `fixed_payment` exige `fixed_amount > 0`.
- `fixed_payment` no puede guardar `card_account_id`.
- `credit_card` exige `card_account_id` owner-scoped.
- La cuenta asociada debe tener tipo `credit_card` y la misma moneda.
- Una regla no contiene cuenta bancaria o cuenta de pago predeterminada.
- `category_id` es obligatoria para pago fijo.
- La categoria debe ser de tipo `expense`.
- La tarjeta asociada identifica la obligacion, no el origen del dinero.
- `timezone` se captura desde el dispositivo al crear la regla y no se muestra como configuracion avanzada.

## Ocurrencias

La tabla actual `debts` se mantiene internamente como almacenamiento de ocurrencias para reducir migracion y preservar datos. Se agregan:

```text
recurring_rule_id uuid null
period_key text null
payment_kind fixed_payment | credit_card | legacy
minimum_amount numeric(14,2) null
amount_status required | confirmed
```

Restriccion:

```text
unique(user_id, recurring_rule_id, period_key)
```

`period_key` se calcula de manera determinista:

- Semanal y quincenal: fecha ISO de inicio del periodo.
- Mensual: `YYYY-MM`.
- Anual: `YYYY`.

### Pago Fijo

- Se genera con `original_amount = fixed_amount`.
- Se genera con `outstanding_amount = fixed_amount`.
- Se genera con `amount_status = confirmed`.

### Tarjeta

- La ocurrencia se genera para mantener fecha y alertas.
- Inicia con `amount_status = required`.
- El usuario debe ingresar total y pago minimo para habilitar pagos.
- Al confirmar total, se actualizan `original_amount` y `outstanding_amount`.
- `minimum_amount` debe ser mayor que cero y menor o igual al total.
- No se calcula el minimo automaticamente.

Para soportar la ocurrencia de tarjeta sin monto, `original_amount` y `outstanding_amount` pueden ser `null` solo cuando `payment_kind = credit_card` y `amount_status = required`.

## Generador De Ocurrencias

Un job diario debe:

1. Seleccionar reglas activas con `next_due_date` dentro de la ventana de generacion.
2. Crear la ocurrencia mediante `INSERT ... ON CONFLICT DO NOTHING`.
3. Calcular el siguiente vencimiento segun frecuencia.
4. Actualizar `next_due_date` dentro de la misma transaccion.
5. Repetir si una regla quedo atrasada por varios periodos, con un limite por ejecucion.

Ventana recomendada: generar al menos 8 dias antes del vencimiento para garantizar el aviso de 7 dias.

No se generan movimientos financieros durante este proceso.

## Registros De Pago

Extender `debt_payments`:

```text
status posted | reversed
pending_movement_id uuid null
origin_installation_id uuid null
idempotency_key uuid not null
reversed_at timestamptz null
reversal_reason text null
```

Restricciones:

- Un pendiente puede aplicarse a un solo pago.
- Una idempotency key puede producir un solo pago por usuario.
- El monto debe ser positivo.
- Moneda de pago, ocurrencia y cuenta deben coincidir.
- El pago acumulado vigente no puede exceder el total en esta version.
- Una ocurrencia de tarjeta con monto pendiente no acepta pagos.

## Calculo De Estados

No se persisten combinaciones de UI innecesarias. API calcula estados desde fecha y pagos vigentes.

### Pago Fijo

```text
paidAmount = sum(debt_payments where status = posted)
```

- `unpaid`: `paidAmount = 0`.
- `partial`: `0 < paidAmount < total`.
- `paid`: `paidAmount >= total`.

### Tarjeta

- `unpaid`: `paidAmount = 0`.
- `partial`: `0 < paidAmount < minimumAmount`.
- `minimum_met`: `minimumAmount <= paidAmount < total`.
- `paid`: `paidAmount >= total`.

### Estado Temporal

- `upcoming`: fecha futura.
- `due_today`: fecha local actual.
- `overdue`: fecha pasada y pago distinto de `paid`.

## Semantica De Movimientos

### Servicio Fijo

Registrar o aplicar un pago crea:

- Movimiento `expense`.
- Categoria de la regla o seleccionada por el usuario.
- Debito sobre la cuenta elegida en ese momento.
- Registro en `debt_payments`.

### Tarjeta

Registrar o aplicar un pago crea:

- Movimiento `debt_payment`.
- Categoria de sistema `Pago de tarjeta`.
- Debito sobre la cuenta elegida en ese momento.
- Registro en `debt_payments`.
- Reduccion del saldo pendiente de la ocurrencia.

Los movimientos `debt_payment` aparecen en el historial, pero se excluyen de gastos por categoria, gasto mensual y ahorro. No se implementa doble entrada ni se modifica automaticamente el balance de la tarjeta en esta fase.

## Cuenta De Pago

La regla no conserva cuenta de pago predeterminada.

En cada pago el usuario selecciona una cuenta que:

- Le pertenece.
- Esta activa.
- No es la tarjeta asociada.
- Usa la misma moneda.

La API recibe `accountId`, nunca el nombre de cuenta.

## API

### Reglas

```text
GET    /api/payment-rules
POST   /api/payment-rules
PATCH  /api/payment-rules/:id
DELETE /api/payment-rules/:id
POST   /api/payment-rules/:id/pause
POST   /api/payment-rules/:id/resume
```

### Ocurrencias

```text
GET   /api/payment-occurrences?status=open|paid|overdue
GET   /api/payment-occurrences/:id
PATCH /api/payment-occurrences/:id/card-amounts
POST  /api/payment-occurrences/:id/pay
POST  /api/payment-occurrences/:id/payments/:paymentId/reverse
```

### Pago Manual

```json
{
  "amount": 250,
  "accountId": "uuid",
  "transactionDate": "2026-07-27",
  "note": null,
  "originInstallationId": "uuid"
}
```

Requiere header `Idempotency-Key`.

### Aplicacion Desde Pendiente

La confirmacion `mode = payment` de la Fase 1 debe:

1. Bloquear pendiente y ocurrencia.
2. Validar compatibilidad de moneda.
3. Crear el movimiento correcto segun tipo de regla.
4. Crear `debt_payments` vinculado al pendiente.
5. Recalcular outstanding y estado.
6. Resolver el pendiente.
7. Confirmar todo en una sola transaccion.

## Reversion

`Reversar pago` solicita motivo y ejecuta atomicamente:

1. Bloqueo del pago, ocurrencia, transaccion y cuenta.
2. Cambio del pago a `reversed`.
3. Restauracion de outstanding.
4. Reversion del impacto en la cuenta.
5. Anulacion o contrapartida del movimiento.
6. Auditoria con motivo y valores antes/despues.

El pago original permanece visible en historial como reversado.

## Mobile

### Navegacion

Renombrar visualmente la tab `Deudas` a `Pagos`. Las rutas internas pueden conservar sus nombres durante la migracion coordinada.

Secciones:

- `Proximos`.
- `Vencidos`.
- `Pagados`.
- `Recurrentes`.

### Card De Ocurrencia

Mostrar:

- Titulo.
- Monto total o `Configura el monto` para tarjeta.
- Pagado acumulado.
- Saldo restante.
- Fecha de vencimiento.
- Estado de pago.
- Estado temporal.
- Tarjeta asociada, solo cuando corresponda.

### Formulario De Regla

Campos comunes:

- Titulo.
- Tipo.
- Frecuencia.
- Moneda.
- Fecha inicial de vencimiento.

Pago fijo agrega:

- Monto fijo.
- Categoria.

Tarjeta agrega:

- Tarjeta asociada.

No existe selector de cuenta bancaria predeterminada ni selector de dias de aviso.

### Registrar Pago

Mostrar:

- Total.
- Minimo, si es tarjeta.
- Pagado.
- Saldo restante.
- Monto a registrar.
- Cuenta real de pago.
- Fecha.
- Nota opcional.

Accesos rapidos para tarjeta:

- `Minimo restante`.
- `Total restante`.
- `Otro monto`.

### Configurar Periodo De Tarjeta

Antes del primer pago de cada periodo:

- Total del periodo.
- Pago minimo.
- Fecha de vencimiento editable.

## Queries E Invalidacion

Mutaciones de reglas, ocurrencias o pagos invalidan:

- Reglas.
- Ocurrencias.
- Movimientos.
- Cuentas.
- Resumen.
- Reportes.
- Pendientes cuando el pago provino de Gmail.

## Pruebas

### Recurrencia

- Semanal cruza mes correctamente.
- Quincenal usa intervalos exactos de 14 dias.
- Mensual ajusta dias 29, 30 y 31.
- Anual ajusta 29 de febrero.
- Dos jobs simultaneos generan una sola ocurrencia.
- Regla pausada no genera nuevas ocurrencias.

### Pagos

- Pago fijo total queda `paid`.
- Pago fijo parcial queda `partial`.
- Tarjeta antes del minimo queda `partial`.
- Tarjeta al alcanzar minimo queda `minimum_met`.
- Tarjeta al alcanzar total queda `paid`.
- Pago de tarjeta no aumenta gasto mensual.
- Reintento con misma key no duplica pago.
- Reversion restaura cuenta y ocurrencia.

### Ownership

- No se puede asociar tarjeta de otro usuario.
- No se puede pagar con cuenta de otro usuario.
- No se puede aplicar pendiente de otro usuario.
- Monedas incompatibles responden `422`.

## Criterios De Aceptacion

- Las reglas solo modelan pagos fijos y tarjetas.
- Todas las frecuencias generan periodos correctos.
- No existe cuenta de pago predeterminada.
- La tarjeta asociada es obligatoria para reglas de tarjeta.
- El usuario ingresa total y minimo por periodo de tarjeta.
- Aplicar un pendiente crea movimiento y pago atomicamente.
- Pagos de tarjeta no se cuentan como gasto nuevo.
- El historial conserva pagos y reversiones.

## Dependencia De Salida

La Fase 4 puede habilitarse cuando la generacion de ocurrencias sea idempotente y `next_due_date` sea confiable.
