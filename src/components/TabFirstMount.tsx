import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ChevronLeft, ChevronRight, Plus, ScanLine, Search, Share } from "@tamagui/lucide-icons-2";
import { useCapabilities } from "../api/capabilities";
import { useScreenStatusBar } from "../theme/useScreenStatusBar";
import { COMPACT_FONT_SCALE, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Chip, FText, SegmentedControl, Ticket, TicketBar } from "../ui";
import { AmountSkeleton } from "../ui/AmountSkeleton";

/**
 * La primera visita a un tab: en el primer cuadro se ve el esqueleto de esa pantalla (su título, sus controles y la
 * forma de su contenido), y en el siguiente se monta la pantalla real (que sigue con su propio esqueleto mientras
 * llegan los datos). Montar una pantalla entera tarda; sin esto, durante el `fade` del cambio de tab solo se veía el
 * fondo vacío. Los tabs no se precargan: cada uno pide sus datos recién cuando la persona lo abre.
 *
 * Cada esqueleto copia el encabezado de su pantalla en la marca D (título a 32, botones `surface` de 44, filas a
 * todo el ancho) y el esqueleto de carga que ella misma muestra, para que al montarse no se reacomode nada.
 */
export function TabFirstMount({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (ready) return children;
  return <Placeholder name={name} title={title} />;
}

function Placeholder({ name, title }: { name: string; title: string }) {
  const insets = useSafeAreaInsets();
  useScreenStatusBar();
  const body = name === "movements" ? <MovementsSkeleton /> : name === "debts" ? <PaymentsSkeleton /> : name === "reports" ? <ReportsSkeleton /> : null;
  return (
    <YStack flex={1} bg="$canvas" pt={insets.top} pointerEvents="none" accessibilityRole="progressbar" accessibilityLabel={title}>
      <YStack pt={space[2]}>{body}</YStack>
    </YStack>
  );
}

/** Título de pestaña a 32 con su botón a la derecha, como en cada pantalla. */
function TitleRow({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <XStack items="center" justify="space-between" px={space[5]} gap={space[3]} minH={44}>
      <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 32, lineHeight: 38, letterSpacing: -0.9 }}>
        {title}
      </FText>
      {action}
    </XStack>
  );
}

/** Botón redondo de 44 en `surface`. */
function RoundIcon({ children }: { children: ReactNode }) {
  return (
    <View width={44} height={44} rounded={999} items="center" justify="center" bg="$surface">
      {children}
    </View>
  );
}

const noop = () => {};

/** Filas a todo el ancho con el cuadro de 44, dos líneas y lo de la derecha, separadas por un filete. */
function Rows({ rows, trailing }: { rows: number; trailing: ReactNode }) {
  return (
    <YStack>
      {Array.from({ length: rows }, (_, i) => (
        <XStack key={i} items="center" gap={space[3]} py={12} borderTopWidth={i ? 1 : 0} borderColor="$line">
          <View width={44} height={44} rounded={14} bg="$surface" />
          <YStack flex={1} gap={6}>
            <AmountSkeleton width={130} height={12} />
            <AmountSkeleton width={90} height={10} />
          </YStack>
          {trailing}
        </XStack>
      ))}
    </YStack>
  );
}

/** Movimientos: buscador, filtros, el mes con la moneda, "Entró / Salió" y la lista del día. */
function MovementsSkeleton() {
  const { t } = useTranslation();
  const { capabilities } = useCapabilities();
  return (
    <YStack>
      <TitleRow
        title={t("movementsTab.title")}
        action={
          capabilities.features.captureImport ? (
            <RoundIcon>
              <ScanLine size={20} color="$ink" strokeWidth={2} />
            </RoundIcon>
          ) : null
        }
      />
      <XStack mx={space[5]} mt={space[3]} minH={44} px={16} gap={10} items="center" rounded={radius.pill} bg="$surface" borderWidth={1} borderColor="$lineStrong">
        <Search size={18} color="$inkFaint" />
        <FText tone="inkFaint" numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ flex: 1 }}>
          {t("movementsTab.search")}
        </FText>
      </XStack>
      <XStack px={space[5]} pt={space[3]} gap={8} overflow="hidden">
        {(["all", "expense", "income", "transfer"] as const).map((f) => (
          <Chip key={f} variant="filter" label={t(`movementsTab.filters.${f}`)} selected={f === "all"} onPress={noop} />
        ))}
      </XStack>
      <XStack mx={space[5]} mt={space[4]} justify="space-between" items="center">
        <AmountSkeleton width={170} height={22} />
        <View width={52} height={32} rounded={radius.pill} bg="$surface" />
      </XStack>
      <XStack mx={space[5]} mt={space[4]} justify="space-between">
        <YStack gap={8}>
          <AmountSkeleton width={60} height={12} />
          <AmountSkeleton width={110} height={24} />
        </YStack>
        <YStack gap={8} items="flex-end">
          <AmountSkeleton width={60} height={12} />
          <AmountSkeleton width={110} height={24} />
        </YStack>
      </XStack>
      <View mx={space[5]} mt={12} height={8} rounded={radius.pill} bg="$surface" />
      <YStack px={space[5]} pt={space[5]} gap={4}>
        <AmountSkeleton width={140} height={14} />
        <Rows rows={4} trailing={<AmountSkeleton width={70} height={12} />} />
      </YStack>
    </YStack>
  );
}

/** Pagos (F-06): lo que falta pagar, las monedas, la semana, Pendientes / Historial y la lista de pagos. */
function PaymentsSkeleton() {
  const { t } = useTranslation();
  const { capabilities } = useCapabilities();
  return (
    <YStack>
      <TitleRow
        title={t("paymentsTab.title")}
        action={
          capabilities.features.recurringPayments ? (
            <RoundIcon>
              <Plus size={20} color="$ink" strokeWidth={2.2} />
            </RoundIcon>
          ) : null
        }
      />
      <YStack mx={space[5]} mt={space[2]} gap={8}>
        <AmountSkeleton width={150} height={13} />
        <AmountSkeleton width={190} height={38} />
        <XStack gap={6} mt={4}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} width={20} height={20} rounded={999} bg="$surface" />
          ))}
        </XStack>
        <AmountSkeleton width={230} height={12} />
      </YStack>
      <View mx={space[5]} mt={16} height={72} rounded={16} bg="$surface" />
      <View mx={space[5]} mt={space[4]}>
        <SegmentedControl
          options={[
            { value: "pending", label: t("paymentsTab.tabs.pending") },
            { value: "history", label: t("paymentsTab.tabs.history") },
          ]}
          value="pending"
          onChange={noop}
        />
      </View>
      <YStack px={space[5]} pt={18} gap={4}>
        <AmountSkeleton width={110} height={14} />
        <Rows rows={3} trailing={<AmountSkeleton width={70} height={12} />} />
      </YStack>
    </YStack>
  );
}

/** Reportes (F-07): periodo, flechas entre periodos, la cuenta y la moneda, la boleta del neto y el flujo. */
function ReportsSkeleton() {
  const { t } = useTranslation();
  return (
    <YStack>
      <TitleRow
        title={t("reportsTab.title")}
        action={
          <RoundIcon>
            <Share size={18} color="$ink" strokeWidth={2} />
          </RoundIcon>
        }
      />
      <View mx={space[5]} mt={14}>
        <SegmentedControl
          options={(["week", "month", "year"] as const).map((p) => ({ value: p, label: t(`reportsTab.periods.${p}`) }))}
          value="month"
          onChange={noop}
        />
      </View>
      <XStack mx={space[5]} mt={12} items="center" justify="space-between" gap={space[3]}>
        <RoundArrow>
          <ChevronLeft size={18} color="$ink" strokeWidth={2} />
        </RoundArrow>
        <AmountSkeleton width={130} height={16} />
        <RoundArrow>
          <ChevronRight size={18} color="$inkFaint" strokeWidth={2} />
        </RoundArrow>
      </XStack>
      <XStack mx={space[5]} mt={10} items="center" gap={8}>
        <View width={96} height={32} rounded={radius.pill} bg="$surface" />
        <View width={64} height={32} rounded={radius.pill} bg="$surface" />
      </XStack>
      <YStack mx={space[5]} mt={space[4]} gap={space[5]}>
        <Ticket
          top={
            <YStack gap={10}>
              <TicketBar width={110} height={12} />
              <TicketBar width={190} height={32} />
              <TicketBar width={170} height={12} />
            </YStack>
          }
          bottom={
            <XStack gap={space[4]}>
              <TicketBar width={110} height={30} />
              <TicketBar width={110} height={30} />
            </XStack>
          }
        />
        <YStack gap={10}>
          <AmountSkeleton width={140} height={16} />
          <View height={140} rounded={16} bg="$surface" />
        </YStack>
      </YStack>
    </YStack>
  );
}

function RoundArrow({ children }: { children: ReactNode }) {
  return (
    <View width={36} height={36} rounded={radius.pill} bg="$surface" items="center" justify="center">
      {children}
    </View>
  );
}
