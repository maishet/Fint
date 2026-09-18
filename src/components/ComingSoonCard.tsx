import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated } from "react-native";
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

export function ComingSoonCard({
  icon,
  title,
  description,
  compact = false,
}: ComingSoonCardProps) {
  const { t } = useTranslation();
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

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
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isReduceMotionEnabled, pulse]);

  const iconSize = compact ? 38 : 44;
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.012],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <FintCard
        borderStyle="dashed"
        borderColor="rgba(7,124,134,0.35)"
        borderWidth={1.5}
        rounded={CARD_RADIUS}
        p={compact ? "$3" : "$4"}
      >
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
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: CARD_RADIUS,
          borderWidth: 1.5,
          borderColor: "rgba(7,124,134,0.9)",
          opacity: pulse,
        }}
      />
    </Animated.View>
  );
}
