import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Clock } from "@tamagui/lucide-icons-2";
import { Paragraph, XStack, YStack } from "tamagui";
import { FintCard } from "../ui";

interface ComingSoonCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}

const CARD_RADIUS = 24;
// Mucho mas grande que cualquier tarjeta real: al girar, siempre cubre por
// completo el marco de 2px sin dejar huecos en las esquinas.
const SWEEP_SIZE = 640;

export function ComingSoonCard({
  icon,
  title,
  description,
  compact = false,
}: ComingSoonCardProps) {
  const { t } = useTranslation();
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setIsReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReduceMotionEnabled,
    );
    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isReduceMotionEnabled) {
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(
      withTiming(360, { duration: 3200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [isReduceMotionEnabled, rotation]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconSize = compact ? 38 : 44;

  return (
    <View
      style={{ borderRadius: CARD_RADIUS + 2, padding: 2, overflow: "hidden" }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: SWEEP_SIZE,
            height: SWEEP_SIZE,
            top: "50%",
            left: "50%",
            marginLeft: -SWEEP_SIZE / 2,
            marginTop: -SWEEP_SIZE / 2,
          },
          sweepStyle,
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(7,124,134,0)",
            "rgba(100,206,208,0.95)",
            "rgba(7,124,134,0.85)",
            "rgba(7,124,134,0)",
            "rgba(7,124,134,0)",
          ]}
          locations={[0, 0.15, 0.3, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <FintCard borderWidth={0} rounded={CARD_RADIUS} p={compact ? "$3" : "$4"}>
        <XStack gap="$3" items="flex-start">
          <YStack
            width={iconSize}
            height={iconSize}
            rounded={14}
            bg="$accent2"
            items="center"
            justify="center"
          >
            {icon}
          </YStack>
          <YStack flex={1} gap="$1">
            <XStack items="flex-start" justify="space-between" gap="$2">
              <Paragraph
                color="$color12"
                fontWeight="700"
                fontSize={compact ? "$3" : "$4"}
                flex={1}
              >
                {title}
              </Paragraph>
              <XStack
                items="center"
                gap="$1"
                bg="rgba(7,124,134,0.10)"
                rounded={999}
                px="$2"
                py={3}
              >
                <Clock size={11} color="$primary" />
                <Paragraph
                  color="$primary"
                  fontSize={10}
                  fontWeight="700"
                  textTransform="uppercase"
                >
                  {t("comingSoon.badge")}
                </Paragraph>
              </XStack>
            </XStack>
            <Paragraph color="$color10" fontSize={compact ? "$1" : "$2"}>
              {description}
            </Paragraph>
          </YStack>
        </XStack>
      </FintCard>
    </View>
  );
}
