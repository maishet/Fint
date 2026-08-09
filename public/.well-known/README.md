# App Links / Universal Links (B-04)

Estos dos archivos habilitan que `https://myfint.app/gmail-connected` abra la app en vez de (o
además de) el esquema propio `finanzasmobilev2://`, que en Android puede ser registrado por otra
app instalada (deep link hijacking) — hallazgo B-04 en `docs/seguridad-revision-y-plan-de-control.md`.

**Pendiente antes de que esto funcione (no lo puede completar un asistente sin acceso a tus
cuentas):**

1. **iOS** — reemplazar `REPLACE_WITH_APPLE_TEAM_ID` en `apple-app-site-association` por tu Apple
   Team ID (Apple Developer → Membership, o `eas credentials`).
2. **Android** — reemplazar `REPLACE_WITH_SHA256_CERT_FINGERPRINT` en `assetlinks.json` por el
   SHA-256 del certificado de firma de producción (`eas credentials` → Android → ver keystore, o
   `keytool -list -v -keystore tu.keystore`). Si usas EAS Build managed, corre
   `eas credentials -p android` y copia el fingerprint SHA256.
3. **Hosting** — desplegar ambos archivos en `https://myfint.app/.well-known/` tal cual, sin
   redirects y sin extensión en `apple-app-site-association`. Si `myfint.app` se sirve con
   `expo export --platform web` (ver `build:web` en `package.json`), Expo copia el contenido de
   `public/` al build de forma automática, así que solo falta desplegar el resultado. Si `myfint.app`
   lo sirve otro proyecto (marketing/landing), copiar estos dos archivos allí en su lugar.
4. Verificar con `https://search.developer.apple.com/appsearch-validation-tool/` (AASA) y
   `https://developers.google.com/digital-asset-links/tools/generator` (assetlinks).
5. Una vez verificado, hacer un nuevo build con EAS (`associatedDomains` / `intentFilters` requieren
   rebuild nativo, no basta un update OTA) y **recién entonces** cambiar el redirect del backend en
   `finanzas-api/src/modules/integrations/gmail/gmail.routes.ts` (línea con
   `finanzasmobilev2://gmail-connected`) a `https://myfint.app/gmail-connected`. No se cambió en esta
   pasada a propósito: hacerlo antes de completar los pasos 1-4 rompería el callback de conexión de
   Gmail para todos los usuarios (la universal link no abriría la app hasta que iOS/Android verifiquen
   el dominio).
