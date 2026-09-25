import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, FileText, MapPin, Plus, X } from "@tamagui/lucide-icons-2";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, ScrollView } from "react-native";
import Animated, { FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, type ColorTokens } from "tamagui";
import { financeApi } from "../src/api/finance";
import { getAppLocale } from "../src/i18n";
import type { AccountOption } from "../src/api/types";
import { UnsavedChangesDialog } from "../src/components/UnsavedChangesDialog";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { formatAmount } from "../src/finance/formatAmount";
import { parseDateString, todayDateString, toDateString } from "../src/finance/dates";
import { amountInputValue, applyAmountKey } from "../src/forms/amountInput";
import { categoryColorIndex } from "../src/home/spending";
import { useUnsavedChangesGuard } from "../src/hooks/useUnsavedChangesGuard";
import { describeLocation, getLastKnownPosition, getLocationPermissionState, type CapturedLocation } from "../src/location/captureLocation";
import { useLocationPreference } from "../src/location/LocationPreferenceProvider";
import { AccountSheet } from "../src/movement-form/AccountSheet";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { DateSheet, shortDay } from "../src/movement-form/DateSheet";
import { GrowPresence, type GrowPresenceHandle } from "../src/movement-form/GrowPresence";
import { LocationSheet } from "../src/movement-form/LocationSheet";
import {
  accountBalance,
  accountCurrencies,
  balanceAfter,
  frequentCategories,
  last30DaysRange,
  recentNotes,
  sharedCurrencies,
  splitAddress,
  type MovementKind,
} from "../src/movement-form/logic";
import { NoteSheet } from "../src/movement-form/NoteSheet";
import { TransferAccounts } from "../src/movement-form/TransferAccounts";
import { radius } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import {
  Amount,
  AmountDisplay,
  AmountKeypad,
  Chip,
  FintButton,
  FintSheet,
  FintSpinner,
  FText,
  IconButton,
  ListRow,
  PressableScale,
  SegmentedControl,
} from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { riseIn } from "../src/ui/entering";
import { haptics } from "../src/ui/haptics";
import { useNotify } from "../src/ui/notify";

type Sheet = "account" | "origin" | "destination" | "currency" | "category" | "date" | "location" | "note" | null;
type Errors = Partial<Record<"amount" | "account" | "category" | "transfer", string>>;

/** Lo que tarda una hoja en terminar de bajar antes de desmontarla. */
const SHEET_UNMOUNT_MS = 600;

/** Tiempo que el toast ofrece "Deshacer". */
const UNDO_MS = 5000;

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
    if (next) {
      setMountedSheet(next);
      // Montada cerrada primero, para que suba con su animación.
      requestAnimationFrame(() => setSheetState(next));
    } else setSheetState(null);
  };
  useEffect(() => {
    if (sheet) return;
    const id = setTimeout(() => setMountedSheet(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [sheet]);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);

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
  const account = accounts.find((a) => a.name === accountName);
  const origin = accounts.find((a) => a.id === originId);
  const destination = accounts.find((a) => a.id === destinationId);

  const movementCurrency = account ? (accountCurrencies(account).includes(currency) ? currency : account.currency) : currency || "PEN";
  const shared = useMemo(() => sharedCurrencies(origin, destination), [origin, destination]);
  const transferCur = shared.includes(transferCurrency) ? transferCurrency : (shared[0] ?? "");
  const displayCurrency = kind === "transfer" ? transferCur || origin?.currency || "PEN" : movementCurrency;

  const frequent = useMemo(
    () => (kind === "transfer" ? [] : frequentCategories(recentQuery.data ?? [], categoryType, categories)),
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
  useEffect(() => {
    if (isEditing || location || !locationPref.isHydrated || !locationPref.enabled) return;
    let cancelled = false;
    void (async () => {
      if ((await getLocationPermissionState()) !== "granted") return;
      const position = await getLastKnownPosition();
      if (!position || cancelled) return;
      const address = await describeLocation(position.latitude, position.longitude);
      if (!cancelled) setSuggestion({ ...position, formattedAddress: address });
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
  const locationName = (place: CapturedLocation | null) => splitAddress(place?.formattedAddress).primary;
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
    return picked && !frequent.some((c) => c.id === picked.id) ? [picked, ...frequent] : frequent;
  }, [categories, category, frequent]);

  const layout = reduceMotion ? undefined : LinearTransition.springify().damping(26).stiffness(240);

  return (
    <>
      <UnsavedChangesDialog
        open={guard.open}
        onCancel={guard.onCancel}
        onConfirm={() => guard.confirmWith((proceed) => (grow.current ? grow.current.close(proceed) : proceed()))}
      />

      <GrowPresence ref={grow} fromFab={params.origin === "fab"}>
        <YStack flex={1} bg="$canvas" pt={insets.top}>
          {/* Barra superior: cerrar y tipo. */}
          <XStack items="center" gap={10} px={16} pt={8}>
            <IconButton label={t("movementForm.close")} icon={<X size={18} color="$ink" strokeWidth={2} />} onPress={requestClose} />
            <View flex={1}>
              <SegmentedControl options={tabs} value={kind} onChange={changeKind} accessibilityLabel={t("movementForm.tabsLabel")} />
            </View>
          </XStack>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cuenta: una píldora, o dos tarjetas en una transferencia. */}
            {kind === "transfer" ? (
              <Animated.View key="transfer" entering={riseIn({ distance: 8, reduceMotion })} exiting={FadeOut.duration(120)}>
                {loadingAccounts ? (
                  <YStack gap={8} mx={16} mt={22}>
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
            ) : (
              <Animated.View key="single" entering={riseIn({ distance: 8, reduceMotion })} exiting={FadeOut.duration(120)}>
                <YStack items="center" gap={8} mt={26}>
                  <FText variant="caption" tone="inkMuted">
                    {t(kind === "income" ? "movementForm.to" : "movementForm.from")}
                  </FText>
                  {loadingAccounts ? (
                    <AmountSkeleton width={180} height={34} />
                  ) : noAccounts ? (
                    <FintButton variant="outlined" minH={36} px={16} icon={<Plus size={16} />} onPress={() => router.push("/account-form")}>
                      {t("movementForm.createAccount")}
                    </FintButton>
                  ) : (
                    <AccountPill account={account} currency={movementCurrency} onPress={() => setSheet("account")} />
                  )}
                  {errors.account ? <ErrorText>{errors.account}</ErrorText> : null}
                  {noAccounts ? (
                    <FText variant="caption" tone="inkFaint">
                      {t("movementForm.noAccounts")}
                    </FText>
                  ) : null}
                </YStack>
              </Animated.View>
            )}

            <Animated.View layout={layout}>
              {/* Monto. */}
              <View mt={kind === "transfer" ? 22 : 18} px={16}>
                <AmountDisplay input={amount} currency={displayCurrency} kind={kind} />
              </View>

              {/* Debajo del monto: cómo queda la cuenta, la moneda de la transferencia o el error. */}
              <View minH={18} mt={kind === "transfer" ? 4 : 6} px={16} items="center">
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

              {/* Categoría: las frecuentes y "Más", todas a la vista (sin deslizar): los chips pasan a la fila siguiente. */}
              {kind !== "transfer" ? (
                <YStack mt={22}>
                  <FText variant="caption" tone="inkMuted" style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                    {t("movementForm.category")}
                  </FText>
                  <XStack flexWrap="wrap" gap={8} px={16}>
                    {categoriesQuery.isLoading
                      ? [120, 104, 96].map((w) => <AmountSkeleton key={w} width={w} height={32} />)
                      : chipCategories.map((c) => (
                          <Chip
                            key={c.id}
                            variant="choice"
                            label={getCategoryLabel(c.name, t)}
                            emoji={c.icon}
                            dotColor={`$chart${categoryColorIndex(c.name)}` as ColorTokens}
                            selected={c.name === category}
                            onPress={() => {
                              setCategory(c.name);
                              clearError("category");
                            }}
                          />
                        ))}
                    <Chip
                      variant="choice"
                      dashed
                      label={t("movementForm.more")}
                      icon={<Plus size={14} color="$inkMuted" strokeWidth={2.2} />}
                      onPress={() => setSheet("category")}
                    />
                  </XStack>
                  {errors.category ? (
                    <View px={16} mt={6}>
                      <ErrorText align="left">{errors.category}</ErrorText>
                    </View>
                  ) : null}
                </YStack>
              ) : null}

              {/* Detalles: fecha y ubicación, de igual ancho. */}
              <XStack gap={8} px={16} mt={22}>
                <Chip
                  variant="detail"
                  grow
                  label={dateLabel}
                  icon={<CalendarDays size={15} color="$ink" />}
                  onPress={() => setSheet("date")}
                />
                {showLocation ? (
                  <Chip
                    variant="detail"
                    grow
                    empty={!location}
                    label={locationName(location) ?? locationName(suggestion) ?? t("movementForm.location")}
                    icon={<MapPin size={15} color={location ? "$ink" : "$inkMuted"} />}
                    onPress={() => setSheet("location")}
                  />
                ) : null}
              </XStack>

              {/*
                La nota va aparte, a lo ancho y completa (hasta tres líneas): en un chip se cortaba y, al volver de la
                hoja, no se veía lo escrito. Ocupa el espacio que quedaba vacío sobre el teclado.
              */}
              <NoteField note={note} onPress={() => setSheet("note")} />
            </Animated.View>
          </ScrollView>

          {/* Teclado y botón: un solo bloque, separado por un filete. */}
          <AmountKeypad onKey={onKey} onClear={() => setAmount("")} />
          <View px={16} pt={16} pb={Math.max(insets.bottom, 16) + 10}>
            <FintButton
              minH={52}
              rounded={radius.md}
              opacity={ready || isPending ? 1 : 0.55}
              disabled={isPending || (loadingAccounts && !noAccounts)}
              icon={isPending ? <FintSpinner color="$onBrand" /> : undefined}
              onPress={submit}
              fontSize={16}
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
                  <FText tone="brand" variant="body-strong">
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
          onSave={setLocation}
        />
      ) : null}
      {mountedSheet === "note" ? (
        <NoteSheet open={sheet === "note"} onClose={() => setSheet(null)} value={note} onChange={setNote} recent={notes} />
      ) : null}
    </>
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

/** La píldora de la cuenta: nombre y saldo disponible. Abre la hoja de cuentas. */
function AccountPill({ account, currency, onPress }: { account?: AccountOption; currency: string; onPress: () => void }) {
  const { t } = useTranslation();
  const balance = account ? accountBalance(account, currency) : null;
  const multi = account ? accountCurrencies(account).length > 1 : false;
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={account?.name ?? t("movementForm.pickAccount")}
    >
      <XStack height={34} pl={14} pr={12} gap={6} items="center" rounded={999} borderWidth={1} borderColor="$lineStrong" bg="$surface">
        <FText variant="label" numberOfLines={1} style={{ maxWidth: 180 }}>
          {account ? (multi ? `${account.name} · ${currency}` : account.name) : t("movementForm.pickAccount")}
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
      <FText variant="caption" tone="brand" style={{ textAlign: "center", fontFamily: fontFace.sans[500] }}>
        {t("movementForm.sharedCurrencyPick", { currency: name })}
      </FText>
    </PressableScale>
  );
}

/** La nota completa, a lo ancho. Sin nota, una invitación a escribirla. Tocarla abre la hoja de nota. */
function NoteField({ note, onPress }: { note: string; onPress: () => void }) {
  const { t } = useTranslation();
  const text = note.trim();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={text ? `${t("movementForm.note")}: ${text}` : t("movementForm.addNote")}
    >
      <XStack mx={16} mt={12} minH={48} px={14} py={12} gap={10} items="flex-start" rounded={radius.md} borderWidth={1} borderColor="$lineStrong" bg="$surface">
        <View pt={3}>
          <FileText size={16} color={text ? "$ink" : "$inkMuted"} />
        </View>
        <FText variant="body" tone={text ? "ink" : "inkMuted"} numberOfLines={3} style={{ flex: 1 }}>
          {text || t("movementForm.addNote")}
        </FText>
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
