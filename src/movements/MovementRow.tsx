import { ArrowLeftRight, Pencil, RotateCcw, Trash2 } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { XStack, YStack, type ColorTokens } from "tamagui";
import { getCategoryLabel } from "../finance/categoryLabels";
import { categoryColorIndex } from "../home/spending";
import { space } from "../theme/tokens";
import { Amount, FText, Monogram } from "../ui";
import { GroupedCell } from "../ui/GroupedCell";
import { SwipeActions, type SwipeAction } from "../ui/SwipeActions";
import type { MovementItem } from "./logic";

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

  const actions: SwipeAction[] = [];
  if (onEdit) actions.push({ key: "edit", label: t("movementsTab.edit"), icon: <Pencil size={18} color="$ink" />, tone: "neutral", run: onEdit });
  if (onDestroy)
    actions.push({
      key: "destroy",
      label: t(destroyKind === "revert" ? "movementsTab.revert" : "movementsTab.delete"),
      icon: destroyKind === "revert" ? <RotateCcw size={18} color="$onDanger" /> : <Trash2 size={18} color="$onDanger" />,
      tone: "danger",
      run: onDestroy,
    });

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
    <GroupedCell first={first} last={last}>
      <SwipeActions actions={actions}>{content}</SwipeActions>
    </GroupedCell>
  );
}
