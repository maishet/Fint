import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronRight, Landmark, Lock, Repeat, Shapes, Zap, X } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TextInput } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { z } from "zod";
import { CurrencySheet } from "../src/accounts/CurrencySheet";
import { useCapabilities } from "../src/api/capabilities";
import { financeApi } from "../src/api/finance";
import { DataStateCard } from "../src/components/DataStateCard";
import { UnsavedChangesDialog } from "../src/components/UnsavedChangesDialog";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { getCurrencySymbol } from "../src/finance/currencies";
import { parseDateString, todayDateString } from "../src/finance/dates";
import { getValidationMessage, parseDecimalInput, sanitizeAmountInput, useSubmitValidation } from "../src/forms";
import { useUnsavedChangesGuard } from "../src/hooks/useUnsavedChangesGuard";
import { getAppLocale } from "../src/i18n";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { DateSheet, shortDay } from "../src/movement-form/DateSheet";
import { AccountSheet } from "../src/movement-form/AccountSheet";
import { accountBalance } from "../src/movement-form/logic";
import { registerPushInstallation } from "../src/notifications/pushNotifications";
import { amountText, upcomingDates, type Frequency } from "../src/payments/form";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import {
  Amount,
  FintButton,
  FintCard,
  FintSpinner,
  FText,
  IconButton,
  PressableScale,
  SegmentedControl,
  SheetField,
  SheetTextInput,
  Toggle,
} from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { useNotify } from "../src/ui/notify";

// NOTE: the payments/debts module only supports 'fixed_payment' rules (single-step flow:
// create rule -> mark occurrence as paid). credit_card rules were removed; see
// database/migrations/025_drop_credit_card_payment_support.sql on the API side.
// TODO: reconsiderar tipos de pago no fijos en el futuro.

type Sheet = "currency" | "date" | "category" | "account" | null;
const SHEET_UNMOUNT_MS = 600;
const KEYBOARD_GAP = 24;
const FREQUENCIES: Frequency[] = ["weekly", "biweekly", "monthly", "yearly"];

/**
 * Formulario de pago recurrente v3: cerrar y título; el monto a 44px en una
 * tarjeta con la moneda en una píldora; nombre; frecuencia en un selector
 * segmentado; primera fecha y categoría en una tarjeta (abren las hojas del
 * formulario de movimiento, aquí con días futuros) y debajo las próximas tres
 * fechas; y el débito automático con su cuenta de cargo. Botón fijo abajo.
 *
 * Conserva la lógica anterior: mismos esquemas y mutaciones, la moneda no se
 * cambia al editar, el monto se bloquea si ya hay pagos registrados, la cuenta
 * de cargo se filtra por moneda y sin tarjetas, y la guardia de cambios.
 */
export default function DebtFormScreen() {
  const params = useLocalSearchParams<{ ruleId?: string | string[] }>();
  const ruleId = Array.isArray(params.ruleId) ? params.ruleId[0] : params.ruleId;
  const isEditing = Boolean(ruleId);
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeMode();
  const { capabilities } = useCapabilities();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const categoriesQuery = useQuery({ queryKey: ["categories", "expense"], queryFn: () => financeApi.listCategories("expense") });
  const rulesQuery = useQuery({ queryKey: ["payment-rules"], queryFn: financeApi.listPaymentRules });
  const optionsQuery = useQuery({ queryKey: ["finance-options"], queryFn: financeApi.getFinanceOptions });
  const paidOccurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "paid"],
    queryFn: () => financeApi.listPaymentOccurrences({ status: "paid" }),
    enabled: isEditing,
  });
  const categories = categoriesQuery.data ?? [];
  const currentRule = (rulesQuery.data ?? []).find((rule) => rule.id === ruleId);
  const hasRegisteredPayments = isEditing && (paidOccurrencesQuery.data ?? []).some((occurrence) => occurrence.ruleId === ruleId);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PEN");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(() => todayDateString());
  const [categoryId, setCategoryId] = useState("");
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayAccountId, setAutoPayAccountId] = useState("");
  const [saved, setSaved] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  // Solo se monta la hoja que se abre, y se desmonta al terminar de cerrarse.
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

  const autoPayAvailable = capabilities.features.autoPayPayments;
  const autoPayAccountsQuery = useQuery({
    queryKey: ["account-options", "auto-pay", currency],
    queryFn: () => financeApi.listAccountOptions({ currency, excludeAccountType: "credit_card" }),
    enabled: autoPayAvailable,
  });
  const autoPayAccounts = autoPayAccountsQuery.data ?? [];
  const autoPayAccount = autoPayAccounts.find((account) => account.id === autoPayAccountId);

  const isDirty =
    !saved &&
    (isEditing
      ? Boolean(currentRule) &&
        (title !== currentRule!.title ||
          amount !== (amountText(currentRule!.fixedAmount)) ||
          categoryId !== (currentRule!.categoryId ?? "") ||
          frequency !== currentRule!.frequency ||
          startDate !== currentRule!.startDate ||
          autoPayEnabled !== currentRule!.autoPayEnabled ||
          autoPayAccountId !== (currentRule!.autoPayAccountId ?? ""))
      : title !== "" || amount !== "" || categoryId !== "" || autoPayEnabled);
  const guard = useUnsavedChangesGuard(isDirty);

  const validation = useSubmitValidation<"title" | "amount" | "categoryId" | "startDate" | "autoPayAccountId">();
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, "amount");
  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(2, getValidationMessage(t, i18n.resolvedLanguage, "minTwo")),
    amount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, "positiveAmount")),
    categoryId: z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, "required")),
    startDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, "date")),
  });

  useEffect(() => {
    if (!currentRule) return;
    setTitle(currentRule.title);
    setFrequency(currentRule.frequency);
    setStartDate(currentRule.startDate);
    setAmount(amountText(currentRule.fixedAmount));
    setCurrency(currentRule.currency);
    setCategoryId(currentRule.categoryId ?? "");
    setAutoPayEnabled(currentRule.autoPayEnabled);
    setAutoPayAccountId(currentRule.autoPayAccountId ?? "");
  }, [currentRule]);

  useEffect(() => {
    if (currentRule || !optionsQuery.data?.baseCurrency) return;
    setCurrency(optionsQuery.data.baseCurrency);
  }, [currentRule, optionsQuery.data?.baseCurrency]);

  // Si cambia la moneda, la cuenta de cargo elegida puede dejar de servir.
  useEffect(() => {
    if (!autoPayAccountId || autoPayAccountsQuery.isPending) return;
    if (!autoPayAccounts.some((account) => account.id === autoPayAccountId)) setAutoPayAccountId("");
  }, [autoPayAccountId, autoPayAccounts, autoPayAccountsQuery.isPending]);

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      const autoPay = { autoPayEnabled, autoPayAccountId: autoPayEnabled ? autoPayAccountId : null };
      if (ruleId) {
        const amountChanged = currentRule?.fixedAmount !== payload.amount;
        return financeApi.updatePaymentRule(ruleId, {
          title: payload.title,
          frequency,
          ...(amountChanged ? { fixedAmount: payload.amount } : {}),
          categoryId: payload.categoryId,
          startDate: payload.startDate,
          ...autoPay,
        });
      }
      return financeApi.createPaymentRule({
        kind: "fixed_payment",
        title: payload.title,
        frequency,
        currency,
        fixedAmount: payload.amount,
        categoryId: payload.categoryId,
        timezone,
        startDate: payload.startDate,
        ...autoPay,
      });
    },
    onSuccess: async () => {
      await Promise.all(
        ["payment-rules", "payment-occurrences", "summary", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      if (!isEditing && capabilities.features.pushPaymentReminders) registerPushInstallation().catch(() => undefined);
      toast.show(t(isEditing ? "payments.recurringUpdated" : "payments.recurringCreated"), {
        message: t(isEditing ? "payments.changesSaved" : "payments.firstOccurrenceReady"),
        preset: "success",
        duration: 3500,
      });
      setSaved(true);
      guard.bypass(() => router.back());
    },
    onError: (error) =>
      toast.error(t(isEditing ? "payments.updateError" : "payments.createError"), {
        message: error instanceof Error ? error.message : undefined,
        duration: 4500,
      }),
  });

  const submit = () => {
    if (!capabilities.features.recurringPayments) {
      toast.error(t("payments.disabledTemporary"));
      return;
    }
    const payload = validation.validate(schema, { title, amount: parseDecimalInput(amount), categoryId, startDate });
    if (autoPayEnabled && (!autoPayAccountId || !autoPayAccounts.some((account) => account.id === autoPayAccountId))) {
      validation.setError("autoPayAccountId", t("payments.autoPayAccountRequired"));
      return;
    }
    if (payload) mutation.mutate(payload);
  };

  const isLoading = categoriesQuery.isLoading || rulesQuery.isLoading || optionsQuery.isLoading;
  const error = categoriesQuery.error ?? rulesQuery.error ?? optionsQuery.error;
  const notFound = !isLoading && !error && isEditing && !currentRule;
  const ready = !isLoading && !error && !notFound;

  // Primera fecha: "Jueves 1 oct". Próximas: desde la primera fecha al crear; al editar, desde hoy.
  const start = parseDateString(startDate);
  const startLabel = start
    ? capitalize(`${new Intl.DateTimeFormat(locale, { weekday: "long" }).format(start)} ${shortDay(start, locale)}`)
    : t("payments.selectDate");
  // En un pago anual las fechas solo difieren en el año: se agrega ("24 set 2026, 24 set 2027…").
  const upcoming = upcomingDates(startDate, frequency, 3, isEditing ? todayDateString() : undefined).map((iso) => {
    const date = parseDateString(iso)!;
    return { iso, label: frequency === "yearly" ? `${shortDay(date, locale)} ${date.getFullYear()}` : shortDay(date, locale) };
  });

  const amountLocked = isEditing && hasRegisteredPayments;
  const fieldErrors = [validation.errors.startDate, validation.errors.categoryId].filter((m): m is string => Boolean(m));

  return (
    <>
      <UnsavedChangesDialog open={guard.open} onCancel={guard.onCancel} onConfirm={guard.onConfirm} />
      <YStack flex={1} bg="$canvas" pt={insets.top}>
        {/* Cerrar y título. */}
        <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]}>
          <IconButton label={t("paymentForm.close")} icon={<X size={18} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText
            variant="title"
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flex: 1, textAlign: "center", fontSize: 18, lineHeight: 23, letterSpacing: -0.4 }}
          >
            {t(isEditing ? "payments.editRecurring" : "payments.newRecurring")}
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
          {isLoading ? <FormSkeleton /> : null}
          {error ? (
            <View mt={space[5]}>
              <DataStateCard message={error instanceof Error ? error.message : t("states.error")} />
            </View>
          ) : null}
          {notFound ? (
            <View mt={space[5]}>
              <DataStateCard message={t("payments.notFound")} />
            </View>
          ) : null}

          {ready ? (
            <>
              {/* Monto de cada pago, con la moneda en una píldora. */}
              <FintCard mt={18} pt={18} px={16} pb={16} items="center">
                <FText variant="caption" tone="inkMuted">
                  {t("paymentForm.amount")}
                </FText>
                <AmountInput
                  currency={currency}
                  value={amount}
                  locked={amountLocked}
                  label={t("paymentForm.amount")}
                  onChange={(value) => {
                    setAmount(value);
                    validation.clearError("amount");
                  }}
                />
                <PressableScale
                  onPress={() => setSheet("currency")}
                  disabled={isEditing}
                  accessibilityRole="button"
                  accessibilityLabel={t("paymentForm.currency", { currency })}
                >
                  <XStack
                    height={28}
                    mt={8}
                    pl={12}
                    pr={10}
                    gap={4}
                    items="center"
                    rounded={radius.pill}
                    borderWidth={1}
                    borderColor="$lineStrong"
                    bg="$surface"
                  >
                    <FText variant="caption" style={{ fontFamily: fontFace.mono[500], fontSize: 12 }}>
                      {currency}
                    </FText>
                    {isEditing ? (
                      <Lock size={12} color="$inkFaint" strokeWidth={2.2} />
                    ) : (
                      <ChevronDown size={13} color="$inkMuted" strokeWidth={2.2} />
                    )}
                  </XStack>
                </PressableScale>
                {validation.errors.amount ? <ErrorText>{validation.errors.amount}</ErrorText> : null}
                {isEditing ? (
                  <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", lineHeight: 17, marginTop: 10 }}>
                    {t(amountLocked ? "paymentForm.amountLocked" : "paymentForm.currencyLocked")}
                  </FText>
                ) : null}
              </FintCard>

              {/* Nombre */}
              <Field label={t("paymentForm.name")} error={validation.errors.title}>
                <NameField
                  value={title}
                  placeholder={t("payments.titlePlaceholder")}
                  label={t("paymentForm.name")}
                  onChange={(value) => {
                    setTitle(value);
                    validation.clearError("title");
                  }}
                />
              </Field>

              {/* Frecuencia */}
              <Field label={t("paymentForm.frequency")}>
                <SegmentedControl
                  options={FREQUENCIES.map((value) => ({ value, label: t(`payments.${value}`) }))}
                  value={frequency}
                  onChange={setFrequency}
                  accessibilityLabel={t("paymentForm.frequency")}
                />
              </Field>

              {/* Primera fecha y categoría. */}
              <FintCard mt={16} p={0} overflow="hidden">
                <LinkRow
                  icon={<CalendarDays size={16} color="$inkMuted" strokeWidth={2} />}
                  label={t("payments.firstDate")}
                  value={startLabel}
                  onPress={() => setSheet("date")}
                />
                {categories.length === 0 ? (
                  <YStack px={14} py={13} gap={10} borderTopWidth={1} borderColor="$line">
                    <FText variant="body" style={{ fontSize: 14 }}>
                      {t("payments.categoryRequiredHint")}
                    </FText>
                    <FintButton variant="outlined" minH={36} onPress={() => router.push("/categories")}>
                      {t("payments.createCategory")}
                    </FintButton>
                  </YStack>
                ) : (
                  <LinkRow
                    divider
                    icon={
                      selectedCategory?.icon ? (
                        <Text style={{ fontSize: 16, lineHeight: 20, includeFontPadding: false }}>{selectedCategory.icon}</Text>
                      ) : (
                        <Shapes size={16} color="$inkMuted" strokeWidth={2} />
                      )
                    }
                    label={t("paymentForm.category")}
                    value={selectedCategory ? getCategoryLabel(selectedCategory.name, t) : t("paymentForm.choose")}
                    muted={!selectedCategory}
                    invalid={Boolean(validation.errors.categoryId)}
                    onPress={() => setSheet("category")}
                  />
                )}
              </FintCard>
              {fieldErrors.map((message) => (
                <ErrorText key={message}>{message}</ErrorText>
              ))}

              {/* Próximas fechas, para confirmar la frecuencia. */}
              {upcoming.length > 0 ? (
                <XStack items="center" gap={8} mt={10} mx={2}>
                  <Repeat size={14} color="$inkFaint" strokeWidth={2} />
                  <FText variant="caption" tone="inkFaint" style={{ flex: 1 }}>
                    {t("paymentForm.next", { count: upcoming.length, list: "" })}
                    {upcoming.map((date, i) => (
                      <FText key={date.iso} variant="caption" tone="inkFaint">
                        {i === 0 ? "" : i === upcoming.length - 1 ? ` ${t("paymentForm.and")} ` : ", "}
                        <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.mono[500] }}>
                          {date.label}
                        </FText>
                      </FText>
                    ))}
                  </FText>
                </XStack>
              ) : null}

              {/* Débito automático. */}
              {autoPayAvailable ? (
                <FintCard mt={16} p={0} overflow="hidden">
                  <XStack items="center" gap={12} px={14} py={13}>
                    <RowIcon>
                      <Zap size={16} color="$inkMuted" strokeWidth={2} />
                    </RowIcon>
                    <FText variant="body" style={{ flex: 1, fontSize: 14 }}>
                      {t("payments.autoPayLabel")}
                    </FText>
                    <Toggle
                      value={autoPayEnabled}
                      accessibilityLabel={t("payments.autoPayLabel")}
                      onValueChange={(checked) => {
                        setAutoPayEnabled(checked);
                        if (!checked) validation.clearError("autoPayAccountId");
                      }}
                    />
                  </XStack>
                  <FText
                    variant="caption"
                    tone="inkFaint"
                    style={{ lineHeight: 17, paddingLeft: 58, paddingRight: 14, paddingBottom: 12, marginTop: -6 }}
                  >
                    {t("payments.autoPayHint")}
                  </FText>
                  {autoPayEnabled ? (
                    autoPayAccounts.length === 0 && !autoPayAccountsQuery.isPending ? (
                      <YStack px={14} py={13} gap={10} borderTopWidth={1} borderColor="$line">
                        <FText variant="body" style={{ fontSize: 14 }}>
                          {t("payments.autoPayNoAccounts", { currency })}
                        </FText>
                        <FintButton variant="outlined" minH={36} onPress={() => router.push("/account-form")}>
                          {t("payments.autoPayCreateAccount")}
                        </FintButton>
                      </YStack>
                    ) : (
                      <LinkRow
                        divider
                        icon={<Landmark size={16} color="$inkMuted" strokeWidth={2} />}
                        label={t("payments.autoPayAccount")}
                        detail={
                          autoPayAccount ? (
                            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                              {`${autoPayAccount.name} · `}
                              <Amount
                                value={accountBalance(autoPayAccount, currency) ?? 0}
                                currency={currency}
                                variant="figure-caption"
                                tone="inkFaint"
                              />
                            </FText>
                          ) : undefined
                        }
                        value={autoPayAccount ? undefined : t("paymentForm.chooseAccount")}
                        muted
                        invalid={Boolean(validation.errors.autoPayAccountId)}
                        onPress={() => setSheet("account")}
                      />
                    )
                  ) : null}
                </FintCard>
              ) : null}
              {validation.errors.autoPayAccountId ? <ErrorText>{validation.errors.autoPayAccountId}</ErrorText> : null}
            </>
          ) : null}
        </KeyboardAwareScrollView>

        {/* Botón fijo abajo; con el teclado abierto va justo encima de él. */}
        {ready ? (
          <KeyboardStickyView offset={{ opened: Math.max(insets.bottom, 16) - 2 }}>
            <View
              px={space[4]}
              pt={space[3]}
              pb={Math.max(insets.bottom, 16) + 10}
              bg="$canvas"
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            >
              <FintButton
                minH={52}
                rounded={radius.md}
                fontSize={16}
                disabled={mutation.isPending || (autoPayEnabled && autoPayAccountsQuery.isPending)}
                icon={mutation.isPending ? <FintSpinner color="$onBrand" /> : undefined}
                onPress={submit}
              >
                {mutation.isPending ? t("payments.saving") : isEditing ? t("accounts.update") : t("payments.createRecurring")}
              </FintButton>
            </View>
          </KeyboardStickyView>
        ) : null}
      </YStack>

      {mountedSheet === "currency" ? (
        <CurrencySheet
          open={sheet === "currency"}
          onClose={() => setSheet(null)}
          title={t("accountForm.currencySheet")}
          value={currency}
          onSelect={setCurrency}
        />
      ) : null}
      {mountedSheet === "date" ? (
        <DateSheet
          open={sheet === "date"}
          onClose={() => setSheet(null)}
          value={startDate}
          allowFuture
          onChange={(value) => {
            setStartDate(value);
            validation.clearError("startDate");
          }}
        />
      ) : null}
      {mountedSheet === "category" ? (
        <CategorySheet
          open={sheet === "category"}
          onClose={() => setSheet(null)}
          type="expense"
          categories={categories}
          frequent={[]}
          value={selectedCategory?.name ?? ""}
          onSelect={(name) => {
            setCategoryId(categories.find((category) => category.name === name)?.id ?? "");
            validation.clearError("categoryId");
          }}
        />
      ) : null}
      {mountedSheet === "account" ? (
        <AccountSheet
          open={sheet === "account"}
          onClose={() => setSheet(null)}
          title={t("payments.autoPayAccount")}
          accounts={autoPayAccounts}
          perBalance={false}
          selected={autoPayAccount ? { id: autoPayAccount.id } : null}
          onSelect={({ account }) => {
            setAutoPayAccountId(account.id);
            validation.clearError("autoPayAccountId");
          }}
        />
      ) : null}
    </>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * El monto a 44px en `mono`, centrado con su símbolo. El campo toma el ancho
 * de lo escrito (se mide con un texto oculto) para que símbolo y cifra queden
 * juntos al centro. Bloqueado, se ve apagado y no se edita.
 */
function AmountInput({
  currency,
  value,
  locked,
  label,
  onChange,
}: {
  currency: string;
  value: string;
  locked: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const style = [textStyles.amount, { fontFamily: fontFace.mono[500], fontSize: 44, lineHeight: 52, letterSpacing: -2 }];
  return (
    <XStack justify="center" items="center" gap={6} mt={4} maxW="100%">
      <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 22, lineHeight: 28, marginTop: 8 }}>
        {getCurrencySymbol(currency)}
      </FText>
      <Text position="absolute" opacity={0} style={style} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
        {value || "0.00"}
      </Text>
      <View>
        {/* El marcador va aparte: en Android el `placeholder` de un campo no usa la fuente `mono`. */}
        {value ? null : (
          <Text position="absolute" l={0} r={0} numberOfLines={1} color="$inkFaint" style={style} pointerEvents="none">
            0.00
          </Text>
        )}
        <TextInput
          value={value}
          onChangeText={(next) => onChange(sanitizeAmountInput(next))}
          editable={!locked}
          keyboardType="decimal-pad"
          selectionColor={theme.brand.val}
          accessibilityLabel={`${label} (${currency})`}
          style={[style, { color: locked ? theme.inkMuted.val : theme.ink.val, width: width ? width + 6 : undefined, minWidth: 40, padding: 0 }]}
        />
      </View>
    </XStack>
  );
}

function NameField({
  value,
  placeholder,
  label,
  onChange,
}: {
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <SheetField focused={focused}>
      <SheetTextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCapitalize="sentences"
        returnKeyType="done"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
      />
    </SheetField>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <YStack mt={16}>
      <FText variant="caption" tone="inkMuted" style={{ marginBottom: 6, marginLeft: 2 }}>
        {label}
      </FText>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </YStack>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <FText variant="caption" tone="dangerHard" style={{ fontFamily: fontFace.sans[600], marginTop: 6, marginHorizontal: 2 }}>
      {children}
    </FText>
  );
}

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <View width={32} height={32} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
      {children}
    </View>
  );
}

/** Fila de tarjeta que abre una hoja: icono, etiqueta, valor a la derecha y flecha. */
function LinkRow({
  icon,
  label,
  detail,
  value,
  muted,
  invalid,
  divider,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  detail?: ReactNode;
  value?: string;
  muted?: boolean;
  invalid?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label}>
      <XStack items="center" gap={12} px={14} py={13} borderTopWidth={divider ? 1 : 0} borderColor="$line">
        <RowIcon>{icon}</RowIcon>
        <YStack flex={1} minW={0}>
          <FText variant="body" tone={invalid ? "dangerHard" : "ink"} style={{ fontSize: 14 }} numberOfLines={1}>
            {label}
          </FText>
          {detail}
        </YStack>
        {value ? (
          <FText
            variant="body"
            tone={muted ? "inkFaint" : "ink"}
            numberOfLines={1}
            style={{ fontSize: 14, fontFamily: fontFace.sans[500], flexShrink: 1 }}
          >
            {value}
          </FText>
        ) : null}
        <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
      </XStack>
    </PressableScale>
  );
}

function FormSkeleton() {
  return (
    <YStack gap={16} mt={18}>
      <View height={150} rounded={radius.lg} bg="$surfaceSunken" />
      {[0, 1].map((i) => (
        <YStack key={i} gap={8}>
          <AmountSkeleton width={70} height={10} />
          <View height={48} rounded={radius.md} bg="$surfaceSunken" />
        </YStack>
      ))}
      <View height={120} rounded={radius.lg} bg="$surfaceSunken" />
    </YStack>
  );
}
