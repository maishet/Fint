# Politica De Seguridad

## Versiones Compatibles

Durante la etapa pre-release, las correcciones de seguridad se aplican a la rama `main` y a la version mas reciente distribuida para pruebas.

## Reportar Una Vulnerabilidad

No abras un issue publico para vulnerabilidades, credenciales expuestas o problemas que permitan acceder a datos de otras personas.

Usa el formulario privado de [GitHub Security Advisories](https://github.com/maishet/finanzas-mobilev2/security/advisories/new) e incluye:

- Descripcion del problema y su posible impacto.
- Pasos minimos para reproducirlo.
- Version, plataforma y entorno afectados.
- Evidencia sin tokens, correos ni datos financieros reales.
- Mitigacion propuesta, si existe.

El mantenedor confirmara la recepcion, evaluara el impacto y coordinara la divulgacion despues de que exista una correccion. Si el formulario privado no esta disponible, contacta al mantenedor desde su [perfil de GitHub](https://github.com/maishet) sin publicar detalles sensibles.

## Alcance Prioritario

- Autenticacion, sesiones y recuperacion de cuentas.
- Acceso indebido a informacion financiera.
- Exposicion de tokens de Supabase, Gmail u otros proveedores.
- Bypass de confirmacion para movimientos sugeridos.
- Exportaciones PDF o Excel que revelen datos de otra cuenta.
- Deep links que permitan saltar controles de acceso.
