export const ONBOARDING_SLIDES = ["welcome", "accounts", "payments", "privacy", "notifications"] as const;
const SLIDE_COUNT = ONBOARDING_SLIDES.length;
export type OnboardingSlide = (typeof ONBOARDING_SLIDES)[number];

export type OnboardingAction = "start" | "next" | "enableNotifications" | "finish";

/**
 * El botón principal de cada paso: "Comenzar" en la bienvenida, "Siguiente" en
 * las del medio y, en la última, "Activar notificaciones" hasta que la persona
 * responda (aceptar, rechazar o "Ahora no"); después, "Entrar a My Fint".
 */
export function primaryAction(index: number, pushAnswered: boolean): OnboardingAction {
  const last = ONBOARDING_SLIDES.length - 1;
  if (index <= 0) return "start";
  if (index < last) return "next";
  return pushAnswered ? "finish" : "enableNotifications";
}

/** El paso al que se llega con un desplazamiento horizontal: el más cercano, dentro del rango. */
export function slideAt(offsetX: number, width: number): number {
  "worklet";
  if (width <= 0) return 0;
  return Math.min(SLIDE_COUNT - 1, Math.max(0, Math.round(offsetX / width)));
}
