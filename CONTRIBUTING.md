# Contribuir A Fint

Gracias por considerar una contribucion a Fint. Buscamos cambios pequenos, claros y faciles de revisar que preserven la privacidad y la calidad de la experiencia financiera.

## Antes De Empezar

- Revisa los issues existentes para evitar trabajo duplicado.
- Abre un issue antes de implementar funcionalidades grandes o cambios de arquitectura.
- No incluyas credenciales, tokens, correos, datos financieros reales ni archivos `.env`.
- Para vulnerabilidades de seguridad, sigue `SECURITY.md` en lugar de abrir un issue publico.

## Entorno Local

```bash
git clone https://github.com/maishet/finanzas-mobilev2.git
cd finanzas-mobilev2
bun install --frozen-lockfile
```

Copia `.env.example` como `.env` y usa credenciales exclusivas de desarrollo.

## Flujo De Trabajo

1. Crea una rama desde `main` con un nombre descriptivo.
2. Implementa un cambio enfocado y agrega pruebas cuando modifiques comportamiento.
3. Ejecuta las validaciones locales.
4. Actualiza la documentacion cuando cambien configuracion, contratos o experiencia de usuario.
5. Abre un pull request explicando el problema, la solucion y como fue validada.

## Validaciones

```bash
bun run typecheck
bun run test
bunx expo-doctor
```

Para cambios visuales, valida al menos un dispositivo Android y adjunta capturas o un video corto al pull request.

## Pull Requests

- Mantiene el alcance pequeno y evita refactors no relacionados.
- Describe cualquier impacto en privacidad, autenticacion, reportes o integraciones.
- No modifica contratos de API sin documentar la compatibilidad requerida.
- No reemplaza decisiones de marca o producto sin discusion previa.
- Confirma que no se agregaron secretos ni datos personales al historial.

## Licencia De Las Contribuciones

Al enviar una contribucion para incorporarla al proyecto, aceptas que se distribuya bajo la Apache License 2.0, conforme a la seccion 5 de dicha licencia, salvo que declares expresamente lo contrario por escrito antes de su envio.
