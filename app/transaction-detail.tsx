import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy, Mail, Pencil, Receipt, Share as ShareIcon, Trash2 } from "@tamagui/lucide-icons-2";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import { MiniMap } from "../src/components/MiniMap";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { formatMoney } from "../src/api/mappers";
import { useCategoryIcons } from "../src/finance/useCategoryIcons";
import { transactionDay } from "../src/home/spending";
import { getAppLocale } from "../src/i18n";
import type { CapturedLocation } from "../src/location/captureLocation";
import { AccountSheet } from "../src/movement-form/AccountSheet";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { DateSheet } from "../src/movement-form/DateSheet";
import { LocationSheet } from "../src/movement-form/LocationSheet";
import { NoteSheet } from "../src/movement-form/NoteSheet";
import { frequentCategories, last30DaysRange, recentNotes, splitAddress } from "../src/movement-form/logic";
import { radius, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { Amount, FintButton, FintSheet, FText, IconButton, Monogram, PressableScale } from "../src/ui";
import { useNotify } from "../src/ui/notify";

type DetailParams = {
  id?: string;
  type?: "income" | "expense";
  amount?: string;
  currency?: string;
  category?: string;
  account?: string;
  note?: string;
  /** Backend nuevo: solo la nota, la descripción detectada y la hora de la operación. */
  userNote?: string;
  sourceTitle?: string;
  occurredAt?: string;
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
  /** Alto de la cabecera de la boleta: ahí van el filete y las dos muescas. */
  const [headHeight, setHeadHeight] = useState(0);
  // La nota es solo lo que escribió la persona; la descripción del correo va aparte (con el backend anterior, `note`
  // trae una o la otra).
  const [note, setNote] = useState(params.userNote ?? params.note ?? "");
  const sourceTitle = params.sourceTitle?.trim() || null;
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

  useScreenStatusBar();

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
  // La hora del correo (o de la operación) si es del mismo día que el movimiento: si se cambió la fecha, ya no aplica.
  const when = params.occurredAt ? new Date(params.occurredAt) : rawDate.includes("T") ? new Date(rawDate) : null;
  const time = when && !Number.isNaN(when.getTime()) && localDay(when) === date ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(when) : null;
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
    void Share.share({ message: [title, signed, `${longDay}${time ? `, ${time}` : ""}`, sourceTitle, note].filter(Boolean).join(" · ") });
  };

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      {/* Volver, el tipo al centro y compartir. */}
      <XStack px={space[5]} pt={space[2]} items="center" justify="space-between" gap={10}>
        <IconButton label={t("movementDetail.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
          {t(`forms.${type}`)}
        </FText>
        <IconButton label={t("movementDetail.share")} icon={<ShareIcon size={18} color="$ink" strokeWidth={2} />} onPress={share} />
      </XStack>

      <ScrollView contentContainerStyle={{ paddingTop: 10, paddingBottom: space[4] }}>
        {/*
          La boleta blanca (marca D, H-00): `canvas` con filete `line` de 1.5 y una sombra corta, radio 26 y dos muescas
          que cortan el filete entre la cabecera y los datos. `overflow` oculta la mitad de afuera de cada muesca.
        */}
        <View mx={space[5]} rounded={26} bg="$canvas" borderWidth={1.5} borderColor="$line" overflow="hidden" style={{ boxShadow: "0 16px 30px -22px rgba(20,20,18,0.5)" }}>
          {/* Cabecera: el emoji, la categoría, el monto con signo y de dónde vino. */}
          <YStack items="center" px={space[5]} pt={22} pb={20} gap={8} onLayout={(e) => setHeadHeight(e.nativeEvent.layout.height)}>
            <Monogram name={title} emoji={emoji} size={64} />
            <FText accessibilityRole="header" numberOfLines={2} style={{ fontFamily: fontFace.display[700], fontSize: 18, lineHeight: 23, marginTop: 4, textAlign: "center" }}>
              {title}
            </FText>
            <Amount value={amount} currency={currency} kind={type} variant="amount-hero" smallCents numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 44, lineHeight: 52, letterSpacing: -1 }} />
            {/* "Registrado" sobre `surface`; lo que llegó por correo o comprobante, "Detectado" en amarillo. */}
            <XStack height={28} px={10} gap={5} items="center" rounded={radius.pill} bg={sourceTitle ? "$brand" : "$surface"}>
              {sourceTitle ? <Mail size={13} color="$onBrand" strokeWidth={2.2} /> : <Check size={13} color="$ink" strokeWidth={2.4} />}
              <FText maxFontSizeMultiplier={1.3} color={sourceTitle ? "$onBrand" : "$ink"} style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
                {sourceTitle ? t("movementDetail.detected") : t("movementDetail.registered")}
              </FText>
            </XStack>
          </YStack>

          <View height={0} mx={22} borderTopWidth={1.5} borderColor="$line" />
          {headHeight ? (
            <>
              <View position="absolute" l={-13.5} t={headHeight - 12} width={24} height={24} rounded={999} bg="$canvas" borderWidth={1.5} borderColor="$line" />
              <View position="absolute" r={-13.5} t={headHeight - 12} width={24} height={24} rounded={999} bg="$canvas" borderWidth={1.5} borderColor="$line" />
            </>
          ) : null}

          {/* Datos: etiqueta arriba y valor debajo; cada fila abre la hoja del formulario y guarda al elegir. */}
          <YStack px={space[5]} pt={6} pb={8}>
            {/* Lo que trajo el correo o el comprobante: no se edita (la nota va abajo, aparte). */}
            {sourceTitle ? <SourceRow label={t("movementDetail.detected")} value={sourceTitle} /> : null}
            <DataRow divider={Boolean(sourceTitle)} label={t("movementDetail.account")} value={account || "—"} onPress={() => setSheet("account")} />
            <DataRow
              divider
              label={t("movementDetail.category")}
              value={title || "—"}
              leading={<Monogram name={title} emoji={emoji} size={32} />}
              onPress={() => setSheet("category")}
            />
            <DataRow divider label={t("movementDetail.date")} value={`${longDay}${time ? `, ${time}` : ""}`} onPress={() => setSheet("date")} />
            <DataRow divider label={t("movementDetail.note")} value={note || t("movementDetail.addNote")} muted={!note} multiline onPress={() => setSheet("note")} />

            {/* Lugar: el nombre, la dirección y el mapa, con "Editar"; sin ubicación, una fila para agregarla. */}
            {location ? (
              <YStack pt={12} pb={6} borderTopWidth={1} borderColor="$line">
                <XStack items="baseline" justify="space-between" gap={10}>
                  <FText tone="inkFaint" style={DATA_LABEL}>
                    {t("movementForm.location")}
                  </FText>
                  <PressableScale onPress={() => setSheet("location")} haptic="tap" hitSlop={12} accessibilityRole="button" accessibilityLabel={`${t("movementDetail.editLocation")} ${t("movementForm.location")}`}>
                    <FText maxFontSizeMultiplier={1.3} style={{ fontFamily: fontFace.display[700], fontSize: 13, lineHeight: 18 }}>
                      {t("movementDetail.editLocation")}
                    </FText>
                  </PressableScale>
                </XStack>
                <FText style={{ ...DATA_VALUE, marginTop: 4 }}>{place.primary ?? t("movementDetail.savedPlace")}</FText>
                {place.secondary ? (
                  <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
                    {place.secondary}
                  </FText>
                ) : null}
                <View mt={10}>
                  <MiniMap latitude={location.latitude} longitude={location.longitude} height={96} rounded={16} accessibilityLabel={t("location.mapAccessibility")} />
                </View>
              </YStack>
            ) : (
              <DataRow divider label={t("movementForm.location")} value={t("movementDetail.addLocation")} muted onPress={() => setSheet("location")} />
            )}
          </YStack>
        </View>

        {/* Recibo: pronto se podrá adjuntar. */}
        <XStack mx={space[5]} mt={space[3]} p={space[4]} gap={12} items="center" rounded={22} bg="$surface">
          <View width={40} height={40} rounded={14} bg="$canvas" items="center" justify="center">
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

      {/* Abajo, tres botones iguales: Editar en amarillo, Duplicar y Eliminar (texto rojo) sobre `surface`. */}
      <XStack gap={8} px={space[5]} pt={12} pb={Math.max(insets.bottom, 12) + 8} bg="$canvas">
        <Action label={t("movementDetail.edit")} icon={<Pencil size={20} color="$onBrand" strokeWidth={2} />} tone="brand" onPress={goEdit} />
        <Action label={t("movementDetail.duplicate")} icon={<Copy size={20} color="$ink" strokeWidth={2} />} onPress={goDuplicate} />
        <Action label={t("movementDetail.delete")} icon={<Trash2 size={20} color="$dangerHard" strokeWidth={2} />} tone="danger" onPress={() => setSheet("delete")} />
      </XStack>

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
            <View width={60} height={60} rounded={20} bg="$dangerWash" items="center" justify="center">
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
              <FintButton variant="danger" haptic="warning" pending={deleteMutation.isPending} onPress={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? t("movementUx.deleting") : t("movementDetail.deleteConfirm")}
              </FintButton>
              <FintButton variant="soft" onPress={() => setSheet(null)}>
                {t("actions.cancel")}
              </FintButton>
            </YStack>
          </YStack>
        </FintSheet>
      ) : null}
    </YStack>
  );
}

/** Etiqueta y valor de una fila de datos de la boleta (H-00): 12 en `inkFaint` arriba, 15 en tinta debajo. */
const DATA_LABEL = { fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 } as const;
const DATA_VALUE = { fontFamily: fontFace.display[700], fontSize: 15, lineHeight: 20 } as const;

/** Uno de los tres botones de abajo: alto 56, radio 18, ícono sobre la etiqueta. */
function Action({ label, icon, tone = "soft", onPress }: { label: string; icon: ReactNode; tone?: "brand" | "soft" | "danger"; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
      <YStack minH={56} py={6} rounded={18} items="center" justify="center" gap={2} bg={tone === "brand" ? "$brand" : "$surface"}>
        {icon}
        <FText
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          color={tone === "brand" ? "$onBrand" : tone === "danger" ? "$dangerHard" : "$ink"}
          style={{ fontFamily: fontFace.display[700], fontSize: 12, lineHeight: 16 }}
        >
          {label}
        </FText>
      </YStack>
    </PressableScale>
  );
}

/** "2026-09-24" del día local de una hora. */
function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** La descripción detectada: el ícono del correo, la etiqueta y el texto completo debajo (hasta tres líneas), sin acción. */
function SourceRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack gap={10} py={12} items="flex-start" accessible accessibilityLabel={`${label}: ${value}`}>
      <Mail size={16} color="$inkFaint" strokeWidth={2} style={{ marginTop: 1 }} />
      <YStack flex={1} minW={0}>
        <FText tone="inkFaint" style={DATA_LABEL}>
          {label}
        </FText>
        <FText numberOfLines={3} style={{ ...DATA_VALUE, marginTop: 2 }}>
          {value}
        </FText>
      </YStack>
    </XStack>
  );
}

/**
 * Fila de datos de la boleta: la etiqueta arriba y el valor debajo (con el cuadro de la categoría si lo hay), y la
 * flecha que dice que se puede cambiar. La nota se lee completa (`multiline`); el resto se corta en dos líneas.
 */
function DataRow({
  label,
  value,
  leading,
  muted,
  divider,
  multiline,
  onPress,
}: {
  label: string;
  value: string;
  leading?: ReactNode;
  muted?: boolean;
  divider?: boolean;
  multiline?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label}>
      {({ pressed }) => (
        <XStack items="center" gap={10} py={12} borderTopWidth={divider ? 1 : 0} borderColor="$line" bg={pressed ? "$surfaceSunken" : "transparent"}>
          <YStack flex={1} minW={0} gap={4}>
            <FText tone="inkFaint" style={DATA_LABEL}>
              {label}
            </FText>
            <XStack items="center" gap={8}>
              {leading}
              <FText
                tone={muted ? "inkMuted" : "ink"}
                numberOfLines={multiline ? undefined : 2}
                style={multiline ? { fontFamily: fontFace.sans[500], fontSize: 15, lineHeight: 22, flexShrink: 1 } : { ...DATA_VALUE, flexShrink: 1 }}
              >
                {value}
              </FText>
            </XStack>
          </YStack>
          <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
        </XStack>
      )}
    </Pressable>
  );
}
