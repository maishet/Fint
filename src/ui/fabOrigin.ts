/**
 * Dónde está el botón central de la barra, en coordenadas de ventana. Lo mide
 * `FintTabBar` y lo lee el formulario de movimiento para crecer desde ahí.
 */
export interface FabOrigin {
  x: number;
  y: number;
  size: number;
}

let origin: FabOrigin | null = null;

export function setFabOrigin(next: FabOrigin) {
  origin = next;
}

export function getFabOrigin(): FabOrigin | null {
  return origin;
}
