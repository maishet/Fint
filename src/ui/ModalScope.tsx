import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { View } from "react-native";
import { holdModal, isModalHeld, subscribeModalHeld } from "./modalHold";

/** Mientras `active`, la hoja cuenta como modal: el fondo se oculta para el lector de pantalla. */
export function useHoldModal(active: boolean) {
  useEffect(() => (active ? holdModal() : undefined), [active]);
}

/**
 * Envuelve la app (no el portal de las hojas ni de los avisos, que viven al lado): con una hoja abierta, el
 * lector de pantalla no llega al fondo. `importantForAccessibility` es de Android y `accessibilityElementsHidden`
 * de iOS. `collapsable={false}` para que la vista no se aplane y cambie de estructura al abrir una hoja.
 */
export function ModalScope({ children }: { children: ReactNode }) {
  const modalOpen = useSyncExternalStore(subscribeModalHeld, isModalHeld, isModalHeld);
  return (
    <View
      style={{ flex: 1 }}
      collapsable={false}
      importantForAccessibility={modalOpen ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={modalOpen}
    >
      {children}
    </View>
  );
}
