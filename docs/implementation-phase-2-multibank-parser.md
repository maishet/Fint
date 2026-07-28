# Fase 2: Parser Multibanco

## Objetivo

Reemplazar el parser centrado en BCP por una arquitectura extensible que identifique de forma segura titulo, tipo, monto y moneda en correos de distintas instituciones, manteniendo siempre la revision humana.

## Principio

El parser propone; el usuario decide. Una mejora de parser nunca habilita confirmacion automatica ni modifica saldos por si sola.

## Resultado Normalizado

Todos los parsers devuelven el mismo contrato interno:

```ts
type ParsedEmailCandidate = {
  title: string
  type: 'income' | 'expense' | 'unknown'
  amount: number | null
  currency: string | null
  occurredAt: string | null
  requiresReview: boolean
  parserId: string
  parserVersion: number
  warnings: string[]
}
```

`parserId`, `parserVersion` y `warnings` son metadata interna. No forman parte de la pantalla de revision mobile.

## Pipeline

```text
Gmail raw message
  -> MIME decoder
  -> Header normalizer
  -> Safe text extractor
  -> Parser resolver
  -> Institution parser
  -> Generic fallback parser
  -> Candidate validator
  -> Pending movement
```

## Decodificacion

Antes de clasificar se debe:

- Decodificar RFC/MIME.
- Decodificar quoted-printable y base64.
- Resolver subjects codificados.
- Preferir texto plano y usar HTML sanitizado como fallback.
- Eliminar scripts, estilos, citas y firmas repetitivas.
- No persistir el cuerpo completo del correo.
- Conservar unicamente referencia tecnica, titulo y resultado normalizado.

## Registro De Parsers

```ts
interface BankEmailParser {
  id: string
  version: number
  supports(input: NormalizedEmail): boolean
  parse(input: NormalizedEmail): ParsedEmailCandidate | null
}
```

Orden inicial:

1. `BcpEmailParser`.
2. `InterbankEmailParser`.
3. `ScotiabankEmailParser`.
4. `GnbEmailParser`.
5. Parsers de cajas agregados cuando existan fixtures anonimizados.
6. `GenericBankEmailParser` como fallback.

No se agrega un parser institucional sin al menos fixtures de ingreso, gasto y caso ambiguo.

## Resolucion De Institucion

La seleccion puede usar internamente:

- Dominio del remitente permitido.
- Subject normalizado.
- Frases estables del cuerpo.
- Encabezados de autenticacion disponibles.

El usuario no ve la institucion inferida ni la direccion de origen en el pendiente. La configuracion de remitentes permitidos permanece en Preferencias Gmail.

## Extraccion De Titulo

- Usar el subject decodificado y limpio.
- Eliminar prefijos repetidos como `RE:`, `FW:` y etiquetas de notificacion cuando no aporten contexto.
- Limitar longitud para evitar cards desbordadas.
- Usar `Movimiento detectado` solo si el subject queda vacio.

## Extraccion De Tipo

Tipos publicos iniciales:

- `income`.
- `expense`.
- `unknown`.

Reglas:

- Una transferencia recibida puede proponer `income`.
- Compra, retiro, cargo, pago o transferencia enviada puede proponer `expense`.
- Empate o ausencia de evidencia produce `unknown`, nunca `expense` por defecto.
- Un tipo `unknown` obliga al usuario a seleccionar ingreso o gasto.
- La aplicacion posterior a una tarjeta convierte el movimiento final a `debt_payment` en API, independientemente del tipo propuesto.

## Extraccion De Monto

El parser de montos debe reconocer como minimo:

```text
S/ 1,234.56
S/ 1.234,56
S/ 100,50
PEN 89.90
USD 120.00
$ 120.00
```

Reglas de seleccion:

- Priorizar numeros cercanos a `monto`, `importe`, `cargo`, `abono`, `compra`, `retiro` o `transferencia`.
- Penalizar numeros cercanos a `saldo`, `disponible`, `limite`, `cuota`, `comision` o `tipo de cambio`.
- Si quedan dos candidatos igualmente probables, devolver `amount: null` y `requiresReview: true`.
- Normalizar a precision monetaria de dos decimales.
- Rechazar cero, negativos, infinitos y valores fuera del rango soportado.

## Extraccion De Moneda

- Reconocer `PEN`, `S/`, soles, `USD`, `$` y dolares.
- No asumir USD solo porque exista `$` en una firma o enlace.
- Si la moneda es ambigua, devolver `null` y requerir seleccion manual.
- Nunca mezclar el monto con la moneda base del perfil silenciosamente.

## Fecha

- Usar fecha de operacion solo si el correo la identifica claramente.
- Usar Gmail internal date como fallback visible y marcarla internamente como estimada.
- La fecha siempre puede corregirse durante la revision.

## Gmail History Y Sincronizacion

La ampliacion multibanco depende de no perder mensajes:

- Separar `watch_registration_history_id` de `last_processed_history_id`.
- Paginar Gmail History hasta agotar `nextPageToken`.
- Paginar el fallback de mensajes dentro de limites definidos.
- Actualizar el cursor procesado solo despues de persistir todos los resultados.
- Serializar sync por connected source.
- Ignorar notificaciones fuera de orden sin retroceder el cursor.
- Aislar errores por source para que una cuenta fallida no bloquee otras.

## Deduplicacion

La llave primaria de ingestion sigue siendo:

```text
user_id + connected_source_id + gmail_message_id
```

No se deduplican automaticamente dos correos distintos por similitud financiera. Esa conciliacion puede sugerirse en el futuro, pero nunca debe fusionar movimientos sin confirmacion.

## Fixtures

Los fixtures deben:

- Estar anonimizados.
- No contener correos personales.
- No contener numeros completos de cuenta o tarjeta.
- No contener tokens, links firmados ni IDs reales.
- Conservar estructura suficiente para probar MIME y formatos monetarios.

Matriz minima por parser:

| Caso | Resultado esperado |
| --- | --- |
| Ingreso simple | Tipo, monto, moneda y titulo correctos. |
| Gasto simple | Tipo, monto, moneda y titulo correctos. |
| Varios montos | Seleccion correcta o `amount: null`. |
| Saldo y monto | No elegir saldo como monto principal. |
| Formato decimal local | Normalizacion correcta. |
| Subject codificado | Titulo legible. |
| HTML | Texto extraido sin scripts ni estilos. |
| Ambiguo | `requiresReview: true`. |

## Observabilidad Sin PII

Metricas permitidas:

- Parser seleccionado.
- Version.
- Exito o fallo.
- Campo faltante.
- Duracion.
- Cantidad de candidatos monetarios.

No registrar:

- Subject completo.
- Body.
- Direccion de correo.
- Numero de cuenta o tarjeta.
- Monto financiero en logs.

## Cambios Mobile

- Consumir campos anulables de tipo, monto y moneda.
- Mostrar `Revisar datos` cuando falte un valor.
- Mantener la misma UI sin importar que parser produjo el pendiente.
- No mostrar banco, Gmail source, remitente, confidence ni parser.
- No diferenciar visualmente BCP de otras instituciones.

## Estrategia De Entrega

1. Extraer el comportamiento BCP actual a la interfaz nueva sin cambiar resultados esperados.
2. Agregar normalizador MIME y parser generico.
3. Activar Interbank, Scotiabank y GNB solo con fixtures aprobados.
4. Agregar cajas de forma incremental sin modificar parsers existentes.
5. Versionar reglas cuando cambien para poder identificar regresiones.

## Criterios De Aceptacion

- BCP conserva los casos ya validados.
- Correos de instituciones no reconocidas usan fallback generico.
- Ambiguedad nunca se convierte automaticamente en gasto.
- Formatos monetarios locales se interpretan correctamente.
- El usuario siempre puede corregir el resultado.
- La UI no expone metadata Gmail o del parser.
- Gmail History no pierde paginas ni retrocede cursores.
- Todos los fixtures estan anonimizados.

## Dependencia De Salida

La Fase 3 puede desarrollarse en paralelo, pero `Aplicar a pago` solo se habilita cuando sus contratos y migraciones esten desplegados.
