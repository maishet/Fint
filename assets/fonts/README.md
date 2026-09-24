# Fuentes del proyecto

Tres familias, todas de Google Fonts con licencia SIL Open Font License 1.1. Son estáticas, un archivo por peso, porque Android no resuelve bien los pesos de una fuente variable.

| Familia | Archivos | Uso |
| --- | --- | --- |
| Schibsted Grotesk (`display`) | `SchibstedGrotesk-SemiBold.ttf`, `SchibstedGrotesk-Bold.ttf` | Marca, títulos de pantalla y de sección. |
| Geist (`sans`) | `Geist-Regular.ttf`, `Geist-Medium.ttf`, `Geist-SemiBold.ttf` | Cuerpo, etiquetas, botones y navegación. |
| Geist Mono (`mono`) | `GeistMono-Regular.ttf`, `GeistMono-Medium.ttf`, `GeistMono-SemiBold.ttf` | Toda cifra: montos, saldos, porcentajes, fechas y ejes. |

Se registran en `src/theme/typography.ts` (`fontFiles`) y se cargan en `app/_layout.tsx` con `useFonts(fontFiles)`. En Tamagui son `$heading`, `$body` y `$mono`.

## Uso

```tsx
<Paragraph fontFamily="$heading">Flujo semanal</Paragraph>
<Paragraph fontFamily="$body">Gasto del mes</Paragraph>
<Amount value={-84.5} currency="PEN" variant="amount" />   // cifras: siempre con Amount
```

Los archivos `Inter_*.ttf` ya no se cargan y se pueden borrar cuando termine la migración.
