import { ArrowUpDown } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { View, XStack, YStack } from "tamagui";
import type { AccountOption } from "../api/types";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, shadows } from "../theme/tokens";
import { Amount, FText, PressableScale } from "../ui";
import { haptics } from "../ui/haptics";
import { AccountMonogram } from "./AccountSheet";
import { accountBalance } from "./logic";

const GAP = 8;

export interface TransferAccountsProps {
  origin?: AccountOption;
  destination?: AccountOption;
  /** La moneda de la transferencia: los saldos se muestran en ella. */
  currency: string;
  onPickOrigin: () => void;
  onPickDestination: () => void;
  onSwap: () => void;
}

/**
 * Origen y destino de una transferencia: dos tarjetas apiladas con su saldo y
 * un botón circular entre ellas para invertirlas. Al invertir, el botón gira
 * 180° con `spring-ui` y las tarjetas cruzan en vertical, cada una con su
 * propio resorte.
 */
export function TransferAccounts({ origin, destination, currency, onPickOrigin, onPickDestination, onSwap }: TransferAccountsProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [cardH, setCardH] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const firstRender = useRef(true);

  const rotation = useSharedValue(0);
  const topY = useSharedValue(0);
  const bottomY = useSharedValue(0);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduceMotion || cardH === 0) return;
    const d = cardH + GAP;
    // Tras el cambio, la de arriba viene de abajo y la de abajo viene de arriba.
    topY.value = withSequence(withTiming(d, { duration: 0 }), withSpring(0, motion.springUi));
    bottomY.value = withSequence(withTiming(-d, { duration: 0 }), withSpring(0, { ...motion.springUi, stiffness: 200 }));
  }, [swaps]); // eslint-disable-line react-hooks/exhaustive-deps

  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: topY.value }] }));
  const bottomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bottomY.value }] }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const swap = () => {
    haptics.select();
    rotation.value = reduceMotion ? rotation.value + 180 : withSpring(rotation.value + 180, motion.springUi);
    setSwaps((n) => n + 1);
    onSwap();
  };

  return (
    <YStack gap={GAP} mx={16} mt={22}>
      <Animated.View style={[{ zIndex: 1 }, topStyle]} onLayout={(e: LayoutChangeEvent) => setCardH(e.nativeEvent.layout.height)}>
        <AccountCard label={t("movementForm.transferFrom")} account={origin} currency={currency} onPress={onPickOrigin} />
      </Animated.View>
      <Animated.View style={bottomStyle}>
        <AccountCard label={t("movementForm.transferTo")} account={destination} currency={currency} onPress={onPickDestination} />
      </Animated.View>
      <View position="absolute" l="50%" t="50%" ml={-19} mt={-19} z={2}>
        <SwapButton label={t("movementForm.swap")} style={buttonStyle} onPress={swap} />
      </View>
    </YStack>
  );
}

function SwapButton({ label, style, onPress }: { label: string; style: object; onPress: () => void }) {
  const { themeMode } = useThemeMode();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <View
        width={38}
        height={38}
        rounded={999}
        bg="$surface"
        borderWidth={1}
        borderColor="$lineStrong"
        items="center"
        justify="center"
        style={{ boxShadow: shadows[themeMode].raised }}
      >
        <Animated.View style={style}>
          <ArrowUpDown size={18} color="$ink" strokeWidth={2} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

function AccountCard({
  label,
  account,
  currency,
  onPress,
}: {
  label: string;
  account?: AccountOption;
  currency: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { themeMode } = useThemeMode();
  const balance = account ? accountBalance(account, currency) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${account?.name ?? t("movementForm.pickAccount")}`}>
      {({ pressed }) => (
        <XStack
          items="center"
          gap={12}
          px={14}
          py={12}
          rounded={radius.lg}
          borderWidth={1}
          borderColor="$line"
          bg={pressed ? "$surfaceSunken" : "$surface"}
          style={{ boxShadow: shadows[themeMode].card }}
        >
          {account ? <AccountMonogram name={account.name} /> : <View width={38} height={38} rounded={999} bg="$surfaceSunken" />}
          <YStack flex={1} minW={0}>
            <FText variant="caption" tone="inkFaint" style={{ fontSize: 11, lineHeight: 14 }}>
              {label}
            </FText>
            <FText variant="body-strong" tone={account ? "ink" : "inkMuted"} numberOfLines={1} style={{ letterSpacing: -0.1 }}>
              {account?.name ?? t("movementForm.pickAccount")}
            </FText>
          </YStack>
          {balance !== null ? (
            <YStack items="flex-end">
              <Amount value={balance} currency={currency} variant="amount-sm" tone="inkMuted" />
              <FText variant="caption" tone="inkFaint" style={{ fontSize: 11, lineHeight: 14 }}>
                {t("movementForm.available")}
              </FText>
            </YStack>
          ) : null}
        </XStack>
      )}
    </Pressable>
  );
}
