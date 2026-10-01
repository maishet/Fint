/**
 * Cuántas hojas modales hay abiertas ahora. Las hojas se dibujan en el portal de Tamagui, fuera de la app: para
 * el lector de pantalla el fondo sigue ahí, detrás, y se puede recorrer. `ModalScope` oculta el fondo mientras
 * este contador no esté en cero.
 */
let held = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Marca una hoja como abierta. Devuelve quien la suelta; soltarla dos veces no resta dos. */
export function holdModal(): () => void {
  held += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held -= 1;
    emit();
  };
}

export function isModalHeld(): boolean {
  return held > 0;
}

export function subscribeModalHeld(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
