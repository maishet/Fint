# Plan De Implementacion: Pendientes Y Pagos Recurrentes

## Proposito

Este documento es la fuente de verdad transversal para implementar el nuevo flujo en:

- Mobile: `E:\Personal proyects\finanzas-mobilev2`.
- API y base de datos: `E:\Personal proyects\finanzas-api`.

El plan simplifica la seccion actual de deudas y fortalece los pendientes detectados desde Gmail sin convertir Fint en un sistema contable complejo.

## Decisiones Cerradas

- Gmail nunca crea un movimiento real sin confirmacion del usuario.
- El pendiente muestra solo informacion util para decidir: titulo, tipo, monto, moneda, fecha, cuenta, categoria y destino.
- La UI no muestra correo conectado, remitente, referencia Gmail, parser, confidence ni observaciones tecnicas.
- La metadata tecnica se conserva solo en API para deduplicacion, soporte y auditoria.
- Un pendiente puede crear un movimiento normal o aplicarse a un pago recurrente.
- Aplicar un pendiente a un pago crea el movimiento y registra el pago en una sola operacion atomica.
- La seccion Deudas evoluciona visualmente a Pagos.
- Los pagos soportados son servicios recurrentes fijos y tarjetas de credito.
- Las frecuencias disponibles son semanal, quincenal, mensual y anual.
- Los avisos previos se envian siempre 7, 3 y 1 dia antes; el usuario no puede modificar esos valores.
- Tambien se avisa el dia de vencimiento y una vez al pasar a vencido.
- Cuando un pago se registra desde otro dispositivo se envia una confirmacion push.
- Una regla no guarda cuenta bancaria predeterminada.
- Una regla de tarjeta guarda una tarjeta asociada, seleccionada solo entre cuentas `credit_card` del usuario.
- La cuenta real de pago se selecciona en el momento de registrar o aplicar el pago.
- En cada periodo de tarjeta, el usuario ingresa total y pago minimo.
- Un pago de tarjeta crea un movimiento `debt_payment` que no se suma como gasto nuevo.
- No existen pagos automaticos ni confirmacion automatica de correos.

## Experiencia Objetivo

### Pendiente Normal

1. La API detecta titulo, tipo, monto y moneda mediante un parser bancario o generico.
2. Mobile muestra una revision simple.
3. El usuario corrige los datos necesarios.
4. El usuario selecciona cuenta y categoria.
5. La API crea un solo movimiento y resuelve el pendiente.

### Pendiente Aplicado A Pago

1. El usuario abre el pendiente.
2. Selecciona `Aplicar a pago`.
3. Mobile muestra pagos abiertos compatibles por moneda y tipo.
4. El usuario selecciona la cuenta real desde la que se pago.
5. API crea el movimiento, registra el pago y actualiza la ocurrencia de forma atomica.

### Pago Recurrente

1. El usuario crea una regla semanal, quincenal, mensual o anual.
2. API genera una ocurrencia unica para cada periodo.
3. API envia avisos fijos a 7, 3 y 1 dia del vencimiento.
4. Mobile permite registrar el pago manualmente o aplicarlo desde un pendiente.
5. La ocurrencia conserva su estado e historial.

### Tarjeta De Credito

1. El usuario crea una regla y selecciona una tarjeta asociada.
2. Para cada periodo ingresa total, pago minimo y vencimiento.
3. Cada pago incrementa el acumulado del periodo.
4. Mobile muestra pendiente, parcial, minimo cubierto o pagado.
5. El pago se registra como `debt_payment`, no como gasto adicional.

## Modelo De Estados

El estado de pago y el estado temporal se calculan por separado para evitar combinaciones ambiguas.

### Estado De Pago

| Estado | Regla |
| --- | --- |
| `unpaid` | No existen pagos vigentes. |
| `partial` | Existe un pago, pero no alcanza el total ni el minimo de tarjeta. |
| `minimum_met` | Solo tarjeta: pagado acumulado mayor o igual al minimo y menor al total. |
| `paid` | Pagado acumulado mayor o igual al total. |

### Estado Temporal

| Estado | Regla |
| --- | --- |
| `upcoming` | La fecha de vencimiento es futura. |
| `due_today` | El vencimiento corresponde a la fecha local actual. |
| `overdue` | Ya vencio y el estado de pago no es `paid`. |

## Notificaciones Definidas

| Evento | Momento | Condicion |
| --- | --- | --- |
| `due_in_7_days` | 7 dias antes | El pago no esta pagado. |
| `due_in_3_days` | 3 dias antes | El pago no esta pagado. |
| `due_in_1_day` | 1 dia antes | El pago no esta pagado. |
| `due_today` | Dia de vencimiento | El pago no esta pagado. |
| `overdue` | Primer dia vencido | El pago no esta pagado. |
| `payment_recorded` | Al registrar pago | Solo otros dispositivos del usuario. |

Cada evento se envia una sola vez por ocurrencia y dispositivo. No existe configuracion de dias de anticipacion en mobile ni en API.

## Fases

1. [Fase 1: Pendientes seguros](implementation-phase-1-safe-pending.md)
2. [Fase 2: Parser multibanco](implementation-phase-2-multibank-parser.md)
3. [Fase 3: Pagos recurrentes](implementation-phase-3-recurring-payments.md)
4. [Fase 4: Notificaciones push](implementation-phase-4-push-notifications.md)
5. [Fase 5: Migracion y QA](implementation-phase-5-migration-and-qa.md)

## Orden Obligatorio

La Fase 1 debe publicarse antes de aceptar nuevos formatos bancarios. La Fase 3 debe estar desplegada antes de habilitar `Aplicar a pago`. La Fase 4 depende de que la generacion de ocurrencias de la Fase 3 sea estable e idempotente.

## Fuera De Alcance

- Prestamos y amortizaciones.
- Capital, intereses y comisiones.
- Calculo automatico de pago minimo.
- Lectura automatica de estados de cuenta.
- Pagos automaticos.
- Acciones de pago desde la notificacion.
- Machine learning para clasificar correos.
- Mostrar contenido, remitente o cuenta Gmail en la revision del pendiente.
- Conciliacion contable completa entre instituciones.

## Definicion Global De Hecho

- Mobile y API usan contratos alineados.
- Las operaciones financieras son atomicas e idempotentes.
- Un pendiente no puede crear mas de un movimiento.
- Una regla no puede generar dos ocurrencias para el mismo periodo.
- Los avisos 7, 3 y 1 dia antes no pueden duplicarse.
- Los datos estan aislados por `user_id` y protegidos por ownership.
- Los estados se calculan igual en API, mobile y reportes.
- Existen pruebas de concurrencia, reintentos y multiples dispositivos.
- TypeScript, tests y Expo Doctor permanecen en verde.
