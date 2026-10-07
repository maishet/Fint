import { readFile, writeFile } from 'node:fs/promises'

// Parches sobre @tamagui/sheet (2.7.7). Cada sustitucion es idempotente: se salta si su `marker` ya esta en el
// archivo, para que el script sobreviva a reinstalaciones y a upgrades parciales de la libreria.
//
// --- 1. Tiron de la lista que cierra la hoja (comportamiento) -----------------
// Sintoma: en una hoja con lista desplazable (categorias), con la lista al final, un tiron hacia abajo para volver
// arriba sube la lista hasta el tope y la hoja se cierra.
//
// Causa, en dos partes:
// a. Con la hoja arriba y el dedo bajando, en cuanto la lista llega a scrollY === 0 el pan se apodera del gesto
//    (`gs.scrollEngaged && hasScrollableContent` -> `panHandles = true`). Un umbral de distancia no alcanza: un tiron
//    largo lo supera y conserva la velocidad.
// b. Al soltar, `onEnd` solo deja la hoja arriba si la lista sigue desplazada (`scrollBridge.y > 0`). Tras el tiron la
//    lista ya esta en 0, asi que proyecta la posicion con la velocidad del dedo y cierra la hoja aunque nunca se haya
//    movido. Medido en el A54: el pan decidio `panHandles = false` en todo el gesto y la hoja igual se cerro.
//
// Arreglo: un gesto que empezo con la lista desplazada solo mueve la lista, y al soltar la hoja se queda arriba. Para
// arrastrarla (o cerrarla) hay que empezar un gesto nuevo con la lista ya arriba.
//
// --- 2. Hoja fantasma (bug) ----------------------------------------------------
// Sintoma: en una hoja con lista desplazable, despues de hacer scroll la hoja se cierra logicamente (open=false: el
// overlay se desmonta y el frame recibe pointerEvents:none) pero el frame sigue pintado en pantalla, inerte, hasta que
// se desmonta la pantalla completa.
//
// Causa: el pan corre en simultaneo con el ScrollView y comparte un unico gestureStateRef mutable. Su onFinalize
// decide si limpiar el estado de arrastre segun gs.panStarted, bandera que onBegin resetea. Si un toque nuevo entra en
// onBegin antes de que finalice el gesto anterior, setIsDragging(false) nunca corre e isDragging queda pegado en true.
// A partir de ahi SheetImplementationCustom bloquea la animacion de cierre (`if (isDraggingRef.current) return`) y su
// efecto de rescate abandona porque ya esta cerrado (`|| !open`), asi que animateTo() nunca corre.
//
// Arreglo: onFinalize limpia una bandera propia que onBegin no toca (un finalize perdido lo repara el siguiente
// gesto), y el cierre nunca queda bloqueado por un arrastre pegado ni abandonado si el arrastre termina despues.

const targets = [
  {
    files: [
      'dist/esm/useGestureHandlerPan.native.js',
      'dist/esm/useGestureHandlerPan.mjs',
      'dist/cjs/useGestureHandlerPan.cjs',
      'dist/cjs/useGestureHandlerPan.native.js',
      'dist/jsx/useGestureHandlerPan.native.js',
      'dist/jsx/useGestureHandlerPan.mjs',
    ],
    replacements: [
      {
        // 1. onBegin recuerda si el gesto empezo con la lista desplazada.
        marker: 'gs.beganScrolled = gs.scrollEngaged;',
        find: 'gs.scrollEngaged = currentScrollY > 0;',
        replace: 'gs.scrollEngaged = currentScrollY > 0; gs.beganScrolled = gs.scrollEngaged;',
      },
      {
        // 1. Con la hoja arriba y el dedo bajando: si el gesto empezo desplazado, manda el scroll aunque llegue al tope.
        marker: 'gs.beganScrolled && hasScrollableContent',
        find: '} else if (gs.scrollEngaged && hasScrollableContent) {',
        replace:
          '} else if (gs.beganScrolled && hasScrollableContent) { panHandles = false; } else if (gs.scrollEngaged && hasScrollableContent) {',
      },
      {
        // 1. Al soltar: si el gesto empezo desplazado, la hoja vuelve (o se queda) arriba, sin proyectar la velocidad.
        marker: '(scrollBridge.y > 0 || gs.beganScrolled)',
        find: 'if (currentPos <= snapMinY + AT_TOP_THRESHOLD && scrollBridge.y > 0) {',
        replace: 'if (currentPos <= snapMinY + AT_TOP_THRESHOLD && (scrollBridge.y > 0 || gs.beganScrolled)) {',
      },
      {
        // 2. onStart marca el arrastre en una bandera que onBegin no resetea.
        marker: 'gs.dragNotified = true',
        find: 'gs.panStarted = true;',
        replace: 'gs.panStarted = true; gs.dragNotified = true;',
      },
      {
        // 2. onFinalize limpia segun esa bandera, no segun la compartida panStarted.
        marker: 'if (gs.dragNotified) {',
        find: 'if (gs.panStarted) {',
        replace: 'if (gs.dragNotified) { gs.dragNotified = false;',
      },
    ],
  },
  {
    files: [
      'dist/esm/SheetImplementationCustom.native.js',
      'dist/esm/SheetImplementationCustom.mjs',
      'dist/cjs/SheetImplementationCustom.cjs',
      'dist/cjs/SheetImplementationCustom.native.js',
      'dist/jsx/SheetImplementationCustom.native.js',
      'dist/jsx/SheetImplementationCustom.mjs',
    ],
    replacements: [
      {
        // 2. Un arrastre en curso manda mientras la hoja esta abierta, nunca al cerrar.
        marker: 'isDraggingRef.current && open) return;',
        find: 'if (isDraggingRef.current) return;',
        replace: 'if (isDraggingRef.current && open) return;',
      },
      {
        // 2. Un arrastre pegado bloqueaba tambien la animacion de APERTURA: el overlay se montaba (open=true) pero el
        // frame se quedaba fuera de pantalla, una hoja invisible imposible de recuperar. Al abrir no hay nada
        // arrastrando: se limpia la bandera en la transicion. El open anterior se guarda como propiedad de
        // isDraggingRef para no depender de anclas de declaracion, que difieren entre las variantes esm/cjs.
        marker: 'isDraggingRef.wasOpen',
        find: 'if (isDraggingRef.current && open) return;',
        replace: [
          'if (open !== isDraggingRef.wasOpen) {',
          '      isDraggingRef.wasOpen = open;',
          '      if (open && isDraggingRef.current) setIsDragging(false);',
          '    }',
          '    if (isDraggingRef.current && open) return;',
        ].join('\n'),
      },
      {
        // 2. Red principal contra la bandera pegada: limpiarla al CERRAR, para que el siguiente render nazca limpio
        // (si se limpiara solo al abrir, activePositions seguiria siendo el memo congelado de ese render y animateTo
        // abortaria en `at.current === toValue`).
        marker: 'if (!open && isDraggingRef.current) setIsDragging(false);',
        find: 'if (!open && isKeyboardVisible) {',
        replace: ['if (!open && isDraggingRef.current) setIsDragging(false);', '    if (!open && isKeyboardVisible) {'].join(
          '\n',
        ),
      },
      {
        // 2. Si el arrastre termina despues del cierre, igual hay que animar la salida.
        marker: 'isHidden) return;',
        find: 'if (!frameSize || !screenSize || isHidden || !open) return;',
        replace: 'if (!frameSize || !screenSize || isHidden) return;',
      },
    ],
  },
]

let patched = 0
let missing = 0
let total = 0

for (const { files, replacements } of targets) {
  for (const relative of files) {
    total += 1
    const file = new URL(`../node_modules/@tamagui/sheet/${relative}`, import.meta.url)
    let source

    try {
      source = await readFile(file, 'utf8')
    } catch {
      missing += 1
      continue
    }

    const original = source

    for (const { marker, find, replace } of replacements) {
      if (source.includes(marker)) continue

      const occurrences = source.split(find).length - 1

      if (occurrences !== 1) {
        throw new Error(`Unexpected @tamagui/sheet source shape in ${relative}: found ${occurrences} occurrences of ${find}`)
      }

      source = source.replace(find, replace)
    }

    if (source === original) continue

    await writeFile(file, source)
    patched += 1
  }
}

if (missing === total) process.exit(0)

if (patched) console.log(`Patched @tamagui/sheet fixes (${patched} files)`)
