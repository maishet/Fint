import { Check, ChevronRight, Sun } from "@tamagui/lucide-icons-2";
import { Children, Fragment, type ReactNode } from "react";
import { Image } from "react-native";
import { Text, View, XStack, YStack } from "tamagui";
import { opacity, radius, space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { FintCard, FintSheet, FText, PressableScale } from "../ui";
import { initials } from "./logic";

type LucideIcon = typeof Sun;

/** Título de un grupo: `caption` en `inkMuted`, alineado con el texto de las filas. */
export function GroupTitle({ children }: { children: string }) {
  return (
    <FText
      variant="caption"
      tone="inkMuted"
      accessibilityRole="header"
      style={{ fontFamily: fontFace.sans[600], marginTop: 20, marginBottom: 8, marginHorizontal: 20 }}
    >
      {children}
    </FText>
  );
}

/** Un grupo de filas en una tarjeta, separadas por un filete `line`. */
export function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <FintCard p={0} mx={space[4]} overflow="hidden">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? <View height={1} bg="$line" /> : null}
          {item}
        </Fragment>
      ))}
    </FintCard>
  );
}

/**
 * Fila de 50px: icono Lucide sobre `surfaceSunken`, etiqueta (con una línea
 * chica debajo si hace falta), el valor actual en `inkFaint` y, a la derecha,
 * un chevron, un interruptor o nada. Ningún icono va en color; `danger` pinta
 * etiqueta e icono en `dangerHard` y `dim` los apaga (`opacity-disabled`).
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
  const color = tone === "danger" ? "$dangerHard" : "$inkMuted";
  const dim = tone === "dim" ? opacity.disabled : 1;
  const row = (
    <XStack minH={50} px={14} py={8} gap={12} items="center">
      <View width={30} height={30} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center" opacity={dim}>
        <Icon size={16} color={color as never} strokeWidth={2} />
      </View>
      <YStack flex={1} minW={0} opacity={dim}>
        <FText tone={tone === "danger" ? "dangerHard" : "ink"} numberOfLines={1}>
          {label}
        </FText>
        {detail ? (
          <FText variant="caption" tone="inkFaint" numberOfLines={2}>
            {detail}
          </FText>
        ) : null}
      </YStack>
      {value ? (
        <Text
          color="$inkFaint"
          numberOfLines={1}
          style={valueMono ? { ...textStyles["amount-sm"], fontSize: 14 } : { ...textStyles.body, fontSize: 14 }}
        >
          {value}
        </Text>
      ) : null}
      {right === "chevron" ? <ChevronRight size={16} color="$inkFaint" strokeWidth={2} /> : right === "none" ? null : right}
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

/** Avatar: la foto de Google si hay; si no, las iniciales sobre la losa. */
export function Avatar({ name, photoUrl, size }: { name: string; photoUrl?: string | null; size: number }) {
  if (photoUrl)
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View width={size} height={size} rounded={999} bg="$slab" items="center" justify="center">
      <Text color="$slabInk" style={{ fontFamily: fontFace.display[600], fontSize: Math.round(size * 0.34) }}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** Hoja de opciones de una sola elección (idioma, apariencia): la elegida lleva el check en `brand`. */
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
                {selected ? <Check size={18} color="$brand" strokeWidth={2.4} /> : null}
              </XStack>
            </PressableScale>
          );
        })}
      </YStack>
    </FintSheet>
  );
}
