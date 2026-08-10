# App Links / Universal Links (B-04) — histórico

## Contexto

Estos archivos se crearon para resolver el hallazgo de seguridad B-04: el callback de "conectar
Gmail" redirigía con el esquema propio `finanzasmobilev2://gmail-connected`, secuestrable en Android
por otra app que registrara el mismo esquema. La solución fue verificar `myfint.app` como dueño de la
app (Android App Links) para que `https://myfint.app/gmail-connected` abriera la app directamente.

Esa migración se completó y se confirmó funcionando en producción (ver
`seguridad-revision-y-plan-de-control.md` §17-18 en el vault de seguridad).

## Por qué ya no hace falta nada de esto

El flujo de "conectar Gmail" se migró después a `GoogleSignin` con `offlineAccess` (obtiene un
`serverAuthCode` directo del selector nativo de cuentas, sin `redirect_uri`, sin navegador, sin deep
link de ningún tipo). Con eso:

- La ruta `/gmail-connected` ya no existe en la app (`app/gmail-connected.tsx` fue eliminada).
- El `intentFilter` correspondiente se quitó de `app.json`.
- El backend ya no redirige a ningún lado tras conectar Gmail (`GET /gmail/oauth/callback` fue
  eliminado junto con todo el flujo OAuth por navegador).

El riesgo original de B-04 queda cerrado por una razón distinta y más fuerte: no hay ningún deep link
que secuestrar en absoluto para este flujo.

## Qué queda y por qué se dejó así

- `assetlinks.json` sigue publicado en `https://myfint.app/.well-known/assetlinks.json` (vía el
  Worker de Cloudflare `myfint-well-known`) — no hace daño dejarlo, y sirve como base si en el futuro
  se necesita verificar `myfint.app` para otro propósito (otro deep link, compartir contenido, etc.).
- `apple-app-site-association` nunca se llegó a publicar (iOS quedó descartado por decisión del
  usuario) y el placeholder local fue borrado.

Si en el futuro se necesita un nuevo App Link verificado, este archivo `assetlinks.json` y el Worker
de Cloudflare siguen siendo el punto de partida — solo haría falta agregar la nueva ruta/`intentFilter`
correspondiente.
