import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, FileText, Landmark, MapPin, Pencil, Receipt, Share as ShareIcon, Tag, Trash2 } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack, type ColorTokens } from "tamagui";
import { financeApi } from "../src/api/finance";
import { MiniMap } from "../src/components/MiniMap";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { formatMoney } from "../src/api/mappers";
import { useCategoryIcons } from "../src/finance/useCategoryIcons";
import { categoryColorIndex, transactionDay } from "../src/home/spending";
import { getAppLocale } from "../src/i18n";
import type { CapturedLocation } from "../src/location/captureLocation";
import { AccountSheet } from "../src/movement-form/AccountSheet";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { DateSheet } from "../src/movement-form/DateSheet";
import { LocationSheet } from "../src/movement-form/LocationSheet";
import { NoteSheet } from "../src/movement-form/NoteSheet";
import { frequentCategories, last30DaysRange, recentNotes, splitAddress } from "../src/movement-form/logic";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { Amount, FintButton, FintCard, FintSheet, FText, IconButton, Monogram, PressableScale } from "../src/ui";
import { DashedOutline } from "../src/ui/DashedOutline";
import { useNotify } from "../src/ui/notify";

type DetailParams = {
  id?: string;
  type?: "income" | "expense";
  amount?: string;
  currency?: string;
  category?: string;
  account?: string;
  note?: string;
  date?: string;
  latitude?: string;
  longitude?: string;
  formattedAddress?: string;
};

type Sheet = "account" | "category" | "date" | "note" | "location" | "delete" | null;
/** Una hoja se desmonta cuando terminó de cerrarse (como en el formulario). */
const SHEET_UNMOUNT_MS = 600;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Detalle de un movimiento v3: volver y compartir; la cabecera con el emoji de
 * la categoría, el tipo y la fecha, el monto a 44px y "Registrado"; Editar,
 * Duplicar y Eliminar en círculos; los datos (cuenta, categoría, fecha y nota),
 * cada uno con la misma hoja del formulario, que guarda al elegir; el lugar con
 * su mapa; y el recibo que pronto se podrá adjuntar.
 *
 * Conserva la lógica anterior: los datos llegan por parámetros, editar y
 * duplicar abren el formulario, eliminar pide confirmación y vuelve atrás.
 */
export default function TransactionDetailScreen() {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeMode();
  const iconFor = useCategoryIcons();
  const params = useLocalSearchParams<DetailParams>();

  const id = params.id ?? "";
  const type = params.type === "income" ? "income" : "expense";
  const amount = Number(params.amount ?? 0);
  const rawDate = params.date ?? "";
  // Lo que se puede cambiar desde aquí; cada cambio se guarda al elegir.
  const [account, setAccount] = useState(params.account ?? "");
  const [currency, setCurrency] = useState(params.currency ?? "PEN");
  const [category, setCategory] = useState(params.category ?? "");
  const [date, setDate] = useState(rawDate.slice(0, 10));
  const [note, setNote] = useState(params.note ?? "");
  const [location, setLocation] = useState<CapturedLocation | null>(() =>
    params.latitude && params.longitude
      ? { latitude: Number(params.latitude), longitude: Number(params.longitude), formattedAddress: params.formattedAddress || null }
      : null,
  );

  const [sheet, setSheetState] = useState<Sheet>(null);
  const [mountedSheet, setMountedSheet] = useState<Sheet>(null);
  const setSheet = (next: Sheet) => {
    if (next) {
      setMountedSheet(next);
      requestAnimationFrame(() => setSheetState(next));
    } else setSheetState(null);
  };
  useEffect(() => {
    if (sheet) return;
    const timer = setTimeout(() => setMountedSheet(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(timer);
  }, [sheet]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  // Los mismos datos que usa el formulario para sus hojas (misma caché).
  const accountsQuery = useQuery({ queryKey: ["account-options"], queryFn: () => financeApi.listAccountOptions() });
  const categoriesQuery = useQuery({ queryKey: ["categories", type], queryFn: () => financeApi.listCategories(type) });
  const recentRange = useMemo(() => last30DaysRange(), []);
  const recentQuery = useQuery({
    queryKey: ["transactions", "recent-30", recentRange.from],
    queryFn: () => financeApi.listAllTransactions(recentRange),
    staleTime: 5 * 60_000,
  });
  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const frequent = useMemo(() => frequentCategories(recentQuery.data ?? [], type, categories), [categories, recentQuery.data, type]);
  const notes = useMemo(() => recentNotes((recentQuery.data ?? []).filter((tx) => tx.type === type)), [recentQuery.data, type]);
  const selectedAccount = accounts.find((a) => a.name === account);

  const invalidate = () =>
    Promise.all(["transactions", "dashboard", "accounts", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

  type Fields = { account: string; currency: string; category: string; date: string; note: string; location: CapturedLocation | null };
  const current: Fields = { account, currency, category, date, note, location };
  const apply = (fields: Fields) => {
    setAccount(fields.account);
    setCurrency(fields.currency);
    setCategory(fields.category);
    setDate(fields.date);
    setNote(fields.note);
    setLocation(fields.location);
  };

  // Guardar un cambio: se ve al instante y, si el servidor falla, vuelve a lo anterior.
  const saveMutation = useMutation({
    mutationFn: (next: Fields) =>
      financeApi.updateTransaction(id, {
        type,
        amount,
        currency: next.currency,
        category: next.category,
        account: next.account,
        note: next.note.trim() || undefined,
        transactionDate: next.date,
        ...(next.location
          ? { latitude: next.location.latitude, longitude: next.location.longitude, formattedAddress: next.location.formattedAddress ?? undefined }
          : {}),
      }),
    onMutate: (next) => {
      const previous = current;
      apply(next);
      return { previous };
    },
    onSuccess: async () => {
      toast.success(t("movementUx.updatedToast"), { message: t("movementUx.updatedMessage") });
      await invalidate();
    },
    onError: (_error, _next, context) => {
      if (context) apply(context.previous);
      toast.error(t("states.error"));
    },
  });
  const save = (patch: Partial<Fields>) => saveMutation.mutate({ ...current, ...patch });

  const deleteMutation = useMutation({
    mutationFn: () => financeApi.deleteTransaction(id),
    onSuccess: async () => {
      setSheet(null);
      await invalidate();
      toast.success(t("movementUx.deletedToast"), { message: t("movementUx.deletedMessage") });
      router.back();
    },
    onError: () => toast.error(t("movementUx.deleteError")),
  });

  const title = getCategoryLabel(category, t);
  const emoji = iconFor(category, type);

  // "Hoy, 13:42" / "Ayer" / "Viernes 18 set": la hora solo si el movimiento la trae.
  const day = transactionDay(date);
  const dayDate = day ? new Date(day.y, day.m, day.d) : null;
  const time = rawDate.includes("T") && rawDate.slice(0, 10) === date ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(rawDate)) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = dayDate ? Math.round((today.getTime() - dayDate.getTime()) / 86_400_000) : null;
  const shortDay = dayDate ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(dayDate).replace(".", "") : "—";
  const relative = diff === 0 ? t("movementDetail.today") : diff === 1 ? t("movementDetail.yesterday") : shortDay;
  const longDay = dayDate ? capitalize(`${new Intl.DateTimeFormat(locale, { weekday: "long" }).format(dayDate)} ${shortDay}`) : "—";
  const place = splitAddress(location?.formattedAddress);

  const goEdit = () =>
    router.push({
      pathname: "/transaction-form",
      params: {
        id,
        type,
        amount: String(amount),
        currency,
        category,
        account,
        note,
        date,
        ...(location ? { latitude: String(location.latitude), longitude: String(location.longitude), formattedAddress: location.formattedAddress ?? "" } : {}),
      },
    });
  // Sin id ni fecha: crea uno nuevo prellenado, con fecha de hoy.
  const goDuplicate = () => router.push({ pathname: "/transaction-form", params: { type, amount: String(amount), currency, category, account, note } });
  const share = () => {
    const signed = `${type === "expense" ? "−" : "+"}${formatMoney(amount, currency)}`;
    void Share.share({ message: [title, signed, `${longDay}${time ? `, ${time}` : ""}`, note].filter(Boolean).join(" · ") });
  };

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView contentContainerStyle={{ paddingTop: space[2], paddingBottom: insets.bottom + space[6] }}>
        {/* Volver y compartir. Sin título: la categoría ya lo dice. */}
        <XStack px={space[4]} items="center" justify="space-between">
          <IconButton label={t("movementDetail.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <IconButton label={t("movementDetail.share")} icon={<ShareIcon size={18} color="$ink" strokeWidth={2} />} onPress={share} />
        </XStack>

        {/* Cabecera. */}
        <YStack items="center" px={space[4]} pt={6}>
          <View rounded={999} borderWidth={1} borderColor="$line">
            <Monogram name={title} emoji={emoji} size={64} color={`$chart${categoryColorIndex(title)}` as ColorTokens} />
          </View>
          <FText variant="title" accessibilityRole="header" numberOfLines={2} style={{ fontSize: 20, lineHeight: 26, marginTop: 12, textAlign: "center" }}>
            {title}
          </FText>
          <FText variant="caption" tone="inkFaint" style={{ fontSize: 13, marginTop: 2 }}>
            {`${t(`forms.${type}`)} · ${relative}${time ? `, ${time}` : ""}`}
          </FText>
          <Amount value={amount} currency={currency} kind={type} variant="amount-hero" style={{ fontSize: 44, lineHeight: 52, letterSpacing: -2, marginTop: 12 }} />
          <XStack mt={10} height={26} px={10} gap={5} items="center" rounded={radius.pill} bg="$surfaceSunken">
            <View width={6} height={6} rounded={999} bg="$flowIn" />
            <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[500] }}>
              {t("movementDetail.registered")}
            </FText>
          </XStack>
        </YStack>

        {/* Acciones: Editar y Duplicar en `brandWash`; Eliminar en `dangerHard` sobre `surfaceSunken`. */}
        <XStack justify="center" gap={28} mt={22}>
          <Action label={t("movementDetail.edit")} icon={<Pencil size={20} color="$brand" strokeWidth={1.8} />} onPress={goEdit} />
          <Action label={t("movementDetail.duplicate")} icon={<Copy size={20} color="$brand" strokeWidth={1.8} />} onPress={goDuplicate} />
          <Action label={t("movementDetail.delete")} icon={<Trash2 size={20} color="$dangerHard" strokeWidth={1.8} />} danger onPress={() => setSheet("delete")} />
        </XStack>

        {/* Datos: cada fila abre la hoja del formulario y guarda al elegir. */}
        <FintCard mx={space[4]} mt={22} p={0} overflow="hidden">
          <DataRow icon={<Landmark size={16} color="$inkMuted" strokeWidth={2} />} label={t("movementDetail.account")} value={account || "—"} onPress={() => setSheet("account")} />
          <DataRow
            divider
            icon={<Tag size={16} color="$inkMuted" strokeWidth={2} />}
            label={t("movementDetail.category")}
            value={title || "—"}
            emoji={emoji}
            onPress={() => setSheet("category")}
          />
          <DataRow
            divider
            icon={<CalendarDays size={16} color="$inkMuted" strokeWidth={2} />}
            label={t("movementDetail.date")}
            value={`${longDay}${time ? `, ${time}` : ""}`}
            onPress={() => setSheet("date")}
          />
          <DataRow
            divider
            icon={<FileText size={16} color="$inkMuted" strokeWidth={2} />}
            label={t("movementDetail.note")}
            value={note || t("movementDetail.addNote")}
            muted={!note}
            onPress={() => setSheet("note")}
          />
        </FintCard>

        {/* Lugar: el mapa con el pin, el nombre y la dirección; sin ubicación, una fila para agregarla. */}
        {location ? (
          <FintCard mx={space[4]} mt={space[3]} p={0} overflow="hidden">
            <MiniMap latitude={location.latitude} longitude={location.longitude} height={128} rounded={0} accessibilityLabel={t("location.mapAccessibility")} />
            <XStack items="center" gap={10} px={space[4]} py={12} borderTopWidth={1} borderColor="$line">
              <YStack flex={1} minW={0}>
                <FText variant="body-strong" numberOfLines={1} style={{ fontSize: 14 }}>
                  {place.primary ?? t("movementDetail.savedPlace")}
                </FText>
                {place.secondary ? (
                  <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                    {place.secondary}
                  </FText>
                ) : null}
              </YStack>
              <PressableScale onPress={() => setSheet("location")} haptic="tap" hitSlop={10} accessibilityRole="button">
                <FText variant="label" tone="brand" style={{ fontSize: 13, fontFamily: fontFace.sans[600] }}>
                  {t("movementDetail.editLocation")}
                </FText>
              </PressableScale>
            </XStack>
          </FintCard>
        ) : (
          <FintCard mx={space[4]} mt={space[3]} p={0} overflow="hidden">
            <DataRow icon={<MapPin size={16} color="$inkMuted" strokeWidth={2} />} label={t("movementDetail.addLocation")} value="" onPress={() => setSheet("location")} />
          </FintCard>
        )}

        {/* Recibo: pronto se podrá adjuntar. */}
        <XStack mx={space[4]} mt={space[3]} p={space[4]} gap={12} items="center">
          <DashedOutline radius={radius.lg} />
          <View width={40} height={40} rounded={999} bg="$surfaceSunken" items="center" justify="center">
            <Receipt size={18} color="$inkFaint" strokeWidth={2} />
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" tone="inkMuted" style={{ fontSize: 14 }}>
              {t("transactionDetail.receiptTitle")}
            </FText>
            <FText variant="caption" tone="inkFaint">
              {t("transactionDetail.receiptHint")}
            </FText>
          </YStack>
        </XStack>
      </ScrollView>

      {mountedSheet === "account" ? (
        <AccountSheet
          open={sheet === "account"}
          onClose={() => setSheet(null)}
          title={t("movementDetail.account")}
          accounts={accounts}
          selected={selectedAccount ? { id: selectedAccount.id, currency } : null}
          onSelect={({ account: next, currency: cur }) => {
            if (next.name !== account || cur !== currency) save({ account: next.name, currency: cur });
          }}
        />
      ) : null}
      {mountedSheet === "category" ? (
        <CategorySheet
          open={sheet === "category"}
          onClose={() => setSheet(null)}
          type={type}
          categories={categories}
          frequent={frequent}
          value={category}
          onSelect={(name) => {
            if (name !== category) save({ category: name });
          }}
        />
      ) : null}
      {mountedSheet === "date" ? (
        <DateSheet
          open={sheet === "date"}
          onClose={() => setSheet(null)}
          value={date}
          onChange={(next) => {
            if (next !== date) save({ date: next });
          }}
        />
      ) : null}
      {mountedSheet === "note" ? (
        <NoteSheet
          open={sheet === "note"}
          onClose={() => setSheet(null)}
          value={note}
          onChange={(next) => {
            if (next.trim() !== note.trim()) save({ note: next });
          }}
          recent={notes}
        />
      ) : null}
      {mountedSheet === "location" ? (
        <LocationSheet open={sheet === "location"} onClose={() => setSheet(null)} value={location} suggestion={null} onSave={(next) => save({ location: next })} />
      ) : null}
      {mountedSheet === "delete" ? (
        <FintSheet open={sheet === "delete"} onClose={() => setSheet(null)}>
          <YStack items="center" px={space[5]} pt={space[4]}>
            <View width={56} height={56} rounded={999} bg="$red2" items="center" justify="center">
              <Trash2 size={24} color="$dangerHard" strokeWidth={2} />
            </View>
            <FText variant="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 14, textAlign: "center" }}>
              {t("movementDetail.deleteTitle")}
            </FText>
            <FText variant="body" tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }}>
              {`${title}, `}
              <FText variant="body" style={{ fontSize: 14, fontFamily: fontFace.mono[500] }}>
                {`${type === "expense" ? "−" : "+"}${formatMoney(amount, currency)}`}
              </FText>
              {`, ${t("movementDetail.deleteAfter", { account })}`}
            </FText>
            <YStack self="stretch" gap={10} mt={22}>
              <FintButton variant="danger" haptic="warning" disabled={deleteMutation.isPending} onPress={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? t("movementUx.deleting") : t("movementDetail.deleteConfirm")}
              </FintButton>
              <FintButton variant="ghost" bg="$surfaceSunken" color="$ink" onPress={() => setSheet(null)}>
                {t("actions.cancel")}
              </FintButton>
            </YStack>
          </YStack>
        </FintSheet>
      ) : null}
    </YStack>
  );
}

function Action({ label, icon, danger, onPress }: { label: string; icon: ReactNode; danger?: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={label}>
      <YStack items="center" gap={6}>
        <View width={50} height={50} rounded={999} bg={danger ? "$surfaceSunken" : "$brandWash"} items="center" justify="center">
          {icon}
        </View>
        <FText variant="caption" tone={danger ? "dangerHard" : "inkMuted"} style={{ fontFamily: fontFace.sans[500] }}>
          {label}
        </FText>
      </YStack>
    </PressableScale>
  );
}

/** Fila de datos: icono en `surfaceSunken`, etiqueta, valor a la derecha y la flecha que dice que se puede cambiar. */
function DataRow({
  icon,
  label,
  value,
  emoji,
  muted,
  divider,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** El emoji que la persona eligió para la categoría, antes del nombre. */
  emoji?: string | null;
  muted?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label}>
      {({ pressed }) => (
        <XStack items="center" gap={12} px={space[4]} py={13} borderTopWidth={divider ? 1 : 0} borderColor="$line" bg={pressed ? "$surfaceSunken" : "transparent"}>
          <View width={32} height={32} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
            {icon}
          </View>
          <FText variant="caption" tone={value ? "inkMuted" : "ink"} style={{ fontSize: value ? 13 : 15 }}>
            {label}
          </FText>
          <XStack flex={1} minW={0} justify="flex-end" items="center" gap={6}>
            {emoji ? (
              <Text style={{ fontSize: 15, lineHeight: 20 }} accessibilityElementsHidden importantForAccessibility="no">
                {emoji}
              </Text>
            ) : null}
            <FText
              variant="body"
              tone={muted ? "inkMuted" : "ink"}
              numberOfLines={1}
              style={{ fontSize: 15, fontFamily: muted ? fontFace.sans[400] : fontFace.sans[500], textAlign: "right", flexShrink: 1 }}
            >
              {value}
            </FText>
          </XStack>
          <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
        </XStack>
      )}
    </Pressable>
  );
}
