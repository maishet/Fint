/**
 * Con lector de pantalla, un toast con acción ("Deshacer", "Ya lo pagué") dura al menos esto: llegar al toast con
 * el foco del lector y activarlo toma más de los 4-5 s de siempre (WCAG 2.2.1, tiempo ajustable).
 */
export const SCREEN_READER_ACTION_MS = 20_000;

/** Lo que dura un toast: lo pedido, salvo que tenga acción y haya lector de pantalla activo. */
export function toastDuration(requested: number | undefined, hasAction: boolean, screenReaderOn: boolean): number | undefined {
  if (!hasAction || !screenReaderOn) return requested;
  return Math.max(requested ?? 0, SCREEN_READER_ACTION_MS);
}

/** Lo que se anuncia al aparecer: título, detalle y, si la hay, el nombre de la acción. */
export function toastAnnouncement(title: string, message?: string, actionLabel?: string): string {
  return [title, message, actionLabel].filter(Boolean).join(". ");
}
