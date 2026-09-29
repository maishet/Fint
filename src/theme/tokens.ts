import { Easing, type WithSpringConfig, type WithTimingConfig } from "react-native-reanimated";

/** Espaciado del sistema. El padding lateral de pantalla es `space[4]`; las secciones se separan con `space[6]`. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;

/** Radios. Tarjetas `lg`, botones `md`, losa y hojas `xl`, barra de tabs `2xl`. No hay esquinas vivas. */
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, "2xl": 36, pill: 999 } as const;

/** Opacidades de estado. */
export const opacity = { idle: 0.38, disabled: 0.42, press: 0.88 } as const;

/** Sombras en sintaxis `boxShadow` (React Native 0.76+). */
export const shadows = {
  light: {
    card: "0 1px 2px rgba(20,23,43,0.03)",
    raised: "0 2px 10px rgba(20,23,43,0.07)",
    float: "0 6px 20px rgba(20,23,43,0.10)",
    sheet: "0 -6px 30px rgba(20,23,43,0.12)",
  },
  dark: {
    card: "0 1px 2px rgba(0,0,0,0.40)",
    raised: "0 2px 6px rgba(0,0,0,0.50)",
    float: "0 8px 28px rgba(0,0,0,0.60)",
    sheet: "0 -8px 40px rgba(0,0,0,0.64)",
  },
} as const;

/**
 * Las cinco curvas. Solo existen estas: no inventes una sexta y no uses
 * `Easing.linear` en nada que la persona toque.
 */
export const motion = {
  /** Resorte por defecto, sin rebote: cambios de estado, aparición de tarjetas, cierre de hojas. */
  springUi: { damping: 26, stiffness: 240, mass: 1 } satisfies WithSpringConfig,
  /** Lo que viene de un gesto y merece inercia. Pásale `velocity` del gesto. */
  springGesture: { damping: 18, stiffness: 220, mass: 0.9 } satisfies WithSpringConfig,
  /** Hojas y modales que suben desde abajo. */
  springSheet: { damping: 20, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  /** Solo el feedback de presión. Única duración fija permitida. */
  press: { duration: 100, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  /** Opacidad pura, sin desplazamiento. */
  fade: { duration: 180, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
} as const;

/** Escala a la que baja todo lo tocable al presionar. */
export const pressScale = 0.97;
