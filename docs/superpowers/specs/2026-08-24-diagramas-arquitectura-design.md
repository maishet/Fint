# Diagramas actualizados de arquitectura de Fint

Fecha: 2026-08-24

## Objetivo

Crear dos imágenes independientes, en español y con formato horizontal 16:9:

1. Arquitectura de ejecución actual de Fint.
2. Infraestructura, despliegue y servicios administrados.

Los diagramas deben representar únicamente componentes existentes. La ruta `/chat` de `fint-ai-worker` se mostrará como reservada y no activa.

## Fuentes verificadas

- `finanzas-mobilev2`: aplicación Expo / React Native.
- `finanzas-api`: API Hono sobre Node.js desplegada en Render.
- `fint-ai-worker`: Cloudflare Worker para extracción de constancias mediante Workers AI.
- Migraciones de Supabase responsables de `pg_cron`, `pg_net` y los jobs internos.
- Documentación del vault de Obsidian del proyecto y configuración de despliegue vigente.

## Alternativas consideradas

### C4 simplificado — seleccionada

Separa límites de sistema, componentes administrados y relaciones mediante cajas y flechas etiquetadas. Es la opción más legible para comunicar arquitectura técnica sin convertir la imagen en un diagrama de clases.

### Flujo de datos

Explica muy bien recorridos concretos, pero pierde claridad al presentar la composición completa del sistema.

### Agrupación por proveedor

Es adecuada para operaciones, pero dificulta entender qué responsabilidad pertenece a la app, la API o el Worker.

## Imagen 1: arquitectura de ejecución

### Composición

El diagrama se organizará de izquierda a derecha:

- Usuario y dispositivo.
- Aplicación móvil.
- Servicios propios de Fint.
- Plataforma de datos y servicios externos.

### Aplicación móvil

- Expo 55, React Native y Expo Router.
- Pantallas y módulos de cuentas, movimientos, pagos, reportes, Gmail y captura de constancias.
- TanStack Query con persistencia local y control de conectividad.
- Supabase SDK para Auth y Realtime.
- SecureStore y filesystem/cache local.
- Captura por cámara, galería o Share Intent; validación, recodificación y eliminación de metadatos antes de subir la imagen.
- Notificaciones locales y recepción de Expo Push.
- Sentry con sanitización de información financiera y credenciales.

### Servicios propios

#### `finanzas-api`

- Hono sobre Node.js 22 en Render.
- Autenticación por JWT de Supabase.
- Rate limiting global y por usuario mediante Upstash Redis.
- Módulos: Finance, Reports, Gmail, Receipts/Capture, Push y Support.
- Acceso a PostgreSQL mediante contexto JWT, rol `authenticated` y RLS.
- Sentry y logging estructurado.

#### `fint-ai-worker`

- Endpoint activo `POST /extract`.
- Validación de JWT contra el JWKS público de Supabase.
- Cache de JWKS y límites por usuario en Cloudflare KV.
- Cloudflare AI Gateway `fint` y Workers AI con Llama 4 Scout.
- Sin persistencia de imágenes y sin service role de Supabase.
- `/chat` se indicará como ruta reservada, no activa.

### Plataforma de datos

- Supabase Auth.
- PostgreSQL con RLS.
- Realtime sobre `pending_movements`.
- Vault para secretos internos.
- `pg_cron` y `pg_net` para invocar jobs autenticados de la API.

### Servicios externos

- Google Sign-In/OAuth y Gmail API.
- Google Pub/Sub para eventos de Gmail.
- Upstash Redis para rate limiting de la API.
- Expo Push Service para tickets y receipts.
- Sentry para app móvil y backend.

### Flujos destacados

1. Operaciones financieras: app → API → PostgreSQL con RLS.
2. Sesión: app → Supabase Auth; JWT → API y Worker.
3. Realtime: PostgreSQL/Supabase Realtime → app para refrescar movimientos pendientes.
4. Captura: dispositivo → sanitización local → Worker → Workers AI → extracción estructurada → app → API → `pending_movements`.
5. Gmail: app obtiene `serverAuthCode` → API → OAuth/Gmail; Gmail → Pub/Sub → API → parser → `pending_movements` → Realtime/push.
6. Jobs: Supabase `pg_cron`/`pg_net` → endpoints internos de la API mediante secreto almacenado en Vault.
7. Push: API → Expo Push → dispositivo; receipts → API mediante job periódico.

## Imagen 2: infraestructura y despliegue

### Repositorios

- `finanzas-mobilev2`.
- `finanzas-api`.
- `fint-ai-worker`.

### Destinos y plataformas

- App: EAS Build/Update y distribución Android/iOS.
- API: build TypeScript, migraciones y servicio web en Render.
- Worker: Wrangler hacia Cloudflare Workers.
- Datos: Supabase Auth, PostgreSQL, Realtime, Vault, `pg_cron` y `pg_net`.
- IA: Cloudflare Workers AI, AI Gateway y KV.
- Integraciones: Google Cloud/OAuth/Gmail/Pub/Sub, Upstash, Expo Push y Sentry.

### Infraestructura periférica

- `myfint.app` alojado en Vercel.
- Cloudflare Worker `myfint-well-known` sobre `/.well-known/*` para Android App Links.
- Featurebase y páginas legales como servicios auxiliares consumidos desde la app.

### Fronteras visuales

- Código y repositorios.
- Pipeline/build.
- Runtime administrado.
- Datos y servicios externos.
- Observabilidad.

## Lenguaje visual

- Formato horizontal 16:9.
- Fondo azul petróleo oscuro.
- Tarjetas claras con bordes suaves y jerarquía tipográfica marcada.
- Verde menta como acento principal de Fint.
- Colores secundarios consistentes por dominio: móvil, backend, edge/IA, datos y externos.
- Flechas sólidas para tráfico síncrono.
- Flechas punteadas para eventos, Realtime y jobs.
- Etiquetas cortas y texto suficientemente grande para lectura a pantalla completa.
- Sin logotipos inventados, marcas de agua ni decoración ajena a la arquitectura.

## Criterios de aceptación

- Se entregan dos imágenes separadas.
- Los nombres técnicos importantes aparecen escritos correctamente.
- El Worker de IA no se confunde con `finanzas-api`.
- La extracción de imágenes se representa como efímera.
- Los jobs se representan como iniciados por Supabase, no como un proceso Worker independiente dentro de Render.
- El flujo Gmail distingue OAuth/Gmail API de Pub/Sub.
- La infraestructura periférica no domina el diagrama principal.
- La ruta `/chat` no aparece como funcionalidad disponible.
- El resultado es legible en una pantalla 16:9 sin ampliar cada etiqueta.

## Entregables previstos

- `docs/architecture/fint-runtime-architecture-2026-08.png`
- `docs/architecture/fint-infrastructure-2026-08.png`

