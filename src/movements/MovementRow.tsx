import { ArrowLeftRight, Pencil, RotateCcw, Trash2 } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { getCategoryLabel } from "../finance/categoryLabels";
import { getAppLocale } from "../i18n";
import { useSensitiveMoney } from "../privacy/useSensitiveMoney";
import { COMPACT_FONT_SCALE, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText, Monogram, RowAmount } from "../ui";
import { SwipeActions, type SwipeAction } from "../ui/SwipeActions";
import { itemDate, spokenDate, type MovementItem } from "./logic";
import { movementText } from "./text";

export interface MovementRowProps {
  item: MovementItem;
  /** Primera y última fila de su día: la primera va sin filete arriba. */
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
 * Fila del tab Movimientos (marca D): a todo el ancho sobre `canvas`, separada de la anterior por un filete. Cuadro
 * de 44 con el emoji de la categoría sobre su fondo, categoría (16), nota o cuenta (13) y el monto con su signo
 * (`flowIn` +, `flowOut` −). Desde `COMPACT_FONT_SCALE` el texto se parte en varias líneas y el monto baja debajo del
 * detalle. Deslizar a la izquierda muestra Editar (tinta) y Eliminar o Revertir (`dangerHard`). La fila sigue al
 * dedo; pasado el ancho de las acciones resiste con goma y, si se suelta lejos, ejecuta la acción de la derecha, que
 * igual pide confirmación.
 */
export function MovementRow({ item, first, emoji, onOpen, onEdit, onDestroy, destroyKind }: MovementRowProps) {
  const { t, i18n } = useTranslation();
  const { formatSensitiveAmount, sensitiveAmountAccessibilityLabel } = useSensitiveMoney();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;

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
        ? [t("movementsTab.payment"), movementText(tx!) || tx!.account].filter(Boolean).join(" · ")
        : movementText(tx!) || tx!.account;
  const amount = item.kind === "transfer" ? item.amount : tx!.amount;
  const currency = item.kind === "transfer" ? item.currency : tx!.currency;
  const kind = transfer ? "transfer" : tx!.type === "income" ? "income" : "expense";
  // La etiqueta reemplaza a los hijos: el `Amount` de adentro no se lee, así que el monto (con "egreso" o "ingreso",
  // porque el signo no se pronuncia) y la fecha van aquí. Con "Ocultar montos", se dice que está oculto.
  const spokenAmount = t(`movementsTab.a11y.${kind}`, {
    amount: sensitiveAmountAccessibilityLabel ?? formatSensitiveAmount(amount, currency),
  });
  const label = [title, subtitle, spokenAmount, spokenDate(itemDate(item), new Date(), getAppLocale(i18n.resolvedLanguage))].filter(Boolean).join(", ");

  const actions: SwipeAction[] = [];
  if (onEdit) actions.push({ key: "edit", label: t("movementsTab.edit"), icon: <Pencil size={18} color="$canvas" />, tone: "ink", run: onEdit });
  if (onDestroy)
    actions.push({
      key: "destroy",
      label: t(destroyKind === "revert" ? "movementsTab.revert" : "movementsTab.delete"),
      icon: destroyKind === "revert" ? <RotateCcw size={18} color="$onDanger" /> : <Trash2 size={18} color="$onDanger" />,
      tone: "danger",
      run: onDestroy,
    });

  const amountNode = <RowAmount value={amount} currency={currency} kind={kind} />;

  const content = (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
    >
      {({ pressed }) => (
        // Fondo opaco: al deslizar, la fila tapa las acciones que quedan detrás.
        <XStack items={stacked ? "flex-start" : "center"} gap={space[3]} py={space[3]} bg={pressed ? "$surfaceSunken" : "$canvas"}>
          {transfer ? (
            <Monogram name={title} size={44} icon={<ArrowLeftRight size={18} color="$inkMuted" strokeWidth={2} />} />
          ) : (
            <Monogram name={title} size={44} emoji={emoji} />
          )}
          <YStack flex={1} minW={0} gap={2}>
            <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>
              {title}
            </FText>
            <FText tone="inkFaint" numberOfLines={stacked ? undefined : 1} style={{ fontSize: 13, lineHeight: 18 }}>
              {subtitle}
            </FText>
            {stacked ? <View mt={2}>{amountNode}</View> : null}
          </YStack>
          {stacked ? null : amountNode}
        </XStack>
      )}
    </Pressable>
  );

  return (
    <View borderTopWidth={first ? 0 : 1} borderColor="$line">
      <SwipeActions actions={actions}>{content}</SwipeActions>
    </View>
  );
}
