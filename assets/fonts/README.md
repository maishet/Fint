# Fuentes del Proyecto

## Requeridas

### Inter
- Descargar desde: https://fonts.google.com/specimen/Inter
- Variantes necesarias:
  - `Inter_18pt-Regular.ttf` (400)
  - `Inter_18pt-Medium.ttf` (500)
  - `Inter_24pt-SemiBold.ttf` (600)
  - `Inter_28pt-Bold.ttf` (700)

## Configuracion Actual

Las fuentes ya estan configuradas en `tamagui.config.ts` y se cargan en `app/_layout.tsx` desde esta carpeta.

`Inter` se usa en titulos, cuerpo, formularios, navegacion, numeros, importes y graficos para mantener una identidad consistente con Fint web.

## Instalación

1. Descargar los archivos .ttf de Google Fonts
2. Colocar en esta carpeta (`assets/fonts/`)
3. Las fuentes se cargan automaticamente al iniciar la app

## Uso en componentes

```tsx
<Paragraph fontFamily="$heading">Mi titulo</Paragraph>
<Paragraph fontFamily="$body">$1,234.56</Paragraph>
```
