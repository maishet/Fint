import { Check, ChevronRight, Sun } from "@tamagui/lucide-icons-2";
import { Children, Fragment, type ReactNode } from "react";
import { Image, useWindowDimensions } from "react-native";
import { Text, View, XStack, YStack } from "tamagui";
import { COMPACT_FONT_SCALE, opacity, radius, space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { FintSheet, FText, PressableScale } from "../ui";
import { initials } from "./logic";

type LucideIcon = typeof Sun;

/** Título de un grupo (marca D, F-10): 13 en `inkFaint`, seminegrita, con el margen de la pantalla. */
export function GroupTitle({ children }: { children: string }) {
  return (
    <FText
      tone="inkFaint"
      accessibilityRole="header"
      maxFontSizeMultiplier={1.5}
      style={{ fontFamily: fontFace.display[700], fontSize: 13, lineHeight: 18, marginTop: 22, marginBottom: 2, marginHorizontal: space[5] }}
    >
      {children}
    </FText>
  );
}

/** Un grupo de filas a todo el ancho sobre `canvas` (sin tarjeta), separadas por un filete `line`. */
export function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <YStack mx={space[5]}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? <View height={1} bg="$line" /> : null}
          {item}
        </Fragment>
      ))}
    </YStack>
  );
}

/**
 * Fila de Ajustes (marca D, F-10): icono Lucide en un cuadro `surface` de 40,
 * etiqueta a 16 (con una línea chica debajo si hace falta), el valor actual en
 * `inkMuted` y, a la derecha, un chevron, un interruptor o nada. Ningún icono va
 * en color; `danger` pinta etiqueta e icono en `dangerHard` y `dim` los apaga
 * (`opacity-disabled`). Desde `COMPACT_FONT_SCALE` el valor baja debajo de la
 * etiqueta y los textos se parten en varias líneas.
 */
export function Item({
  icon: Icon,
  label,
  detail,
  value,
  valueMono = false,
  right = "chevron",
  tone = "default",
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  value?: string;
  valueMono?: boolean;
  right?: "chevron" | "none" | ReactNode;
  tone?: "default" | "danger" | "dim";
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const color = tone === "danger" ? "$dangerHard" : "$inkMuted";
  const dim = tone === "dim" ? opacity.disabled : 1;
  const valueText = value ? (
    <Text
      color="$inkMuted"
      numberOfLines={stacked ? undefined : 1}
      style={valueMono ? { ...textStyles["amount-sm"], fontFamily: fontFace.mono[600], fontSize: 14 } : { ...textStyles.body, fontFamily: fontFace.sans[600], fontSize: 14 }}
    >
      {value}
    </Text>
  ) : null;
  const row = (
    <XStack minH={62} py={11} gap={12} items="center">
      <View width={40} height={40} rounded={14} bg="$surface" items="center" justify="center" opacity={dim} self={stacked ? "flex-start" : "center"}>
        <Icon size={20} color={color as never} strokeWidth={2} />
      </View>
      <YStack flex={1} minW={0} gap={2} opacity={dim}>
        <FText tone={tone === "danger" ? "dangerHard" : "ink"} numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
          {label}
        </FText>
        {detail ? (
          <FText tone="inkFaint" numberOfLines={stacked ? undefined : 2} style={{ fontSize: 13, lineHeight: 18 }}>
            {detail}
          </FText>
        ) : null}
        {stacked ? valueText : null}
      </YStack>
      {stacked ? null : valueText}
      {right === "chevron" ? <ChevronRight size={18} color="$inkFaint" strokeWidth={2} /> : right === "none" ? null : right}
    </XStack>
  );
  if (!onPress) return row;
  return (
    <PressableScale
      scaleTo={1}
      dim
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
    >
      {row}
    </PressableScale>
  );
}

/** Avatar: la foto de Google si hay; si no, las iniciales en tinta sobre el amarillo de la marca. */
export function Avatar({ name, photoUrl, size }: { name: string; photoUrl?: string | null; size: number }) {
  if (photoUrl)
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View width={size} height={size} rounded={999} bg="$slab" items="center" justify="center">
      <Text color="$slabInk" allowFontScaling={false} style={{ fontFamily: fontFace.display[700], fontSize: Math.round(size * 0.34) }}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** Hoja de opciones de una sola elección (idioma, apariencia): la elegida va sobre `surfaceSunken` con el check en tinta. */
export function OptionSheet<T extends string>({
  open,
  onClose,
  title,
  value,
  options,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: T;
  options: { value: T; label: string; detail?: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <FintSheet
      open={open}
      onClose={onClose}
      title={title}
      titleSize="compact"
      scrollable={options.length > 7}
      snapPoints={options.length > 7 ? [70] : undefined}
    >
      <YStack px={space[2]} pb={space[2]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <PressableScale
              key={option.value}
              scaleTo={1}
              dim
              onPress={() => {
                onChange(option.value);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <XStack minH={52} px={space[3]} gap={12} items="center" rounded={radius.md} bg={selected ? "$surfaceSunken" : "transparent"}>
                {option.icon}
                <YStack flex={1} minW={0}>
                  <FText variant={selected ? "body-strong" : "body"} numberOfLines={1}>
                    {option.label}
                  </FText>
                  {option.detail ? (
                    <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                      {option.detail}
                    </FText>
                  ) : null}
                </YStack>
                {selected ? <Check size={18} color="$ink" strokeWidth={2.4} /> : null}
              </XStack>
            </PressableScale>
          );
        })}
      </YStack>
    </FintSheet>
  );
}
