# Fint Architecture Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Producir dos diagramas 16:9 separados y legibles que documenten la arquitectura actual de ejecución y la infraestructura de Fint.

**Architecture:** Cada imagen se generará como una infografía C4 simplificada a partir de la especificación aprobada. Se validarán nombres, relaciones, estado actual de los componentes y legibilidad; las versiones finales se copiarán al repositorio sin reemplazar archivos preexistentes.

**Tech Stack:** Built-in ImageGen, inspección visual local, PNG, documentación Markdown.

## Global Constraints

- Usar exclusivamente componentes verificados en `finanzas-mobilev2`, `finanzas-api`, `fint-ai-worker`, sus configuraciones y las migraciones de Supabase.
- Texto en español, nombres de productos y endpoints en su grafía técnica original.
- Formato horizontal 16:9 con fondo azul petróleo, tarjetas claras y acento verde menta.
- Flechas sólidas para llamadas síncronas; punteadas para eventos, Realtime y jobs.
- No mostrar `/chat` como funcionalidad activa.
- No mostrar las imágenes de constancias como almacenadas en el Worker, la API o Supabase Storage.
- No representar los jobs como un proceso Worker alojado en Render: los inicia Supabase mediante `pg_cron` y `pg_net`.
- No sobrescribir entregables existentes; si el nombre ya existe, crear una versión `-v2`, `-v3`, etc.

---

### Task 1: Diagrama de arquitectura de ejecución

**Files:**
- Create: `docs/architecture/fint-runtime-architecture-2026-08.png`
- Reference: `docs/superpowers/specs/2026-08-24-diagramas-arquitectura-design.md`

**Interfaces:**
- Consumes: arquitectura verificada de app, API, Worker, Supabase y servicios externos.
- Produces: PNG panorámico de arquitectura runtime.

- [ ] **Step 1: Generar el primer borrador con ImageGen**

Usar este prompt exacto como base:

```text
Use case: infographic-diagram
Asset type: diagrama técnico de arquitectura de software para documentación de proyecto
Primary request: crear un diagrama C4 simplificado, horizontal y profesional titulado “Fint — Arquitectura de ejecución actual · Agosto 2026”. Todo el texto debe estar en español y ser legible.
Scene/backdrop: lienzo 16:9 con fondo azul petróleo oscuro, cuadrícula técnica muy sutil y amplio espaciado.
Style/medium: infografía vectorial limpia renderizada como PNG, tarjetas claras, bordes redondeados discretos, acento verde menta, iconografía lineal mínima.
Composition/framing: flujo de izquierda a derecha en cuatro zonas: “Usuario y dispositivo”, “App móvil”, “Servicios Fint”, “Datos e integraciones”.
Text (verbatim):
Zona 1: “Usuario”, “Android / iOS”, “Cámara · Galería · Share Intent”.
Zona 2, tarjeta “App móvil · Expo 55 + React Native”: “Expo Router”, “Cuentas · Movimientos · Pagos · Reportes”, “TanStack Query + caché persistente”, “SecureStore + filesystem”, “Supabase SDK · Auth + Realtime”, “Validación y recodificación de imágenes”, “Notificaciones locales”, “Sentry con sanitización”.
Zona 3, tarjeta “finanzas-api · Render”: “Hono + Node.js 22”, “Finance · Reports · Gmail”, “Receipts/Capture · Push · Support”, “JWT Supabase”, “RLS context”, “Rate limiting”, “Sentry + logs”.
Zona 3, tarjeta “fint-ai-worker · Cloudflare”: “POST /extract”, “JWT → JWKS público”, “KV: JWKS + límites”, “AI Gateway fint”, “Workers AI · Llama 4 Scout”, “Imagen efímera · no se almacena”, “/chat: reservado, no activo”.
Zona 4, grupo “Supabase”: “Auth”, “PostgreSQL + RLS”, “Realtime”, “Vault”, “pg_cron + pg_net”.
Zona 4, servicios: “Google OAuth + Gmail API”, “Google Pub/Sub”, “Upstash Redis”, “Expo Push Service”, “Sentry”.
Connections: flecha sólida “HTTPS + JWT” de app a finanzas-api; flecha sólida “imagen sanitizada + JWT” de app a fint-ai-worker; flecha sólida “extracción JSON” de Worker a app; flecha sólida “captura normalizada” de app a API; API a PostgreSQL + RLS; app a Supabase Auth; Realtime a app; Worker a JWKS, KV, AI Gateway y Workers AI; app a Google Sign-In y API a Gmail API; Gmail API a Pub/Sub y Pub/Sub a API; pg_cron + pg_net a endpoints internos de API con “cron secret”; API a Upstash; API a Expo Push y Expo Push al dispositivo; app y API a Sentry.
Legend: “Sólida: llamada síncrona” y “Punteada: evento / job / Realtime”.
Constraints: mantener las zonas y límites inequívocos; usar flechas con origen y destino visibles; conservar exactamente los nombres técnicos; texto grande y nítido; mostrar captura como flujo efímero; no inventar servicios.
Avoid: flechas cruzadas innecesarias, texto microscópico, párrafos largos, efectos 3D, fotorealismo, logotipos deformados, marcas de agua, almacenamiento de imágenes, /chat activo, Worker de jobs en Render.
```

- [ ] **Step 2: Inspeccionar visualmente el borrador**

Comprobar a resolución original:

- El título y los cuatro límites de zona son legibles.
- `finanzas-api` y `fint-ai-worker` son tarjetas separadas.
- La imagen viaja app → Worker y la extracción vuelve Worker → app → API.
- Supabase inicia los jobs mediante `pg_cron` + `pg_net`.
- Gmail API y Pub/Sub son componentes distintos.
- `/chat` dice “reservado, no activo”.
- No existe ninguna flecha que sugiera persistencia de la imagen.

- [ ] **Step 3: Corregir un único grupo de defectos si la inspección falla**

Emitir una edición dirigida que mantenga composición, paleta y contenido correcto, cambiando solo textos ilegibles, flechas erróneas o componentes omitidos identificados en Step 2.

- [ ] **Step 4: Guardar la versión validada**

Copiar la salida seleccionada a `docs/architecture/fint-runtime-architecture-2026-08.png`, o al primer nombre versionado libre si ya existe.

- [ ] **Step 5: Confirmar integridad del archivo**

Abrir el PNG guardado a resolución original y confirmar que no está truncado, que el formato es panorámico y que el texto principal sigue legible.

### Task 2: Diagrama de infraestructura y despliegue

**Files:**
- Create: `docs/architecture/fint-infrastructure-2026-08.png`
- Reference: `docs/superpowers/specs/2026-08-24-diagramas-arquitectura-design.md`

**Interfaces:**
- Consumes: repositorios, plataformas de build, runtimes y servicios administrados verificados.
- Produces: PNG panorámico de infraestructura y despliegue.

- [ ] **Step 1: Generar el primer borrador con ImageGen**

Usar este prompt exacto como base:

```text
Use case: infographic-diagram
Asset type: diagrama técnico de infraestructura y despliegue para documentación de proyecto
Primary request: crear un diagrama C4 simplificado, horizontal y profesional titulado “Fint — Infraestructura y despliegue · Agosto 2026”. Todo el texto debe estar en español y ser legible.
Scene/backdrop: lienzo 16:9 con fondo azul petróleo oscuro, cuadrícula técnica muy sutil y amplio espaciado.
Style/medium: infografía vectorial limpia renderizada como PNG, tarjetas claras, bordes redondeados discretos, acento verde menta y colores secundarios coherentes por proveedor.
Composition/framing: cinco columnas conectadas de izquierda a derecha: “Código fuente”, “Build y despliegue”, “Runtime administrado”, “Datos e integraciones”, “Observabilidad”. Colocar una franja inferior discreta “Infraestructura periférica”.
Text (verbatim):
Columna 1: “finanzas-mobilev2”, “finanzas-api”, “fint-ai-worker”.
Columna 2: “EAS Build / Update”, “TypeScript build + migraciones”, “Wrangler deploy”.
Columna 3: “Android / iOS”, “Render · finanzas-api”, “Cloudflare Workers · fint-ai-worker”.
Dentro de Cloudflare: “KV”, “AI Gateway fint”, “Workers AI”.
Columna 4, grupo “Supabase”: “Auth”, “PostgreSQL + RLS”, “Realtime”, “Vault”, “pg_cron”, “pg_net”.
Columna 4, grupo “Google Cloud”: “OAuth”, “Gmail API”, “Pub/Sub”.
Columna 4, servicios: “Upstash Redis”, “Expo Push Service”.
Columna 5: “Sentry móvil”, “Sentry backend”, “Logs estructurados · Render”.
Franja inferior: “myfint.app · Vercel”, “Cloudflare Worker myfint-well-known”, “/.well-known/* · Android App Links”, “Featurebase”, “Páginas legales”.
Connections: cada repositorio a su pipeline y su runtime; API build ejecuta migraciones hacia Supabase PostgreSQL; Render API se conecta a Supabase, Google Cloud, Upstash, Expo Push y Sentry; Worker se conecta a Supabase JWKS público, KV, AI Gateway y Workers AI; `pg_cron` + `pg_net` invocan endpoints internos de Render; app distribuida se conecta a Render API, Supabase Auth/Realtime y Cloudflare Worker; Vercel sirve myfint.app; myfint-well-known atiende solo `/.well-known/*` para Android App Links.
Legend: “Sólida: despliegue o dependencia” y “Punteada: job / evento / telemetría”.
Constraints: separar claramente repositorio, pipeline y runtime; infraestructura periférica visualmente secundaria; nombres técnicos exactos; texto grande y nítido; no mostrar procesos futuros como activos.
Avoid: mezclar EAS con Render, colocar finanzas-api dentro de Cloudflare, colocar fint-ai-worker dentro de Render, mostrar un job worker separado, exceso de logotipos, párrafos largos, texto microscópico, fotorealismo, marcas de agua.
```

- [ ] **Step 2: Inspeccionar visualmente el borrador**

Comprobar a resolución original:

- Cada repositorio llega a su pipeline y runtime correctos.
- Render contiene únicamente `finanzas-api`.
- Cloudflare contiene `fint-ai-worker`, KV, AI Gateway y Workers AI.
- Supabase contiene datos, Auth, Realtime, Vault y scheduling.
- La franja periférica es secundaria y no parece parte del camino principal.
- Telemetría y logs terminan en sus destinos correctos.

- [ ] **Step 3: Corregir un único grupo de defectos si la inspección falla**

Emitir una edición dirigida que mantenga composición, paleta y contenido correcto, cambiando solo textos ilegibles, conexiones erróneas o agrupaciones incorrectas identificadas en Step 2.

- [ ] **Step 4: Guardar la versión validada**

Copiar la salida seleccionada a `docs/architecture/fint-infrastructure-2026-08.png`, o al primer nombre versionado libre si ya existe.

- [ ] **Step 5: Confirmar integridad del archivo**

Abrir el PNG guardado a resolución original y confirmar que no está truncado, que el formato es panorámico y que el texto principal sigue legible.

### Task 3: Verificación y entrega

**Files:**
- Verify: `docs/architecture/fint-runtime-architecture-2026-08.png`
- Verify: `docs/architecture/fint-infrastructure-2026-08.png`
- Modify: `docs/superpowers/plans/2026-08-24-diagramas-arquitectura.md`

**Interfaces:**
- Consumes: ambos PNG validados.
- Produces: entregables finales verificables y plan marcado como completado.

- [ ] **Step 1: Comparar las imágenes con los criterios de aceptación**

Revisar cada criterio del documento de diseño y registrar cualquier incumplimiento antes de declarar la tarea completa.

- [ ] **Step 2: Comprobar archivos y dimensiones**

Listar ambos archivos, confirmar formato PNG, dimensiones horizontales y tamaño mayor que cero.

- [ ] **Step 3: Marcar las tareas completadas en este plan**

Cambiar únicamente los checkboxes realmente verificados de `- [ ]` a `- [x]`.

- [ ] **Step 4: Revisar el diff**

Ejecutar `git diff --check` y confirmar que solo existen el plan actualizado y los dos PNG esperados.

- [ ] **Step 5: Crear el commit de artefactos**

Ejecutar:

```text
git add -- docs/superpowers/plans/2026-08-24-diagramas-arquitectura.md docs/architecture/fint-runtime-architecture-2026-08.png docs/architecture/fint-infrastructure-2026-08.png
git commit -m "docs: agregar diagramas actualizados de arquitectura"
```

