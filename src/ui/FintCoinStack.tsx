import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";

export interface FintCoinStackProps {
  color?: string;
  size?: number;
  showDisc?: boolean;
}

const DISC_COLOR = "#087F91";

const COINS = [
  { cy: 78, opacity: 0.55, rx: 34, ry: 11 },
  { cy: 62, opacity: 0.78, rx: 28, ry: 10 },
  { cy: 47, opacity: 1, rx: 20, ry: 9 },
] as const;

const VIEW_BOX = 120;
const DISC_INSET = 2;
const DISC_SIZE = 116;

const CLUSTER_LEFT = Math.min(...COINS.map((coin) => 60 - coin.rx));
const CLUSTER_TOP = Math.min(...COINS.map((coin) => coin.cy - coin.ry));
const CLUSTER_WIDTH = Math.max(...COINS.map((coin) => 60 + coin.rx)) - CLUSTER_LEFT;
const CLUSTER_HEIGHT = Math.max(...COINS.map((coin) => coin.cy + coin.ry)) - CLUSTER_TOP;

/** Altura desde la que cae cada moneda, en unidades del viewBox. */
const DROP_DISTANCE = 14;
const DROP_MS = 380;
const STAGGER_MS = 140;
const HOLD_MS = 500;
const FADE_MS = 260;

export function FintCoinStack({
  color = "#FFFFFF",
  showDisc = true,
  size = 96,
}: FintCoinStackProps) {
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(COINS.map(() => new Animated.Value(1))).current;

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

  const shouldAnimate = !isReduceMotionEnabled;

  useEffect(() => {
    if (!shouldAnimate) {
      containerOpacity.setValue(1);
      progress.forEach((value) => value.setValue(1));
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(containerOpacity, {
            duration: 0,
            toValue: 1,
            useNativeDriver: true,
          }),
          ...progress.map((value) =>
            Animated.timing(value, {
              duration: 0,
              toValue: 0,
              useNativeDriver: true,
            }),
          ),
        ]),
        Animated.stagger(
          STAGGER_MS,
          progress.map((value) =>
            Animated.timing(value, {
              duration: DROP_MS,
              easing: Easing.out(Easing.back(1.4)),
              toValue: 1,
              useNativeDriver: true,
            }),
          ),
        ),
        Animated.delay(HOLD_MS),
        Animated.timing(containerOpacity, {
          duration: FADE_MS,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: false },
    );

    animation.start();
    return () => animation.stop();
  }, [containerOpacity, progress, shouldAnimate]);

  const scale = showDisc ? size / VIEW_BOX : size / CLUSTER_WIDTH;
  const originX = showDisc ? 0 : CLUSTER_LEFT;
  const originY = showDisc ? 0 : CLUSTER_TOP;
  const drop = DROP_DISTANCE * scale;

  return (
    <Animated.View
      style={{
        height: showDisc ? size : CLUSTER_HEIGHT * scale,
        opacity: containerOpacity,
        width: showDisc ? size : CLUSTER_WIDTH * scale,
      }}
    >
      {showDisc ? (
        <View
          style={{
            backgroundColor: DISC_COLOR,
            borderRadius: (DISC_SIZE / 2) * scale,
            height: DISC_SIZE * scale,
            left: DISC_INSET * scale,
            position: "absolute",
            top: DISC_INSET * scale,
            width: DISC_SIZE * scale,
          }}
        />
      ) : null}
      {COINS.map((coin, index) => (
        <Animated.View
          key={coin.cy}
          style={{
            backgroundColor: color,
            borderRadius: coin.ry * scale,
            height: coin.ry * 2 * scale,
            left: (60 - coin.rx - originX) * scale,
            opacity: progress[index].interpolate({
              extrapolate: "clamp",
              inputRange: [0, 1],
              outputRange: [0, coin.opacity],
            }),
            position: "absolute",
            top: (coin.cy - coin.ry - originY) * scale,
            transform: [
              {
                translateY: progress[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-drop, 0],
                }),
              },
            ],
            width: coin.rx * 2 * scale,
          }}
        />
      ))}
    </Animated.View>
  );
}
