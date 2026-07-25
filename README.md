# Fint MVP Mobile v2

Aplicacion mobile nueva para finanzas personales, creada desde cero con Expo Router y Tamagui usando el template oficial `expo-router`.

## Stack

- Expo SDK 55
- React Native 0.83
- Expo Router
- Tamagui 2 con `defaultConfig` de `@tamagui/config/v5`
- Supabase Auth
- TanStack Query
- i18next ES/EN/PT
- EAS Build

## Configuracion

1. Copia `.env.example` a `.env` y configura Supabase/API.
2. Permite el deep link `finanzasmobilev2://auth/callback` en Supabase Auth URL Configuration.
3. Ejecuta `bun install` si faltan dependencias.

## Scripts

- `bun run start`: inicia Expo con cache limpia.
- `bun run typecheck`: valida TypeScript.
- `bun run build:web`: export web.

## Alcance Inicial

La app queda preparada con login/registro, Google OAuth, tabs de dashboard/cuentas/movimientos/deudas, formularios base y cliente API contra `finanzas-api` mediante Bearer token de Supabase.

## Licencia

Software propietario. Consulta `LICENSE`; el acceso al repositorio no concede derechos de uso, modificacion o distribucion.
