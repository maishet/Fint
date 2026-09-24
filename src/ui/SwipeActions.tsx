import { useRef, type ReactNode } from "react";
import { Pressable } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import { XStack, YStack, type ColorTokens } from "tamagui";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";
import { haptics } from "./haptics";

/** Cada acción revelada mide 78px. */
const ACTION_W = 78;
/** Cuánto más allá de las acciones hay que deslizar para ejecutar la de la derecha. */
const LONG_SWIPE = 56;

/** La fila abierta en este momento, en toda la app: al abrir otra, la anterior se cierra. */
let openRow: SwipeableMethods | null = null;

export interface SwipeAction {
  key: string;
  label: string;
  /** Icono de 18px, ya con su color (`$ink` en `neutral`, `$onDanger` en `danger`). */
  icon: ReactNode;
  /** `neutral` (Editar) en `surfaceSunken`; `danger` (Eliminar, Revertir) en `dangerHard`. */
  tone: "neutral" | "danger";
  run: () => void;
}

/**
 * Deslizar a la izquierda muestra las acciones de la fila, de 78px cada una.
 * La fila sigue al dedo; pasado el ancho de las acciones resiste con goma y, si
 * se suelta lejos, ejecuta la acción de la derecha (que igual pide
 * confirmación). Sin acciones, devuelve la fila tal cual.
 *
 * Las mismas acciones hay que ofrecerlas al lector de pantalla en la fila
 * (`accessibilityActions`): el gesto no es la única vía.
 */
export function SwipeActions({ actions, children }: { actions: readonly SwipeAction[]; children: ReactNode }) {
  const swipe = useRef<SwipeableMethods>(null);
  const translation = useRef<SharedValue<number> | null>(null);
  const actionsWidth = actions.length * ACTION_W;

  if (actions.length === 0) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1}
      overshootRight
      overshootFriction={6}
      rightThreshold={actionsWidth / 2}
      renderRightActions={(_progress, drag) => {
        translation.current = drag;
        return (
          <XStack width={actionsWidth}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                style={{ width: ACTION_W }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => {
                  haptics.tap();
                  swipe.current?.close();
                  a.run();
                }}
              >
                <YStack flex={1} items="center" justify="center" gap={4} bg={a.tone === "danger" ? "$dangerHard" : "$surfaceSunken"}>
                  {a.icon}
                  <FText
                    variant="caption"
                    color={(a.tone === "danger" ? "$onDanger" : "$ink") as ColorTokens}
                    style={{ fontFamily: fontFace.sans[600] }}
                  >
                    {a.label}
                  </FText>
                </YStack>
              </Pressable>
            ))}
          </XStack>
        );
      }}
      onSwipeableWillOpen={() => {
        // Un deslizamiento largo ejecuta la acción de la derecha (con su confirmación) y la fila vuelve.
        const drag = translation.current?.value ?? 0;
        if (drag < -(actionsWidth + LONG_SWIPE)) {
          haptics.warning();
          swipe.current?.close();
          actions[actions.length - 1].run();
          return;
        }
        haptics.select();
        if (openRow && openRow !== swipe.current) openRow.close();
        openRow = swipe.current;
      }}
      onSwipeableClose={() => {
        if (openRow === swipe.current) openRow = null;
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
