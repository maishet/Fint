import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { X } from "@tamagui/lucide-icons-2";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack, useTheme } from "tamagui";
import { useSheetBackHandler } from "../hooks/useSheetBackHandler";
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
  /** Alturas fijas. Sin ellas la hoja toma el alto de su contenido. */
  snapPoints?: (string | number)[];
  children: ReactNode;
}

/**
 * Hoja inferior del sistema. Sube con `spring-sheet` sobre el velo `scrim`, en
 * `surfaceOverlay` con esquinas `radius-xl` y manija de 38x5. Se cierra
 * arrastrando, tocando el velo, con el botón de la cabecera o con "atrás" en
 * Android. En oscuro lleva un filete `line` arriba porque la sombra no se ve.
 *
 * Todo lo que se elige dentro de un formulario se elige en una de estas.
 */
export function FintSheet({ open, onClose, title, subtitle, headerAction, scrollable = false, snapPoints, children }: FintSheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const animationConfigs = useBottomSheetSpringConfigs(motion.springSheet);

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  useSheetBackHandler(open, onClose);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        pressBehavior="close"
        style={[props.style, { backgroundColor: theme.scrim.val }]}
      />
    ),
    [theme.scrim.val],
  );

  const header =
    title || headerAction ? (
      <XStack items="center" justify="space-between" gap={space[3]} pt={4} pl={space[5]} pr={space[4]}>
        <YStack flex={1} minW={0}>
          {title ? (
            <FText variant="title" accessibilityRole="header" numberOfLines={1}>
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

  const Container = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      animationConfigs={animationConfigs}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: theme.surfaceOverlay.val,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        borderTopWidth: themeMode === "dark" ? 1 : 0,
        borderColor: theme.line.val,
        boxShadow: shadows[themeMode].sheet,
      }}
      handleIndicatorStyle={{ width: 38, height: 5, backgroundColor: theme.lineStrong.val, opacity: 0.45 }}
    >
      <Container contentContainerStyle={scrollable ? { paddingBottom: insets.bottom + 26 } : undefined} style={scrollable ? undefined : { paddingBottom: insets.bottom + 26 }}>
        {header}
        {children}
      </Container>
    </BottomSheetModal>
  );
}

/**
 * Relleno hundido dentro de una hoja (buscador, campo). En oscuro,
 * `surfaceSunken` y `surfaceOverlay` casi no se distinguen, así que lleva
 * además un filete `line` de 1px.
 */
export function SheetField({ children, focused = false }: { children: ReactNode; focused?: boolean }) {
  const { themeMode } = useThemeMode();
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

/** Campo de texto para usar dentro de `FintSheet`: sube con el teclado sin tapar la hoja. */
export function SheetTextInput(props: TextInputProps) {
  const theme = useTheme();
  return (
    <BottomSheetTextInput
      placeholderTextColor={theme.inkFaint.val}
      selectionColor={theme.brand.val}
      {...props}
      style={[textStyles.body, { flex: 1, color: theme.ink.val, paddingVertical: 12 }, props.style]}
    />
  );
}
