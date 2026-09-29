import {
  ArrowLeftRight,
  Bell,
  ChartPie,
  GripVertical,
} from "@tamagui/lucide-icons-2";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { View, XStack, YStack } from "tamagui";
import { motion, radius, space } from "../theme/tokens";
import { FintSheet, FText, Toggle } from "../ui";
import { haptics } from "../ui/haptics";
import {
  moveSection,
  setSectionVisible,
  type HomeLayout,
  type HomeSectionId,
} from "./layout";

const ROW = 68;

const ICONS: Record<HomeSectionId, ReactNode> = {
  attention: <Bell size={18} color="$inkMuted" strokeWidth={1.9} />,
  transactions: (
    <ArrowLeftRight size={18} color="$inkMuted" strokeWidth={1.9} />
  ),
  spending: <ChartPie size={18} color="$inkMuted" strokeWidth={1.9} />,
};

type Props = {
  open: boolean;
  onClose: () => void;
  layout: HomeLayout;
  onChange: (next: HomeLayout) => void;
};

/**
 * "Personalizar inicio": las tres secciones en una lista que se reordena arrastrando del agarre, cada una con su
 * interruptor. El hero no está: no se mueve ni se oculta. Cada cambio se guarda al soltar o al tocar el interruptor.
 * Sin arrastre para cerrar la hoja, para que no compita con el de las filas.
 */
export function HomeLayoutSheet({ open, onClose, layout, onChange }: Props) {
  const { t } = useTranslation();
  const positions = useSharedValue<Record<string, number>>(indexOf(layout));

  useEffect(() => {
    positions.value = indexOf(layout);
  }, [layout, positions]);

  const drop = (id: HomeSectionId, to: number) =>
    onChange(moveSection(layout, id, to));

  return (
    <FintSheet
      open={open}
      onClose={onClose}
      title={t("home.customize.title")}
      subtitle={t("home.customize.subtitle")}
      disableDrag
    >
      <YStack px={space[4]} pt={space[3]}>
        <View
          height={ROW * layout.sections.length}
          rounded={radius.lg}
          bg="$surface"
          borderWidth={1}
          borderColor="$line"
        >
          {layout.sections.map((section, index) => (
            <SortableRow
              key={section.id}
              id={section.id}
              count={layout.sections.length}
              positions={positions}
              onDrop={drop}
              onMove={(delta) => drop(section.id, index + delta)}
              canMoveUp={index > 0}
              canMoveDown={index < layout.sections.length - 1}
              title={t(`home.customize.sections.${section.id}`)}
              hint={t(`home.customize.hints.${section.id}`)}
              visible={section.visible}
            >
              <Toggle
                value={section.visible}
                onValueChange={(visible) =>
                  onChange(setSectionVisible(layout, section.id, visible))
                }
                accessibilityLabel={t("home.customize.show", {
                  section: t(`home.customize.sections.${section.id}`),
                })}
              />
            </SortableRow>
          ))}
        </View>
        <FText
          variant="caption"
          tone="inkFaint"
          style={{ marginTop: 10, textAlign: "center" }}
        >
          {t("home.customize.dragHint")}
        </FText>
      </YStack>
    </FintSheet>
  );
}

function indexOf(layout: HomeLayout): Record<string, number> {
  return Object.fromEntries(layout.sections.map((s, i) => [s.id, i]));
}

/**
 * Una fila que sigue al dedo: al pasar la mitad de la vecina, se cambian de lugar (la otra se acomoda con
 * `spring-ui`). Al soltar, vuelve a su lugar y avisa la posición. Con lector de pantalla, "Subir" y "Bajar".
 */
function SortableRow({
  id,
  count,
  positions,
  onDrop,
  onMove,
  canMoveUp,
  canMoveDown,
  title,
  hint,
  visible,
  children,
}: {
  id: HomeSectionId;
  count: number;
  positions: { value: Record<string, number> };
  onDrop: (id: HomeSectionId, to: number) => void;
  onMove: (delta: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  title: string;
  hint: string;
  visible: boolean;
  /** El interruptor, a la derecha y aparte para el lector de pantalla. */
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const top = useSharedValue((positions.value[id] ?? 0) * ROW);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);

  useAnimatedReaction(
    () => positions.value[id] ?? 0,
    (position, previous) => {
      if (position !== previous && !dragging.value)
        top.value = withSpring(position * ROW, motion.springUi);
    },
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      dragging.value = true;
      start.value = top.value;
      runOnJS(haptics.tap)();
    })
    .onUpdate((e) => {
      const max = (count - 1) * ROW;
      top.value = Math.max(0, Math.min(max, start.value + e.translationY));
      const to = Math.max(0, Math.min(count - 1, Math.round(top.value / ROW)));
      const from = positions.value[id] ?? 0;
      if (to === from) return;
      const next: Record<string, number> = {};
      for (const key of Object.keys(positions.value)) {
        const position = positions.value[key] ?? 0;
        next[key] = key === id ? to : position === to ? from : position;
      }
      positions.value = next;
      runOnJS(haptics.tap)();
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      const to = positions.value[id] ?? 0;
      top.value = withSpring(to * ROW, motion.springUi);
      dragging.value = false;
      runOnJS(onDrop)(id, to);
    });

  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: dragging.value ? 10 : 0,
    transform: [
      { scale: withTiming(dragging.value ? 1.02 : 1, { duration: 120 }) },
    ],
    shadowOpacity: withTiming(dragging.value ? 0.18 : 0, { duration: 120 }),
    elevation: dragging.value ? 6 : 0,
  }));

  const actions = [
    ...(canMoveUp
      ? [{ name: "moveUp", label: t("home.customize.moveUp") }]
      : []),
    ...(canMoveDown
      ? [{ name: "moveDown", label: t("home.customize.moveDown") }]
      : []),
  ];

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            height: ROW,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 14,
          },
          style,
        ]}
      >
        <XStack
          flex={1}
          items="center"
          gap={12}
          px={14}
          bg="$surface"
          rounded={radius.lg}
        >
          <XStack
            flex={1}
            minW={0}
            items="center"
            gap={12}
            accessible
            accessibilityLabel={`${title}. ${hint}`}
            accessibilityHint={t("home.customize.dragHint")}
            accessibilityActions={actions}
            onAccessibilityAction={(e) =>
              onMove(e.nativeEvent.actionName === "moveUp" ? -1 : 1)
            }
          >
            <GripVertical size={18} color="$inkFaint" />
            <View
              width={36}
              height={36}
              rounded={radius.pill}
              items="center"
              justify="center"
              bg="$surfaceSunken"
            >
              {ICONS[id]}
            </View>
            <YStack flex={1} minW={0}>
              <FText
                variant="body-strong"
                numberOfLines={1}
                tone={visible ? "ink" : "inkMuted"}
              >
                {title}
              </FText>
              <FText variant="caption" tone="inkMuted" numberOfLines={1}>
                {hint}
              </FText>
            </YStack>
          </XStack>
          {children}
        </XStack>
      </Animated.View>
    </GestureDetector>
  );
}
