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
/** En `immediate`, cuánto hay que deslizar para que al soltar se ejecute la acción. */
const IMMEDIATE_THRESHOLD = 72;

/** La fila abierta en este momento, en toda la app: al abrir otra, la anterior se cierra. */
let openRow: SwipeableMethods | null = null;

export interface SwipeAction {
  key: string;
  label: string;
  /** Icono de 18px, ya con su color (`$ink` en `neutral`, `$onDanger` en `danger`). */
  icon: ReactNode;
  /**
   * `neutral` (Editar, Descartar) en `surfaceSunken`; `danger` (Eliminar, Revertir) en `dangerHard`;
   * `brand` (Confirmar un pendiente) en `brand`, con el icono en `$onBrand`.
   */
  tone: "neutral" | "danger" | "brand";
  run: () => void;
}

const toneBg = { neutral: "$surfaceSunken", danger: "$dangerHard", brand: "$brand" } as const;
const toneInk = { neutral: "$ink", danger: "$onDanger", brand: "$onBrand" } as const;

/**
 * Deslizar a la izquierda muestra las acciones de la fila, de 78px cada una.
 * La fila sigue al dedo; pasado el ancho de las acciones resiste con goma y, si
 * se suelta lejos, ejecuta la acción de la derecha (que igual pide
 * confirmación). Sin acciones, devuelve la fila tal cual.
 *
 * Las mismas acciones hay que ofrecerlas al lector de pantalla en la fila
 * (`accessibilityActions`): el gesto no es la única vía.
 */
export function SwipeActions({
  actions,
  leftActions = [],
  radius,
  immediate = false,
  children,
}: {
  actions: readonly SwipeAction[];
  /**
   * Acciones al deslizar a la derecha (Por revisar: Confirmar). Un deslizamiento
   * largo ejecuta la de la izquierda, igual que el lado derecho.
   */
  leftActions?: readonly SwipeAction[];
  /** Esquinas redondeadas, para una tarjeta suelta en lugar de una fila de grupo. */
  radius?: number;
  /**
   * Deslizar ejecuta la acción al soltar (una por lado), sin dejarla revelada
   * para tocarla: Por revisar, donde deslizar confirma o descarta. Además, con
   * acciones en los dos lados el contenedor de las de la derecha tapa a las de
   * la izquierda y no se podrían tocar.
   */
  immediate?: boolean;
  children: ReactNode;
}) {
  const swipe = useRef<SwipeableMethods>(null);
  const translation = useRef<SharedValue<number> | null>(null);
  const actionsWidth = actions.length * ACTION_W;
  const leftWidth = leftActions.length * ACTION_W;

  if (actions.length === 0 && leftActions.length === 0) return <>{children}</>;

  const renderActions = (list: readonly SwipeAction[], width: number) => (_progress: SharedValue<number>, drag: SharedValue<number>) => {
    translation.current = drag;
    return (
      <XStack width={width}>
        {list.map((a) => (
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
            <YStack flex={1} items="center" justify="center" gap={4} bg={toneBg[a.tone]}>
              {a.icon}
              <FText variant="caption" color={toneInk[a.tone] as ColorTokens} style={{ fontFamily: fontFace.sans[600] }}>
                {a.label}
              </FText>
            </YStack>
          </Pressable>
        ))}
      </XStack>
    );
  };

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1}
      overshootRight={actions.length > 0}
      overshootLeft={leftActions.length > 0}
      overshootFriction={6}
      rightThreshold={immediate ? IMMEDIATE_THRESHOLD : actionsWidth / 2}
      leftThreshold={immediate ? IMMEDIATE_THRESHOLD : leftWidth / 2}
      containerStyle={radius ? { borderRadius: radius, overflow: "hidden" } : undefined}
      renderRightActions={actions.length ? renderActions(actions, actionsWidth) : undefined}
      renderLeftActions={leftActions.length ? renderActions(leftActions, leftWidth) : undefined}
      onSwipeableWillOpen={() => {
        // Un deslizamiento largo ejecuta la acción del borde (con su confirmación, si la pide) y la fila vuelve.
        const drag = translation.current?.value ?? 0;
        if (immediate) {
          const action = drag > 0 ? leftActions[0] : actions[actions.length - 1];
          swipe.current?.close();
          if (action) {
            haptics.tap();
            action.run();
          }
          return;
        }
        if (actions.length && drag < -(actionsWidth + LONG_SWIPE)) {
          haptics.warning();
          swipe.current?.close();
          actions[actions.length - 1].run();
          return;
        }
        if (leftActions.length && drag > leftWidth + LONG_SWIPE) {
          haptics.tap();
          swipe.current?.close();
          leftActions[0].run();
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
