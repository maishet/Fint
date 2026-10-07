# Fuentes del proyecto

Dos familias, ambas con licencia SIL Open Font License 1.1 (textos en `OFL-Figtree.txt` y `OFL-IBMPlexSans.txt`). Son estáticas, un archivo por peso, porque Android no resuelve bien los pesos de una fuente variable. Los archivos son los oficiales, sin modificar: Figtree de [erikdkennedy/figtree](https://github.com/erikdkennedy/figtree) e IBM Plex Sans del release `@ibm/plex-sans@1.1.0` de [IBM/plex](https://github.com/IBM/plex).

| Familia | Archivos | Uso |
| --- | --- | --- |
| Figtree (`display`) | `Figtree-SemiBold.ttf`, `Figtree-Bold.ttf` | Marca, títulos de pantalla y de sección. |
| Figtree (`sans`) | `Figtree-Regular.ttf`, `Figtree-Medium.ttf`, `Figtree-SemiBold.ttf` | Cuerpo, etiquetas, botones y navegación. |
| IBM Plex Sans (`mono`) | `IBMPlexSans-Regular.ttf`, `IBMPlexSans-Medium.ttf`, `IBMPlexSans-SemiBold.ttf` | Toda cifra: montos, saldos, porcentajes, fechas y ejes. |

La familia de las cifras conserva el nombre `mono` aunque Plex no es monoespaciada: sus dígitos sí son tabulares de fábrica (todos miden 0.6em), así los montos quedan alineados en columna y un monto que cambia no hace saltar la fila. El punto, el espacio fino y el símbolo de la moneda miden menos que un dígito; `AmountDisplay` los ubica con eso en cuenta.

Se registran en `src/theme/typography.ts` (`fontFiles`) y se cargan en `app/_layout.tsx` con `useFonts(fontFiles)`. En Tamagui son `$heading`, `$body` y `$mono`.

## Uso

```tsx
<Paragraph fontFamily="$heading">Flujo semanal</Paragraph>
<Paragraph fontFamily="$body">Gasto del mes</Paragraph>
<Amount value={-84.5} currency="PEN" variant="amount" />   // cifras: siempre con Amount
```

Los archivos `Inter_*.ttf` ya no se cargan y se pueden borrar cuando termine la migración.
