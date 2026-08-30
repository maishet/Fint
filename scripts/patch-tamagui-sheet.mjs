import { readFile, writeFile } from 'node:fs/promises'

// Parches sobre @tamagui/sheet (presentes hasta 2.7.7 y tambien en la beta 3.0).
// Cada sustitucion es idempotente por separado: se salta si su `marker` ya esta
// en el archivo, para que el script sobreviva a upgrades parciales de la libreria.
//
// --- 1. Sheet fantasma (bug) -------------------------------------------------
// Sintoma: en un Sheet con Sheet.ScrollView y contenido desplazable, despues de
// hacer scroll el sheet se cierra logicamente (open=false: el overlay se desmonta
// y el frame recibe pointerEvents:none) pero el frame sigue pintado en pantalla,
// inerte, hasta que se desmonta la pantalla completa.
//
// Causa: el gesto pan corre en simultaneo con el ScrollView y comparte un unico
// gestureStateRef mutable. Su onFinalize decide si limpiar el estado de arrastre
// segun gs.panStarted, bandera que onBegin resetea. Si un toque nuevo entra en
// onBegin antes de que finalice el gesto anterior, setIsDragging(false) nunca
// corre e isDragging queda pegado en true. A partir de ahi
// SheetImplementationCustom bloquea la animacion de cierre
// (`if (isDraggingRef.current) return`) y su efecto de rescate abandona porque ya
// esta cerrado (`|| !open`), asi que animateTo() nunca corre.
//
// Arreglo: onFinalize limpia una bandera propia que onBegin no toca (de modo que
// un finalize perdido lo repare el siguiente gesto), y el cierre nunca queda
// bloqueado por un arrastre pegado ni abandonado si el arrastre termina despues.
//
// --- 2. Traspaso pan/scroll sin umbral hacia abajo (comportamiento) ----------
// Sintoma: al hacer scroll arriba y abajo repetidamente dentro del sheet, este
// se mueve o parpadea, como si interpretara que quieres cerrarlo.
//
// Causa: al llegar la lista a scrollY === 0 y seguir arrastrando hacia abajo, el
// pan se apodera del gesto de inmediato, sin ningun umbral. Medido en un A54: el
// sheet baja 351px en ~1.2s de gesto y acaba cerrandose, aunque el usuario solo
// estuviera volviendo al principio de la lista. Cada traspaso ademas fuerza un
// scrollTo que sacude el contenido. La direccion contraria si tiene umbral
// (SCROLL_HANDOFF_THRESHOLD, via gs.upwardDragAfterTop): es una asimetria.
//
// Arreglo: replicar esa misma mecanica hacia abajo. Tras tocar el tope hay que
// seguir arrastrando SCROLL_HANDOFF_THRESHOLD px antes de que el pan tome el
// sheet, y el contador se reinicia en cuanto la lista vuelve a scrollear, de modo
// que los cruces incidentales nunca lo acumulan.

const targets = [
  {
    files: [
      'dist/esm/useGestureHandlerPan.native.js',
      'dist/esm/useGestureHandlerPan.mjs',
      'dist/cjs/useGestureHandlerPan.cjs',
      'dist/cjs/useGestureHandlerPan.native.js',
    ],
    replacements: [
      {
        // onStart marca el arrastre en una bandera que onBegin no resetea.
        marker: 'gs.dragNotified = true',
        find: 'gs.panStarted = true;',
        replace: 'gs.panStarted = true; gs.dragNotified = true;',
      },
      {
        // onFinalize limpia segun esa bandera, no segun la compartida panStarted.
        marker: 'if (gs.dragNotified) {',
        find: 'if (gs.panStarted) {',
        replace: 'if (gs.dragNotified) { gs.dragNotified = false;',
      },
      {
        // onBegin reinicia el acumulador de arrastre hacia abajo.
        marker: 'gs.downwardDragAfterTop = 0; gs.upwardDragAfterTop',
        find: 'gs.upwardDragAfterTop = 0;',
        replace: 'gs.downwardDragAfterTop = 0; gs.upwardDragAfterTop = 0;',
      },
      {
        // Umbral simetrico para el traspaso hacia abajo.
        marker: 'gs.downwardDragAfterTop >=',
        find: /if \(nodeIsScrolling && hasScrollableContent\) \{\s*panHandles = false;\s*\} else if \(gs\.scrollEngaged && hasScrollableContent\) \{\s*panHandles = true;\s*\} else \{\s*panHandles = true;\s*\}/,
        replace: [
          'if (nodeIsScrolling && hasScrollableContent) {',
          '            gs.downwardDragAfterTop = 0;',
          '            panHandles = false;',
          '          } else if (gs.scrollEngaged && hasScrollableContent) {',
          '            gs.downwardDragAfterTop += Math.max(0, deltaY);',
          '            panHandles = gs.downwardDragAfterTop >= SCROLL_HANDOFF_THRESHOLD;',
          '          } else {',
          '            panHandles = true;',
          '          }',
        ].join('\n'),
      },
    ],
  },
  {
    files: [
      'dist/esm/SheetImplementationCustom.native.js',
      'dist/esm/SheetImplementationCustom.mjs',
      'dist/cjs/SheetImplementationCustom.cjs',
      'dist/cjs/SheetImplementationCustom.native.js',
    ],
    replacements: [
      {
        // Un arrastre en curso manda mientras el sheet esta abierto, nunca al cerrar.
        marker: 'isDraggingRef.current && open) return;',
        find: 'if (isDraggingRef.current) return;',
        replace: 'if (isDraggingRef.current && open) return;',
      },
      {
        // Un arrastre pegado bloqueaba tambien la animacion de APERTURA: el overlay
        // se montaba (open=true) pero el frame se quedaba fuera de pantalla, dando un
        // sheet invisible imposible de recuperar (no se puede gesticular sobre algo
        // que no se ve, asi que la auto-reparacion de dragNotified nunca llegaba).
        // Al abrir no hay nada arrastrando: se limpia la bandera en la transicion.
        // Se guarda el open anterior como propiedad de isDraggingRef para no depender
        // de anclas de declaracion, que difieren entre las variantes esm/cjs.
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
        // Red principal contra la bandera pegada: limpiarla al CERRAR. Al cerrar, el
        // root de RNGH colapsa a height 0 y el gesto en vuelo puede perder su
        // onEnd/onFinalize, dejando isDragging en true para siempre. Limpiarlo aqui
        // hace que el siguiente render nazca limpio, que es lo que importa: si se
        // limpiara solo al abrir, activePositions seguiria siendo el memo congelado
        // de ese render (`if (isDragging || isDraggingRef.current) return
        // activePositionsRef.current`) y animateTo abortaria en `at.current === toValue`.
        marker: 'if (!open && isDraggingRef.current) setIsDragging(false);',
        find: 'if (!open && isKeyboardVisible) {',
        replace: [
          'if (!open && isDraggingRef.current) setIsDragging(false);',
          '    if (!open && isKeyboardVisible) {',
        ].join('\n'),
      },
      {
        // Si el arrastre termina despues del cierre, igual hay que animar la salida.
        marker: 'isHidden) return;',
        find: 'if (!frameSize || !screenSize || isHidden || !open) return;',
        replace: 'if (!frameSize || !screenSize || isHidden) return;',
      },
    ],
  },
]

function countMatches(source, find) {
  if (typeof find === 'string') return source.split(find).length - 1
  const flags = find.flags.includes('g') ? find.flags : `${find.flags}g`
  return (source.match(new RegExp(find.source, flags)) || []).length
}

let patched = 0
let missing = 0
let total = 0

for (const target of targets) {
  for (const relative of target.files) {
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

    for (const { marker, find, replace } of target.replacements) {
      if (source.includes(marker)) continue

      const occurrences = countMatches(source, find)

      if (occurrences !== 1) {
        throw new Error(
          `Unexpected @tamagui/sheet source shape in ${relative}: found ${occurrences} occurrences of ${find}`,
        )
      }

      source = source.replace(find, replace)
    }

    if (source === original) continue

    await writeFile(file, source)
    patched += 1
  }
}

if (missing === total) process.exit(0)

if (patched) console.log(`Patched @tamagui/sheet sheet-gesture fixes (${patched} files)`)
