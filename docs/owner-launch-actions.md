# Acciones del propietario para lanzamiento

Este documento separa las tareas que ya se completaron en desarrollo de las que requieren acceso del propietario a correo, dominio, Google Cloud o Play Console.

## Estado preparado por desarrollo

- APK preview validado con políticas y términos públicos.
- OAuth Gmail publicado con `openid`, perfil, correo y `gmail.readonly`.
- Formulario de ayuda y soporte envía a `soporte.fint@gmail.com`.
- Cuenta QA preparada en el dispositivo Android conectado con datos ficticios:
  - Cuenta de efectivo.
  - Categorías de ingreso y gasto.
  - Ingreso de PEN 2,500 y gasto de PEN 640.
  - Pago recurrente mensual de PEN 89.
- Listing, Data safety, runbook y checklist de soporte preparados en `docs/`.

## 1. Validar soporte por correo

Responsable: propietario del correo `soporte.fint@gmail.com`.

1. Actualizar Expo en el dispositivo para cargar el último cambio del formulario.
2. Abrir Fint > Configuración > Ayuda > Reportar un problema.
3. Completar una categoría, una descripción ficticia y pasos ficticios.
4. Pulsar Enviar y confirmar que el cliente de correo abre un mensaje dirigido a `soporte.fint@gmail.com`.
5. Enviar el mensaje y responderlo desde `soporte.fint@gmail.com`.
6. Marcar el resultado en `docs/release-checklist-prioritized.md` solo cuando ambas direcciones funcionen.

Desarrollo puede comprobar el enlace `mailto:` y su contenido, pero no puede enviar ni recibir correos desde la cuenta del propietario.

## 2. Capturas para Google Play

Responsable: desarrollo puede capturarlas por ADB; propietario aprueba las imágenes finales.

Usar la cuenta QA ya preparada y ocultar montos si una captura mostrara información que no se desea publicar. Tomar en este orden:

1. Inicio con balance, flujo mensual y privacidad visual.
2. Movimientos con ingreso y gasto ficticios.
3. Pagos con el pago recurrente ficticio.
4. Reportes con los datos ficticios.
5. Cuentas con la cuenta QA.

La lista completa y textos de store están en `docs/play-store-listing.md`.

## 3. Dominio y verificación OAuth de Gmail

Responsable: propietario. Requiere comprar o controlar un dominio propio.

1. Registrar un dominio que controles.
2. Añadirlo al proyecto `fint-web` en Vercel y aplicar los registros DNS que Vercel indique.
3. Verificar el dominio en Google Search Console con la misma cuenta propietaria del proyecto Google Cloud.
4. Actualizar en Vercel las URLs públicas de homepage, privacidad y términos bajo el dominio propio.
5. Actualizar las variables EAS de privacidad y términos con esas nuevas URLs y crear un nuevo APK preview.
6. En Google Auth Platform > Branding, actualizar Homepage, Privacy policy y Terms of service con el dominio propio.
7. En Google Auth Platform > Verification Center, solicitar verificación de marca y del scope restringido `https://www.googleapis.com/auth/gmail.readonly`.
8. Adjuntar un video en inglés que muestre: abrir Fint, iniciar conexión Gmail, consentimiento con el scope, retorno a Fint, sincronización y desconexión.

Sin esta verificación, la aplicación externa publicada muestra la advertencia de app no verificada y tiene un máximo de 100 usuarios para Gmail.

## 4. Preparar acceso QA para revisión

Responsable: propietario de la cuenta QA.

1. Confirmar que la cuenta usada en el dispositivo es exclusiva de QA y no contiene datos personales.
2. Guardar correo y contraseña únicamente en App access de Play Console. Nunca en el repositorio, documentos públicos ni capturas.
3. Mantener la cuenta activa durante toda la revisión.
4. Explicar al revisor que Gmail es opcional y que puede revisar todo el producto sin conectar un correo real.

La plantilla exacta está en `docs/play-console-submission.md`.

## 5. Completar Google Play Console

Responsable: propietario con acceso a Play Console.

1. Crear o abrir la aplicación `com.fint.finanzasmobilev2`.
2. En App content, ingresar:
   - Política: `https://fint-web.vercel.app/privacy`.
   - Eliminación de cuenta: `https://fint-web.vercel.app/account-deletion`.
   - Sin anuncios mientras siga siendo cierto.
   - Audiencia de 18 años o más.
3. Completar Data safety usando `docs/play-console-submission.md` y contrastando con el AAB final.
4. Configurar App access con la cuenta QA y los pasos de revisión.
5. Completar Content rating y Financial features: Fint organiza información financiera, no es banco, billetera, prestamista ni procesador de pagos.
6. Cargar nombre, descripciones, capturas y correo de soporte desde `docs/play-store-listing.md`.
7. Crear un closed test. No publicar a producción todavía.

Desarrollo puede preparar el AAB solo después de una aprobación explícita del propietario. La carga y las declaraciones finales en Play Console requieren la cuenta del propietario.

## Criterio para avanzar

Antes de solicitar el AAB de closed testing: correo de soporte probado, cuenta QA documentada, capturas aprobadas y App content/Data safety completados. Antes de abrir Gmail a más de 100 usuarios: dominio propio y verificación OAuth aprobada.
