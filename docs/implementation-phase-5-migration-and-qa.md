# Fase 5: Migracion Y QA

## Objetivo

Migrar datos existentes, desplegar mobile y API sin estados incompatibles y validar el flujo completo antes de habilitarlo para todos los usuarios.

## Estrategia De Migracion

Usar expandir, migrar y contraer. No modificar migraciones ya aplicadas.

### Expandir

1. Crear `operation_requests`.
2. Crear `recurring_payment_rules`.
3. Extender `debts` como ocurrencias.
4. Extender `debt_payments` con idempotencia y reversion.
5. Crear `push_installations`.
6. Crear `notification_deliveries`.
7. Agregar indices y foreign keys inicialmente `NOT VALID` cuando aplique.
8. Agregar nuevos contratos API sin retirar inmediatamente respuestas requeridas por builds instaladas.

### Migrar Datos

Las deudas existentes se conservan como ocurrencias `legacy` de una sola vez:

```text
payment_kind = legacy
recurring_rule_id = null
period_key = null
```

Reglas:

- No inferir recurrencia desde descripcion.
- No convertir automaticamente una deuda en tarjeta solo porque tenga account ID.
- No modificar montos, pagos ni estados historicos.
- Mostrar las ocurrencias legacy hasta que se paguen o cancelen.
- No permitir crear nuevas deudas legacy desde la nueva UI.
- Ofrecer accion explicita `Convertir en recurrente` cuando sea apropiado.

Para tarjetas existentes:

- Conservar asociacion actual si la cuenta sigue siendo `credit_card` y moneda compatible.
- Exigir confirmacion del usuario antes de crear una regla recurrente.
- No inventar pago minimo ni periodo.

### Contraer

Despues de que el build nuevo tenga adopcion suficiente:

- Retirar el contrato antiguo de confirmacion que solo recibe categoria.
- Retirar creacion de deudas genericas.
- Mantener lectura de ocurrencias legacy mientras existan filas activas.
- Validar constraints agregados como `NOT VALID`.
- Eliminar codigo antiguo solo cuando metricas confirmen que no llegan requests del build anterior.

## Orden De Despliegue

1. Ejecutar migraciones expansivas.
2. Desplegar API compatible con mobile actual y nuevo.
3. Ejecutar backfill y consultas de anomalias.
4. Activar pruebas internas de parser y recurrencia.
5. Generar preview APK con notificaciones.
6. Validar flujos internos end-to-end.
7. Generar AAB de produccion.
8. Publicar en closed testing.
9. Habilitar capability para `payment` y nueva UI.
10. Monitorear errores antes de retirar contratos antiguos.

## Capabilities

API debe exponer capacidades de despliegue para evitar que mobile muestre acciones no soportadas:

```json
{
  "features": {
    "editablePendingMovements": true,
    "pendingToPayment": true,
    "recurringPayments": true,
    "pushPaymentReminders": true
  }
}
```

Mobile oculta o deshabilita cada flujo hasta que API confirme soporte.

## Consultas De Integridad Previas

Antes de validar constraints:

- Pendientes confirmados con mas de una transaccion.
- Pendientes confirmed sin transaccion.
- Pendientes discarded con transaccion activa.
- Pagos sin deuda, cuenta o transaccion.
- Deudas con outstanding negativo o mayor al original.
- Monedas incompatibles entre pago, cuenta y ocurrencia.
- Cuentas asociadas a tarjeta que ya no sean `credit_card`.
- Duplicados de regla y periodo.
- Tokens push duplicados.

Las anomalias se registran para correccion; no se eliminan automaticamente.

## Matriz End-To-End

### Pendientes

| Caso | Resultado |
| --- | --- |
| Gasto BCP correcto | Revision y movimiento unico. |
| Ingreso Interbank | Tipo y monto revisables. |
| Scotiabank ambiguo | Queda `requiresReview`. |
| Banco no reconocido | Usa parser generico. |
| Monto incorrecto | Usuario corrige antes de confirmar. |
| Sin cuenta detectada | Usuario selecciona cuenta. |
| Doble tap | Una sola operacion. |
| Timeout y retry | Mismo resultado idempotente. |
| Descartado | No crea movimiento. |
| Dos dispositivos | Solo uno resuelve; ambos refrescan. |

### Pagos Fijos

| Caso | Resultado |
| --- | --- |
| Regla semanal | Siguiente fecha en 7 dias. |
| Regla quincenal | Siguiente fecha en 14 dias. |
| Regla mensual dia 31 | Ajuste al ultimo dia. |
| Regla anual 29 febrero | Ajuste correcto. |
| Pago parcial | Estado `partial`. |
| Pago total | Estado `paid`. |
| Aplicar pendiente | Movimiento y pago atomicos. |
| Revertir | Cuenta y ocurrencia restauradas. |

### Tarjetas

| Caso | Resultado |
| --- | --- |
| Nueva regla | Exige tarjeta asociada. |
| Sin total mensual | No permite pagar. |
| Menor al minimo | `partial`. |
| Alcanza minimo | `minimum_met`. |
| Pago total | `paid`. |
| Pago desde otra cuenta | Se elige en ese momento. |
| Pago Gmail | Movimiento `debt_payment` y actualizacion atomica. |
| Reportes | Pago no cuenta como gasto nuevo. |

### Push

| Caso | Resultado |
| --- | --- |
| T-7 | Un push. |
| T-3 | Un push. |
| T-1 | Un push. |
| T0 | Un push de vencimiento. |
| T+1 | Un push de vencido. |
| Regla pagada | Sin avisos posteriores. |
| Dos ejecuciones del cron | Sin duplicados. |
| Pago mismo dispositivo | Solo toast local. |
| Pago otro dispositivo | Push de actualizacion. |
| Token invalido | Instalacion desactivada. |

## Pruebas Automatizadas

### API Unitarias

- Parsers y normalizadores.
- Calculo de recurrencia.
- Estados de pago y vencimiento.
- Plantillas de notificacion.
- Validacion de contratos.

### API Integracion

- Migraciones desde base vacia.
- Ownership y RLS.
- Confirmacion concurrente.
- Idempotencia.
- Generacion concurrente de ocurrencias.
- Pago y reversion transaccional.
- Claim concurrente de push deliveries.

### Mobile Unitarias

- Validacion del sheet de pendiente.
- Cambio de tipo y categorias.
- Mappers de reglas y ocurrencias.
- Render de estados.
- Manejo de notification payload.
- Feature capabilities.

### Mobile E2E O Manuales

- Crear regla fija.
- Crear regla de tarjeta.
- Configurar total y minimo mensual.
- Aplicar pendiente a pago.
- Abrir desde push.
- Rechazar permisos.
- Cambiar de cuenta durante pago.
- Revertir pago.

## Rendimiento

Datos de prueba recomendados por usuario:

- 3 fuentes Gmail.
- 500 pendientes historicos.
- 50 reglas activas.
- 24 ocurrencias por regla.
- 3 dispositivos registrados.

Validar:

- Listas paginadas.
- Query de recordatorios indexada.
- Job horario sin table scans completos.
- Parser limitado por mensaje y por sync.
- Reportes sin incluir doblemente `debt_payment`.

## Observabilidad

Registrar sin PII:

- Cantidad de mensajes procesados.
- Parser y version.
- Pendientes creados, confirmados y descartados.
- Conflictos de idempotencia.
- Ocurrencias creadas.
- Pagos aplicados y reversados.
- Notificaciones claimed, enviadas, fallidas y tokens desactivados.
- Duracion de cron y sync.

No registrar titles, montos, correos, cuerpos, tokens completos ni nombres de cuentas.

## Rollback

- Las migraciones expansivas no eliminan columnas actuales.
- Un feature capability permite apagar nueva UI sin revertir datos.
- El cron de recurrencia y push se puede desactivar por nombre.
- Si falla push, pagos y pendientes siguen funcionando.
- Si falla el parser nuevo, se desactivan adapters especificos y permanece el fallback o sync manual.
- No revertir pagos mediante SQL; usar la operacion de reversion.

## Checklist De Lanzamiento

- [ ] Migraciones aplicadas en staging y produccion.
- [ ] Backfill sin anomalias bloqueantes.
- [ ] API compatible desplegada antes del mobile.
- [ ] Preview APK validado en dispositivo real.
- [ ] Push probado con app abierta, background y cerrada.
- [ ] T-7, T-3 y T-1 verificados sin duplicados.
- [ ] Parser BCP conserva comportamiento esperado.
- [ ] Parsers nuevos tienen fixtures anonimizados.
- [ ] Pago de tarjeta excluido de gastos.
- [ ] Aplicar pendiente es atomico.
- [ ] Reversion validada.
- [ ] AAB de produccion generado.
- [ ] Closed testing sin bloqueadores.

## Criterios De Aceptacion

- Datos historicos permanecen accesibles.
- Builds antiguos no corrompen contratos durante la transicion.
- No existen duplicados de pendientes, pagos, ocurrencias o push.
- El flujo funciona en multiples dispositivos.
- La UI no expone detalles Gmail innecesarios.
- La seccion Pagos representa solo pagos fijos y tarjetas.
- El plan puede habilitarse y deshabilitarse sin rollback destructivo.
