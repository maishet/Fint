# Mejoras y reportes posteriores al MVP

## Objetivo

Este documento detalla el trabajo propuesto para aumentar la cobertura automatica, mejorar la experiencia, preparar soporte operativo y medir el uso del producto sin recopilar informacion financiera sensible. Tambien define una funcion de reportes financieros visibles para el usuario.

Los reportes financieros y la analitica de producto son funciones distintas:

- Los reportes financieros procesan los datos del usuario para mostrarselos dentro de Fint.
- La analitica de producto solo mide eventos operativos anonimizados o seudonimizados para mejorar la aplicacion.
- Los montos, notas, comercios, correos, nombres de cuentas y descripciones de deudas no deben enviarse a servicios de analitica o monitoreo.

## 15. Cobertura automatica

### Objetivo

Detectar regresiones en los flujos que modifican saldos o conectan servicios externos antes de publicar una nueva version.

### Trabajo mobile

- Probar crear, editar y desactivar una cuenta, incluyendo invalidacion de `accounts`, `summary` y `transactions`.
- Probar crear, editar y eliminar ingresos y gastos.
- Probar crear, editar, cancelar y pagar una deuda.
- Probar estados de carga, error, reintento y bloqueo de doble pulsacion.
- Probar la confirmacion y el descarte de pendientes Gmail.
- Probar que una fuente Gmail con token revocado muestre la accion de reconexion.
- Probar filtros de movimientos por rango y tipo.
- Mantener las pruebas unitarias sin depender de la API remota.

### Trabajo API

- Agregar pruebas de integracion para ownership: un usuario nunca puede consultar ni modificar recursos de otro.
- Cubrir recalculo de balances al crear, editar y eliminar movimientos.
- Cubrir deduplicacion de pendientes Gmail por fuente y mensaje.
- Cubrir `invalid_grant`, renovacion de watch y sincronizacion multi-cuenta.
- Cubrir validacion del secreto del endpoint interno de Cron.
- Cubrir rate limit, respuestas con `X-Request-Id` y sanitizacion de errores enviados a Sentry.

### Prueba E2E minima

1. Registrar o autenticar un usuario de prueba.
2. Completar onboarding.
3. Crear una cuenta.
4. Registrar un ingreso y un gasto.
5. Confirmar que dashboard, saldo e historial se actualizan.
6. Crear una deuda y registrar un pago.
7. Cerrar sesion, iniciar nuevamente y confirmar persistencia.

### Criterios de salida

- Los flujos de mutacion principales tienen al menos una prueba satisfactoria y una de error.
- Las pruebas verifican el resultado visible y la invalidacion de cache, no detalles internos del componente.
- La API demuestra aislamiento entre usuarios.
- Typecheck, unit tests, integration tests y el E2E minimo se ejecutan en cada release candidate.

## 16. Experiencia de usuario

### Estados y feedback

- Estandarizar estados de carga, vacio, error y reintento con `DataStateCard` y `FintButton`.
- Mantener feedback visible durante operaciones que puedan tardar, especialmente sincronizacion Gmail.
- Mostrar toast de exito o error al crear, editar, eliminar, confirmar o pagar.
- Pedir confirmacion antes de eliminar movimientos, desactivar cuentas, cancelar deudas o desconectar Gmail.
- Mostrar fecha y hora de la ultima sincronizacion por cada cuenta Gmail.
- Explicar por que una cuenta requiere reconexion y que ocurrira con sus datos existentes.

### Accesibilidad

- Agregar etiquetas accesibles a botones de icono, graficos y acciones de cards.
- Verificar contraste en modo claro y oscuro.
- Mantener areas tactiles de al menos 44 por 44 puntos.
- Probar texto ampliado sin ocultar montos, etiquetas ni acciones principales.
- No depender solo del color para comunicar ingreso, gasto, deuda vencida o estado de error.
- Validar el orden de lectura con TalkBack en dashboard, formularios y reportes.

### Consistencia

- Usar los mismos terminos para cuenta, movimiento, deuda, pendiente y sincronizacion en toda la app.
- Unificar formatos de moneda, fechas y porcentajes segun el locale.
- Mantener acciones primarias en posiciones predecibles.
- Conservar filtros seleccionados al volver desde el detalle o formulario cuando sea util.

### Criterios de salida

- Todos los dominios principales tienen estados de carga, vacio, error y reintento.
- Las operaciones destructivas requieren confirmacion.
- Los flujos principales son utilizables con texto ampliado y TalkBack.
- Modo claro y oscuro se validan en al menos un dispositivo Android real.

## 17. Operacion y soporte

### Funcion de soporte visible

Agregar en Ajustes una seccion `Ayuda y soporte` con:

- `Reportar un problema`, que abra el correo o formulario de soporte.
- `Solicitar una mejora`, separado de los incidentes.
- Preguntas frecuentes para login, Gmail, sincronizacion y movimientos duplicados.
- Version de app, numero de build y ambiente.
- ID de diagnostico opcional basado en el ultimo `X-Request-Id`, sin incluir datos financieros.
- Enlaces a politica de privacidad, terminos y eliminacion de cuenta.

### Contenido de un reporte de problema

- Categoria elegida por el usuario.
- Descripcion escrita por el usuario.
- Pasos para reproducir, cuando sea posible.
- Version, build, plataforma y ambiente agregados automaticamente.
- Consentimiento explicito antes de adjuntar diagnostico tecnico.
- Nunca adjuntar tokens, correos Gmail, montos, notas, headers, cookies o cuerpos HTTP.

Categorias sugeridas:

- Inicio de sesion o cuenta.
- Cuentas y saldos.
- Movimientos o categorias.
- Deudas y pagos.
- Conexion o sincronizacion Gmail.
- Rendimiento o cierre inesperado.
- Privacidad y eliminacion de datos.
- Sugerencia de mejora.

### Procedimiento operativo

1. Soporte recibe el reporte y asigna severidad.
2. Se busca el evento por version, fecha aproximada e ID de diagnostico.
3. Se revisan Sentry y logs de Render sin solicitar credenciales al usuario.
4. Se reproduce el problema con una cuenta de prueba y datos ficticios.
5. Se informa al usuario cuando exista solucion o alternativa temporal.
6. Los incidentes repetidos se convierten en prueba automatica antes de cerrarse.

Severidades sugeridas:

- Critica: perdida o exposicion de datos, acceso cruzado o app inutilizable para todos.
- Alta: login, saldos, Gmail o movimientos principales no funcionan para varios usuarios.
- Media: una funcion falla pero existe alternativa.
- Baja: defecto visual, texto o solicitud de mejora.

### Criterios de salida

- El usuario puede reportar un problema desde Ajustes.
- El reporte incluye version y build sin exponer datos sensibles.
- Existe un correo de soporte monitoreado y un tiempo objetivo de primera respuesta.
- El runbook documenta responsables y pasos para incidentes criticos y altos.

## 18. Analitica respetuosa de privacidad

### Objetivo

Conocer donde existe friccion sin registrar el contenido financiero del usuario.

### Eventos permitidos

- `onboarding_started` y `onboarding_completed`.
- `account_created`.
- `transaction_created`, usando solo `type=income|expense` y nunca el monto.
- `debt_created` y `debt_payment_recorded`, sin montos ni descripcion.
- `gmail_connection_started`, `gmail_connection_completed` y `gmail_reconnect_required`.
- `gmail_sync_completed`, usando solo estado y duracion agrupada.
- `pending_movement_confirmed` y `pending_movement_discarded`, sin contenido del correo.
- `report_opened`, usando unicamente el tipo de reporte.
- `support_report_started` y `support_report_submitted`, usando solo la categoria.

### Propiedades prohibidas

- Monto, moneda asociada a una operacion o saldo.
- Nombre de cuenta, categoria personalizada, nota o descripcion.
- Correo, remitente, asunto, referencia o contenido Gmail.
- Token, JWT, cookie, header o cuerpo HTTP.
- Nombre, direccion, telefono o identificador publicitario.

### Reglas de implementacion

- Crear un modulo central para declarar eventos y propiedades permitidas.
- Rechazar propiedades no declaradas en desarrollo y tests.
- Usar un identificador interno seudonimizado solo si es indispensable para medir retencion.
- Documentar proveedor, retencion, finalidad y mecanismo de baja en la politica de privacidad.
- Permitir desactivar analitica no esencial desde Ajustes.
- Sentry se mantiene para errores y rendimiento; no se usa como herramienta de analitica de negocio.

### Metricas iniciales

- Porcentaje de onboarding completado.
- Tiempo agrupado hasta crear la primera cuenta y el primer movimiento.
- Porcentaje de conexiones Gmail completadas.
- Tasa de sincronizaciones satisfactorias y reconexiones requeridas.
- Uso relativo de cuentas, movimientos, deudas y reportes.
- Tasa de errores por version de app, obtenida desde Sentry.

### Criterios de salida

- Existe un inventario cerrado de eventos y propiedades.
- Ningun evento contiene informacion financiera o Gmail.
- La configuracion de privacidad explica la analitica no esencial.
- Los eventos se validan en preview antes de habilitarlos en produccion.

## Funcion de reportes financieros para el usuario

### Proposito

Agregar una seccion `Reportes` que responda preguntas financieras concretas sin duplicar el dashboard. El dashboard muestra el estado actual; Reportes permite elegir periodo, comparar y profundizar.

### Acceso y filtros comunes

- Acceso desde una nueva entrada de navegacion o desde `Ver reportes` en el dashboard.
- Periodos: mes actual, mes anterior, ultimos 3 meses, ultimos 6 meses y rango personalizado.
- Filtros: todas las cuentas o una cuenta; moneda base; ingreso o gasto cuando aplique.
- Cada reporte debe mostrar periodo, moneda, fecha de actualizacion y estado vacio accionable.
- Al tocar una categoria, cuenta o periodo, se abre la lista de movimientos que compone el resultado.

### Reportes recomendados para la primera version

#### 1. Flujo de ingresos y gastos

Pregunta: `Cuanto ingreso, cuanto gaste y cuanto ahorre en el periodo?`

- Total de ingresos.
- Total de gastos.
- Ahorro neto: `ingresos - gastos`.
- Tasa de ahorro: `(ahorro / ingresos) * 100`, solo cuando ingresos sea mayor que cero.
- Grafico por semana o mes segun el rango.
- Comparacion contra el periodo anterior equivalente.

#### 2. Gastos por categoria

Pregunta: `En que se fue mi dinero?`

- Total y porcentaje por categoria.
- Orden descendente por gasto.
- Variacion contra el periodo anterior.
- Acceso a los movimientos de cada categoria.
- Grupo `Sin categoria` si existieran datos historicos incompletos.

#### 3. Saldos y patrimonio por cuenta

Pregunta: `Donde esta mi dinero y cual es mi posicion neta?`

- Balance actual por cuenta.
- Total de activos, pasivos y patrimonio neto.
- Distribucion porcentual por cuenta y tipo.
- Advertencia visible cuando se mezclen monedas sin una conversion definida.

#### 4. Estado de deudas

Este apartado debe interpretarse como estado de pagos bajo el plan [Pendientes y Pagos Recurrentes](implementation-plan-pending-and-payments.md). El producto deja fuera prestamos y amortizaciones y se enfoca en servicios recurrentes fijos y tarjetas de credito.

Pregunta: `Cuanto debo y que pagos requieren atencion?`

- Deuda original, saldo pendiente y porcentaje pagado.
- Deudas activas, pagadas, vencidas y proximas a vencer.
- Calendario o lista por fecha de vencimiento.
- Progreso total y por deuda.
- Acceso directo a registrar un pago.

### Reportes posibles para una segunda version

#### 5. Comparacion mensual

- Ingresos, gastos y ahorro de los ultimos 6 o 12 meses.
- Promedio mensual y mejor o peor variacion.
- Navegacion desde cada mes hacia sus movimientos.

#### 6. Gastos recurrentes

- Posibles cargos repetidos detectados por descripcion, categoria, importe aproximado y frecuencia.
- Confirmacion del usuario antes de etiquetar algo como recurrente.
- Proyeccion del siguiente cargo claramente identificada como estimacion.

#### 7. Salud financiera simple

- Tasa de ahorro.
- Relacion entre pagos de deuda e ingresos registrados.
- Tendencia de patrimonio neto.
- Explicaciones educativas, sin presentar recomendaciones como asesoria financiera.

#### 8. Origen de movimientos

- Cantidad de movimientos manuales y confirmados desde Gmail.
- Pendientes confirmados, descartados y por revisar.
- Sin mostrar direcciones de correo, remitentes ni contenido de mensajes.

### Reglas de calculo

- Usar fechas de movimiento, no fecha de creacion del registro.
- Excluir movimientos eliminados o anulados.
- Calcular ingresos y gastos por separado; no representar gastos como ingresos negativos en la API publica.
- Resolver moneda antes de sumar. Si no existe tipo de cambio, separar resultados por moneda.
- La comparacion anterior debe usar un rango de igual duracion.
- Los porcentajes deben manejar divisiones entre cero y redondeo consistente.
- Cada cifra agregada debe poder rastrearse hasta los movimientos que la componen.

### Arquitectura propuesta

- Crear endpoints agregados en API para evitar descargar historiales completos al dispositivo.
- Aceptar `from`, `to`, `accountId` y agrupacion mediante valores enumerados.
- Aplicar ownership y RLS igual que en cuentas y movimientos.
- Limitar rangos y paginar los movimientos de detalle.
- Usar claves TanStack Query que incluyan todos los filtros.
- Invalidar reportes al modificar cuentas, movimientos, deudas o pagos.
- No persistir copias innecesarias de los agregados si pueden calcularse con consultas indexadas.

Respuesta conceptual sugerida:

```ts
interface FinancialReport {
  from: string
  to: string
  currency: string
  income: number
  expenses: number
  savings: number
  savingsRate: number | null
  previousPeriodChange: number | null
  series: Array<{ period: string; income: number; expenses: number }>
  categories: Array<{ category: string; amount: number; percentage: number }>
}
```

### Orden de implementacion

1. Flujo de ingresos y gastos.
2. Gastos por categoria con acceso al detalle.
3. Estado de deudas.
4. Saldos y patrimonio por cuenta.
5. Comparacion mensual.
6. Reportes recurrentes y salud financiera solo despues de validar calidad de datos.

### Criterios de salida

- Los totales coinciden con los movimientos del mismo rango y moneda.
- Cambiar un filtro actualiza cifras, grafico y detalle.
- Editar o eliminar un movimiento invalida el reporte correspondiente.
- Los estados vacios explican como crear el primer dato necesario.
- El reporte funciona en modo claro, oscuro, pantalla pequena y texto ampliado.
- Ningun dato del reporte se envia a telemetria, logs o Sentry.
