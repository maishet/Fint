import { X } from "@tamagui/lucide-icons-2";
import { useContext, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, useWindowDimensions, type TextInputProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet, XStack, YStack, useTheme } from "tamagui";
import { useSheetBackHandler } from "../hooks/useSheetBackHandler";
import { SensitiveAmountsContext } from "../privacy/SensitiveAmountsProvider";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, shadows, space } from "../theme/tokens";
import { textStyles } from "../theme/typography";
import { FText } from "./FText";
import { IconButton } from "./IconButton";
import { PressableScale } from "./PressableScale";

export interface FintSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /**
   * Acción de texto a la derecha de la cabecera en lugar del botón de cerrar,
   * por ejemplo "Listo" en la hoja de Nota, donde el teclado ocupa la mitad de abajo.
   */
  headerAction?: { label: string; onPress: () => void };
  /** Contenido largo (lista de categorías, lugares): se desplaza dentro de la hoja. */
  scrollable?: boolean;
  /** Alto fijo en porcentaje de la pantalla (por ejemplo `[78]`). Sin él, la hoja toma el alto de su contenido. */
  snapPoints?: number[];
  /** `compact` (18px) para hojas de menú como "¿Qué quieres registrar?"; `title` (22px) para las del formulario. */
  titleSize?: "title" | "compact";
  /** Sin arrastre para cerrar: la hoja lleva un mapa que se arrastra. Se cierra con el velo, la X o "atrás". */
  disableDrag?: boolean;
  children: ReactNode;
}

/**
 * Hoja inferior del sistema, sobre el `Sheet` de Tamagui (el mismo que ya usa
 * la app). Sube con `spring-sheet` sobre el velo `scrim`, en `surfaceOverlay`
 * con esquinas `radius-xl` y manija de 38x5. Se cierra arrastrando, tocando el
 * velo, con el botón de la cabecera o con "atrás" en Android. En oscuro lleva
 * un filete `line` arriba porque la sombra no se ve.
 *
 * Todo lo que se elige dentro de un formulario se elige en una de estas.
 */
export function FintSheet({
  open,
  onClose,
  title,
  subtitle,
  headerAction,
  scrollable = false,
  snapPoints,
  titleSize = "title",
  disableDrag = false,
  children,
}: FintSheetProps) {
  const { themeMode } = useThemeMode();
  // Con "reducir movimiento" la hoja aparece en su lugar, sin subir; el velo sigue entrando con fade.
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  // La hoja se dibuja en el portal de Tamagui, fuera de los proveedores de la app: se vuelve a proveer
  // "Ocultar montos" para que un `Amount` dentro de la hoja lo respete.
  const sensitiveAmounts = useContext(SensitiveAmountsContext);

  useSheetBackHandler(open, onClose);

  const header =
    title || headerAction ? (
      <XStack items="center" justify="space-between" gap={space[3]} pt={4} pl={space[5]} pr={space[4]}>
        <YStack flex={1} minW={0}>
          {title ? (
            <FText
              variant="title"
              accessibilityRole="header"
              numberOfLines={1}
              style={titleSize === "compact" ? { fontSize: 18, lineHeight: 23, letterSpacing: -0.3 } : undefined}
            >
              {title}
            </FText>
          ) : null}
          {subtitle ? (
            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
              {subtitle}
            </FText>
          ) : null}
        </YStack>
        {headerAction ? (
          <PressableScale onPress={headerAction.onPress} hitSlop={10} accessibilityRole="button">
            <FText variant="body-strong" tone="brand">
              {headerAction.label}
            </FText>
          </PressableScale>
        ) : (
          <IconButton label={t("actions.close")} tone="sunken" size={34} icon={<X size={16} color="$inkMuted" strokeWidth={2.2} />} onPress={onClose} />
        )}
      </XStack>
    ) : null;

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      snapPointsMode={snapPoints ? "percent" : "fit"}
      snapPoints={snapPoints}
      dismissOnSnapToBottom
      disableDrag={disableDrag}
      moveOnKeyboardChange
      zIndex={110_000}
      transitionConfig={reduceMotion ? { type: "direct" } : { type: "spring", ...motion.springSheet }}
    >
      <Sheet.Overlay bg="$scrim" transition="quick" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      {/*
        El marco de Tamagui queda transparente y el aspecto va en la capa de adentro: la cubierta que Tamagui pone
        bajo la hoja copia las props del marco (esquinas, filete, sombra) y al estirar la hoja hacia arriba se veía
        como una segunda hoja cortada. En su lugar, la capa lleva debajo su propia extensión lisa.
      */}
      <Sheet.Frame bg="transparent" overflow="visible" disableHideBottomOverflow>
        <YStack
          flex={snapPoints ? 1 : undefined}
          bg="$surfaceOverlay"
          borderTopWidth={themeMode === "dark" ? 1 : 0}
          borderColor="$line"
          pb={Math.max(insets.bottom, 16) + 10}
          style={{
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            boxShadow: shadows[themeMode].sheet,
          }}
        >
          <YStack self="center" width={38} height={5} rounded={999} bg="$lineStrong" opacity={0.45} mt={8} mb={4} />
          {header}
          <SensitiveAmountsContext.Provider value={sensitiveAmounts}>
            {scrollable ? <Sheet.ScrollView showsVerticalScrollIndicator={false}>{children}</Sheet.ScrollView> : children}
          </SensitiveAmountsContext.Provider>
          {/* Al estirar la hoja más allá de su alto, esto cubre lo que queda debajo. Va al final para tapar la sombra. */}
          <YStack position="absolute" t="100%" l={0} r={0} height={height} bg="$surfaceOverlay" pointerEvents="none" />
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

/**
 * Relleno hundido dentro de una hoja (buscador, campo). En oscuro,
 * `surfaceSunken` y `surfaceOverlay` casi no se distinguen, así que lleva
 * además un filete `line` de 1px.
 */
export function SheetField({ children, focused = false, invalid = false }: { children: ReactNode; focused?: boolean; invalid?: boolean }) {
  const { themeMode } = useThemeMode();
  // Con error, borde `dangerHard` de 1.5px aunque tenga el foco: el error se ve hasta que la persona corrige.
  if (invalid) {
    return (
      <XStack minH={48} px={14} gap={10} items="center" rounded={radius.md} bg="$surfaceSunken" borderWidth={1.5} borderColor="$dangerHard">
        {children}
      </XStack>
    );
  }
  return (
    <XStack
      minH={48}
      px={14}
      gap={10}
      items="center"
      rounded={radius.md}
      bg={focused ? "$surface" : "$surfaceSunken"}
      borderWidth={focused ? 1.5 : 1}
      borderColor={focused ? "$brand" : themeMode === "dark" ? "$line" : "$surfaceSunken"}
    >
      {children}
    </XStack>
  );
}

/** Campo de texto para usar dentro de `FintSheet` (la hoja sube con el teclado). */
/** Acepta `ref` (React 19 lo pasa como prop) para poder darle el foco al abrir la hoja. */
export function SheetTextInput(props: TextInputProps & { ref?: Ref<TextInput> }) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.inkFaint.val}
      selectionColor={theme.brand.val}
      {...props}
      style={[textStyles.body, { flex: 1, color: theme.ink.val, paddingVertical: 12 }, props.style]}
    />
  );
}
