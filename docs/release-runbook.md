# Runbook de release mobile

## Proposito

Usar este procedimiento para cada APK preview, closed test y release productivo de Fint. No ejecutar un build productivo ni publicar en Google Play sin aprobacion explicita del propietario.

## Responsables

| Responsabilidad | Responsable |
| --- | --- |
| Aprobar release, revisar alertas y decidir rollback | Propietario de Fint |
| Build EAS, validacion tecnica y documentacion | Equipo de desarrollo |
| Soporte a usuarios | `soporte.fint@gmail.com` |

## Antes de construir

1. Confirmar que `main` contiene los cambios que se desean probar.
2. Ejecutar las validaciones locales:

```bash
bun run typecheck
bun run test
bunx expo-doctor
```

3. Confirmar variables EAS del entorno elegido:
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SENTRY_DSN`
   - `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
   - `EXPO_PUBLIC_TERMS_URL`
   - `SENTRY_AUTH_TOKEN` solo como secreto de EAS.
4. Confirmar que las URLs legales responden sin autenticacion:

```bash
bun -e "for(const path of ['/privacy','/terms','/account-deletion','/support']){const res=await fetch('https://fint-web.vercel.app'+path); console.log(path+'='+res.status)}"
```

## Preview Android

Generar un APK interno:

```bash
bun run build:preview:android
```

Instalar el APK desde el enlace de EAS y verificar en un dispositivo Android real:

1. Registro e inicio de sesion por correo.
2. Restauracion de sesion despues de cerrar y abrir la app.
3. Configuracion > Legal: Privacidad y Terminos abren las URLs publicas correctas.
4. Crear, editar y eliminar una cuenta de prueba.
5. Registrar, editar y eliminar un ingreso y un gasto de prueba.
6. Crear un pago recurrente y registrar un pago.
7. Gmail es opcional y no crea movimientos sin confirmacion.
8. Modo claro y oscuro; texto ampliado y navegacion basica con TalkBack.

Registrar el ID del build, enlace de descarga, dispositivo y resultado en el issue o registro de release.

## Closed Test

Antes de subir el AAB a Play Console:

1. Completar App content: politica de privacidad, eliminacion de cuenta, Data safety, anuncios, audiencia, content rating y declaracion financiera.
2. Crear credenciales QA sin datos personales ni financieros reales.
3. Preparar nombre, descripcion, capturas y correo de soporte.
4. Confirmar que Google OAuth mantiene el callback de Supabase y que Gmail `readonly` sigue siendo opcional.
5. Revisar alertas de Sentry y disponibilidad de `/healthz`.

## Produccion

Solo despues de aprobar el closed test y los puntos anteriores:

```bash
bun run build:production:android
```

1. Subir el AAB a un track de prueba cerrada antes de produccion.
2. Revisar el resumen de cambios, versionCode y Data safety en Play Console.
3. Usar un rollout gradual para la primera publicacion.
4. Vigilar Sentry, uptime y correo de soporte durante las primeras 48 horas.

## Respuesta a incidentes

1. Clasificar el incidente: bloqueo de inicio de sesion, perdida o exposicion de datos, crash frecuente, pagos incorrectos o degradacion no critica.
2. Para posible exposicion de datos o movimientos incorrectos, detener el rollout de Play Console y deshabilitar la integracion afectada si es necesario.
3. Revisar el issue en Sentry y los logs de Render usando el `request_id`; no copiar datos financieros, correos ni tokens a tickets o chats.
4. Si el problema esta en la API, desplegar el ultimo commit sano en Render y verificar `/healthz`.
5. Si el problema esta en mobile, corregirlo y publicar un build con versionCode superior. Google Play no permite reemplazar un AAB ya distribuido.
6. Informar al propietario, documentar impacto, mitigacion y seguimiento. Convertir regresiones confirmadas en pruebas automatizadas antes de cerrarlas.

## Criterio de salida

Un release queda listo para avanzar solo cuando las validaciones automaticas pasan, la prueba del APK preview esta documentada, las URLs legales funcionan dentro de la app, no hay alertas criticas abiertas y el propietario aprueba el siguiente track.
