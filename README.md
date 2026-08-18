<div align="center">
  <img src="assets/images/readme-hero.svg" width="100%" alt="My Fint, tu panorama financiero claro" />

  <p><strong>Organiza cuentas, movimientos, deudas y reportes personales sin perder el control de tus datos.</strong></p>

  <p>
    <a href="https://github.com/maishet/Fint/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-2f89b8?style=flat-square" alt="Apache License 2.0" /></a>
    <a href="https://expo.dev"><img src="https://img.shields.io/badge/Expo-SDK%2055-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 55" /></a>
    <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/React%20Native-0.83-20232a?style=flat-square&logo=react&logoColor=61dafb" alt="React Native 0.83" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.9" /></a>
    <img src="https://img.shields.io/badge/status-pre--release-54b9e8?style=flat-square" alt="Pre-release" />
  </p>

  <p>
    <a href="#producto">Producto</a> ·
    <a href="#arquitectura">Arquitectura</a> ·
    <a href="#comenzar">Comenzar</a> ·
    <a href="#contribuir">Contribuir</a> ·
    <a href="https://github.com/maishet/Fint/issues">Issues</a>
  </p>
</div>

---

## Producto

My Fint ayuda a construir una vision completa de las finanzas personales desde el telefono. Reune la actividad diaria, la posicion financiera y los reportes de cierre en una experiencia enfocada, accesible y disponible en varios idiomas.

| Organiza | Comprende | Actua |
| --- | --- | --- |
| Cuentas, saldos, movimientos, categorias y deudas. | Dashboard, comparaciones, tendencias y desglose por cuenta o categoria. | Registra operaciones, confirma sugerencias y exporta reportes en PDF o Excel. |

### Capacidades

- **Control financiero:** ingresos, gastos, transferencias, cuentas, categorias y deudas.
- **Reportes accionables:** filtros temporales, comparaciones, evolucion, posicion actual y movimientos destacados.
- **Exportacion portable:** documentos PDF y archivos Excel generados directamente en el dispositivo.
- **Gmail opcional:** deteccion de movimientos pendientes con filtros definidos por el usuario y confirmacion obligatoria.
- **Acceso seguro:** sesiones administradas con Supabase Auth, con Google OAuth y Sign in with Apple en iOS.
- **Experiencia localizada:** interfaz disponible en espanol, ingles y portugues.
- **Tema adaptable:** modos claro y oscuro con un sistema visual ocean-blue.
- **Notificaciones push:** recordatorios de pagos proximos y avisos de movimientos pendientes detectados.
- **Privacidad visual:** oculta montos sensibles en pantalla con un control rapido, util en espacios compartidos.

> [!IMPORTANT]
> My Fint es una herramienta de organizacion financiera personal. No ofrece asesoramiento financiero, bancario, tributario ni de inversion.

## Arquitectura

```mermaid
flowchart LR
    A[Expo mobile app] -->|Supabase session| B[Supabase Auth]
    A -->|Bearer token| C[My Fint API]
    C --> D[(Supabase Postgres)]
    C --> E[Gmail API]
    C --> F[Financial report DTO]
    F --> A
    A --> G[PDF and Excel exports]
```

La aplicacion movil mantiene la presentacion y las interacciones en Expo. La API privada concentra las reglas de negocio y entrega un DTO canonico que alimenta la vista de reportes y sus exportaciones.

### Stack principal

| Capa | Tecnologia |
| --- | --- |
| Mobile | Expo SDK 55, React Native 0.83, Expo Router |
| UI | Tamagui 2, React Native SVG, Reanimated |
| Datos | TanStack Query, Zod, API HTTP privada |
| Identidad | Supabase Auth, Google OAuth, Sign in with Apple, Secure Store |
| Idiomas | i18next, espanol, ingles y portugues |
| Observabilidad | Sentry con sanitizacion de datos sensibles |
| Entrega | EAS Build, Android App Bundle y APK interno, IPA de iOS |

### Estructura

```text
app/                  Rutas y pantallas de Expo Router
src/analytics/        Definicion de eventos permitidos para analitica
src/api/              Cliente HTTP, contratos y mappers
src/auth/             Sesion, autenticacion y rutas iniciales
src/components/       Componentes reutilizables del producto
src/finance/          Reglas financieras, reportes y exportaciones
src/forms/            Validacion y utilidades de formularios
src/i18n/             Configuracion y traducciones
src/monitoring/       Sanitizacion de datos sensibles para Sentry
src/notifications/    Registro y copy de notificaciones push
src/privacy/          Ocultar y mostrar montos sensibles en pantalla
src/providers/        Composicion de providers de la aplicacion
src/support/          Diagnosticos adjuntos a los reportes de soporte
src/theme/            Tema, tipografia y preferencias visuales
src/ui/               Primitivas del sistema de interfaz
tests/unit/           Pruebas unitarias
```

## Comenzar

### Requisitos

- [Bun 1.3.9](https://bun.sh/)
- [Node.js 22](https://nodejs.org/) para builds EAS
- [Expo](https://docs.expo.dev/) y un Android Emulator, un dispositivo Android o un iPhone
- Para builds de iOS: una cuenta de Apple Developer Program y las credenciales descritas en `docs/ios-build-setup.md`
- Un proyecto Supabase y acceso a una instancia compatible de la API de My Fint

### Instalacion

```bash
git clone https://github.com/maishet/Fint.git finanzas-mobilev2
cd finanzas-mobilev2
bun install --frozen-lockfile
```

Crea `.env` a partir de [`.env.example`](.env.example):

```env
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://your-domain.com/privacy
EXPO_PUBLIC_TERMS_URL=https://your-domain.com/terms
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` es obligatorio para compilar iOS: de el se deriva el URL scheme
que devuelve el control a la app tras el consentimiento de Google. Sin ese valor,
`bun run build:production:ios` falla de forma explicita en lugar de generar un IPA con el login roto.

Configura `finanzasmobilev2://auth/callback` como URL de redireccionamiento en Supabase Auth.

> [!CAUTION]
> Las variables `EXPO_PUBLIC_*` se incluyen en el cliente. Nunca guardes en ellas service-role keys, tokens privados ni secretos de servidor.

### Desarrollo

| Comando | Descripcion |
| --- | --- |
| `bun run start` | Inicia Expo y limpia la cache de Metro. |
| `bun run android` | Compila y ejecuta la aplicacion en Android. |
| `bun run ios` | Compila y ejecuta la aplicacion en iOS. |
| `bun run typecheck` | Valida el proyecto con TypeScript. |
| `bun run test` | Ejecuta las pruebas unitarias. |
| `bun run test:coverage` | Ejecuta las pruebas unitarias con cobertura. |
| `bunx expo-doctor` | Revisa la compatibilidad del proyecto Expo. |
| `bun run build:preview:android` | Genera un APK para pruebas internas. |
| `bun run build:production:android` | Genera un AAB para Google Play. |
| `bun run build:preview:ios` | Genera un IPA ad hoc para dispositivos registrados con `eas device:create`. |
| `bun run build:production:ios` | Genera un IPA de distribucion para App Store Connect y TestFlight. |

## Estado Del Proyecto

El proyecto esta en fase pre-release: el nucleo funcional (cuentas, movimientos, deudas, reportes, Gmail opcional) esta operativo y en pulido continuo antes del lanzamiento publico. El roadmap y los pendientes se siguen en las [Issues](https://github.com/maishet/Fint/issues) del repositorio.

## Contribuir

Las contribuciones que mejoren la calidad, accesibilidad, privacidad o experiencia financiera de My Fint son bienvenidas. Antes de comenzar un cambio grande, abre un [issue](https://github.com/maishet/Fint/issues) para acordar el alcance.

Lee [CONTRIBUTING.md](CONTRIBUTING.md) para conocer el flujo de trabajo, las validaciones requeridas y los terminos aplicables a las contribuciones.

## Contribuidores

<a href="https://github.com/maishet/Fint/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=maishet/Fint" alt="Contribuidores de My Fint" />
</a>

Las contribuciones aparecen automaticamente cuando GitHub actualiza el historial publico del repositorio.

## Seguridad Y Privacidad

My Fint maneja informacion financiera sensible. No publiques vulnerabilidades, credenciales ni datos personales en issues abiertos. Consulta [SECURITY.md](SECURITY.md) para reportar un problema de forma responsable.

La integracion de Gmail es opcional y no crea movimientos de manera automatica. Toda sugerencia requiere confirmacion explicita del usuario.

## Licencia

El codigo de este repositorio se distribuye bajo la [Apache License 2.0](LICENSE).

```text
Copyright 2026 Cristhofer Moises Ventura Villanueva
```

Apache 2.0 permite usar, modificar y distribuir el codigo, incluye una concesion expresa de patentes y exige conservar los avisos aplicables. La licencia no concede derechos sobre los nombres, logotipos o marcas de My Fint.

---

<div align="center">
  <sub>Construido con Expo, React Native y una obsesion saludable por la claridad financiera.</sub>
</div>
