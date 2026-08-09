import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Platform } from "react-native";
import { Separator, XStack, YStack, type YStackProps } from "tamagui";
import { FintCard } from "../ui";

interface SkeletonGroupProps {
  children: ReactNode;
  label: string;
}

interface SkeletonListProps {
  grouped?: boolean;
  rows?: number;
}

export function SkeletonGroup({ children, label }: SkeletonGroupProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (Platform.OS === "web") {
      opacity.setValue(0.72);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 750,
          toValue: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 750,
          toValue: 0.5,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={{ opacity }}
    >
      <YStack
        gap="$4"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </YStack>
    </Animated.View>
  );
}

export function SkeletonBlock({
  bg = "$color4",
  height = 14,
  rounded = "$4",
  width = "100%",
  ...props
}: YStackProps) {
  return (
    <YStack
      bg={bg}
      height={height}
      rounded={rounded}
      width={width}
      {...props}
    />
  );
}

export function SkeletonHero() {
  return (
    <FintCard bg="$heroBackground" borderColor="$heroBorder" gap="$4" p="$4">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack flex={1} gap="$2">
          <SkeletonBlock bg="rgba(185,215,225,0.32)" height={11} width="42%" />
          <SkeletonBlock bg="rgba(244,251,253,0.42)" height={35} width="72%" />
        </YStack>
        <SkeletonBlock
          bg="rgba(93,214,229,0.18)"
          borderColor="rgba(93,214,229,0.24)"
          borderWidth={1}
          height={48}
          rounded="$10"
          width={48}
        />
      </XStack>
      <XStack gap="$4">
        <HeroMetricSkeleton />
        <HeroMetricSkeleton />
      </XStack>
    </FintCard>
  );
}

function HeroMetricSkeleton() {
  return (
    <YStack flex={1} gap="$1">
      <SkeletonBlock bg="rgba(93,214,229,0.32)" height={4} />
      <SkeletonBlock bg="rgba(185,215,225,0.28)" height={9} width="58%" />
      <SkeletonBlock bg="rgba(244,251,253,0.38)" height={16} width="76%" />
    </YStack>
  );
}

export function SkeletonList({ grouped = false, rows = 3 }: SkeletonListProps) {
  const content = Array.from({ length: rows }, (_, index) => (
    <YStack key={index}>
      {grouped && index > 0 ? <Separator ml={66} /> : null}
      <XStack
        items="center"
        gap="$3"
        minH={64}
        px={grouped ? "$4" : undefined}
        py={grouped ? "$2" : undefined}
      >
        <SkeletonBlock height={42} rounded="$9" width={42} />
        <YStack flex={1} gap="$2">
          <SkeletonBlock height={14} width={index % 2 === 0 ? "62%" : "48%"} />
          <SkeletonBlock height={10} width={index % 2 === 0 ? "42%" : "55%"} />
        </YStack>
        <SkeletonBlock height={16} width={68} />
      </XStack>
    </YStack>
  ));

  if (grouped)
    return (
      <FintCard p={0} overflow="hidden">
        {content}
      </FintCard>
    );
  return (
    <YStack gap={8}>
      {content.map((row, index) => (
        <FintCard key={index} p="$3">
          {row}
        </FintCard>
      ))}
    </YStack>
  );
}

export function SkeletonSection({ height = 220 }: { height?: number }) {
  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between">
        <SkeletonBlock height={20} width="48%" />
        <SkeletonBlock height={11} width="20%" />
      </XStack>
      <FintCard gap="$3" minH={height}>
        <XStack gap="$3">
          <SkeletonBlock height={10} width={64} />
          <SkeletonBlock height={10} width={64} />
        </XStack>
        <SkeletonBlock height={52} rounded="$5" />
        <XStack flex={1} items="flex-end" justify="space-around" gap="$3">
          {[46, 82, 64, 108].map((barHeight, index) => (
            <SkeletonBlock
              key={index}
              height={barHeight}
              rounded="$3"
              width={26}
            />
          ))}
        </XStack>
      </FintCard>
    </YStack>
  );
}

export function SkeletonMetricGrid() {
  return (
    <YStack gap="$2">
      {[0, 1].map((row) => (
        <XStack key={row} gap="$2">
          {[0, 1].map((column) => (
            <FintCard key={column} flex={1} gap="$2" p="$3" minH={92}>
              <XStack items="center" gap="$2">
                <SkeletonBlock height={30} rounded="$8" width={30} />
                <SkeletonBlock height={10} width="52%" />
              </XStack>
              <SkeletonBlock height={18} width="72%" />
            </FintCard>
          ))}
        </XStack>
      ))}
    </YStack>
  );
}

export function SkeletonContentCard({ rows = 3 }: { rows?: number }) {
  return (
    <FintCard gap="$3">
      <SkeletonBlock height={20} width="52%" />
      {Array.from({ length: rows }, (_, index) => (
        <XStack key={index} items="center" gap="$3">
          <SkeletonBlock height={38} rounded="$8" width={38} />
          <YStack flex={1} gap="$2">
            <SkeletonBlock height={13} width="58%" />
            <SkeletonBlock height={9} width="40%" />
          </YStack>
          <SkeletonBlock height={14} width={64} />
        </XStack>
      ))}
    </FintCard>
  );
}

export function SkeletonForm({
  fieldCount = 3,
  label,
  segmentCount = 2,
  showAmount = true,
  showChoiceGrid = false,
  showNote = true,
  showSegment = false,
}: {
  fieldCount?: number;
  label: string;
  segmentCount?: number;
  showAmount?: boolean;
  showChoiceGrid?: boolean;
  showNote?: boolean;
  showSegment?: boolean;
}) {
  return (
    <SkeletonGroup label={label}>
      {showSegment ? (
        <FintCard p="$1" bg="$muted">
          <XStack gap="$1">
            {Array.from({ length: segmentCount }, (_, index) => (
              <SkeletonBlock key={index} flex={1} height={segmentCount > 2 ? 64 : 56} rounded="$6" />
            ))}
          </XStack>
        </FintCard>
      ) : null}
      <FormFieldSkeleton />
      {showChoiceGrid ? (
        <FintCard gap="$3" p="$3">
          <SkeletonBlock height={10} width="28%" />
          <XStack gap="$2" flexWrap="wrap">
            {[0, 1, 2, 3].map((item) => (
              <SkeletonBlock key={item} height={52} rounded="$5" width="48%" />
            ))}
          </XStack>
        </FintCard>
      ) : null}
      {showAmount ? (
        <FintCard minH={148} gap="$3" bg="$accent1" borderColor="$accent4">
          <SkeletonBlock height={11} width="22%" />
          <XStack flex={1} items="center" gap="$3">
            <SkeletonBlock height={48} rounded="$10" width={52} />
            <SkeletonBlock flex={1} height={42} rounded="$5" />
          </XStack>
        </FintCard>
      ) : null}
      {Array.from({ length: fieldCount }, (_, index) => (
        <FormFieldSkeleton key={index} />
      ))}
      {showNote ? (
        <FintCard minH={112} p="$3">
          <XStack items="flex-start" gap="$3">
            <SkeletonBlock height={42} rounded="$10" width={42} />
            <YStack flex={1} gap="$2">
              <SkeletonBlock height={10} width="34%" />
              <SkeletonBlock height={14} width="72%" />
              <SkeletonBlock height={14} width="48%" />
            </YStack>
          </XStack>
        </FintCard>
      ) : null}
      <YStack gap={8}>
        <SkeletonBlock height={52} rounded="$6" />
        <SkeletonBlock height={48} rounded="$6" />
      </YStack>
    </SkeletonGroup>
  );
}

function FormFieldSkeleton() {
  return (
    <FintCard minH={68} p="$3">
      <XStack items="center" gap="$3">
        <SkeletonBlock height={42} rounded="$10" width={42} />
        <YStack flex={1} gap="$2">
          <SkeletonBlock height={9} width="28%" />
          <SkeletonBlock height={15} width="62%" />
        </YStack>
        <SkeletonBlock height={18} rounded="$10" width={18} />
      </XStack>
    </FintCard>
  );
}
