import { ArrowDown, ArrowLeftRight, ArrowUp, FileDown, Inbox, Mail, Settings, Tags } from "@tamagui/lucide-icons-2";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { motion, radius, space } from "../theme/tokens";
import { FintSheet, FText, ListRow } from "../ui";
import { haptics } from "../ui/haptics";

/** Lo que tarda la hoja en bajar antes de abrir el formulario. */
const SHEET_OUT_MS = 220;

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * La hoja del botón central: Egreso, Ingreso y Transferencia, en ese orden,
 * que es el de frecuencia real. Es siempre la misma hoja, desde cualquier tab.
 */
export function RecordSheet({ open, onClose }: SheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // La hoja baja primero y luego el formulario crece desde el botón central (`origin: "fab"`); si se abrían a la
  // vez, la hoja quedaba encima del formulario mientras este se montaba.
  const go = (type: "expense" | "income" | "transfer") => {
    onClose();
    setTimeout(() => router.push({ pathname: "/transaction-form", params: { type, origin: "fab" } }), SHEET_OUT_MS);
  };

  return (
    <FintSheet open={open} onClose={onClose} title={t("home.record.title")} titleSize="compact">
      <YStack px={space[4]} pt={space[3]} gap={4}>
        <Option
          icon={<ArrowDown size={20} color="$flowOut" strokeWidth={2} />}
          title={t("home.record.expense")}
          hint={t("home.record.expenseHint")}
          onPress={() => go("expense")}
        />
        <Option
          icon={<ArrowUp size={20} color="$flowIn" strokeWidth={2} />}
          title={t("home.record.income")}
          hint={t("home.record.incomeHint")}
          onPress={() => go("income")}
        />
        <Option
          icon={<ArrowLeftRight size={20} color="$inkMuted" strokeWidth={2} />}
          title={t("home.record.transfer")}
          hint={t("home.record.transferHint")}
          onPress={() => go("transfer")}
        />
      </YStack>
    </FintSheet>
  );
}

/** Una opción de la hoja: sin borde; al presionar, el fondo pasa a `surfaceSunken` con la curva `press`. */
function Option({ icon, title, hint, onPress }: { icon: ReactNode; title: string; hint: string; onPress: () => void }) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const from = "rgba(0,0,0,0)";
  const to = theme.surfaceSunken.val;
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pressed.value, [0, 1], [from, to]) }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, motion.press);
        haptics.tap();
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, motion.fade);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
    >
      <Animated.View style={[{ borderRadius: radius.md }, bgStyle]}>
        <XStack items="center" gap={14} px={space[3]} py={13}>
          <View width={40} height={40} rounded={radius.md} bg="$surfaceSunken" items="center" justify="center">
            {icon}
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="body-strong">{title}</FText>
            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
              {hint}
            </FText>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  );
}

/** La acción "Más" del hero: lo que se usa de vez en cuando. */
export function MoreSheet({ open, onClose }: SheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (href: Href) => {
    onClose();
    router.push(href);
  };
  const items: { icon: ReactNode; label: string; href: Href }[] = [
    { icon: <ArrowLeftRight size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.transfer"), href: { pathname: "/transaction-form", params: { type: "transfer" } } },
    { icon: <Inbox size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.pending"), href: "/pending-movements" },
    { icon: <Tags size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.categories"), href: "/categories" },
    { icon: <FileDown size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.import"), href: "/import-transactions" },
    { icon: <Mail size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.gmail"), href: "/gmail-settings" },
    { icon: <Settings size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.settings"), href: "/settings" },
  ];

  return (
    <FintSheet open={open} onClose={onClose} title={t("home.more.title")} titleSize="compact">
      <YStack mx={space[4]} mt={space[4]} rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
        {items.map((item, i) => (
          <ListRow
            key={item.label}
            divider={i > 0}
            title={item.label}
            leading={
              <View width={32} height={32} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
                {item.icon}
              </View>
            }
            onPress={() => go(item.href)}
          />
        ))}
      </YStack>
    </FintSheet>
  );
}
