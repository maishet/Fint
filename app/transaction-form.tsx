import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronRight, FileText, Grid2x2, MapPin, Plus, Wallet, X } from "@tamagui/lucide-icons-2";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, useWindowDimensions } from "react-native";
import Animated, { FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../src/api/finance";
import { getAppLocale } from "../src/i18n";
import type { AccountOption, Category } from "../src/api/types";
import { UnsavedChangesDialog } from "../src/components/UnsavedChangesDialog";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { formatAmount } from "../src/finance/formatAmount";
import { parseDateString, todayDateString, toDateString } from "../src/finance/dates";
import { amountInputValue, applyAmountKey } from "../src/forms/amountInput";
import { useUnsavedChangesGuard } from "../src/hooks/useUnsavedChangesGuard";
import { describeLocationDetailed, getLastKnownPosition, getLocationPermissionState, type CapturedLocation } from "../src/location/captureLocation";
import { useLocationPreference } from "../src/location/LocationPreferenceProvider";
import { findSavedPlace, locationLines } from "../src/location/places";
import { useSavedPlaces } from "../src/location/savedPlaces";
import { AccountSheet } from "../src/movement-form/AccountSheet";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { CATEGORY_GRID_MAX, CategoryStrip } from "../src/movement-form/CategoryStrip";
import { DateSheet, shortDay } from "../src/movement-form/DateSheet";
import { GrowPresence, type GrowPresenceHandle } from "../src/movement-form/GrowPresence";
import { LocationSheet } from "../src/movement-form/LocationSheet";
import { MapThumb } from "../src/movement-form/MapThumb";
import {
  accountBalance,
  accountCurrencies,
  balanceAfter,
  frequentCategories,
  last30DaysRange,
  recentNotes,
  sharedCurrencies,
  type MovementKind,
} from "../src/movement-form/logic";
import { NOTE_MAX, NoteSheet } from "../src/movement-form/NoteSheet";
import { TransferAccounts } from "../src/movement-form/TransferAccounts";
import { useSensitiveMoney } from "../src/privacy/useSensitiveMoney";
import { COMPACT_FONT_SCALE } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import {
  Amount,
  AmountDisplay,
  Chip,
  AmountKeypad,
  FintButton,
  FintLottie,
  FintSheet,
  FintSpinner,
  FText,
  IconButton,
  ListRow,
  Monogram,
  PressableScale,
  SegmentedControl,
} from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { InlineSheetContext } from "../src/ui/FintSheet";
import { riseIn } from "../src/ui/entering";
import { haptics } from "../src/ui/haptics";
import { useNotify } from "../src/ui/notify";

type Sheet = "account" | "origin" | "destination" | "currency" | "category" | "date" | "location" | "note" | null;
type Errors = Partial<Record<"amount" | "account" | "category" | "transfer", string>>;

/** Lo que tarda una hoja en terminar de bajar antes de desmontarla. */
const SHEET_UNMOUNT_MS = 600;

/** Tiempo que el toast ofrece "Deshacer". */
const UNDO_MS = 5000;
const COIN_ICON = 30;
const COIN_DELAY_MS = 350;

/**
 * Formulario de movimiento v3: pantalla modal completa sobre `canvas`. El monto
 * es el protagonista (64px, teclado propio); cuenta, categoría, fecha, ubicación
 * y nota se eligen en hojas. El botón vive debajo del teclado en las tres
 * pestañas, donde cae el pulgar.
 *
 * Conserva la lógica del formulario anterior: crear y editar movimientos,
 * transferencias entre saldos que comparten moneda, cuentas con varios saldos,
 * ubicación opcional y la guardia de cambios sin guardar.
 */
export default function TransactionFormScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  // Desde 1.3, la tira de categorías y las fichas de detalle pasan a filas de Detalles con el valor en varias líneas.
  const largeText = fontScale >= COMPACT_FONT_SCALE;
  useScreenStatusBar();
  const reduceMotion = useReducedMotion();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    id?: string;
    type?: MovementKind;
    amount?: string;
    currency?: string;
    category?: string;
    account?: string;
    note?: string;
    date?: string;
    latitude?: string;
    longitude?: string;
    formattedAddress?: string;
    /** "fab": se abrió desde el botón central y crece desde él. */
    origin?: string;
  }>();
  const isEditing = Boolean(params.id);

  const [kind, setKind] = useState<MovementKind>(
    !isEditing && params.type === "transfer" ? "transfer" : params.type === "income" ? "income" : "expense",
  );
  const [amount, setAmount] = useState(() => normalizeAmountParam(params.amount));
  const [category, setCategory] = useState(params.category ?? "");
  const [accountName, setAccountName] = useState(params.account ?? "");
  const [currency, setCurrency] = useState(params.currency ?? "");
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [transferCurrency, setTransferCurrency] = useState("");
  const [note, setNote] = useState(params.note ?? "");
  const [date, setDate] = useState(() => params.date ?? todayDateString());
  const [location, setLocation] = useState<CapturedLocation | null>(() =>
    params.latitude && params.longitude
      ? {
          latitude: Number(params.latitude),
          longitude: Number(params.longitude),
          formattedAddress: params.formattedAddress || null,
        }
      : null,
  );
  const [suggestion, setSuggestion] = useState<CapturedLocation | null>(null);
  // Solo se monta la hoja que se abre, y se desmonta al terminar de cerrarse: montadas todas, cada tecla
  // re-renderizaba siete hojas en el portal de Tamagui y el formulario se atrasaba.
  const [sheet, setSheetState] = useState<Sheet>(null);
  const [mountedSheet, setMountedSheet] = useState<Sheet>(null);
  const setSheet = (next: Sheet) => {
    // Se monta y se abre en el mismo render: `FintSheet` espera un cuadro antes de subir, así que igual se anima.
    if (next) setMountedSheet(next);
    setSheetState(next);
  };
  useEffect(() => {
    if (sheet) return;
    const id = setTimeout(() => setMountedSheet(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [sheet]);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  // Categoría, fecha, ubicación y nota se montan cuando la pantalla terminó de entrar. El primer cuadro lleva lo
  // indispensable (tipo, cuenta, monto, teclado y botón): así crece antes, y lo demás no se dibuja a mitad del crecimiento.
  const [entered, setEntered] = useState(false);

  const isDirty =
    !saved && (amount !== normalizeAmountParam(params.amount) || note !== (params.note ?? "") || category !== (params.category ?? ""));
  const guard = useUnsavedChangesGuard(isDirty);

  // Datos -----------------------------------------------------------------
  const accountsQuery = useQuery({
    queryKey: ["account-options"],
    queryFn: () => financeApi.listAccountOptions(),
  });
  const categoryType = kind === "income" ? "income" : "expense";
  const categoriesQuery = useQuery({
    queryKey: ["categories", categoryType],
    queryFn: () => financeApi.listCategories(categoryType),
    enabled: kind !== "transfer",
  });
  const recentRange = useMemo(() => last30DaysRange(), []);
  const recentQuery = useQuery({
    queryKey: ["transactions", "recent-30", recentRange.from],
    queryFn: () => financeApi.listAllTransactions(recentRange),
    staleTime: 5 * 60_000,
  });

  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  // Sin elección todavía, ya se muestran las cuentas por defecto (el efecto de abajo las fija después del primer
  // render): el formulario entra con "Elegir cuenta" y enseguida cambiaba a la cuenta, a la vista durante el crecimiento.
  const account = accountName ? accounts.find((a) => a.name === accountName) : accounts[0];
  const origin = originId ? accounts.find((a) => a.id === originId) : accounts[0];
  const destination = destinationId ? accounts.find((a) => a.id === destinationId) : accounts[1];

  const movementCurrency = account ? (accountCurrencies(account).includes(currency) ? currency : account.currency) : currency || "PEN";
  const shared = useMemo(() => sharedCurrencies(origin, destination), [origin, destination]);
  const transferCur = shared.includes(transferCurrency) ? transferCurrency : (shared[0] ?? "");
  const displayCurrency = kind === "transfer" ? transferCur || origin?.currency || "PEN" : movementCurrency;

  const frequent = useMemo(
    () => (kind === "transfer" ? [] : frequentCategories(recentQuery.data ?? [], categoryType, categories, CATEGORY_GRID_MAX)),
    [categories, categoryType, kind, recentQuery.data],
  );
  const notes = useMemo(
    () => recentNotes((recentQuery.data ?? []).filter((tx) => (kind === "transfer" ? tx.transferGroupId : tx.type === kind))),
    [kind, recentQuery.data],
  );

  // Valores por defecto: primera cuenta; en una transferencia, las dos primeras.
  useEffect(() => {
    if (!accountName && accounts[0]) setAccountName(accounts[0].name);
    if (!originId && accounts[0]) setOriginId(accounts[0].id);
    if (!destinationId && accounts[1]) setDestinationId(accounts[1].id);
  }, [accountName, accounts, destinationId, originId]);

  // Una categoría de otro tipo no sirve al cambiar de pestaña.
  useEffect(() => {
    if (category && categoriesQuery.isSuccess && !categories.some((c) => c.name === category)) setCategory("");
  }, [categories, categoriesQuery.isSuccess, category]);

  // Sugerencia de lugar: solo si la persona activó "Ubicación en movimientos" y ya dio permiso. Nunca se guarda sola.
  const locationPref = useLocationPreference();
  // Un lugar guardado ("Casa") se reconoce a menos de 50 m y se muestra en una píldora en el campo Ubicación.
  const { places: savedPlaces } = useSavedPlaces();
  const savedPlace = location ? findSavedPlace(savedPlaces, location) : null;
  useEffect(() => {
    if (isEditing || location || !locationPref.isHydrated || !locationPref.enabled) return;
    let cancelled = false;
    void (async () => {
      if ((await getLocationPermissionState()) !== "granted") return;
      const position = await getLastKnownPosition();
      if (!position || cancelled) return;
      const address = await describeLocationDetailed(position.latitude, position.longitude);
      if (!cancelled) setSuggestion({ ...position, ...address });
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditing, location, locationPref.enabled, locationPref.isHydrated]);

  // Guardar ---------------------------------------------------------------
  const value = amountInputValue(amount);
  // Al editar, lo que el movimiento original ya movió en su cuenta (si sigue en la misma cuenta y moneda).
  const original = amountInputValue(normalizeAmountParam(params.amount));
  const editOffset =
    isEditing && account?.name === params.account && (!params.currency || params.currency === movementCurrency)
      ? params.type === "income"
        ? -original
        : original
      : 0;

  // Se cierra en cuanto responde el servidor; las listas se refrescan detrás y el movimiento nuevo entra con `fade`.
  const afterSave = () => {
    setSaved(true);
    void invalidateMovementQueries(queryClient);
    grow.current?.close(() => guard.bypass(() => router.back())) ?? guard.bypass(() => router.back());
  };

  // Cerrar: si hay cambios, primero la guardia (y "Descartar" encoge la pantalla); si no, se encoge y sale.
  const grow = useRef<GrowPresenceHandle>(null);
  const requestClose = () => {
    if (isDirty) router.back();
    else if (grow.current) grow.current.close(() => guard.bypass(() => router.back()));
    else router.back();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    // "Atrás" de Android: las hojas abiertas lo atienden antes (se registran después); si no hay, se cierra animado.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      requestCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const saveMovement = useMutation({
    mutationFn: async () => {
      const payload = {
        type: kind as "expense" | "income",
        amount: value,
        currency: movementCurrency,
        category,
        account: accountName,
        note: note.trim() || undefined,
        transactionDate: date,
        ...(location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              formattedAddress: location.formattedAddress ?? undefined,
            }
          : {}),
      };
      if (params.id) {
        await financeApi.updateTransaction(params.id, payload);
        return null;
      }
      return financeApi.createTransaction(payload);
    },
    onSuccess: async (result) => {
      toast.show(t(isEditing ? "movementUx.updatedToast" : "movements.createdToast"), {
        message: t(isEditing ? "movementUx.updatedMessage" : "movements.createdMessage"),
        preset: "success",
        ...(result
          ? {
              duration: UNDO_MS,
              icon: <FintLottie name="coin-drop" size={COIN_ICON} play={["drop"]} loop="rest" delay={COIN_DELAY_MS} />,
              action: {
                label: t("movementForm.undo"),
                onPress: () => void undo(() => financeApi.deleteTransaction(result.id)),
              },
            }
          : {}),
      });
      afterSave();
    },
    onError: (error) =>
      toast.show(t("states.error"), {
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      }),
  });

  const saveTransfer = useMutation({
    mutationFn: () =>
      financeApi.createTransfer({
        originAccountId: originId,
        destinationAccountId: destinationId,
        amount: value,
        currency: transferCur,
        transactionDate: date,
        note: note.trim() || null,
      }),
    onSuccess: async (result) => {
      toast.show(t("movements.createdToast"), {
        message: t("movements.createdMessage"),
        preset: "success",
        duration: UNDO_MS,
        icon: <FintLottie name="coin-drop" size={COIN_ICON} play={["drop"]} loop="rest" delay={COIN_DELAY_MS} />,
        action: {
          label: t("movementForm.undo"),
          onPress: () => void undo(() => financeApi.reverseTransfer(result.transferGroupId)),
        },
      });
      afterSave();
    },
    onError: (error) =>
      toast.show(t("states.error"), {
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      }),
  });

  const undo = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await invalidateMovementQueries(queryClient);
      toast.show(t("movementForm.undone"), { preset: "info" });
    } catch {
      toast.show(t("movementForm.undoError"), { preset: "error" });
    }
  };

  const isPending = saveMovement.isPending || saveTransfer.isPending;

  // No se valida mientras se escribe: los errores aparecen al tocar el botón, debajo de lo que falta.
  const missing = (): Errors => {
    const next: Errors = {};
    if (!(value > 0)) next.amount = t("movementForm.errors.amount");
    if (kind === "transfer") {
      if (!origin || !destination) next.transfer = t("movementForm.errors.account");
      else if (origin.id === destination.id) next.transfer = t("movementForm.errors.sameAccount");
      else if (!transferCur) next.transfer = t("movementForm.noSharedCurrency");
    } else {
      if (!account) next.account = t("movementForm.errors.account");
      if (!categories.some((c) => c.name === category)) next.category = t("movementForm.errors.category");
    }
    return next;
  };
  const ready = Object.keys(missing()).length === 0;

  const submit = () => {
    const next = missing();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      haptics.warning();
      // El rol `alert` de los errores no habla solo en Android: se anuncian una vez, en el orden en que se ven
      // (cuenta, monto, transferencia, categoría). Sin región viva en cada error, o TalkBack los leería dos veces.
      AccessibilityInfo.announceForAccessibility(
        [next.account, next.amount, next.transfer, next.category].filter(Boolean).join(". "),
      );
      return;
    }
    if (kind === "transfer") saveTransfer.mutate();
    else saveMovement.mutate();
  };

  // Cambios ---------------------------------------------------------------
  const changeKind = (next: MovementKind) => {
    setKind(next);
    setErrors({});
  };
  const onKey = (key: Parameters<typeof applyAmountKey>[1]) => {
    setAmount((current) => applyAmountKey(current, key));
    if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
  };
  const clearError = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  // Presentación ----------------------------------------------------------
  const loadingAccounts = accountsQuery.isLoading;
  const noAccounts = accountsQuery.isSuccess && accounts.length === 0;
  const today = todayDateString();
  const yesterday = toDateString(new Date(Date.now() - 86_400_000));
  const dateLabel =
    date === today
      ? t("movementForm.today")
      : date === yesterday
        ? t("movementForm.yesterday")
        : shortDay(parseDateString(date) ?? new Date(), locale);
  const showLocation = kind !== "transfer" && (Boolean(location) || (locationPref.isHydrated && locationPref.enabled));

  const ctaLabel = isPending
    ? t(isEditing ? "movementForm.updating" : "movementForm.saving")
    : isEditing
      ? t("movementForm.saveChanges")
      : kind === "transfer"
        ? value > 0
          ? t("movementForm.register.transfer", {
              amount: formatAmount(value, displayCurrency),
            })
          : t("movementForm.register.transferEmpty")
        : t(kind === "income" ? "movementForm.register.income" : "movementForm.register.expense");

  const tabs = [
    { value: "expense" as const, label: t("movementForm.tabs.expense") },
    { value: "income" as const, label: t("movementForm.tabs.income") },
    ...(isEditing
      ? []
      : [
          {
            value: "transfer" as const,
            label: t("movementForm.tabs.transfer"),
          },
        ]),
  ];

  const chipCategories = useMemo(() => {
    const picked = categories.find((c) => c.name === category);
    // Siete casillas junto a «Todas»: la elegida desde la hoja entra primera si no está entre las frecuentes.
    return (picked && !frequent.some((c) => c.id === picked.id) ? [picked, ...frequent] : frequent).slice(0, CATEGORY_GRID_MAX);
  }, [categories, category, frequent]);

  const layout = reduceMotion ? undefined : LinearTransition.springify().damping(26).stiffness(240);

  return (
    <InlineSheetContext.Provider value>
      <UnsavedChangesDialog
        open={guard.open}
        onCancel={guard.onCancel}
        onConfirm={() => guard.confirmWith((proceed) => (grow.current ? grow.current.close(proceed) : proceed()))}
      />

      <GrowPresence ref={grow} fromFab={params.origin === "fab"} onEntered={() => setEntered(true)}>
        <YStack flex={1} bg="$canvas" pt={insets.top}>
          {/* Barra superior: cerrar y tipo (el activo en amarillo). */}
          <XStack items="center" gap={10} px={20} pt={8}>
            <IconButton label={t("movementForm.close")} icon={<X size={20} color="$ink" strokeWidth={2} />} onPress={requestClose} />
            <View flex={1}>
              <SegmentedControl tone="brand" options={tabs} value={kind} onChange={changeKind} accessibilityLabel={t("movementForm.tabsLabel")} />
            </View>
          </XStack>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* El monto y la cuenta se centran en el espacio libre que dejan la tira y el teclado. */}
            <YStack flex={1} justify="center" minH={170} py={12}>
              {kind === "transfer" ? (
                <Animated.View key="transfer" entering={riseIn({ distance: 8, reduceMotion })} exiting={FadeOut.duration(120)}>
                  {loadingAccounts ? (
                    <YStack gap={8} mx={20} mb={12}>
                      <AmountSkeleton width={320} height={64} />
                      <AmountSkeleton width={320} height={64} />
                    </YStack>
                  ) : (
                    <TransferAccounts
                      origin={origin}
                      destination={destination}
                      currency={displayCurrency}
                      onPickOrigin={() => setSheet("origin")}
                      onPickDestination={() => setSheet("destination")}
                      onSwap={() => {
                        setOriginId(destinationId);
                        setDestinationId(originId);
                      }}
                    />
                  )}
                </Animated.View>
              ) : null}

              <Animated.View layout={layout}>
                {/* Monto: 62px, no escala con la letra del sistema. */}
                <View mt={kind === "transfer" ? 16 : 0} px={20}>
                  <AmountDisplay input={amount} currency={displayCurrency} kind={kind} expectedWidth={screenWidth - 40} />
                </View>

                {kind !== "transfer" ? (
                  <Animated.View key="single" entering={riseIn({ distance: 8, reduceMotion })} exiting={FadeOut.duration(120)}>
                    {/* `pb` deja sitio al `hitSlop` de la píldora: Android recorta el área de toque al borde del contenedor. */}
                    <YStack items="center" gap={8} mt={8} pb={PILL_SLOP}>
                      {loadingAccounts ? (
                        <AmountSkeleton width={180} height={34} />
                      ) : noAccounts ? (
                        <FintButton variant="outlined" size="mini" minH={36} px={16} icon={<Plus size={16} />} onPress={() => router.push("/account-form")}>
                          {t("movementForm.createAccount")}
                        </FintButton>
                      ) : (
                        <AccountPill
                          label={t(kind === "income" ? "movementForm.to" : "movementForm.from")}
                          account={account}
                          currency={movementCurrency}
                          onPress={() => setSheet("account")}
                        />
                      )}
                      {errors.account ? <ErrorText>{errors.account}</ErrorText> : null}
                      {noAccounts ? (
                        <FText variant="caption" tone="inkFaint">
                          {t("movementForm.noAccounts")}
                        </FText>
                      ) : null}
                    </YStack>
                  </Animated.View>
                ) : null}

                {/* Debajo: cómo queda la cuenta, la moneda de la transferencia o el error. */}
                <View minH={18} mt={kind === "transfer" ? 6 : 0} px={20} items="center">
                  {errors.amount ? (
                    <ErrorText>{errors.amount}</ErrorText>
                  ) : kind === "transfer" ? (
                    <TransferCurrencyLine
                      shared={shared}
                      currency={transferCur}
                      error={errors.transfer}
                      hasBoth={Boolean(origin && destination)}
                      onPick={() => setSheet("currency")}
                    />
                  ) : account && value > 0 ? (
                    <BalanceLine account={account} currency={movementCurrency} amount={value} kind={kind} offset={editOffset} />
                  ) : null}
                </View>
              </Animated.View>
            </YStack>

            {largeText ? (
              // Con letra grande, en lugar de la tira y las fichas, las filas de Detalles con el valor en varias líneas.
              <DetailsList
                kind={kind}
                category={kind !== "transfer" ? (categories.find((c) => c.name === category) ?? null) : null}
                categoryLabel={category ? getCategoryLabel(category, t) : null}
                dateLabel={dateLabel}
                showLocation={showLocation}
                location={location}
                placeName={savedPlace?.name ?? null}
                note={note}
                onCategory={() => setSheet("category")}
                onDate={() => setSheet("date")}
                onLocation={() => setSheet("location")}
                onNote={() => setSheet("note")}
                categoryError={errors.category}
              />
            ) : (
              <YStack gap={10}>
                {/* Categoría: «Todas» abre la hoja; las frecuentes van en una cuadrícula de dos filas con su emoji. */}
                {kind !== "transfer" ? (
                  <YStack>
                    <CategoryStrip
                      categories={chipCategories.map((c) => ({ category: c, label: getCategoryLabel(c.name, t) }))}
                      value={category}
                      loading={!entered || categoriesQuery.isLoading}
                      onSelect={(name) => {
                        setCategory(name);
                        clearError("category");
                      }}
                      onAll={() => setSheet("category")}
                      allLabel={t("movementForm.allCategoriesA11y")}
                      allShortLabel={t("movementForm.allCategoriesShort")}
                      accessibilityLabel={t("movementForm.category")}
                    />
                    {errors.category ? (
                      <View px={20} mt={6}>
                        <ErrorText align="left">{errors.category}</ErrorText>
                      </View>
                    ) : null}
                  </YStack>
                ) : null}

                {/* Fecha, Lugar y Nota en fichas que se envuelven en dos filas; llenas en `surface`, vacías con contorno. */}
                <XStack px={20} gap={6} flexWrap="wrap">
                  <DetailChip icon={<CalendarDays size={16} color="$ink" strokeWidth={2} />} label={dateLabel} a11y={`${t("movementForm.date")}: ${dateLabel}`} onPress={() => setSheet("date")} />
                  {showLocation ? (
                    <DetailChip
                      icon={<MapPin size={16} color={location ? "$ink" : "$inkMuted"} strokeWidth={2} />}
                      label={location ? (savedPlace?.name ?? locationLines(location).primary ?? t("movementForm.location")) : suggestion ? t("movementForm.nearby") : t("movementForm.addLocation")}
                      a11y={location ? `${t("movementForm.location")}: ${savedPlace?.name ?? locationLines(location).primary ?? ""}` : t("movementForm.addLocation")}
                      empty={!location}
                      onPress={() => setSheet("location")}
                    />
                  ) : null}
                  <DetailChip
                    icon={<FileText size={16} color={note.trim() ? "$ink" : "$inkMuted"} strokeWidth={2} />}
                    label={note.trim() || t("movementForm.note")}
                    a11y={note.trim() ? `${t("movementForm.note")}: ${note.trim()}` : t("movementForm.addNote")}
                    empty={!note.trim()}
                    onPress={() => setSheet("note")}
                  />
                </XStack>
              </YStack>
            )}
          </ScrollView>

          {/* Teclado y botón pegados abajo, sin hueco debajo del botón. */}
          <AmountKeypad onKey={onKey} onClear={() => setAmount("")} />
          <View px={20} pt={12} pb={Math.max(insets.bottom, 12) + 4}>
            <FintButton
              disabled={loadingAccounts && !noAccounts && !isPending}
              pending={isPending}
              icon={isPending ? <FintSpinner color="$onBrand" /> : undefined}
              onPress={submit}
            >
              {ctaLabel}
            </FintButton>
          </View>
        </YStack>
      </GrowPresence>

      {/* Hojas: una sola abierta a la vez. */}
      {mountedSheet === "account" ? (
        <AccountSheet
          open={sheet === "account"}
          onClose={() => setSheet(null)}
          title={t(kind === "income" ? "movementForm.to" : "movementForm.from")}
          accounts={accounts}
          selected={account ? { id: account.id, currency: movementCurrency } : null}
          onSelect={({ account: next, currency: cur }) => {
            setAccountName(next.name);
            setCurrency(cur);
            clearError("account");
          }}
        />
      ) : null}
      {mountedSheet === "origin" || mountedSheet === "destination" ? (
        <AccountSheet
          open={sheet === "origin" || sheet === "destination"}
          onClose={() => setSheet(null)}
          title={t(sheet === "destination" ? "movementForm.transferTo" : "movementForm.transferFrom")}
          accounts={accounts}
          perBalance={false}
          selected={sheet === "destination" ? (destination ? { id: destination.id } : null) : origin ? { id: origin.id } : null}
          onSelect={({ account: next }) => {
            clearError("transfer");
            // Elegir la otra cuenta del par las invierte, en lugar de dejar la misma en los dos lados.
            if (sheet === "destination") {
              if (next.id === originId) setOriginId(destinationId);
              setDestinationId(next.id);
            } else {
              if (next.id === destinationId) setDestinationId(originId);
              setOriginId(next.id);
            }
          }}
        />
      ) : null}
      {mountedSheet === "currency" ? (
        <FintSheet open={sheet === "currency"} onClose={() => setSheet(null)} title={t("movementForm.currencySheet")}>
          <View height={8} />
          {shared.map((code, i) => (
            <ListRow
              key={code}
              divider={i > 0}
              title={currencyName(t, code)}
              subtitle={code}
              trailing={
                code === transferCur ? (
                  <FText tone="ink" variant="body-strong">
                    ✓
                  </FText>
                ) : undefined
              }
              onPress={() => {
                haptics.select();
                setTransferCurrency(code);
                setSheet(null);
              }}
            />
          ))}
        </FintSheet>
      ) : null}
      {kind !== "transfer" && mountedSheet === "category" ? (
        <CategorySheet
          open={sheet === "category"}
          onClose={() => setSheet(null)}
          type={categoryType}
          categories={categories}
          frequent={frequent}
          value={category}
          onSelect={(name) => {
            setCategory(name);
            clearError("category");
          }}
        />
      ) : null}
      {mountedSheet === "date" ? (
        <DateSheet open={sheet === "date"} onClose={() => setSheet(null)} value={date} onChange={setDate} />
      ) : null}
      {kind !== "transfer" && mountedSheet === "location" ? (
        <LocationSheet
          open={sheet === "location"}
          onClose={() => setSheet(null)}
          value={location}
          suggestion={suggestion}
          context={
            value > 0
              ? t("movementForm.locationSheet.context", { kind: t(`movementForm.locationSheet.kinds.${kind}`), amount: formatAmount(value, displayCurrency), date: dateLabel.toLocaleLowerCase(locale) })
              : t("movementForm.locationSheet.contextNoAmount", { kind: t(`movementForm.locationSheet.kinds.${kind}`), date: dateLabel.toLocaleLowerCase(locale) })
          }
          onSave={setLocation}
        />
      ) : null}
      {mountedSheet === "note" ? (
        <NoteSheet open={sheet === "note"} onClose={() => setSheet(null)} value={note} onChange={setNote} recent={notes} />
      ) : null}
    </InlineSheetContext.Provider>
  );
}

/** Lo que llega por parámetro ("84.5", "1200") como entrada del teclado. */
function normalizeAmountParam(value?: string) {
  if (!value) return "";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 100) / 100);
}

function invalidateMovementQueries(queryClient: QueryClient) {
  return Promise.all(
    [["transactions"], ["summary"], ["accounts"], ["account-options"], ["reports"], ["dashboard"]].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

function currencyName(t: (key: string, options?: Record<string, unknown>) => string, code: string) {
  return t(`movementForm.currencyNames.${code}`, { defaultValue: code });
}

/** Lo que el `hitSlop` de la píldora agrega arriba y abajo: de 34 a 48 de alto para el dedo. */
const PILL_SLOP = 7;

/**
 * La píldora de la cuenta (ficha `surface` de 34 con su ícono): nombre y saldo disponible. Abre la hoja de cuentas. Para el lector: "Sale de: BCP Soles,
 * disponible S/ 4 080.80" (con montos ocultos, "Monto oculto") y la pista de que cambia la cuenta.
 */
function AccountPill({ label, account, currency, onPress }: { label: string; account?: AccountOption; currency: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { amountsVisible, formatSensitiveAmount } = useSensitiveMoney();
  const balance = account ? accountBalance(account, currency) : null;
  const multi = account ? accountCurrencies(account).length > 1 : false;
  const name = account ? (multi ? `${account.name} · ${currency}` : account.name) : t("movementForm.pickAccount");
  const a11yLabel =
    balance !== null
      ? t("movementForm.accountAvailableA11y", {
          label,
          account: name,
          amount: amountsVisible ? formatSensitiveAmount(balance, currency) : t("privacy.amounts.hiddenLabel"),
        })
      : t("movementForm.accountA11y", { label, account: name });
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      hitSlop={{ top: PILL_SLOP, bottom: PILL_SLOP, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t("movementForm.accountHint")}
    >
      <XStack minH={34} pl={12} pr={10} gap={6} items="center" rounded={999} bg="$surface">
        <Wallet size={15} color="$inkMuted" strokeWidth={2} />
        <FText variant="label" numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ maxWidth: 180, fontFamily: fontFace.sans[600], fontSize: 13 }}>
          {name}
        </FText>
        {balance !== null ? (
          <Amount value={balance} currency={currency} variant="amount-sm" tone="inkFaint" style={{ fontSize: 12 }} />
        ) : null}
        <ChevronDown size={14} color="$ink" strokeWidth={2.2} />
      </XStack>
    </PressableScale>
  );
}

/** "Te quedan S/ 4 035.80 en BCP Soles"; si el egreso deja la cuenta en negativo, "Quedarías en −S/ 120.00" en `flowOut`. */
function BalanceLine({
  account,
  currency,
  amount,
  kind,
  offset = 0,
}: {
  account: AccountOption;
  currency: string;
  amount: number;
  kind: MovementKind;
  /** Al editar, el saldo ya incluye el movimiento original: se descuenta antes de aplicar el nuevo monto. */
  offset?: number;
}) {
  const { t } = useTranslation();
  const balance = accountBalance(account, currency);
  if (balance === null) return null;
  const after = balanceAfter(balance + offset, amount, kind);
  const negative = kind === "expense" && after < 0;
  const prefix = negative
    ? t("movementForm.wouldBePrefix")
    : t(kind === "income" ? "movementForm.incomePrefix" : "movementForm.expenseLeftPrefix");
  const suffix = negative
    ? ""
    : t(kind === "income" ? "movementForm.incomeSuffix" : "movementForm.expenseLeftSuffix", { account: account.name });
  return (
    <XStack items="center" gap={4} flexWrap="wrap" justify="center">
      <FText variant="caption" tone={negative ? "flowOut" : "inkFaint"}>
        {prefix}
      </FText>
      <Amount
        value={after}
        currency={currency}
        variant="amount-sm"
        tone={negative ? "flowOut" : "inkMuted"}
        style={{ fontSize: 12, lineHeight: 16 }}
      />
      {suffix ? (
        <FText variant="caption" tone="inkFaint" numberOfLines={1}>
          {suffix}
        </FText>
      ) : null}
    </XStack>
  );
}

/** En qué moneda se hace la transferencia: la que comparten las dos cuentas. */
function TransferCurrencyLine({
  shared,
  currency,
  error,
  hasBoth,
  onPick,
}: {
  shared: string[];
  currency: string;
  error?: string;
  hasBoth: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!hasBoth) return null;
  if (shared.length === 0) return <ErrorText>{t("movementForm.noSharedCurrency")}</ErrorText>;
  const name = currencyName(t, currency);
  if (shared.length === 1) {
    return (
      <FText variant="caption" tone="inkFaint" style={{ textAlign: "center" }}>
        {t("movementForm.sharedCurrency", { currency: name })}
      </FText>
    );
  }
  return (
    <PressableScale onPress={onPick} haptic="tap" accessibilityRole="button">
      <FText variant="caption" tone="ink" style={{ textAlign: "center", fontFamily: fontFace.sans[600] }}>
        {t("movementForm.sharedCurrencyPick", { currency: name })}
      </FText>
    </PressableScale>
  );
}

/**
 * Una ficha de detalle (Fecha, Lugar, Nota): llena en `surface` con el valor, o vacía con contorno `line` y la
 * invitación. Un texto largo se corta con puntos suspensivos; se lee completo en su hoja o, con letra grande, en
 * las filas de Detalles.
 */
function DetailChip({ icon, label, a11y, empty = false, onPress }: { icon: ReactNode; label: string; a11y: string; empty?: boolean; onPress: () => void }) {
  return (
    <View maxW="100%">
      <Chip variant="detail" icon={icon} label={label} empty={empty} accessibilityLabel={a11y} onPress={onPress} />
    </View>
  );
}

/**
 * Detalles con letra grande (desde `COMPACT_FONT_SCALE`): Categoría, Fecha, Ubicación con su mapa chico y Nota
 * completa, una fila por campo y separadas por un filete. La etiqueta va arriba en `inkFaint` y el valor puede
 * ocupar varias líneas. En una transferencia, solo Fecha y Nota.
 */
function DetailsList({
  kind,
  category,
  categoryLabel,
  dateLabel,
  showLocation,
  location,
  placeName,
  note,
  onCategory,
  onDate,
  onLocation,
  onNote,
  categoryError,
}: {
  kind: MovementKind;
  category: Category | null;
  categoryLabel: string | null;
  dateLabel: string;
  showLocation: boolean;
  location: CapturedLocation | null;
  placeName: string | null;
  note: string;
  onCategory: () => void;
  onDate: () => void;
  onLocation: () => void;
  onNote: () => void;
  categoryError?: string;
}) {
  const { t } = useTranslation();
  const lines = location ? locationLines(location) : null;
  const text = note.trim();
  const rows: ReactNode[] = [];
  if (kind !== "transfer") {
    rows.push(
      <DetailRow
        key="category"
        leading={category ? <Monogram name={categoryLabel ?? category.name} emoji={category.icon} size={44} /> : <DetailIcon icon={<Grid2x2 size={20} color="$inkMuted" strokeWidth={2} />} />}
        label={t("movementForm.category")}
        value={categoryLabel ?? t("movementForm.allCategories")}
        empty={!categoryLabel}
        onPress={onCategory}
      />,
    );
  }
  rows.push(<DetailRow key="date" leading={<DetailIcon icon={<CalendarDays size={20} color="$inkMuted" strokeWidth={2} />} />} label={t("movementForm.date")} value={dateLabel} onPress={onDate} />);
  if (kind !== "transfer" && showLocation) {
    rows.push(
      <DetailRow
        key="location"
        leading={<DetailIcon icon={<MapPin size={20} color="$inkMuted" strokeWidth={2} />} />}
        label={t("movementForm.location")}
        value={placeName ?? lines?.primary ?? t("movementForm.addLocation")}
        secondary={lines?.secondary ?? undefined}
        empty={!location}
        onPress={onLocation}
      >
        {location ? (
          <View mt={10}>
            <MapThumb />
          </View>
        ) : null}
      </DetailRow>,
    );
  }
  rows.push(
    <DetailRow
      key="note"
      leading={<DetailIcon icon={<FileText size={20} color="$inkMuted" strokeWidth={2} />} />}
      label={t("movementForm.note")}
      value={text || t("movementForm.addNote")}
      count={text ? t("movementForm.noteCount", { count: text.length, max: NOTE_MAX }) : undefined}
      empty={!text}
      onPress={onNote}
    />,
  );
  return (
    <YStack px={20}>
      {rows.map((row, i) => (
        <View key={i} borderTopWidth={i > 0 ? 1 : 0} borderColor="$line">
          {row}
        </View>
      ))}
      {categoryError ? (
        <View mt={6}>
          <ErrorText align="left">{categoryError}</ErrorText>
        </View>
      ) : null}
    </YStack>
  );
}

function DetailIcon({ icon }: { icon: ReactNode }) {
  return (
    <View width={44} height={44} rounded={14} bg="$surface" items="center" justify="center">
      {icon}
    </View>
  );
}

/** Una fila de Detalles: cuadro de 44, la etiqueta arriba (12/700), el valor (15/700, varias líneas) y un chevron. */
function DetailRow({
  leading,
  label,
  value,
  secondary,
  count,
  empty = false,
  onPress,
  children,
}: {
  leading: ReactNode;
  label: string;
  value: string;
  secondary?: string;
  count?: string;
  empty?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} haptic="tap" accessibilityRole="button" accessibilityLabel={[label, value, secondary].filter(Boolean).join(": ")}>
      <XStack gap={12} py={14} items="flex-start">
        {leading}
        <YStack flex={1} minW={0} gap={2}>
          <XStack justify="space-between" gap={8}>
            <FText tone="inkFaint" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
              {label}
            </FText>
            {count ? (
              <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 12, lineHeight: 16 }}>
                {count}
              </FText>
            ) : null}
          </XStack>
          <FText tone={empty ? "inkMuted" : "ink"} style={{ fontFamily: fontFace.display[700], fontSize: 15, lineHeight: 20 }}>
            {value}
          </FText>
          {secondary ? (
            <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
              {secondary}
            </FText>
          ) : null}
          {children}
        </YStack>
        <View pt={8}>
          <ChevronRight size={18} color="$inkFaint" strokeWidth={2} />
        </View>
      </XStack>
    </PressableScale>
  );
}

function ErrorText({ children, align = "center" }: { children: string; align?: "center" | "left" }) {
  return (
    <FText variant="caption" tone="dangerHard" accessibilityRole="alert" style={{ textAlign: align, fontFamily: fontFace.sans[500] }}>
      {children}
    </FText>
  );
}
