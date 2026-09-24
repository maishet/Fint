import { ArrowLeftRight, Pencil, RotateCcw, Trash2 } from "@tamagui/lucide-icons-2";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import { View, XStack, YStack, type ColorTokens } from "tamagui";
import { getCategoryLabel } from "../finance/categoryLabels";
import { categoryColorIndex } from "../home/spending";
import { radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, Monogram } from "../ui";
import { haptics } from "../ui/haptics";
import type { MovementItem } from "./logic";

/** Cada acción revelada mide 78px. */
const ACTION_W = 78;
/** Cuánto más allá de las acciones hay que deslizar para ejecutar la de la derecha. */
const LONG_SWIPE = 56;

/** La fila abierta en este momento: al abrir otra, la anterior se cierra. */
let openRow: SwipeableMethods | null = null;

export interface MovementRowProps {
  item: MovementItem;
  /** Primera y última fila de su día: el grupo se dibuja como una tarjeta. */
  first: boolean;
  last: boolean;
  emoji: string | null;
  onOpen?: () => void;
  onEdit?: () => void;
  /** Eliminar un movimiento, o revertir un pago o una transferencia (lo que la app hace hoy). */
  onDestroy?: () => void;
  destroyKind: "delete" | "revert";
}

/**
 * Fila del tab Movimientos: emoji de la categoría (o monograma), categoría,
 * nota o cuenta, y el monto con su signo. Deslizar a la izquierda muestra
 * Editar y Eliminar (o Revertir). La fila sigue al dedo; pasado el ancho de las
 * acciones resiste con goma y, si se suelta lejos, ejecuta la acción de la
 * derecha, que igual pide confirmación.
 */
export function MovementRow({ item, first, last, emoji, onOpen, onEdit, onDestroy, destroyKind }: MovementRowProps) {
  const { t } = useTranslation();
  const swipe = useRef<SwipeableMethods>(null);
  const translation = useRef<SharedValue<number> | null>(null);

  const transfer = item.kind === "transfer" || item.movement.type === "transfer";
  const tx = item.kind === "movement" ? item.movement : null;
  const title =
    item.kind === "transfer"
      ? t("movementsTab.transferTitle", { origin: item.origin.account, destination: item.destination.account })
      : transfer
        ? t("movementsTab.transfer")
        : getCategoryLabel(tx!.category, t);
  const subtitle =
    item.kind === "transfer"
      ? t("movementsTab.transfer")
      : tx!.paymentOccurrenceId
        ? [t("movementsTab.payment"), tx!.note || tx!.account].filter(Boolean).join(" · ")
        : tx!.note || tx!.account;
  const amount = item.kind === "transfer" ? item.amount : tx!.amount;
  const currency = item.kind === "transfer" ? item.currency : tx!.currency;
  const kind = transfer ? "transfer" : tx!.type === "income" ? "income" : "expense";

  const actions: { key: string; label: string; icon: ReactNode; bg: string; color: string; run: () => void }[] = [];
  if (onEdit) actions.push({ key: "edit", label: t("movementsTab.edit"), icon: <Pencil size={18} color="$ink" />, bg: "$surfaceSunken", color: "$ink", run: onEdit });
  if (onDestroy)
    actions.push({
      key: "destroy",
      label: t(destroyKind === "revert" ? "movementsTab.revert" : "movementsTab.delete"),
      icon: destroyKind === "revert" ? <RotateCcw size={18} color="$onDanger" /> : <Trash2 size={18} color="$onDanger" />,
      bg: "$dangerHard",
      color: "$onDanger",
      run: onDestroy,
    });
  const actionsWidth = actions.length * ACTION_W;

  const content = (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? "button" : undefined}
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
    >
      {({ pressed }) => (
        <XStack items="center" gap={space[3]} px={space[4]} py={space[3]} bg={pressed ? "$surfaceSunken" : "$surface"}>
          {transfer ? (
            <Monogram name={title} icon={<ArrowLeftRight size={16} color="$inkMuted" strokeWidth={2} />} />
          ) : (
            <Monogram name={title} emoji={emoji} color={`$chart${categoryColorIndex(tx!.category)}` as ColorTokens} />
          )}
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
              {title}
            </FText>
            <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ marginTop: 1 }}>
              {subtitle}
            </FText>
          </YStack>
          <Amount value={amount} currency={currency} kind={kind} />
        </XStack>
      )}
    </Pressable>
  );

  return (
    <View
      bg="$surface"
      borderColor="$line"
      borderLeftWidth={1}
      borderRightWidth={1}
      borderTopWidth={first ? 1 : 0}
      borderBottomWidth={last ? 1 : 0}
      overflow="hidden"
      style={{
        borderTopLeftRadius: first ? radius.lg : 0,
        borderTopRightRadius: first ? radius.lg : 0,
        borderBottomLeftRadius: last ? radius.lg : 0,
        borderBottomRightRadius: last ? radius.lg : 0,
      }}
    >
      {!first ? <View height={1} bg="$line" /> : null}
      {actions.length === 0 ? (
        content
      ) : (
        <ReanimatedSwipeable
          ref={swipe}
          friction={1}
          overshootRight
          overshootFriction={6}
          rightThreshold={actionsWidth / 2}
          renderRightActions={(_progress, drag) => {
            translation.current = drag;
            return (
              <XStack width={actionsWidth}>
                {actions.map((a) => (
                  <Pressable
                    key={a.key}
                    style={{ width: ACTION_W }}
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                    onPress={() => {
                      haptics.tap();
                      swipe.current?.close();
                      a.run();
                    }}
                  >
                    <YStack flex={1} items="center" justify="center" gap={4} bg={a.bg as never}>
                      {a.icon}
                      <FText variant="caption" color={a.color as ColorTokens} style={{ fontFamily: fontFace.sans[600] }}>
                        {a.label}
                      </FText>
                    </YStack>
                  </Pressable>
                ))}
              </XStack>
            );
          }}
          onSwipeableWillOpen={() => {
            // Un deslizamiento largo ejecuta la acción de la derecha (con su confirmación) y la fila vuelve.
            const drag = translation.current?.value ?? 0;
            if (drag < -(actionsWidth + LONG_SWIPE)) {
              haptics.warning();
              swipe.current?.close();
              actions[actions.length - 1].run();
              return;
            }
            haptics.select();
            if (openRow && openRow !== swipe.current) openRow.close();
            openRow = swipe.current;
          }}
          onSwipeableClose={() => {
            if (openRow === swipe.current) openRow = null;
          }}
        >
          {content}
        </ReanimatedSwipeable>
      )}
    </View>
  );
}
