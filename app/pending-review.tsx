import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Coins,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Repeat,
  Shapes,
  X,
} from "@tamagui/lucide-icons-2";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack } from "tamagui";
import { useCapabilities } from "../src/api/capabilities";
import { financeApi } from "../src/api/finance";
import type { PendingMovementDetail, TransactionType } from "../src/api/types";
import { DataStateCard } from "../src/components/DataStateCard";
import { balanceCurrencies } from "../src/finance/accountBalances";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { parseDateString, todayDateString } from "../src/finance/dates";
import { parseDecimalInput } from "../src/forms";
import { getAppLocale } from "../src/i18n";
import type { CapturedLocation } from "../src/location/captureLocation";
import { AccountSheet } from "../src/movement-form/AccountSheet";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { DateSheet, shortDay } from "../src/movement-form/DateSheet";
import { LocationSheet } from "../src/movement-form/LocationSheet";
import { NoteSheet } from "../src/movement-form/NoteSheet";
import { getInstallationId } from "../src/notifications/pushNotifications";
import { compatibleOccurrences, matchingOccurrence } from "../src/pending/logic";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import {
  Amount,
  FintButton,
  FintCard,
  FintSheet,
  FintSpinner,
  FText,
  IconButton,
  ListRow,
  SegmentedControl,
} from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { BigAmountInput } from "../src/ui/BigAmountInput";
import { haptics } from "../src/ui/haptics";
import { useNotify } from "../src/ui/notify";

type Sheet = "account" | "origin" | "destination" | "category" | "date" | "note" | "location" | "payment" | null;
const SHEET_UNMOUNT_MS = 600;
const KEYBOARD_GAP = 24;
const NORMAL = "__transaction__";

/**
 * Revisar un pendiente v3: arriba lo que se detectó (para comparar), el monto
 * grande que se corrige tocándolo, y la lista de Cuenta, Pago (si coincide con
 * uno), Categoría, Fecha, Nota y Ubicación; cada fila abre la hoja
 * del formulario de movimiento. Lo que falta va en `brandWash` con "Elegir", y
 * "Confirmar" espera con la pista de qué falta.
 *
 * Una transferencia muestra Desde y Hacia. Con las dos cuentas se registra la
 * transferencia; con una sola, la salida o la entrada de esa cuenta (el otro
 * lado está fuera de My Fint). "¿No es una transferencia?" pasa al formulario
 * normal y "Es una transferencia entre mis cuentas" vuelve.
 *
 * Conserva la lógica anterior: confirmar como movimiento o como pago, el aviso
 * de saldo en otra moneda (y habilitarlo en una tarjeta), transferencias y
 * descartar (sin `danger`: no borra nada).
 */
export default function PendingReviewScreen() {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeMode();
  const { capabilities } = useCapabilities();
  const params = useLocalSearchParams<{ id?: string; detectedAt?: string }>();
  const pendingId = params.id ?? "";

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const hydratedId = useRef<string | null>(null);
  const [mode, setMode] = useState<"normal" | "transfer">("normal");
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayDateString());
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [occurrenceId, setOccurrenceId] = useState(NORMAL);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [missingBalanceCurrency, setMissingBalanceCurrency] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);

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
    const id = setTimeout(() => setMountedSheet(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [sheet]);

  const detailQuery = useQuery({
    queryKey: ["pending-movements", "detail", pendingId],
    queryFn: ({ signal }) => financeApi.getPendingMovement(pendingId, signal),
    enabled: Boolean(pendingId),
  });
  const detail = detailQuery.data;
  const currency = detail?.currency ?? null;
  const accountsQuery = useQuery({
    queryKey: ["account-options", currency],
    queryFn: () => financeApi.listAccountOptions(currency ? { currency } : undefined),
    enabled: Boolean(detail),
  });
  const categoriesQuery = useQuery({ queryKey: ["categories", type], queryFn: () => financeApi.listCategories(type), enabled: Boolean(detail) });
  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: "open" }, signal),
    enabled: Boolean(detail) && capabilities.features.pendingToPayment,
  });
  const accounts = accountsQuery.data ?? [];
  // Ninguna cuenta en la moneda del pendiente: la hoja saldría vacía, así que se ofrece crear una.
  const noAccounts = accountsQuery.isSuccess && accounts.length === 0 && Boolean(currency);
  const categories = categoriesQuery.data ?? [];
  const parsedAmount = amount.trim() ? parseDecimalInput(amount) : NaN;
  const account = accounts.find((a) => a.id === accountId);
  const origin = accounts.find((a) => a.id === originId);
  const destination = accounts.find((a) => a.id === destinationId);
  const selectedCategory = categories.find((c) => c.name === category);
  const occurrences = capabilities.features.pendingToPayment
    ? compatibleOccurrences(occurrencesQuery.data ?? [], { type, amount: Number.isFinite(parsedAmount) ? parsedAmount : null, currency })
    : [];
  const occurrence = occurrences.find((o) => o.id === occurrenceId);

  useEffect(() => {
    if (!detail || hydratedId.current === detail.id) return;
    hydratedId.current = detail.id;
    setMode(detail.transfer && detail.amount !== null && detail.currency ? "transfer" : "normal");
    setType(detail.type ?? "expense");
    setAmount(detail.amount === null ? "" : detail.amount.toFixed(2));
    setDate(detail.transactionDate);
    setAccountId(detail.accountSuggestion?.id ?? "");
    setOriginId(detail.transfer?.originMatch?.accountId ?? "");
    setDestinationId(detail.transfer?.destinationMatch?.accountId ?? "");
  }, [detail]);

  // Lo elegido que deja de servir (otra moneda, otro tipo) se limpia.
  useEffect(() => {
    if (accountId && accountsQuery.isSuccess && !accounts.some((a) => a.id === accountId)) setAccountId("");
  }, [accountId, accounts, accountsQuery.isSuccess]);
  useEffect(() => {
    if (category && categoriesQuery.isSuccess && !categories.some((c) => c.name === category)) setCategory("");
  }, [categories, category, categoriesQuery.isSuccess]);
  useEffect(() => {
    if (occurrenceId !== NORMAL && occurrencesQuery.isSuccess && !occurrences.some((o) => o.id === occurrenceId)) setOccurrenceId(NORMAL);
  }, [occurrenceId, occurrences, occurrencesQuery.isSuccess]);
  // Al abrir: si a un pago le falta exactamente el monto detectado, "Pago" viene con ese pago elegido (como en la lista).
  const paymentDefaulted = useRef(false);
  useEffect(() => {
    if (paymentDefaulted.current || !detail || !occurrencesQuery.isSuccess) return;
    paymentDefaulted.current = true;
    const match = matchingOccurrence(occurrences, detail.amount);
    if (match && type === "expense") setOccurrenceId(match.id);
  }, [detail, occurrences, occurrencesQuery.isSuccess, type]);

  // Primero se sale y después se refresca: con la pantalla abierta, refrescar volvía a pedir este pendiente
  // (ya confirmado), el servidor respondía "no encontrado" y se veía un error antes de volver.
  const done = () => {
    router.back();
    toast.show(t("movements.createdToast"), { message: t("movements.createdMessage"), preset: "success" });
    void Promise.all(
      ["pending-movements", "transactions", "dashboard", "summary", "accounts", "reports", "payment-occurrences"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  const fail = (error: unknown) => setErrorMessage(error instanceof Error ? error.message : t("states.error"));

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const locationFields = location
        ? { latitude: location.latitude, longitude: location.longitude, formattedAddress: location.formattedAddress ?? undefined }
        : {};
      if (occurrence) {
        return financeApi.confirmPendingMovement(pendingId, {
          mode: "payment",
          paymentOccurrenceId: occurrence.id,
          title: detail!.title,
          type: "expense",
          amount: parsedAmount,
          currency: occurrence.currency,
          transactionDate: date,
          accountId,
          categoryId: null,
          note: note.trim() || null,
          originInstallationId: await getInstallationId(),
          ...locationFields,
        });
      }
      return financeApi.confirmPendingMovement(pendingId, {
        mode: "transaction",
        title: detail!.title,
        type,
        amount: parsedAmount,
        currency: currency ?? account!.currency,
        transactionDate: date,
        accountId,
        categoryId: selectedCategory!.id,
        note: note.trim() || null,
        ...locationFields,
      });
    },
    onSuccess: done,
    onError: fail,
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (originId && destinationId) {
        return financeApi.createTransfer({
          originAccountId: originId,
          destinationAccountId: destinationId,
          amount: parsedAmount,
          currency: currency!,
          transactionDate: date,
          pendingMovementId: pendingId,
        });
      }
      // Un solo lado es tuyo: la salida o la entrada de esa cuenta, sin categoría.
      const side = originId ? "origin" : "destination";
      const sideAccount = side === "origin" ? origin : destination;
      return financeApi.confirmPendingMovement(pendingId, {
        mode: "transaction",
        title: t(side === "origin" ? "movementUx.transferOutTitle" : "movementUx.transferInTitle", { account: sideAccount?.name ?? "" }),
        type: side === "origin" ? "expense" : "income",
        amount: parsedAmount,
        transactionDate: date,
        accountId: side === "origin" ? originId : destinationId,
        note: null,
      });
    },
    onSuccess: done,
    onError: fail,
  });

  const discardMutation = useMutation({
    mutationFn: () => financeApi.discardPendingMovement(pendingId),
    onSuccess: () => {
      router.back();
      toast.show(t("movementUx.pendingDiscarded"), { preset: "success" });
      void queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
    },
    onError: fail,
  });

  const enableBalanceMutation = useMutation({
    mutationFn: (input: { accountId: string; currency: string }) =>
      financeApi.enableAccountBalance(input.accountId, { currency: input.currency, openingBalance: 0 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-options"] });
      setMissingBalanceCurrency(null);
      toast.show(t("accounts.balanceEnabledToast"), { message: t("movementUx.balanceEnabledRetryHint"), preset: "success", duration: 4000 });
    },
    onError: fail,
  });

  const isPending = confirmMutation.isPending || transferMutation.isPending || discardMutation.isPending;

  // Qué falta para confirmar (la primera cosa), o nada.
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const missing =
    mode === "transfer"
      ? !amountOk
        ? t("pendingScreen.needAmount")
        : !originId && !destinationId
          ? t("pendingScreen.needTransferAccount")
          : originId && originId === destinationId
            ? t("pendingScreen.sameAccounts")
            : null
      : !amountOk
        ? t("pendingScreen.needAmount")
        : !accountId
          ? noAccounts
            ? t("pendingScreen.needAccountCreate", { currency })
            : t("pendingScreen.needAccount")
          : !occurrence && !selectedCategory
            ? t("pendingScreen.needCategory")
            : null;

  const submit = () => {
    setErrorMessage(null);
    setMissingBalanceCurrency(null);
    if (missing || isPending) return;
    if (mode === "transfer") {
      transferMutation.mutate();
      return;
    }
    // La cuenta tiene que tener saldo en la moneda del pendiente.
    if (!occurrence && currency && account && !balanceCurrencies(account).includes(currency)) {
      setMissingBalanceCurrency(currency);
      return;
    }
    confirmMutation.mutate();
  };

  const loading = detailQuery.isLoading || (Boolean(detail) && (accountsQuery.isLoading || categoriesQuery.isLoading));
  const dateLabel = (iso: string) => {
    const d = parseDateString(iso);
    if (!d) return iso;
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${shortDay(d, locale)}`;
  };
  // "Detectado el jueves 24 set a las 14:32": con la hora si se llegó desde la lista (el detalle no la trae); si no, solo el día.
  const sourceLabel = (() => {
    const at = params.detectedAt ? new Date(params.detectedAt) : null;
    if (at && !Number.isNaN(at.getTime())) {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(at);
      const day = inSentence(`${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${shortDay(at, locale)}`, i18n.resolvedLanguage);
      const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
      return t("pendingScreen.sourceAt", { date: day, time });
    }
    return detail ? t("pendingScreen.source", { date: inSentence(dateLabel(detail.transactionDate), i18n.resolvedLanguage) }) : "";
  })();
  const sign = mode === "transfer" ? "" : type === "expense" ? "−" : "+";
  // Un lado que no es tuyo: el nombre que trae el correo, marcado como externo.
  const outsideName = (raw: string | null | undefined) => (raw ? t("pendingScreen.outsideNamed", { name: raw }) : t("pendingScreen.outside"));

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]}>
        <IconButton label={t("pendingScreen.close")} icon={<X size={18} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText
          variant="title"
          accessibilityRole="header"
          numberOfLines={1}
          style={{ flex: 1, textAlign: "center", fontSize: 20, lineHeight: 25, letterSpacing: -0.4 }}
        >
          {t("pendingScreen.reviewTitle")}
        </FText>
        <View width={40} />
      </XStack>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={footerHeight + KEYBOARD_GAP}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? <ReviewSkeleton /> : null}
        {detailQuery.error ? (
          <View mt={space[5]}>
            <DataStateCard
              message={detailQuery.error instanceof Error ? detailQuery.error.message : t("states.error")}
              onRetry={() => void detailQuery.refetch()}
            />
          </View>
        ) : null}

        {detail && !loading ? (
          <>
            <SourceBox detail={detail} label={sourceLabel} />

            {mode === "normal" ? (
              <View mt={18}>
                <SegmentedControl
                  options={[
                    { value: "expense" as const, label: t("forms.expense") },
                    { value: "income" as const, label: t("forms.income") },
                  ]}
                  value={type}
                  onChange={(next) => {
                    setType(next);
                    setCategory("");
                    setOccurrenceId(NORMAL);
                    setErrorMessage(null);
                  }}
                />
              </View>
            ) : null}

            {/* El monto: se corrige tocándolo. */}
            <YStack items="center" mt={18}>
              <BigAmountInput
                currency={currency ?? account?.currency ?? "PEN"}
                value={amount}
                sign={amount ? sign : undefined}
                label={t("forms.amount")}
                onChange={setAmount}
              />
              <FText variant="caption" tone="inkMuted" style={{ marginTop: 4 }}>
                {t("pendingScreen.amountHint")}
              </FText>
            </YStack>

            <FintCard mt={18} p={0} overflow="hidden">
              {mode === "transfer" ? (
                <>
                  <DataRow
                    icon={<ArrowUpRight size={16} color="$inkMuted" strokeWidth={2} />}
                    label={t("pendingScreen.from")}
                    value={origin?.name ?? outsideName(detail.transfer?.originAccountName)}
                    muted={!origin}
                    onPress={() => setSheet("origin")}
                    onClear={origin ? () => setOriginId("") : undefined}
                    clearLabel={t("pendingScreen.clearSide")}
                  />
                  <DataRow
                    divider
                    icon={<ArrowDownLeft size={16} color="$inkMuted" strokeWidth={2} />}
                    label={t("pendingScreen.to")}
                    value={destination?.name ?? outsideName(detail.transfer?.destinationAccountName)}
                    muted={!destination}
                    onPress={() => setSheet("destination")}
                    onClear={destination ? () => setDestinationId("") : undefined}
                    clearLabel={t("pendingScreen.clearSide")}
                  />
                </>
              ) : (
                <>
                  <DataRow
                    icon={<Landmark size={16} color="$inkMuted" strokeWidth={2} />}
                    label={t("pendingScreen.account")}
                    value={noAccounts ? t("pendingScreen.noAccountsIn", { currency }) : account?.name}
                    muted={noAccounts}
                    missing={!account && !noAccounts}
                    chooseLabel={t("pendingScreen.choose")}
                    onPress={() => (noAccounts ? router.push("/account-form") : setSheet("account"))}
                  />
                  {type === "expense" && occurrences.length ? (
                    <DataRow
                      divider
                      icon={<Repeat size={16} color="$inkMuted" strokeWidth={2} />}
                      label={t("pendingScreen.payment")}
                      value={occurrence?.title ?? t("pendingScreen.normalMovement")}
                      muted={!occurrence}
                      onPress={() => setSheet("payment")}
                    />
                  ) : null}
                  {occurrence ? null : (
                    <DataRow
                      divider
                      icon={
                        selectedCategory?.icon ? (
                          <Text style={{ fontSize: 16, lineHeight: 20, includeFontPadding: false }}>{selectedCategory.icon}</Text>
                        ) : (
                          <Shapes size={16} color="$inkMuted" strokeWidth={2} />
                        )
                      }
                      label={t("pendingScreen.category")}
                      value={selectedCategory ? getCategoryLabel(selectedCategory.name, t) : undefined}
                      missing={!selectedCategory}
                      chooseLabel={t("pendingScreen.choose")}
                      onPress={() => setSheet("category")}
                    />
                  )}
                </>
              )}
              <DataRow
                divider
                icon={<CalendarDays size={16} color="$inkMuted" strokeWidth={2} />}
                label={t("pendingScreen.date")}
                value={dateLabel(date)}
                onPress={() => setSheet("date")}
              />
              {mode === "normal" ? (
                <>
                  <DataRow
                    divider
                    icon={<FileText size={16} color="$inkMuted" strokeWidth={2} />}
                    label={t("pendingScreen.note")}
                    value={note.trim() || t("pendingScreen.optional")}
                    muted={!note.trim()}
                    onPress={() => setSheet("note")}
                  />
                  <DataRow
                    divider
                    icon={<MapPin size={16} color="$inkMuted" strokeWidth={2} />}
                    label={t("pendingScreen.location")}
                    value={location?.formattedAddress?.split(",")[0] || (location ? "·" : t("pendingScreen.optional"))}
                    muted={!location}
                    onPress={() => setSheet("location")}
                  />
                </>
              ) : null}
            </FintCard>

            {mode === "normal" && noAccounts ? (
              <YStack mt={16} p={14} gap={12} rounded={radius.lg} bg="$surfaceSunken">
                <FText variant="body" style={{ fontSize: 14 }}>
                  {t("pendingScreen.noAccountsHint", { currency })}
                </FText>
                <FintButton variant="outlined" minH={40} onPress={() => router.push("/account-form")}>
                  {t("payments.autoPayCreateAccount")}
                </FintButton>
              </YStack>
            ) : null}

            {missingBalanceCurrency && account ? (
              <MissingBalance
                currency={missingBalanceCurrency}
                canEnable={
                  capabilities.features.accountCurrencyBalances && account.accountType === "credit_card" && balanceCurrencies(account).length < 2
                }
                pending={enableBalanceMutation.isPending}
                onEnable={() => enableBalanceMutation.mutate({ accountId: account.id, currency: missingBalanceCurrency })}
              />
            ) : null}

            {detail.transfer && currency && detail.amount !== null ? (
              <Pressable
                onPress={() => {
                  haptics.select();
                  setMode(mode === "transfer" ? "normal" : "transfer");
                  setErrorMessage(null);
                }}
                accessibilityRole="button"
                style={{ alignSelf: "center", marginTop: 16, paddingVertical: 6, paddingHorizontal: 8 }}
              >
                <FText variant="body-strong" tone="brand" style={{ fontSize: 14, textAlign: "center" }}>
                  {t(mode === "transfer" ? "movementUx.transferNotATransfer" : "pendingScreen.asTransfer")}
                </FText>
              </Pressable>
            ) : null}

            {errorMessage ? (
              <View mt={16} p={space[3]} rounded={radius.md} bg="$red2">
                <FText variant="body" tone="dangerHard" style={{ fontSize: 14 }}>
                  {errorMessage}
                </FText>
              </View>
            ) : null}
          </>
        ) : null}
      </KeyboardAwareScrollView>

      {detail && !loading ? (
        <KeyboardStickyView offset={{ opened: Math.max(insets.bottom, 16) - 2 }}>
          <YStack
            px={space[4]}
            pt={space[3]}
            pb={Math.max(insets.bottom, 16) + 10}
            bg="$canvas"
            gap={10}
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          >
            {missing ? (
              <FText variant="caption" tone="inkMuted" style={{ textAlign: "center" }}>
                {missing}
              </FText>
            ) : null}
            <XStack gap={10}>
              <FintButton
                variant="outlined"
                minH={52}
                rounded={radius.md}
                px={18}
                disabled={isPending}
                icon={discardMutation.isPending ? <FintSpinner color="$ink" /> : undefined}
                onPress={() => discardMutation.mutate()}
              >
                {t("pendingScreen.discard")}
              </FintButton>
              <FintButton
                flex={1}
                minH={52}
                rounded={radius.md}
                fontSize={16}
                opacity={missing ? 0.45 : 1}
                disabled={Boolean(missing) || isPending}
                icon={confirmMutation.isPending || transferMutation.isPending ? <FintSpinner color="$onBrand" /> : undefined}
                onPress={submit}
              >
                {t(mode === "transfer" && originId && destinationId ? "movementUx.transferConfirmAction" : "pendingScreen.confirm")}
              </FintButton>
            </XStack>
          </YStack>
        </KeyboardStickyView>
      ) : null}

      {mountedSheet === "account" ? (
        <AccountSheet
          open={sheet === "account"}
          onClose={() => setSheet(null)}
          title={t("pendingScreen.account")}
          accounts={accounts}
          perBalance={false}
          selected={account ? { id: account.id } : null}
          onSelect={({ account: next }) => {
            setAccountId(next.id);
            setMissingBalanceCurrency(null);
          }}
        />
      ) : null}
      {mountedSheet === "origin" || mountedSheet === "destination" ? (
        <AccountSheet
          open={sheet === "origin" || sheet === "destination"}
          onClose={() => setSheet(null)}
          title={t(sheet === "destination" || mountedSheet === "destination" ? "pendingScreen.to" : "pendingScreen.from")}
          accounts={accounts}
          perBalance={false}
          selected={mountedSheet === "destination" ? (destination ? { id: destination.id } : null) : origin ? { id: origin.id } : null}
          onSelect={({ account: next }) => {
            // Elegir la cuenta del otro lado las invierte, en lugar de dejar la misma en los dos.
            if (mountedSheet === "destination") {
              if (next.id === originId) setOriginId(destinationId);
              setDestinationId(next.id);
            } else {
              if (next.id === destinationId) setDestinationId(originId);
              setOriginId(next.id);
            }
          }}
        />
      ) : null}
      {mountedSheet === "category" ? (
        <CategorySheet
          open={sheet === "category"}
          onClose={() => setSheet(null)}
          type={type}
          categories={categories}
          frequent={[]}
          value={category}
          onSelect={setCategory}
        />
      ) : null}
      {mountedSheet === "date" ? <DateSheet open={sheet === "date"} onClose={() => setSheet(null)} value={date} onChange={setDate} /> : null}
      {mountedSheet === "note" ? <NoteSheet open={sheet === "note"} onClose={() => setSheet(null)} value={note} onChange={setNote} recent={[]} /> : null}
      {mountedSheet === "location" ? (
        <LocationSheet open={sheet === "location"} onClose={() => setSheet(null)} value={location} suggestion={null} onSave={setLocation} />
      ) : null}
      {mountedSheet === "payment" ? (
        <FintSheet open={sheet === "payment"} onClose={() => setSheet(null)} title={t("pendingScreen.paymentSheet")}>
          <View height={8} />
          {[{ id: NORMAL, title: t("pendingScreen.normalMovement"), dueDate: null as string | null, remainingAmount: null as number | null, currency: "" }, ...occurrences].map(
            (o, i) => (
              <ListRow
                key={o.id}
                divider={i > 0}
                title={o.title}
                subtitle={o.dueDate ? t("pendingScreen.due", { date: shortDay(parseDateString(o.dueDate)!, locale) }) : undefined}
                trailing={
                  <XStack items="center" gap={10}>
                    {o.remainingAmount !== null ? <Amount value={o.remainingAmount} currency={o.currency} variant="amount-sm" tone="inkMuted" /> : null}
                    {occurrenceId === o.id ? <Check size={18} color="$brand" strokeWidth={2.4} /> : null}
                  </XStack>
                }
                onPress={() => {
                  haptics.select();
                  setOccurrenceId(o.id);
                  setSheet(null);
                }}
              />
            ),
          )}
        </FintSheet>
      ) : null}
    </YStack>
  );
}

/** "Miércoles 23 set" dentro de una frase: en español y portugués, el día va en minúscula. */
function inSentence(label: string, language?: string) {
  return language === "en" ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * Lo que se detectó, en `surfaceSunken`: cuándo y la descripción que arma el
 * lector del correo ("Consumo con Tarjeta de Crédito BCP"). El monto y la fecha
 * no se repiten aquí: ya están en el formulario. La descripción no se edita: se
 * guarda como nota del movimiento si la persona no escribe una.
 */
function SourceBox({ detail, label }: { detail: PendingMovementDetail; label: string }) {
  return (
    <YStack mt={18} p={14} gap={6} rounded={radius.lg} bg="$surfaceSunken">
      <XStack items="center" gap={6}>
        <Mail size={13} color="$inkFaint" strokeWidth={2} />
        <FText variant="caption" tone="inkFaint" style={{ fontSize: 12 }}>
          {label}
        </FText>
      </XStack>
      <FText variant="body-strong" numberOfLines={2}>
        {detail.title}
      </FText>
    </YStack>
  );
}

/**
 * Fila de dato: icono en `surfaceSunken`, etiqueta, valor y flecha. Lo que
 * falta va en `brandWash` con "Elegir" en `brand`.
 */
function DataRow({
  icon,
  label,
  value,
  muted,
  missing,
  chooseLabel,
  divider,
  onPress,
  onClear,
  clearLabel,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  muted?: boolean;
  missing?: boolean;
  chooseLabel?: string;
  divider?: boolean;
  onPress: () => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${missing ? chooseLabel : value}`}>
      {({ pressed }) => (
        <XStack
          items="center"
          gap={12}
          px={14}
          py={13}
          borderTopWidth={divider ? 1 : 0}
          borderColor="$line"
          bg={missing ? "$brandWash" : pressed ? "$surfaceSunken" : "transparent"}
        >
          <View width={32} height={32} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
            {icon}
          </View>
          <FText variant="body" tone="inkMuted" style={{ fontSize: 14 }}>
            {label}
          </FText>
          <FText
            variant="body"
            tone={missing ? "brand" : muted ? "inkFaint" : "ink"}
            numberOfLines={1}
            style={{ flex: 1, textAlign: "right", fontSize: 14, fontFamily: fontFace.sans[missing ? 600 : 500] }}
          >
            {missing ? chooseLabel : value}
          </FText>
          {onClear ? (
            <IconButton label={clearLabel ?? ""} tone="sunken" size={34} icon={<X size={14} color="$inkMuted" strokeWidth={2.2} />} onPress={onClear} />
          ) : (
            <ChevronRight size={16} color={missing ? "$brand" : "$inkFaint"} strokeWidth={2} />
          )}
        </XStack>
      )}
    </Pressable>
  );
}

function MissingBalance({ currency, canEnable, pending, onEnable }: { currency: string; canEnable: boolean; pending: boolean; onEnable: () => void }) {
  const { t } = useTranslation();
  return (
    <YStack mt={16} p={14} gap={12} rounded={radius.lg} bg="$surfaceSunken">
      <XStack items="center" gap={12}>
        <View width={32} height={32} rounded={radius.sm} bg="$surface" items="center" justify="center">
          <Coins size={16} color="$inkMuted" strokeWidth={2} />
        </View>
        <YStack flex={1} minW={0} gap={2}>
          <FText variant="body-strong" style={{ fontSize: 14 }}>
            {t("movementUx.missingBalanceTitle", { currency })}
          </FText>
          {/* Solo una tarjeta de crédito puede habilitar una segunda moneda: para el resto, elegir otra cuenta. */}
          <FText variant="caption" tone="inkMuted">
            {canEnable ? t("movementUx.missingBalanceDescription", { currency }) : t("movementUx.missingBalanceOtherAccountOnly", { currency })}
          </FText>
        </YStack>
      </XStack>
      {canEnable ? (
        <FintButton variant="outlined" minH={40} disabled={pending} icon={pending ? <FintSpinner color="$ink" /> : undefined} onPress={onEnable}>
          {pending ? t("accounts.enablingBalance") : t("movementUx.enableBalanceForCurrency", { currency })}
        </FintButton>
      ) : null}
    </YStack>
  );
}

function ReviewSkeleton() {
  return (
    <YStack gap={18} mt={18}>
      <View height={96} rounded={radius.lg} bg="$surfaceSunken" />
      <YStack items="center" gap={8}>
        <AmountSkeleton width={180} height={40} />
        <AmountSkeleton width={140} height={10} />
      </YStack>
      <View height={260} rounded={radius.lg} bg="$surfaceSunken" />
    </YStack>
  );
}
