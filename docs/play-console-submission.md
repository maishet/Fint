# Ficha de envío a Google Play Console

Usar esta ficha al completar Play Console. Verificar cada respuesta contra el APK/AAB final y las opciones vigentes del formulario de Google Play antes de enviarlo.

## Identidad y URLs

| Campo | Valor |
| --- | --- |
| Nombre de la app | Fint |
| Operador | Cristhofer Moises Ventura Villanueva |
| País | Perú |
| Soporte | soporte.fint@gmail.com |
| Política de privacidad | https://fint-web.vercel.app/privacy |
| Eliminación de cuenta | https://fint-web.vercel.app/account-deletion |
| Términos | https://fint-web.vercel.app/terms |

## App content

### Publicidad

Declarar que la app no contiene anuncios mientras esto siga siendo cierto.

### Público objetivo

Seleccionar solo usuarios de 18 años o más. Fint no está dirigida a menores.

### Funciones financieras

Fint registra y organiza información financiera personal. No procesa pagos, no es un banco, billetera, prestamista, transferidor de dinero ni ofrece asesoramiento financiero. Si el formulario exige clasificarla, seleccionar `Other` y usar esta descripción.

### Eliminación de cuenta

Usar `https://fint-web.vercel.app/account-deletion`. La página explica la eliminación desde Configuración y la solicitud por correo, sin pedir contraseñas, tokens ni información financiera.

## Data safety

Esta matriz refleja el comportamiento documentado de Fint. Confirmar cada tipo de dato contra el APK/AAB final, los SDKs instalados y las preguntas exactas de Play Console.

| Tipo de dato de Play | ¿Cuándo se recopila? | Finalidad | Obligatorio |
| --- | --- | --- | --- |
| Nombre | Al crear o completar el perfil si se proporciona | Gestión de cuenta | Según método de registro |
| Dirección de correo | Al autenticarse o contactar soporte | Gestión de cuenta y comunicaciones del desarrollador | Requerido para cuenta |
| IDs de usuario | Al operar la cuenta autenticada | Funcionalidad y gestión de cuenta | Requerido |
| Historial de compras / otra información financiera | Al registrar o importar cuentas, saldos, movimientos, pagos y deudas | Funcionalidad de la app | Según uso del usuario |
| Correos | Solo al conectar Gmail | Funcionalidad de la app | Opcional |
| Otro contenido generado por el usuario | Notas y solicitudes de soporte | Funcionalidad y comunicaciones del desarrollador | Opcional |
| Registros de fallos y diagnósticos | Cuando Sentry captura un error o rendimiento | Funcionalidad y diagnóstico | Automático con Sentry activo |
| Identificadores de dispositivo | Al habilitar notificaciones | Funcionalidad de la app | Opcional |

Confirmar en el formulario que los datos se cifran en tránsito. La app permite solicitar eliminación de cuenta y datos mediante la URL pública anterior. Evaluar por separado la respuesta de `sharing` según los contratos vigentes de Supabase, Render, Google APIs/Gmail, Firebase, Expo Push y Sentry; no marcarla basándose solo en esta ficha.

## Google OAuth y Gmail

El backend solicita únicamente estos scopes para la integración Gmail:

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/userinfo.email
```

En Google Auth Platform > Data Access, pegar los URI completos. `gmail.readonly` sin el prefijo `https://www.googleapis.com/auth/` no es un scope válido. Es un scope restringido: el acceso público requiere completar la verificación OAuth de Google y sus requisitos aplicables para datos de scopes restringidos.

La aplicación está publicada como externa. Hasta completar la verificación, Google muestra una advertencia de app no verificada y aplica un límite de 100 usuarios. La verificación exige una homepage y política de privacidad bajo un dominio propio verificado; `fint-web.vercel.app` es válido para pruebas actuales, pero no reemplaza ese dominio para la publicación pública de Gmail.

## Acceso para revisión

Antes de enviar a revisión, crear una cuenta QA exclusiva y guardar sus credenciales fuera del repositorio.

| Campo | Valor a completar antes del envío |
| --- | --- |
| Correo QA | Pendiente |
| Contraseña QA | Guardar solo en Play Console |
| Estado de onboarding | Completado o pasos detallados |
| Datos de ejemplo | Cuenta, ingreso, gasto, pago y reporte ficticios |
| Gmail | Opcional; la revisión puede completarse sin conectar una cuenta real |

Instrucciones para el revisor:

1. Iniciar sesión con la cuenta QA.
2. Revisar Inicio, Cuentas, Movimientos, Pagos y Reportes con datos ficticios.
3. Gmail es opcional y no es necesario conectar un correo personal.
4. Abrir Configuración para revisar Privacidad, Términos y eliminación de cuenta.

## Listing y closed test

1. Confirmar disponibilidad legal y comercial del nombre Fint antes de la publicación.
2. Preparar descripción corta, descripción completa y capturas de Inicio, Movimientos y Pagos.
3. Subir primero un AAB a closed testing.
4. Recoger feedback, resolver bloqueadores y revisar Sentry antes del rollout de producción.
