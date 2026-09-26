import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  ScanLine,
  Search,
  Share,
  Wallet,
} from "@tamagui/lucide-icons-2";
import { useCapabilities } from "../api/capabilities";
import { useScreenStatusBar } from "../theme/useScreenStatusBar";
import { radius, space } from "../theme/tokens";
import { Chip, FintCard, FText, SegmentedControl } from "../ui";
import { AmountSkeleton } from "../ui/AmountSkeleton";

/**
 * La primera visita a un tab: en el primer cuadro se ve el esqueleto de esa pantalla (su título, sus controles y la
 * forma de su contenido), y en el siguiente se monta la pantalla real (que sigue con su propio esqueleto mientras
 * llegan los datos). Montar una pantalla entera tarda; sin esto, durante el `fade` del cambio de tab solo se veía el
 * fondo vacío. Los tabs no se precargan: cada uno pide sus datos recién cuando la persona lo abre.
 *
 * Cada esqueleto copia el encabezado de su pantalla y el esqueleto de carga que ella misma muestra, para que al
 * montarse no se reacomode nada.
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

/** Título grande con su botón a la derecha, como en cada pantalla. */
function TitleRow({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <XStack items="center" justify="space-between" px={space[4]} gap={space[3]}>
      <FText variant="display-lg">{title}</FText>
      {action}
    </XStack>
  );
}

function RoundIcon({ brand = false, children }: { brand?: boolean; children: ReactNode }) {
  return (
    <View width={40} height={40} rounded={999} items="center" justify="center" bg={brand ? "$brand" : "$surface"} borderWidth={1} borderColor={brand ? "$brand" : "$line"}>
      {children}
    </View>
  );
}

function PillShape({ height, icon, width }: { height: number; icon?: ReactNode; width: number }) {
  return (
    <XStack height={height} px={14} gap={8} items="center" rounded={radius.pill} borderWidth={1} borderColor="$lineStrong" bg="$surface">
      {icon}
      <AmountSkeleton width={width} height={12} />
    </XStack>
  );
}

const noop = () => {};

/** Movimientos: buscador, filtros, mes y moneda, resumen "Entró / Salió" y la lista del día. */
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
              <ScanLine size={20} color="$ink" strokeWidth={1.8} />
            </RoundIcon>
          ) : null
        }
      />
      <XStack mx={space[4]} mt={space[4]} height={48} px={16} gap={10} items="center" rounded={radius.pill} bg="$surface" borderWidth={1} borderColor="$line">
        <Search size={18} color="$inkFaint" />
        <FText variant="body" tone="inkFaint">
          {t("movementsTab.search")}
        </FText>
      </XStack>
      <XStack px={space[4]} pt={space[3]} gap={8} overflow="hidden">
        {(["all", "expense", "income", "transfer"] as const).map((f) => (
          <Chip key={f} variant="filter" label={t(`movementsTab.filters.${f}`)} selected={f === "all"} onPress={noop} />
        ))}
      </XStack>
      <XStack mx={space[4]} mt={space[4]} justify="space-between" items="center">
        <PillShape height={40} width={96} icon={<CalendarDays size={16} color="$ink" />} />
        <PillShape height={40} width={32} />
      </XStack>
      <FintCard mx={space[4]} mt={space[3]} p={0}>
        <XStack>
          {[
            { key: "in", icon: <ArrowUp size={14} color="$flowIn" strokeWidth={2.2} /> },
            { key: "out", icon: <ArrowDown size={14} color="$flowOut" strokeWidth={2.2} /> },
          ].map((side, i) => (
            <XStack key={side.key} flex={1}>
              {i > 0 ? <View width={1} my={14} bg="$line" /> : null}
              <YStack flex={1} px={space[4]} pt={14} pb={12} gap={4}>
                <XStack items="center" gap={6}>
                  {side.icon}
                  <FText variant="caption" tone="inkMuted">
                    {t(`movementsTab.${side.key}`)}
                  </FText>
                </XStack>
                <AmountSkeleton width={120} height={20} />
              </YStack>
            </XStack>
          ))}
        </XStack>
        <XStack mx={space[4]} py={12} borderTopWidth={1} borderColor="$line" justify="space-between" items="center">
          <AmountSkeleton width={90} height={12} />
          <AmountSkeleton width={110} height={12} />
        </XStack>
      </FintCard>
      <YStack px={space[4]} pt={space[2] + 18} gap={8}>
        <AmountSkeleton width={140} height={14} />
        <RowsCard rows={4} avatarRadius={999} trailing={<AmountSkeleton width={70} height={12} />} />
      </YStack>
    </YStack>
  );
}

/** Pagos: resumen del mes con su riel, Pendientes / Historial y la lista de pagos. */
function PaymentsSkeleton() {
  const { t } = useTranslation();
  const { capabilities } = useCapabilities();
  return (
    <YStack>
      <TitleRow
        title={t("paymentsTab.title")}
        action={
          capabilities.features.recurringPayments ? (
            <RoundIcon brand>
              <Plus size={20} color="$onBrand" strokeWidth={2.2} />
            </RoundIcon>
          ) : null
        }
      />
      <FintCard mx={space[4]} mt={space[4]} p={space[5]}>
        <AmountSkeleton width={150} height={13} />
        <View mt={8} mb={2}>
          <AmountSkeleton width={170} height={26} />
        </View>
        <View height={8} mt={16} mb={10} rounded={radius.pill} bg="$chartTrack" />
        <XStack justify="space-between" items="center" gap={space[3]}>
          <AmountSkeleton width={150} height={12} />
          <AmountSkeleton width={60} height={12} />
        </XStack>
      </FintCard>
      <View mx={space[4]} mt={space[4]}>
        <SegmentedControl
          options={[
            { value: "pending", label: t("paymentsTab.tabs.pending") },
            { value: "history", label: t("paymentsTab.tabs.history") },
          ]}
          value="pending"
          onChange={noop}
        />
      </View>
      <YStack px={space[4]} pt={18} gap={8}>
        <AmountSkeleton width={110} height={14} />
        <RowsCard
          rows={3}
          avatarRadius={radius.md}
          trailing={
            <YStack items="flex-end" gap={6}>
              <AmountSkeleton width={70} height={12} />
              <AmountSkeleton width={54} height={20} />
            </YStack>
          }
        />
      </YStack>
    </YStack>
  );
}

/** Reportes: periodo (Semana / Mes / Año), flechas entre periodos, la cuenta y las tarjetas de estado y flujo. */
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
      <View mx={space[4]} mt={14}>
        <SegmentedControl
          options={(["week", "month", "year"] as const).map((p) => ({ value: p, label: t(`reportsTab.periods.${p}`) }))}
          value="month"
          onChange={noop}
        />
      </View>
      <XStack mx={space[4]} mt={12} items="center" justify="space-between" gap={space[3]}>
        <ArrowShape>
          <ChevronLeft size={16} color="$inkMuted" strokeWidth={2.2} />
        </ArrowShape>
        <AmountSkeleton width={130} height={14} />
        <ArrowShape>
          <ChevronRight size={16} color="$inkMuted" strokeWidth={2.2} />
        </ArrowShape>
      </XStack>
      <XStack mx={space[4]} mt={10} items="center" gap={8}>
        <XStack height={34} pl={12} pr={14} gap={6} items="center" rounded={radius.pill} borderWidth={1} borderColor="$lineStrong" bg="$surface">
          <Wallet size={14} color="$inkMuted" strokeWidth={2} />
          <AmountSkeleton width={110} height={12} />
        </XStack>
      </XStack>
      <YStack mx={space[4]} mt={space[4]} gap={space[4]}>
        <FintCard p={space[5]} gap={10}>
          <AmountSkeleton width={110} height={12} />
          <AmountSkeleton width={190} height={28} />
          <AmountSkeleton width={170} height={12} />
        </FintCard>
        <FintCard p={space[5]} gap={10}>
          <AmountSkeleton width={140} height={12} />
          <AmountSkeleton width={260} height={110} />
        </FintCard>
      </YStack>
    </YStack>
  );
}

function ArrowShape({ children }: { children: ReactNode }) {
  return (
    <View width={32} height={32} rounded={radius.pill} bg="$surface" borderWidth={1} borderColor="$line" items="center" justify="center">
      {children}
    </View>
  );
}

/** Tarjeta de filas con ícono, dos líneas y el monto a la derecha, como los esqueletos de lista de las pantallas. */
function RowsCard({ rows, avatarRadius, trailing }: { rows: number; avatarRadius: number; trailing: ReactNode }) {
  return (
    <YStack rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
      {Array.from({ length: rows }, (_, i) => (
        <XStack key={i} items="center" gap={space[3]} px={space[4]} py={space[3]} borderTopWidth={i ? 1 : 0} borderColor="$line">
          <View width={38} height={38} rounded={avatarRadius} bg="$surfaceSunken" />
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
