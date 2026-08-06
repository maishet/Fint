# Fase 6: Privacidad Visual Y Onboarding

## Objetivo

Agregar dos capacidades orientadas a confianza y activacion inicial:

- Privacidad visual para ocultar montos sensibles cuando el usuario comparte o muestra la app.
- Onboarding guiado para usuarios nuevos con tour de funcionalidades y solicitud contextual de permisos de notificaciones.

Esta fase no cambia calculos financieros, no cifra datos adicionales y no automatiza confirmaciones de movimientos. El foco es UX, seguridad visual, routing de usuarios nuevos y consentimiento informado.

## Decisiones Cerradas

- Los montos empiezan visibles por defecto.
- La preferencia de visibilidad es global para Inicio, Cuentas, Movimientos, Reportes y Pagos.
- En Inicio se ocultan todos los importes exactos, incluidos textos accesibles.
- Los graficos, porcentajes relativos, colores y estados agregados permanecen visibles.
- En Cuentas se ocultan totales y balances individuales.
- En Movimientos se ocultan el card principal y los importes de la lista.
- En Reportes se ocultan los importes renderizados en pantalla, sin afectar exportacion PDF/Excel.
- En Pagos se ocultan montos pendientes, pagados, totales y el hero principal.
- La preferencia se guarda por usuario en el dispositivo.
- El onboarding se muestra solo a usuarios nuevos.
- Usuarios existentes quedan marcados como onboarding completado durante la migracion.
- Notificaciones no son obligatorias para usar la app.
- Si el usuario rechaza notificaciones durante onboarding, puede continuar.
- El unico permiso nativo que requiere onboarding actualmente es notificaciones.
- Google y Gmail usan OAuth/consentimiento web, no permisos nativos del sistema.

## Repos Y Alcance

- Mobile: `E:\Personal proyects\finanzas-mobilev2`.
- API/Base de datos: `E:\Personal proyects\finanzas-api`.

Cambios mobile:

- Provider de privacidad visual.
- Formatter sensible para montos protegidos.
- Toggle rapido en Inicio y Cuentas.
- Fila persistente en Configuracion.
- Mascara en Movimientos y Reportes visuales.
- Mascara en Pagos.
- Pantalla `onboarding` con tour.
- Gate central de navegacion basado en `setupComplete`.
- Flujo contextual de permisos push.
- Traducciones y pruebas.

Cambios API/base de datos:

- Migracion `022_onboarding_completion.sql`.
- `/api/me` debe devolver `setupComplete` real.
- Endpoint idempotente para completar onboarding.

Fuera de alcance:

- Cifrado local o remoto de montos.
- Biometria para desbloquear montos.
- Ocultar reportes exportados despues de una accion explicita de exportacion.
- Bloquear la app si el usuario rechaza notificaciones.
- Permisos de camara, ubicacion, contactos, calendario o archivos.

## Feature 1: Ocultar Montos

### Objetivo

Permitir que el usuario oculte rapidamente montos personales antes de mostrar la pantalla a otra persona.

Esto protege visualmente:

- Patrimonio neto.
- Ingresos y gastos exactos.
- Balances de cuentas.
- Montos de movimientos recientes.
- Montos del tab Movimientos.
- Montos visibles en Reportes.
- Montos por categoria.
- Labels accesibles que contienen importes.

No protege:

- Datos ya cargados en memoria.
- Requests de red.
- Respuestas API.
- Capturas hechas antes de ocultar.
- Graficos o porcentajes relativos.

### Experiencia De Usuario

Ubicaciones del toggle:

- Card principal de Inicio.
- Card de balance consolidado de Cuentas.
- Card principal de Movimientos.
- Card principal de Reportes.
- Card principal de Pagos.
- Configuracion, como fila persistente.

Comportamiento:

- Estado inicial: visible.
- Al tocar el icono, los montos se ocultan o muestran inmediatamente.
- El estado afecta Inicio, Cuentas, Movimientos, Reportes y Pagos al mismo tiempo.
- El cambio no debe disparar refetch de API.
- No mostrar toast al alternar, porque el resultado es evidente.
- El boton debe tener area tactil minima de `44x44`.
- Debe tener `aria-label` o `accessibilityLabel` correcto.

Iconografia:

- Si los montos estan visibles, mostrar `EyeOff` con accion `Ocultar montos`.
- Si los montos estan ocultos, mostrar `Eye` con accion `Mostrar montos`.

Mascara:

```text
••••••
```

La mascara debe ser fija. No debe revelar:

- Cantidad de digitos.
- Signo positivo o negativo.
- Decimales.
- Longitud aproximada.
- Moneda junto al valor oculto.

Texto accesible cuando esta oculto:

```text
Monto oculto
```

### Alcance En Inicio

Archivo principal:

```text
app/(tabs)/dashboard.tsx
```

Montos a ocultar:

- `HeroSummary`: patrimonio neto, ingresos mensuales, gastos mensuales.
- `HeroMetric`: valores que recibe ya formateados.
- `WeeklyFlowSection`: ingreso y gasto de semana seleccionada.
- `WeeklyFlowSection`: `aria-label` de barras semanales.
- `FlowTotal`: total de ingresos y total de gastos.
- `AdviceCarousel`: montos de gasto/ahorro cuando se muestran como dinero.
- `CategoryBreakdown`: montos por categoria.
- `RecentTransactions`: montos de movimientos recientes.

Se mantienen visibles:

- Nombres de categorias.
- Fechas.
- Nombres de cuentas.
- Porcentajes.
- Barras y donut.
- Estado positivo/negativo.
- Color verde/rojo.

Regla de accesibilidad:

- Si un `aria-label` incluye `formatMoney`, debe usar el formatter sensible.
- Si el monto esta oculto, el label no debe contener el numero real.

### Alcance En Cuentas

Archivo principal:

```text
app/(tabs)/accounts.tsx
```

Montos a ocultar:

- `AccountsSummary`: balance consolidado.
- `SummaryMetric`: activos y pasivos.
- `AccountCard`: balance de cada cuenta.

Se mantienen visibles:

- Nombre de cuenta.
- Tipo de cuenta.
- Moneda de cuenta.
- Cantidad de cuentas.
- Acciones de crear, editar y eliminar.

### Alcance En Movimientos

Archivo principal:

```text
app/(tabs)/movements.tsx
```

Montos a ocultar:

- Card principal de flujo del periodo.
- Total de ingresos del periodo.
- Total de gastos del periodo.
- Importe de cada movimiento registrado en la lista.

Se mantienen visibles:

- Categoria.
- Fecha.
- Cuenta.
- Nota.
- Colores de ingreso/gasto.
- Acciones de editar, eliminar y revertir pago.

### Alcance En Reportes

Archivo principal:

```text
app/(tabs)/reports.tsx
```

Montos a ocultar en pantalla:

- Highlights financieros.
- Ingresos, gastos y neto del resumen.
- Valores de serie seleccionada.
- Labels accesibles de la serie.
- Montos por categoria.
- Actividad por cuenta.
- Posicion actual.
- Saldos de cuentas y pendientes de pagos.
- Top transacciones.

Se mantienen visibles:

- Porcentajes.
- Estados financieros.
- Graficos de barras.
- Nombres de categorias/cuentas.
- Fechas.
- Filtros.

Exportacion:

- PDF y Excel mantienen valores reales.
- No usar formatter sensible en `exportReport` ni en `report-export`.
- La exportacion sigue haciendo fetch de datos reales mediante `getFinancialReportExportData`.

### Alcance En Pagos

Archivo principal:

```text
app/(tabs)/debts.tsx
```

Montos a ocultar:

- Total pendiente del hero principal.
- Monto pendiente/restante de cada ocurrencia.
- Monto pagado de cada ocurrencia.
- Total de cada ocurrencia.

Se mantienen visibles:

- Nombre del pago.
- Tipo de pago.
- Cuenta de tarjeta asociada.
- Fechas de vencimiento.
- Estados de pago.
- Porcentaje de progreso.
- Acciones de configurar monto, registrar pago, editar y eliminar.

### Arquitectura Mobile

Crear modulo:

```text
src/privacy/SensitiveAmountsProvider.tsx
src/privacy/sensitiveAmountsStorage.ts
src/privacy/useSensitiveMoney.ts
```

Contexto sugerido:

```ts
type SensitiveAmountsContextValue = {
  isHydrated: boolean
  amountsVisible: boolean
  toggleAmountsVisibility: () => void
  setAmountsVisible: (value: boolean) => void
}
```

Hook sugerido:

```ts
function useSensitiveMoney() {
  return {
    amountsVisible,
    formatSensitiveAmount(amount: number, currency: string): string,
    getSensitiveAmountAccessibilityLabel(amountLabel?: string): string,
  }
}
```

Reglas:

- El formatter sensible debe usar `getAppLocale(i18n.resolvedLanguage)`.
- No reemplazar globalmente `formatMoney`, porque formularios y exportes deben seguir mostrando valores reales.
- Usar el formatter sensible solo en superficies protegidas.
- En modo oculto devolver siempre `••••••`.
- En modo visible devolver formato monetario normal.
- Durante hidratacion, usar la mascara para evitar destello si el usuario habia ocultado montos.

Provider:

Integrar en:

```text
src/providers/AppProviders.tsx
```

Ubicacion recomendada:

- Dentro de `AuthProvider`, o como provider que consuma `useAuth` en un componente hijo.
- La preferencia debe estar disponible para tabs y settings.

Clave de almacenamiento:

```text
fint-sensitive-amounts-visible-<USER_ID>
```

Persistencia:

- Native: `expo-secure-store`.
- Web: `window.localStorage`.
- Valor inexistente: visible.
- Valor `true`: visible.
- Valor `false`: oculto.
- Valor invalido: visible.
- Error de lectura/escritura: visible y sin bloquear UI.

Cambio de usuario:

- Al cambiar `session.user.id`, recargar preferencia.
- No reutilizar el estado de un usuario anterior.
- Durante el cambio, ocultar temporalmente hasta hidratar la nueva preferencia.

### Componentes Reutilizables

Crear componente opcional:

```text
src/privacy/SensitiveAmountToggle.tsx
```

Props sugeridas:

```ts
type SensitiveAmountToggleProps = {
  variant?: 'hero' | 'plain' | 'settings'
}
```

Debe:

- Renderizar `Eye` o `EyeOff`.
- Usar tokens Tamagui existentes.
- Ser accesible.
- Evitar estilos inline complejos.

### Configuracion

Archivo:

```text
app/settings.tsx
```

Agregar fila dentro de Configuracion:

```text
Privacidad financiera
Montos visibles / Montos ocultos
```

Icono sugerido:

- `Eye` o `EyeOff`.
- Alternativa: `ShieldCheck` si se quiere agrupar privacidad.

### i18n

Agregar claves en español, ingles y portugues.

Claves sugeridas:

```text
privacy.amounts.title
privacy.amounts.visible
privacy.amounts.hidden
privacy.amounts.show
privacy.amounts.hide
privacy.amounts.hiddenLabel
privacy.amounts.description
```

Textos base en español:

```text
Privacidad financiera
Montos visibles
Montos ocultos
Mostrar montos
Ocultar montos
Monto oculto
Oculta balances e importes cuando compartas tu pantalla.
```

### Tests Feature 1

Unitarios:

- Formatter visible devuelve moneda real.
- Formatter oculto devuelve siempre `••••••`.
- Formatter oculto no cambia por monto grande, negativo, cero o decimal.
- Label accesible oculto devuelve `Monto oculto`.
- Estado inicial sin preferencia es visible.
- Preferencia `false` hidrata como oculto.
- Preferencia `true` hidrata como visible.
- Preferencia invalida hidrata como visible.
- Error de storage no rompe render.
- Cambio de usuario recarga preferencia.

Manual QA:

- Abrir Inicio con montos visibles.
- Tocar `EyeOff`; todos los montos exactos del dashboard quedan `••••••`.
- Ir a Cuentas; totales y balances estan ocultos.
- Ir a Movimientos; card principal y lista estan ocultos.
- Ir a Reportes; importes renderizados estan ocultos.
- Ir a Pagos; hero, pendientes, pagados y totales estan ocultos.
- Tocar `Eye`; Inicio, Cuentas, Movimientos, Reportes y Pagos muestran montos reales.
- Ocultar desde Cuentas; volver a Inicio y verificar estado.
- Alternar desde Configuracion y verificar que todas las secciones cambian.
- Reiniciar app con montos ocultos y verificar que persiste.
- Cerrar sesion e iniciar con otro usuario; verificar que no hereda preferencia.
- Revisar TalkBack/VoiceOver: no lee montos ocultos en Inicio, Movimientos ni Reportes.
- Exportar reporte: PDF/Excel conserva valores reales solo despues de accion explicita.
- Crear/editar transaccion: formularios siguen mostrando montos reales mientras el usuario edita.
- Revisar tema claro y oscuro.

Criterios de aceptacion:

- Un solo estado controla Inicio, Cuentas, Movimientos, Reportes y Pagos.
- Ningun importe exacto protegido queda visible en texto.
- Ningun importe protegido queda en accessibility labels.
- La mascara no filtra longitud ni signo.
- Persistencia funciona por usuario.
- No hay refetches causados por alternar visibilidad.
- No se rompen exportes ni formularios.

## Feature 2: Onboarding Guiado

### Objetivo

Guiar a usuarios nuevos por las funciones principales y solicitar permisos de notificaciones en contexto, sin bloquear el uso de la app si el permiso se rechaza.

Debe cubrir:

- Bienvenida.
- Cuentas y movimientos.
- Pagos recurrentes.
- Privacidad visual.
- Notificaciones.

Debe funcionar para:

- Registro con email y sesion inmediata.
- Registro con email y confirmacion posterior.
- Primer login con Google.
- Usuario que abandona el onboarding y vuelve despues.

### Autoridad Del Estado

No inferir usuario nuevo desde fechas de Supabase.

Fuente de verdad:

```text
profiles.onboarding_completed_at
```

`/api/me.setupComplete` debe derivarse de esa columna.

### Migracion 022

Repo API:

```text
E:\Personal proyects\finanzas-api\database\migrations\022_onboarding_completion.sql
```

Contenido esperado:

```sql
alter table profiles
  add column if not exists onboarding_completed_at timestamptz;

update profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    updated_at = now()
where onboarding_completed_at is null;
```

Notas:

- La migracion marca usuarios existentes como completados.
- Usuarios creados despues de aplicar la migracion quedan con `null`.
- El trigger `handle_new_fint_user` puede seguir insertando sin la columna.
- No actualizar historicos financieros.

Validaciones SQL despues de aplicar:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'onboarding_completed_at';
```

```sql
select count(*) as existing_without_onboarding
from profiles
where onboarding_completed_at is null
  and created_at < '<MIGRATION_DEPLOYED_AT>'::timestamptz;
```

El segundo resultado debe ser `0`, salvo usuarios creados exactamente durante la ventana de despliegue. Si hay una ventana concurrente, validarla manualmente.

### API

Archivo actual relacionado:

```text
E:\Personal proyects\finanzas-api\src\modules\finance\presentation\finance.routes.ts
```

Hoy `/api/me` devuelve `setupComplete: true` fijo. Debe cambiar.

Implementacion recomendada:

- Crear metodo en repositorio o modulo perfil para leer `profiles` por `user_id`.
- Si falta perfil, crearlo o devolver error controlado segun patron existente.
- `setupComplete = onboarding_completed_at is not null`.
- Mantener campos actuales: `userId`, `email`, `status`, `gmailEnabled`, `voiceEnabled`.

Contrato:

```ts
type CurrentUser = {
  userId: string
  email?: string | null
  status: string
  setupComplete: boolean
  gmailEnabled: boolean
  voiceEnabled: boolean
}
```

Endpoint nuevo:

```http
POST /api/me/onboarding/complete
Authorization: Bearer <token>
Content-Type: application/json
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "setupComplete": true,
    "completedAt": "2026-07-31T00:00:00.000Z"
  }
}
```

Reglas:

- Requiere auth.
- Usa `user_id` del token.
- Idempotente.
- Si ya estaba completado, devuelve exito sin cambiar fecha.
- No depende del resultado del permiso de notificaciones.
- Auditar si existe patron de auditoria para perfil; no registrar PII.

SQL sugerido:

```sql
update profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    updated_at = now()
where user_id = $1
returning onboarding_completed_at;
```

### Navegacion Mobile

Archivos:

```text
app/_layout.tsx
app/index.tsx
app/login.tsx
app/auth/callback.tsx
src/auth/initial-route.ts
src/api/finance.ts
src/api/types.ts
```

Agregar pantalla:

```text
app/onboarding.tsx
```

Matriz de rutas:

| Estado | Destino |
| --- | --- |
| Sin sesion | `/login` |
| Sesion restaurando | Loading |
| Sesion con `/api/me` cargando | Loading |
| `/api/me` 401 | `/login` |
| `/api/me` error de red/500 | Pantalla de reintento |
| `setupComplete = false` | `/onboarding` |
| `setupComplete = true` | `/(tabs)/dashboard` |

Cambios:

- `getInitialRoute` debe recibir `setupComplete` y estado de error.
- `index.tsx` no debe mandar al dashboard si `/api/me` falla por error no 401.
- `login.tsx` debe redirigir a `/` cuando ya hay sesion.
- `auth/callback.tsx` debe redirigir a `/`, no directo a dashboard.
- `app/_layout.tsx` debe registrar `onboarding` como ruta protegida por sesion.
- Rutas financieras deben requerir sesion y onboarding completo, no solo sesion.

Proteccion recomendada:

- `login` y `auth/callback`: `!session` o excepcion controlada para callback si Expo Router lo requiere.
- `onboarding`: `session && me.setupComplete === false`.
- `(tabs)` y rutas financieras: `session && me.setupComplete === true`.

Si el root layout no puede consumir `me` sin crear loops, mantener `index` como gate y agregar guardas en pantallas financieras criticas. La opcion preferida es gate central con query `['me']` compartida.

Al completar onboarding:

1. Llamar `financeApi.completeOnboarding()`.
2. Invalidar `['me']`.
3. `router.replace('/(tabs)/dashboard')`.
4. No usar `push`, para evitar volver al onboarding con Back.

### Tour UI

Implementacion:

- Usar `FlatList` horizontal con `pagingEnabled`.
- No agregar libreria de carrusel.
- Mantener estado local `currentIndex`.
- CTA fijo inferior dentro de safe area.
- Dots de progreso.
- Boton secundario `Omitir recorrido`.
- En la ultima pantalla, botones especificos para notificaciones.

Componentes sugeridos:

```text
src/onboarding/OnboardingSlide.tsx
src/onboarding/onboardingSlides.tsx
```

O mantener todo en `app/onboarding.tsx` si no supera un tamaño razonable. Preferir extraer slides si el archivo queda demasiado grande.

Pantallas:

1. Bienvenida.
2. Cuentas y movimientos.
3. Pagos recurrentes.
4. Privacidad visual.
5. Notificaciones.

### Contenido De Slides

#### Slide 1: Bienvenida

Titulo:

```text
Tu dinero, mas claro
```

Mensaje:

- Centraliza tus cuentas.
- Entiende tus ingresos y gastos.
- Revisa lo importante sin complicarte.

CTA:

```text
Comenzar
```

#### Slide 2: Cuentas Y Movimientos

Mensaje:

- Registra cuentas personales.
- Consulta balances consolidados.
- Revisa movimientos por periodo.
- Corrige informacion antes de confirmarla.

Visual:

- Card de cuenta.
- Movimiento de ingreso.
- Movimiento de gasto.

#### Slide 3: Pagos Recurrentes

Mensaje:

- Organiza servicios y tarjetas.
- Registra pagos parciales o completos.
- Recibe recordatorios de vencimiento.
- Gmail nunca confirma movimientos automaticamente.

Visual:

- Pago proximo.
- Barra de progreso.
- Indicador de vencimiento.

#### Slide 4: Privacidad Visual

Mensaje:

- Oculta balances antes de compartir la pantalla.
- Cambia la visibilidad desde Inicio o Cuentas.
- La preferencia queda guardada para tu usuario.

Visual:

- Card con monto real transformandose a `••••••`.
- Icono `Eye/EyeOff`.

#### Slide 5: Notificaciones

Mensaje:

- Recibe recordatorios de pagos proximos.
- Recibe avisos de movimientos pendientes.
- Las notificaciones no muestran montos, bancos ni informacion Gmail.
- Puedes continuar aunque no las actives ahora.

Acciones:

```text
Activar notificaciones
Continuar sin notificaciones
```

### Flujo De Permisos

Archivo actual:

```text
src/notifications/pushNotifications.ts
```

Reglas:

- No pedir permiso al abrir la app.
- No pedir permiso automaticamente al llegar al slide.
- Mostrar explicacion primero.
- Pedir permiso solo si el usuario toca `Activar notificaciones`.
- Si acepta, registrar instalacion push.
- Si rechaza, permitir continuar.
- Si esta `denied`, ofrecer abrir Configuracion o continuar.
- Si esta `unsupported`, explicar y permitir continuar.
- Si falla registro API, permitir continuar y mostrar mensaje de reintento posterior.

Cambios tecnicos:

- Exportar una funcion para configurar canales Android antes de solicitar permiso.
- `requestAndRegisterPushInstallation` debe configurar canales antes de `requestPermissionsAsync`.
- Settings debe refrescar estado al volver desde Configuracion del sistema.
- Mantener `registerPushInstallation` para casos donde el permiso ya fue concedido.

Estados UI:

| Estado | UI |
| --- | --- |
| `undetermined` | CTA `Activar notificaciones` |
| `granted` | Mostrar `Notificaciones activas` y CTA finalizar |
| `denied` | Mostrar `Permiso rechazado`, abrir Configuracion opcional y CTA continuar |
| `unsupported` | Mostrar `No disponible en este dispositivo`, CTA continuar |
| Error registro | Mostrar error no bloqueante, CTA continuar |

### Deep Links Y Push Durante Onboarding

Mientras `setupComplete = false`:

- No abrir pantallas financieras desde push.
- No navegar directo a pendientes/pagos por deep link.
- Redirigir al onboarding.
- Despues de completar, enviar al dashboard.

Implementacion minima:

- `attachNotificationResponseListener` debe respetar disponibilidad de rutas o delegar al gate.
- Si no hay sesion o onboarding completo, no ejecutar `router.push('/pending-movements')`.
- Como mejora posterior, guardar destino pendiente y ejecutarlo al completar onboarding.

### i18n Onboarding

Agregar claves en español, ingles y portugues.

Namespace sugerido:

```text
onboarding.title
onboarding.skip
onboarding.next
onboarding.start
onboarding.finish
onboarding.notifications.enable
onboarding.notifications.continueWithout
onboarding.notifications.enabled
onboarding.notifications.denied
onboarding.notifications.unsupported
onboarding.notifications.error
onboarding.slides.welcome.*
onboarding.slides.accounts.*
onboarding.slides.payments.*
onboarding.slides.privacy.*
onboarding.slides.notifications.*
```

No dejar textos hardcodeados en `app/onboarding.tsx`.

### Tests Feature 2

API:

- Migracion agrega columna.
- Usuarios existentes quedan con `onboarding_completed_at` no nulo.
- Usuario nuevo creado despues de migracion queda con `null`.
- `/api/me` devuelve `setupComplete = false` para usuario nuevo.
- `/api/me` devuelve `setupComplete = true` para usuario completado.
- `POST /api/me/onboarding/complete` establece fecha.
- Segunda llamada no cambia fecha y responde exito.
- Sin token responde `401`.
- Usuario A no puede completar perfil de usuario B porque no se acepta `userId` externo.

Mobile unitarias:

- `getInitialRoute(false, ...)` devuelve login.
- Sesion no autorizada devuelve login.
- Sesion con `setupComplete = false` devuelve onboarding.
- Sesion con `setupComplete = true` devuelve dashboard.
- Error no 401 de `/api/me` no devuelve dashboard.
- `completeOnboarding` invalida `['me']` y hace replace.
- Estado `denied` de notificaciones permite completar.
- Estado `unsupported` permite completar.
- Error de registro push permite completar.

Manual QA:

- Usuario existente no ve onboarding despues del deploy.
- Usuario nuevo email con confirmacion ve onboarding al primer login confirmado.
- Usuario nuevo email sin confirmacion ve onboarding si queda logueado inmediatamente.
- Usuario nuevo Google ve onboarding despues del callback.
- Cerrar la app en slide 3 y volver; onboarding sigue pendiente.
- Tocar Omitir recorrido; completa y no reaparece.
- Completar con notificaciones aceptadas; quedan activas.
- Completar con notificaciones rechazadas; entra al dashboard.
- Ir a Settings y activar notificaciones despues.
- Recibir push antes de completar; no salta a pantalla financiera.
- Back despues de completar no vuelve al onboarding.
- Reinstalar app con mismo usuario completado no muestra onboarding porque API es fuente de verdad.

## Orden De Implementacion

1. Crear documentacion Fase 6.
2. Implementar Feature 1 completa en mobile.
3. Validar Feature 1 con typecheck/tests/manual QA.
4. Crear migracion API `022_onboarding_completion.sql`.
5. Implementar `/api/me` con `setupComplete` real.
6. Implementar `POST /api/me/onboarding/complete`.
7. Validar API local.
8. Implementar gate central mobile.
9. Implementar pantalla de onboarding.
10. Ajustar flujo push para permiso contextual.
11. Agregar traducciones.
12. Validar mobile local.
13. Aplicar migracion 022 en Supabase.
14. Desplegar API en Render.
15. Validar usuarios existentes y usuario nuevo QA.
16. Generar build mobile de prueba.
17. Validar Android real.
18. Validar iOS real si se va a liberar en iOS.

## Validacion Tecnica

API:

```text
bun run typecheck
bun test
bun run build
git diff --check
```

Mobile:

```text
bun run typecheck
bun run test
bunx expo-doctor
git diff --check
```

Validacion post-deploy API:

```text
GET /healthz
GET /api/version
GET /api/me con usuario existente
GET /api/me con usuario nuevo
POST /api/me/onboarding/complete con usuario nuevo
POST /api/me/onboarding/complete repetido
```

## Riesgos Y Mitigaciones

### Destello De Montos

Riesgo: el usuario oculto ve montos durante hidratacion.

Mitigacion:

- Estado no hidratado renderiza mascara.
- Cargar preferencia apenas exista sesion.

### Onboarding Para Usuarios Existentes

Riesgo: usuarios actuales ven onboarding inesperado.

Mitigacion:

- Migracion marca perfiles existentes como completados antes del deploy mobile.
- Validar conteo de perfiles antiguos con `onboarding_completed_at is null`.

### Google Nuevo Vs Existente

Riesgo: no distinguir usuarios nuevos por OAuth.

Mitigacion:

- No inferir por proveedor.
- Usar `profiles.onboarding_completed_at`.

### Permiso Rechazado

Riesgo: usuario queda bloqueado.

Mitigacion:

- Rechazo no bloquea onboarding.
- Settings mantiene accion para activar luego.

### Deep Links Antes Del Onboarding

Riesgo: push abre pantallas financieras antes de explicar la app.

Mitigacion:

- Gate de rutas por `setupComplete`.
- Listener push no navega si onboarding pendiente.

### Exportes Y Formularios

Riesgo: mascara rompe datos editables o exportados.

Mitigacion:

- No modificar `formatMoney` globalmente.
- Usar formatter sensible solo en superficies protegidas.

## Definicion De Hecho

- Inicio y Cuentas pueden ocultar y mostrar montos con una sola preferencia.
- La preferencia persiste por usuario.
- No hay importes exactos protegidos en texto ni accesibilidad cuando esta oculto.
- Exportes y formularios mantienen valores reales.
- Usuarios existentes no ven onboarding.
- Usuarios nuevos por email o Google ven onboarding.
- Onboarding se puede completar, omitir y no reaparece.
- Rechazar notificaciones no bloquea la app.
- Prompt del sistema aparece solo tras accion explicita.
- API guarda `onboarding_completed_at` de forma idempotente.
- TypeScript, tests, build API y Expo Doctor pasan.
