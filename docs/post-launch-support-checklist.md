# Checklist de soporte posterior al lanzamiento

Usar este checklist durante las primeras 48 horas y luego semanalmente mientras Fint tenga usuarios activos.

## Cada día durante las primeras 48 horas

1. Revisar alertas nuevas o regresiones de `fint-mobile` y `fint-api` en Sentry.
2. Confirmar que el monitor de `https://finanzas-api-ansq.onrender.com/healthz` sigue activo.
3. Revisar correos recibidos en `support@myfint.app` y responder o clasificar cada solicitud.
4. Revisar logs de Render por errores repetidos, rate limits y timeouts. Usar `request_id` para investigar sin copiar datos personales o financieros.
5. Revisar errores de Gmail: reconexión requerida, fallos de sync y renovación de watch.

## Clasificación de solicitudes

| Severidad | Ejemplos | Acción inicial |
| --- | --- | --- |
| Crítica | Exposición o pérdida de datos, acceso a otra cuenta, app inutilizable para todos | Detener rollout, investigar Sentry y Render, informar al propietario. |
| Alta | Login, saldos, Gmail o movimientos fallan para varios usuarios | Priorizar corrección, preparar hotfix y comunicar alternativa. |
| Media | Una función falla con alternativa disponible | Registrar, reproducir con cuenta QA y planificar corrección. |
| Baja | Texto, visual o sugerencia | Registrar para siguiente ciclo. |

## Respuesta de soporte

1. Solicitar solo pantalla afectada, pasos, fecha aproximada y versión de la app.
2. No solicitar contraseñas, tokens, códigos de autenticación, correos Gmail, montos, saldos ni documentos financieros.
3. Reproducir con la cuenta QA y datos ficticios antes de acceder a logs.
4. Comunicar estado o alternativa; si hay un hotfix, confirmar la versión que lo contiene.
5. Convertir problemas repetidos en una prueba automatizada antes de cerrar el incidente.

## Revisión semanal

1. Revisar frecuencia de crashes por versión en Sentry.
2. Revisar tiempos de respuesta y errores del API en Render.
3. Revisar la ejecución de renovación Gmail en Supabase Cron.
4. Confirmar que la política, términos y eliminación de cuenta siguen respondiendo `200`.
5. Revisar el límite de usuarios y estado de verificación OAuth si Gmail sigue publicado sin verificación.
