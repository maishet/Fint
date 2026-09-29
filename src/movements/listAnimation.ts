import { LayoutAnimation, type LayoutAnimationConfig } from "react-native";

/**
 * Movimientos: animaciones de la lista (`FlashList`). Con `LayoutAnimation` y `prepareForLayoutAnimationRender`, que es
 * lo que documenta FlashList v2; las animaciones de layout de Reanimated no se llevan bien con el reciclado de filas.
 */

/** Al cambiar de filtro: las filas que salen o entran se desvanecen y las que quedan se reacomodan. */
export const FILTER_ANIMATION: LayoutAnimationConfig = {
  duration: 260,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.86 },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

/** Al eliminar o revertir: la fila colapsa su altura y las de abajo suben. */
export const REMOVE_ANIMATION: LayoutAnimationConfig = {
  duration: 300,
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.86 },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleY },
};
