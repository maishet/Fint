# App Links / Universal Links (B-04)

## Para qué sirven estos dos archivos

Hoy, cuando conectas una cuenta de Gmail, el backend redirige de vuelta a la app usando un
esquema propio: `finanzasmobilev2://gmail-connected`. El problema (hallazgo B-04): en Android,
**cualquier otra app instalada puede registrar ese mismo esquema** y capturar esa redirección en
lugar de tu app — un ataque de "deep link hijacking". Como en ese callback solo viaja el email (los
tokens de Gmail quedan cifrados en el servidor, nunca en la URL), el impacto real hoy es bajo, pero
sigue siendo una superficie de ataque innecesaria.

La solución es que Android/iOS **verifiquen** que `myfint.app` es dueño de tu app, para que un link
`https://myfint.app/gmail-connected` abra la app directamente (en vez de un navegador o, peor, otra
app) — eso es lo que se llama *App Links* (Android) / *Universal Links* (iOS). La verificación
funciona así: el sistema operativo visita `https://myfint.app/.well-known/assetlinks.json` (Android)
o `https://myfint.app/.well-known/apple-app-site-association` (iOS) y compara lo que encuentra ahí
con la firma de tu app instalada. Si coincide, el link abre la app; si no, no pasa nada especial (se
abre como un link normal). Por eso estos archivos tienen que estar publicados en ese dominio exacto.

## Estado actual

- ✅ **Android** (`assetlinks.json`) — completo, ya tiene tu SHA-256 real.
- ⏳ **iOS** (`apple-app-site-association`) — pendiente, falta tu Apple Team ID.
- ⏳ **Hosting** — `myfint.app` lo sirve tu portal web en **Vercel** (proyecto aparte, no este
  repo), así que estos archivos deben copiarse allá.
- ⏳ **Rebuild con EAS** — `associatedDomains`/`intentFilters` en `app.json` requieren un build
  nativo nuevo, no basta un update OTA.
- 🚫 **Backend sin tocar a propósito** — el redirect de Gmail sigue usando el esquema propio hasta
  completar todo lo anterior (ver el punto 5 más abajo).

## Pasos que faltan

1. **iOS (opcional por ahora)** — cuando tengas tu Apple Team ID (Apple Developer → Membership, o
   `eas credentials -p ios`), reemplaza `REPLACE_WITH_APPLE_TEAM_ID` en
   `apple-app-site-association`. Mientras tanto, Android puede quedar protegido sin esperar a iOS —
   son verificaciones independientes.
2. **Hosting** — copiar `apple-app-site-association` y `assetlinks.json` (tal cual, sin extensión
   en el primero, sin redirects) a la carpeta pública del portal Vercel, en la ruta
   `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`. Si me das la ruta
   local de ese proyecto, lo conecto y dejo los archivos puestos ahí directamente.
3. **Verificar** — una vez desplegado, confirma con
   `https://developers.google.com/digital-asset-links/tools/generator` (assetlinks) y, cuando
   tengas el Team ID, con `https://search.developer.apple.com/appsearch-validation-tool/` (AASA).
4. **Rebuild** — nuevo build de producción con EAS (`eas build`) para que Android/iOS recojan los
   nuevos `intentFilters`/`associatedDomains` de `app.json`.
5. **Recién entonces** cambiar el redirect del backend en
   `finanzas-api/src/modules/integrations/gmail/gmail.routes.ts` (línea con
   `finanzasmobilev2://gmail-connected`) a `https://myfint.app/gmail-connected`. Cambiarlo antes de
   completar los pasos 1-4 rompería el callback de conexión de Gmail para todos los usuarios (el
   link no abriría la app hasta que el sistema operativo verifique el dominio).
