# Plan MVP: Sentry, documentos legales y Google Play

Fecha de referencia: 2026-08-02

## Objetivo

Cerrar los requisitos operativos y legales que faltan antes de enviar Fint a Google Play, sin generar todavia el build productivo.

Este plan cubre:

- Configuracion y validacion real de Sentry para mobile y API.
- Alertas operativas con bajo ruido.
- Politica de privacidad, terminos, soporte y eliminacion de cuenta.
- Alojamiento publico de los documentos legales.
- Configuracion posterior en EAS y Google Play Console.

Este documento es un plan tecnico y operativo. El contenido legal final debe ser revisado por una persona con conocimiento de la jurisdiccion aplicable.

## Estado actual verificado

### Mobile

- `@sentry/react-native` esta instalado.
- `app/_layout.tsx` inicializa Sentry y envuelve la aplicacion con `Sentry.wrap`.
- `app.json` incluye el plugin `@sentry/react-native/expo` para la organizacion `finanzas-app-1x` y el proyecto `fint-mobile`.
- `metro.config.js` usa `getSentryExpoConfig`.
- `EXPO_PUBLIC_SENTRY_DSN` activa o desactiva el envio de eventos.
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT` diferencia ambientes.
- La exportacion de reportes captura excepciones con la etiqueta de operacion correspondiente.
- Todavia falta comprobar con un evento controlado que los eventos llegan simbolizados y sin datos sensibles.
- Todavia falta comprobar que `SENTRY_AUTH_TOKEN` permite subir source maps durante un build EAS.

### API

- `@sentry/node` y `@sentry/hono` estan instalados.
- El proceso carga `src/instrument.ts` antes de iniciar la aplicacion.
- `sendDefaultPii` esta desactivado.
- `beforeSend` elimina usuario, cookies, body y headers de request.
- Cada request incorpora `request_id` como tag de Sentry.
- Render contiene las variables `SENTRY_DSN`, `SENTRY_ENVIRONMENT` y `SENTRY_TRACES_SAMPLE_RATE`.
- Los logs HTTP estructurados siguen disponibles en Render.
- Todavia falta comprobar la recepcion real de un error controlado.
- Todavia faltan release/commit identificables en Sentry y reglas de alertas.

### Alertas operativas existentes

- `OPS_ALERT_WEBHOOK_URL` es independiente de Sentry.
- Actualmente sirve para eventos operativos especificos, como fallos de renovacion Gmail.
- `/api/alerts/policies` describe notificaciones de producto para usuarios; no configura alertas operativas de Sentry.

## Decision de herramientas

| Necesidad | Herramienta | Decision MVP |
| --- | --- | --- |
| Excepciones mobile | Sentry proyecto `fint-mobile` | Obligatorio antes del build final |
| Excepciones API | Proyecto Sentry separado para API | Obligatorio antes del build final |
| Logs HTTP y despliegue | Render logs | Mantener como fuente de detalle operativo |
| Fallos operativos Gmail/jobs | Webhook y posteriormente Sentry Monitors | Mantener webhook; agregar monitor si el plan de Sentry lo permite |
| Documentos legales | Sitio estatico en Vercel | Recomendado para salir rapido |
| Dominio | URL estable de Vercel inicialmente; dominio propio despues | No bloquear el MVP por dominio propio |

## Fase 1: cerrar Sentry

### 1.1 Accesos y estructura

- Confirmar que el propietario tiene acceso de administrador a la organizacion Sentry.
- Confirmar que `fint-mobile` recibe exclusivamente eventos mobile.
- Confirmar o crear un proyecto separado, por ejemplo `fint-api`, para la API.
- Confirmar que el DSN configurado en Render pertenece al proyecto API y no a `fint-mobile`.
- Verificar el correo que recibira alertas y activar sus notificaciones en Sentry.
- Usar `preview` y `production` como ambientes operativos; no crear alertas para `development`.

### 1.2 Variables requeridas

#### EAS

| Variable | Tipo | Ambiente |
| --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | Publica | preview y production |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | Publica | `preview` o `production` |
| `SENTRY_AUTH_TOKEN` | Secreto | preview y production |

El DSN puede ser publico. `SENTRY_AUTH_TOKEN` no debe entrar al repositorio, logs, app bundle ni variables `EXPO_PUBLIC_*`.

#### Render

| Variable | Valor esperado |
| --- | --- |
| `SENTRY_DSN` | DSN del proyecto API |
| `SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` inicialmente |
| `GIT_COMMIT_SHA` | Commit desplegado, si se mantiene esta variable |

Render expone metadatos del deploy. Se debe enlazar el release de Sentry con el commit desplegado, usando `GIT_COMMIT_SHA` o el identificador de commit nativo de Render. El resultado esperado es que cada evento permita identificar la version exacta.

### 1.3 Endurecimiento de privacidad

Estado: aplicado y validado con pruebas automatizadas en mobile y API. Falta revisar en Sentry el payload real de los eventos controlados.

Antes del evento controlado se debe revisar lo siguiente:

- [x] Mobile declara explicitamente `sendDefaultPii: false`.
- [x] Mobile filtra usuario, cookies, headers, body y query strings antes de enviar eventos.
- [x] Mobile filtra claves sensibles en `extra`, `contexts` y breadcrumbs, incluyendo nombre de cuenta, monto, moneda, nota, categoria, email, token, header y body.
- [x] API conserva el `beforeSend` actual que elimina body, headers, cookies y usuario.
- [x] Los eventos manuales actuales usan tags tecnicos como `operation`.
- [x] Sentry no se usa como analitica de negocio.

Validacion pendiente del punto 1.3:

- [ ] Disparar un evento controlado en mobile preview y revisar payload en Sentry.
- [x] Disparar un evento controlado de API y revisar payload en Sentry.
- [ ] Confirmar que no aparecen correos, tokens, montos, cuentas, categorias, notas, remitentes, asuntos ni cuerpos HTTP.

### 1.4 Releases y source maps mobile

Estado: validado en build preview Android, sin generar build productivo.

La configuracion base ya existe en `app.json` y `metro.config.js`. Durante el proximo build preview, no productivo, se debe comprobar:

- [x] El log EAS confirma subida de source maps a Sentry.
- [ ] El evento de prueba muestra stack trace simbolizado con archivo y linea legibles.
- [x] El release/dist del evento corresponde al build instalado.
- [x] `SENTRY_AUTH_TOKEN` no aparece en logs.
- [x] Un build que no pueda subir source maps se considera fallido para el gate de release.

Build preview validado:

```text
Build ID: 6a8968b1-bd1f-48d6-bf6d-109da657c838
Release: com.fint.finanzasmobilev2@1.0.0+2
Dist: 2
Debug ID: 0428e9b7-b210-4f89-b6fe-93c4a52a4428
Resultado: Uploaded files to Sentry
APK: https://expo.dev/accounts/maishet/projects/finanzas-mobilev2/builds/6a8968b1-bd1f-48d6-bf6d-109da657c838
```

No ejecutar esta comprobacion con un build productivo hasta aprobar el resto del plan.

### 1.5 Pruebas controladas

Estado: API enviada. Mobile preparado en build preview; falta dispararlo desde dispositivo real.

No se debe crear un endpoint publico que genere errores.

| Prueba | Ambiente | Resultado esperado |
| --- | --- | --- |
| Excepcion JS mobile controlada | Preview | Evento en `fint-mobile`, simbolizado y sin PII |
| Excepcion API controlada | Render o ambiente controlado | Evento en proyecto API con `request_id` y sin request body |
| Exportacion fallida controlada | Preview | Tag `operation=report_export_*` sin contenido financiero |
| Error resuelto y regresion controlada | Preview | Sentry reconoce la regresion y ejecuta la alerta |

Despues de probar, retirar cualquier boton, script temporal o ruta usada exclusivamente para generar el error.

Implementacion actual:

- API usa `npm run sentry:controlled-test`; no expone endpoints publicos.
- Mobile usa la ruta no enlazada `/sentry-test`, disponible solo si `EXPO_PUBLIC_ENABLE_SENTRY_TESTS=true` en el ambiente EAS preview.
- El APK preview `6a8968b1-bd1f-48d6-bf6d-109da657c838` incluye esa variable y permite enviar `operation=sentry_controlled_mobile_validation`.
- No se detecto un dispositivo Android conectado por ADB en esta maquina, por lo que el evento mobile queda pendiente de disparar manualmente desde el APK preview.
- Luego de validar mobile, eliminar `EXPO_PUBLIC_ENABLE_SENTRY_TESTS` del ambiente EAS preview o dejarlo documentado como variable temporal de QA.

Comandos de referencia:

```bash
npm run sentry:controlled-test
```

Para mobile:

1. Instalar el APK preview del build `6a8968b1-bd1f-48d6-bf6d-109da657c838`.
2. Abrir la ruta `finanzasmobilev2://sentry-test` o navegar a `/sentry-test` si se usa una herramienta de deep link.
3. Presionar `Enviar evento controlado`.
4. Revisar en Sentry `operation=sentry_controlled_mobile_validation`.

### 1.6 Alertas minimas

Configurar primero correo electronico. Slack, Discord o PagerDuty pueden agregarse despues sin bloquear el lanzamiento.

| Nombre sugerido | Proyecto | Ambiente | Condicion inicial | Accion |
| --- | --- | --- | --- | --- |
| `MVP Mobile - New production issue` | Mobile | production | Issue nuevo o regresion | Email inmediato |
| `MVP Mobile - Fatal error` | Mobile | production | Nivel fatal/unhandled | Email inmediato |
| `MVP API - New production issue` | API | production | Issue nuevo o regresion | Email inmediato |
| `MVP API - Error spike` | API | production | 5 eventos en 5 minutos | Email inmediato |
| `MVP API - Availability` | API/uptime | production | `/healthz` falla durante 2 comprobaciones | Email inmediato |

Si el plan de Sentry no ofrece metric alerts o uptime, reemplazar temporalmente esas dos reglas por alertas de frecuencia de issue y un monitor externo de `/healthz`.

Reglas contra ruido:

- Filtrar solo `environment=production`.
- No alertar por errores de validacion 4xx esperados.
- Mantener una ventana de repeticion minima de 30 minutos por issue.
- Revisar umbrales despues de 48 horas de closed testing.
- Toda alerta debe tener propietario y accion esperada.

### 1.7 Jobs y cron

Para el MVP se mantiene `OPS_ALERT_WEBHOOK_URL` para errores operativos Gmail. Como mejora inmediata, si Sentry Monitors esta disponible:

- Crear monitor para renovacion Gmail cada 12 horas.
- Crear monitor para generacion de ocurrencias.
- Crear monitor para recordatorios push.
- Crear monitor para comprobacion de push receipts.
- Enviar check-in al inicio, exito y fallo de cada job.

La ausencia de un check-in debe generar alerta. Los monitores no deben incluir IDs de usuarios, correos ni datos financieros.

### 1.8 Gate de aceptacion Sentry

- [ ] Mobile preview recibido y simbolizado.
- [ ] Evento API recibido con release y `request_id`.
- [ ] Ningun evento de prueba contiene PII o datos financieros.
- [ ] Source maps confirmados.
- [ ] Alerta mobile recibida por email.
- [ ] Alerta API recibida por email.
- [ ] `/healthz` tiene monitor o alternativa documentada.
- [ ] Propietario y proceso de respuesta definidos.

## Fase 2: documentos legales publicos

### 2.1 Donde alojarlos

Para salir rapido se recomienda crear un repositorio pequeno, por ejemplo `fint-legal`, y desplegarlo como sitio estatico en Vercel.

Motivos:

- HTTPS automatico.
- URL publica estable desde el primer despliegue.
- Puede usar repositorio privado.
- No requiere backend ni base de datos.
- Permite agregar dominio propio posteriormente sin cambiar el contenido.
- Los documentos quedan versionados y tienen historial de cambios.

Cloudflare Pages es una alternativa equivalente. GitHub Pages es valido, pero no es la opcion preferida si obliga a hacer publico un repositorio que se desea mantener privado.

Estructura publica recomendada:

```text
https://<sitio-legal>/privacy
https://<sitio-legal>/terms
https://<sitio-legal>/account-deletion
https://<sitio-legal>/support
```

La URL generada por Vercel es suficiente para una primera publicacion si es estable y controlada por el propietario. No usar un dominio de ejemplo ni uno que no se posea.

### 2.2 Requisitos del sitio

- HTML responsive y legible en movil.
- Sin login para leer los documentos.
- Sin geoblocking.
- Sin enlaces temporales o firmados.
- Fecha de vigencia y fecha de ultima actualizacion visibles.
- Nombre del operador visible.
- Correo de soporte y privacidad visible.
- Navegacion entre privacidad, terminos, eliminacion y soporte.
- Contenido accesible sin JavaScript obligatorio.
- Respuesta HTTP 200 en todas las URLs.
- No usar PDF como formato principal.

### 2.3 Datos que debe proporcionar el propietario

| Dato | Estado requerido |
| --- | --- |
| Nombre legal del operador o empresa | Obligatorio |
| Pais y jurisdiccion | Obligatorio |
| Correo de soporte | Obligatorio y monitoreado |
| Correo de privacidad/eliminacion | Obligatorio; puede ser el mismo |
| Domicilio o dato legal exigido por jurisdiccion | Confirmar con asesoria legal |
| Edad minima/mercado objetivo | Obligatorio |
| Tiempo de respuesta a eliminaciones web | Definir y publicar |
| Periodos de retencion excepcionales | Definir; no inventar retenciones |
| Fecha de vigencia | Obligatorio |

### 2.4 Politica de privacidad

La politica debe describir de forma exacta:

- Datos de perfil: nombre, correo, avatar e identificador de usuario.
- Datos financieros ingresados: cuentas, saldos, movimientos, categorias, pagos, deudas y notas.
- Gmail opcional: cuenta conectada, filtros configurados, acceso `gmail.readonly`, correos procesados y pendientes derivados.
- Notificaciones: installation ID, Expo push token, plataforma, idioma y zona horaria.
- Diagnosticos: crash logs, errores y rendimiento procesados por Sentry.
- Soporte: categoria, descripcion y datos que el usuario decide enviar.
- Finalidades de cada dato.
- Base o justificacion de tratamiento segun la jurisdiccion.
- Proveedores que procesan datos: Supabase, Render, Google APIs/Gmail, Firebase/Expo Push, Sentry y el proveedor del sitio legal cuando corresponda.
- Cifrado en transito y controles de acceso, sin prometer seguridad absoluta.
- Retencion, desconexion Gmail y eliminacion de cuenta.
- Transferencias internacionales si los proveedores procesan fuera del pais.
- Derechos del usuario y canal de contacto.
- Cambios futuros a la politica.
- Restriccion de edad definida para el producto.

Por el uso de Gmail, la politica y la pantalla contextual deben cumplir Google API Services User Data Policy. Deben explicar claramente que:

- El acceso se usa solo para funciones visibles solicitadas por el usuario.
- Fint no vende datos de Google ni los usa para publicidad.
- Fint no usa datos Gmail para scoring crediticio o prestamos.
- Fint no permite lectura humana salvo consentimiento especifico, seguridad o exigencia legal.
- El uso y transferencia de datos obtenidos de Google cumplen los requisitos de Limited Use.
- El usuario puede desconectar Gmail y eliminar los datos asociados.

### 2.5 Terminos y condiciones

Los terminos deben incluir:

- Identidad del operador.
- Aceptacion y edad/capacidad minima.
- Descripcion del servicio.
- Aclaracion de que Fint organiza informacion y no presta servicios bancarios.
- Aclaracion de que Fint no ofrece asesoria financiera, tributaria, legal ni de inversion.
- Responsabilidad del usuario de revisar movimientos detectados por Gmail.
- Reglas de uso aceptable.
- Disponibilidad, cambios y suspension del servicio.
- Propiedad intelectual y licencia de uso.
- Cierre y eliminacion de cuenta.
- Limitaciones de responsabilidad permitidas por la jurisdiccion.
- Ley aplicable, contacto y fecha de vigencia.

### 2.6 Pagina web de eliminacion de cuenta

Google Play exige una ruta dentro de la app y un recurso web cuando la app permite crear cuentas. La ruta interna ya existe. La pagina web debe:

- Mencionar claramente `Fint` y al operador publicado en Play Store.
- Explicar que la eliminacion interna esta en Configuracion > Gestion de cuenta > Eliminar cuenta.
- Permitir iniciar una solicitud sin reinstalar la app.
- Ofrecer un correo o formulario funcional para solicitar eliminacion.
- Pedir que la solicitud se envie desde el correo de la cuenta cuando sea posible.
- No pedir contrasena, tokens, saldos, movimientos ni documentos financieros.
- Explicar como se verificara la identidad.
- Indicar que datos se eliminan y si existe alguna retencion legal excepcional.
- Indicar un plazo razonable de respuesta.

Para el MVP, el camino mas rapido es un enlace `mailto:` hacia un correo monitoreado. El asunto puede ser `Solicitud de eliminacion de cuenta Fint`. Si luego se agrega un formulario, su proveedor y datos recolectados deben incorporarse a la politica.

### 2.7 Soporte

La pagina `/support` debe mostrar:

- Correo monitoreado.
- Horario o plazo estimado de respuesta.
- Instruccion de no enviar contrasenas, tokens ni informacion financiera completa.
- Enlaces a privacidad, terminos y eliminacion.

### 2.8 Idiomas

Fint ofrece ES, EN y PT. Recomendacion:

- Publicar una version principal en espanol.
- Publicar traducciones EN y PT en el mismo sitio.
- Incluir selector de idioma visible.
- Definir cual version prevalece en caso de discrepancia, sujeto a revision legal.
- Mantener la misma fecha/version en todos los idiomas.

### 2.9 Gate de aceptacion legal

- [ ] Datos legales del operador confirmados.
- [ ] Politica revisada y publicada.
- [ ] Terminos revisados y publicados.
- [ ] Pagina de eliminacion funcional.
- [ ] Pagina de soporte funcional.
- [ ] URLs publicas devuelven HTTP 200 sin login.
- [ ] Enlaces probados desde un dispositivo movil.
- [ ] Gmail/Limited Use descrito correctamente.
- [ ] Correos de soporte y privacidad reciben mensajes.

## Fase 3: conectar documentos con la app y Play Console

### 3.1 EAS

Una vez publicadas las URLs, configurar en preview y production:

```text
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<sitio-legal>/privacy
EXPO_PUBLIC_TERMS_URL=https://<sitio-legal>/terms
```

La app ya consume estas variables desde Configuracion. Antes del build productivo se debe validar en preview que ambos enlaces abren correctamente.

### 3.2 Google OAuth

- Configurar la URL de privacidad publica en OAuth consent screen.
- Confirmar homepage y dominio autorizado si Google los solicita.
- Verificar que el nombre, logo y operador coinciden entre OAuth, Play Store y sitio legal.
- Revisar el estado de verificacion OAuth para `gmail.readonly` antes de abrir el acceso a usuarios externos.
- Mantener solo scopes necesarios: `gmail.readonly` y `userinfo.email`.

### 3.3 Play Console: App content

Completar antes de closed testing publico o produccion:

- Privacy policy con la URL `/privacy`.
- Data safety con inventario real de app, API y SDKs.
- Account deletion con la URL `/account-deletion`.
- Ads: declarar que no contiene anuncios mientras siga siendo cierto.
- App access: proporcionar credenciales QA e instrucciones para onboarding y funciones protegidas.
- Target audience: definir audiencia adulta; no seleccionar menores si no forman parte del producto.
- Content rating.
- Financial features declaration.

Fint registra y organiza informacion financiera, pero no procesa pagos, no presta dinero, no funciona como banco y no da asesoramiento financiero. En la declaracion financiera se debe revisar la opcion vigente en Play Console. No declarar banking, loans, money transfer, wallet ni financial advice. Si el formulario considera el seguimiento presupuestario como funcion financiera, utilizar `Other` con una descripcion precisa.

### 3.4 Inventario inicial para Data safety

Este inventario es una base para revisar el formulario; no debe copiarse sin contrastarlo con el bundle final y las guias de cada SDK.

| Tipo Google Play | Uso probable en Fint | Obligatorio/opcional | Finalidad |
| --- | --- | --- | --- |
| Name | Perfil | Requerido en registro email; proveedor Google puede entregarlo | Account management |
| Email address | Autenticacion y soporte | Requerido | Account management |
| User IDs | Supabase user ID | Requerido | App functionality/account management |
| Purchase history | Movimientos importados o creados | Segun uso | App functionality |
| Other financial info | Saldos, ingresos, gastos, deudas | Segun uso | App functionality |
| Emails | Gmail conectado | Opcional | App functionality |
| Other user-generated content | Notas y soporte | Opcional | App functionality/developer communications |
| Crash logs | Sentry | Automatico con Sentry activo | Analytics/app functionality |
| Diagnostics | Sentry y rendimiento | Automatico con Sentry activo | Analytics/app functionality |
| Device or other IDs | Installation ID y push token | Opcional al activar push | App functionality |

Se debe revisar si cada proveedor califica como service provider y por tanto como recopilacion sin `sharing` bajo la definicion de Google Play. La decision debe coincidir con contratos, configuracion y uso real.

### 3.5 Credenciales para revision

- Crear usuario QA exclusivo para Google Play Review.
- No reutilizar una cuenta personal.
- Dejar onboarding completado o documentar los pasos exactos.
- Crear datos financieros ficticios suficientes para revisar dashboard, cuentas, movimientos, pagos y reportes.
- No incluir correos, bancos, tarjetas ni montos reales.
- Explicar si Gmail es opcional y como revisar la app sin conectar una cuenta Gmail personal.
- Mantener las credenciales activas durante toda la revision.

## Orden de ejecucion recomendado

| Orden | Trabajo | Bloquea Play |
| ---: | --- | --- |
| 1 | Confirmar datos legales y correos | Si |
| 2 | Crear sitio estatico y publicar cuatro URLs | Si |
| 3 | Revisar contenido legal y Google Limited Use | Si |
| 4 | Configurar Sentry projects, privacidad, releases y alertas | Si |
| 5 | Probar Sentry con build preview y error API controlado | Si |
| 6 | Configurar URLs en EAS preview/production | Si |
| 7 | Configurar OAuth consent screen | Si para Gmail publico |
| 8 | Completar App content y Data safety en Play Console | Si |
| 9 | Preparar listing, screenshots y credenciales QA | Si |
| 10 | Generar AAB productivo cuando se autorice | Si |
| 11 | Closed testing y correccion de bloqueadores | Si |
| 12 | Envio a produccion con rollout controlado | Final |

## Gate antes de autorizar build productivo

- [ ] Sentry mobile/API validado sin PII.
- [ ] Source maps mobile validados en preview.
- [ ] Alertas criticas probadas.
- [ ] Documentos legales publicados.
- [ ] URL web de eliminacion funcional.
- [ ] Variables legales configuradas en EAS.
- [ ] OAuth consent screen actualizado.
- [ ] Data safety preparado y revisado.
- [ ] Financial features declaration definida con precision.
- [ ] Credenciales QA de Play preparadas.
- [ ] Store listing y assets listos.

## Fuentes oficiales

- Sentry Alerts: https://docs.sentry.io/product/monitors-and-alerts/alerts/
- Sentry source maps para Expo: https://docs.sentry.io/platforms/react-native/guides/expo/sourcemaps/uploading/expo/
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play app review: https://support.google.com/googleplay/android-developer/answer/9859455
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play Financial features: https://support.google.com/googleplay/android-developer/answer/13849271
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy

## Documentos relacionados

- `docs/monitoring-setup.md`
- `docs/play-store-launch.md`
- `docs/release-checklist-prioritized.md`
- `docs/launch-readiness.md`
- `docs/brand-and-license-decision.md`
