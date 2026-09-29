import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronRight, CircleAlert, FileText } from "@tamagui/lucide-icons-2";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { z } from "zod";
import { financeApi } from "../api/finance";
import type { AccountOption, PaymentOccurrence } from "../api/types";
import { getAccountTypeLabel } from "../finance/accountTypes";
import { parseDateString, todayDateString } from "../finance/dates";
import { formatAmount } from "../finance/formatAmount";
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from "../forms";
import { getAppLocale } from "../i18n";
import { AccountMonogram } from "../movement-form/AccountSheet";
import { DateSheet, shortDay } from "../movement-form/DateSheet";
import { NoteSheet } from "../movement-form/NoteSheet";
import { accountBalance } from "../movement-form/logic";
import { getInstallationId } from "../notifications/pushNotifications";
import { radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FintButton, FintCard, FintSheet, FintSpinner, FText, SheetField, useNotify } from "../ui";
import { BigAmountInput } from "../ui/BigAmountInput";
import { haptics } from "../ui/haptics";

/**
 * Registrar el pago de una ocurrencia (el "Pagar" de la pestaña Pagos), en el
 * sistema v3: el monto grande (`BigAmountInput`, como en el formulario de
 * pago) con lo que queda por pagar debajo, las cuentas de la misma moneda en
 * una tarjeta con su saldo y el check `brand` en la elegida, la fecha (abre
 * `DateSheet`, sin días futuros) y una nota opcional (abre `NoteSheet`). La lógica no cambia:
 * mismo esquema, misma mutación y mismas cuentas elegibles.
 */
export function OccurrencePaymentSheet({
  accounts,
  occurrence,
  onOpenChange,
  open,
}: {
  accounts: AccountOption[];
  occurrence: PaymentOccurrence | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { i18n, t } = useTranslation();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const eligibleAccounts = occurrence ? accounts.filter((account) => account.currency === occurrence.currency) : [];
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => todayDateString());
  const [note, setNote] = useState("");
  // La fecha y la nota se eligen en su propia hoja (como en el formulario de movimiento); mientras tanto, esta cede
  // el lugar y vuelve con todo lo escrito. La nota en su hoja sube pegada al teclado, que aquí tapaba el campo.
  const [subSheet, setSubSheet] = useState<"date" | "note" | null>(null);
  const [mountedSub, setMountedSub] = useState<"date" | "note" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const validation = useSubmitValidation<"accountId" | "amount" | "transactionDate">();
  const maxAmount = occurrence?.remainingAmount ?? 0;
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, "amount");
  const paymentSchema = z.object({
    amount: z
      .number({ error: amountMessage })
      .positive(getValidationMessage(t, i18n.resolvedLanguage, "positiveAmount"))
      .max(maxAmount, getValidationMessage(t, i18n.resolvedLanguage, "maxAmount")),
    accountId: z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, "required")),
    transactionDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, "date")),
    note: z.string().trim().optional(),
  });

  useEffect(() => {
    if (!open || !occurrence) return;
    setAmount((occurrence.remainingAmount ?? 0).toFixed(2));
    setAccountId("");
    setTransactionDate(todayDateString());
    setNote("");
    setErrorMessage(null);
    validation.resetErrors();
  }, [occurrence, open, validation.resetErrors]);

  // La hoja de fecha o de nota se monta al abrirla y se desmonta después de cerrarse (la consulta del mes no corre de más).
  useEffect(() => {
    if (subSheet) return;
    const id = setTimeout(() => setMountedSub(null), 600);
    return () => clearTimeout(id);
  }, [subSheet]);
  const openSub = (next: "date" | "note") => {
    setMountedSub(next);
    setSubSheet(next);
  };

  useEffect(() => {
    if (!open || accountId) return;
    const first = eligibleAccounts[0]?.id;
    if (first) setAccountId(first);
  }, [open, accountId, eligibleAccounts]);

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof paymentSchema>) => {
      if (!occurrence) throw new Error("Missing payment occurrence");
      return financeApi.payPaymentOccurrence(occurrence.id, { ...payload, originInstallationId: await getInstallationId() });
    },
    onSuccess: async () => {
      await Promise.all(
        ["payment-occurrences", "summary", "accounts", "transactions", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      onOpenChange(false);
      notify.success(t("payments.paymentRecorded"), { message: t("payments.occurrenceUpdated") });
    },
    onError: () => setErrorMessage(t("payments.paymentError")),
  });

  const submit = () => {
    setErrorMessage(null);
    const payload = validation.validate(paymentSchema, { amount: parseDecimalInput(amount), accountId, transactionDate, note: note || undefined });
    if (payload) mutation.mutate(payload);
  };

  const locale = getAppLocale(i18n.resolvedLanguage);
  const dateLabel = (() => {
    const today = todayDateString();
    const d = parseDateString(transactionDate);
    if (!d) return transactionDate;
    if (transactionDate === today) return t("movementForm.today");
    const y = parseDateString(today)!;
    const yesterday = new Date(y.getFullYear(), y.getMonth(), y.getDate() - 1);
    if (d.getTime() === yesterday.getTime()) return t("movementForm.yesterday");
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${shortDay(d, locale)}`;
  })();
  const currency = occurrence?.currency ?? "PEN";
  const tall = eligibleAccounts.length > 4;

  return (
    <>
      <FintSheet
        open={open && !subSheet}
        onClose={() => !mutation.isPending && onOpenChange(false)}
        title={t("payments.registerPayment")}
        subtitle={occurrence?.title ?? ""}
        // Toma el alto de su contenido; solo con muchas cuentas pasa a un alto fijo con desplazamiento.
        scrollable={tall}
        snapPoints={tall ? [86] : undefined}
      >
        <YStack px={space[4]} pt={space[2]} pb={space[4]}>
          <YStack items="center" mt={6}>
            <BigAmountInput
              currency={currency}
              value={amount}
              label={t("payments.amount", { defaultValue: t("forms.amount") })}
              onChange={(value) => {
                setAmount(value);
                validation.clearError("amount");
              }}
            />
            {occurrence ? (
              <FText variant="caption" tone="inkMuted" style={{ marginTop: 4 }}>
                {t("payments.maxAmountHint", { amount: formatAmount(occurrence.remainingAmount ?? 0, currency) })}
              </FText>
            ) : null}
            {validation.errors.amount ? <ErrorLine message={validation.errors.amount} center /> : null}
          </YStack>

          <Label>{t("payments.paymentAccount")}</Label>
          {eligibleAccounts.length ? (
            <FintCard p={0} overflow="hidden" borderColor={validation.errors.accountId ? "$dangerHard" : "$line"}>
              {eligibleAccounts.map((account, i) => {
                const selected = account.id === accountId;
                const balance = accountBalance(account, account.currency);
                const typeLabel = account.accountType ? getAccountTypeLabel(account.accountType, t) : null;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      haptics.select();
                      setAccountId(account.id);
                      validation.clearError("accountId");
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${account.name} · ${account.currency}`}
                  >
                    {({ pressed }) => (
                      <XStack
                        items="center"
                        gap={space[3]}
                        px={space[4]}
                        py={space[3]}
                        borderTopWidth={i ? 1 : 0}
                        borderColor="$line"
                        bg={pressed ? "$surfaceSunken" : "transparent"}
                      >
                        <AccountMonogram name={account.name} />
                        <YStack flex={1} minW={0}>
                          <FText variant="body-strong" numberOfLines={1}>
                            {account.name}
                          </FText>
                          <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                            {[typeLabel, account.currency].filter(Boolean).join(" · ")}
                          </FText>
                        </YStack>
                        {balance !== null ? <Amount value={balance} currency={account.currency} variant="amount-sm" tone="inkMuted" /> : null}
                        <View width={18}>{selected ? <Check size={18} color="$brand" strokeWidth={2.4} /> : null}</View>
                      </XStack>
                    )}
                  </Pressable>
                );
              })}
            </FintCard>
          ) : (
            <XStack px={14} py={12} gap={10} rounded={radius.md} bg="$surfaceSunken" items="flex-start">
              <CircleAlert size={15} color="$inkMuted" strokeWidth={2} style={{ marginTop: 1 }} />
              <FText variant="caption" tone="inkMuted" style={{ flex: 1, lineHeight: 17 }}>
                {t("payments.noAccountsForCurrency")}
              </FText>
            </XStack>
          )}
          {validation.errors.accountId ? <ErrorLine message={validation.errors.accountId} /> : null}

          <Label>{t("payments.paymentDate")}</Label>
          <Pressable onPress={() => openSub("date")} accessibilityRole="button" accessibilityLabel={`${t("payments.paymentDate")}: ${dateLabel}`}>
            <SheetField invalid={Boolean(validation.errors.transactionDate)}>
              <CalendarDays size={18} color="$inkMuted" strokeWidth={2} />
              <FText style={{ flex: 1, paddingVertical: 12 }}>{dateLabel}</FText>
              <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
            </SheetField>
          </Pressable>
          {validation.errors.transactionDate ? <ErrorLine message={validation.errors.transactionDate} /> : null}

          <Label>{t("payments.note")}</Label>
          <Pressable onPress={() => openSub("note")} accessibilityRole="button" accessibilityLabel={t("payments.note")}>
            <SheetField>
              <FileText size={18} color="$inkMuted" strokeWidth={2} />
              <FText tone={note ? "ink" : "inkFaint"} numberOfLines={1} style={{ flex: 1, paddingVertical: 12 }}>
                {note || t("payments.noteOptionalPlaceholder")}
              </FText>
              <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
            </SheetField>
          </Pressable>

          {errorMessage ? <ErrorLine message={errorMessage} /> : null}
          <YStack mt={20}>
            <FintButton disabled={mutation.isPending || eligibleAccounts.length === 0} onPress={submit}>
              {mutation.isPending ? <FintSpinner color="$onBrand" /> : t("payments.confirmPayment")}
            </FintButton>
          </YStack>
        </YStack>
      </FintSheet>

      {mountedSub === "date" ? (
        <DateSheet
          open={subSheet === "date"}
          onClose={() => setSubSheet(null)}
          value={transactionDate}
          onChange={(value) => {
            setTransactionDate(value);
            validation.clearError("transactionDate");
          }}
        />
      ) : null}
      {mountedSub === "note" ? (
        <NoteSheet open={subSheet === "note"} onClose={() => setSubSheet(null)} value={note} onChange={setNote} recent={[]} />
      ) : null}
    </>
  );
}

function Label({ children }: { children: string }) {
  return (
    <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[600], marginTop: 18, marginBottom: 8, marginLeft: 2 }}>
      {children}
    </FText>
  );
}

function ErrorLine({ message, center = false }: { message: string; center?: boolean }) {
  return (
    <XStack items="center" justify={center ? "center" : "flex-start"} gap={5} mx={2} mt={6} accessibilityRole="alert">
      <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
      <FText variant="caption" tone="dangerHard" style={{ fontFamily: fontFace.sans[600] }}>
        {message}
      </FText>
    </XStack>
  );
}
