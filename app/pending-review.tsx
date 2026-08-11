import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarDays,
  Check,
  Save,
  Shapes,
  Trash2,
  WalletCards,
} from "@tamagui/lucide-icons-2";
import { useToastController } from "@tamagui/toast";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Paragraph, XStack, YStack } from "tamagui";
import { z } from "zod";
import { financeApi } from "../src/api/finance";
import { formatMoney } from "../src/api/mappers";
import type {
  AccountOption,
  PendingMovementDetail,
  PaymentOccurrence,
  TransactionType,
} from "../src/api/types";
import { CategoryPickerSheet } from "../src/components/CategoryPickerSheet";
import { DataStateCard } from "../src/components/DataStateCard";
import {
  MovementAmountField,
  MovementNoteField,
  MovementPickerTrigger,
  MovementTypeSelector,
} from "../src/components/MovementFormControls";
import { Screen } from "../src/components/Screen";
import { SkeletonForm } from "../src/components/Skeleton";
import { todayDateString } from "../src/finance/dates";
import {
  getValidationMessage,
  parseDecimalInput,
  useSubmitValidation,
} from "../src/forms";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintDateField,
  FintFormField,
  FintSheetSelect,
  FintSpinner,
} from "../src/ui";
import { getInstallationId } from "../src/notifications/pushNotifications";

type PendingField = "accountId" | "amount" | "categoryId" | "transactionDate";
const NORMAL_MOVEMENT = "__transaction__";

type TransferScenario = 1 | 2 | 3;

function transferScenario(
  detail: PendingMovementDetail | undefined,
): TransferScenario | null {
  if (!detail?.transfer) return null;
  if (detail.amount === null || !detail.currency) return null;
  const { originMatch, destinationMatch } = detail.transfer;
  if (originMatch && destinationMatch) return 1;
  if (originMatch || destinationMatch) return 2;
  return 3;
}

export default function PendingReviewScreen() {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const toast = useToastController();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const pendingId = params.id ?? "";
  const hydratedId = useRef<string | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayDateString);
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [paymentOccurrenceId, setPaymentOccurrenceId] =
    useState(NORMAL_MOVEMENT);
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  // Scenario 1: reveals a compact origin/destination account editor instead of the full form.
  const [transferEditOpen, setTransferEditOpen] = useState(false);
  const [transferOriginAccountId, setTransferOriginAccountId] = useState("");
  const [transferDestinationAccountId, setTransferDestinationAccountId] =
    useState("");
  // Scenarios 2 and 3: "Editar" / "Es mío, registrar manualmente" fall back to the full form.
  const [manualFallbackOpen, setManualFallbackOpen] = useState(false);
  const validation = useSubmitValidation<PendingField>();

  const detailQuery = useQuery({
    queryKey: ["pending-movements", "detail", pendingId],
    queryFn: ({ signal }) => financeApi.getPendingMovement(pendingId, signal),
    enabled: Boolean(pendingId),
    retry: false,
  });
  const detail = detailQuery.data;
  const scenario = transferScenario(detail);
  const accountsQuery = useQuery({
    queryKey: ["account-options"],
    queryFn: () => financeApi.listAccountOptions(),
    enabled: Boolean(detailQuery.data),
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", type],
    queryFn: () => financeApi.listCategories(type),
    enabled: Boolean(detailQuery.data),
    retry: false,
  });
  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) =>
      financeApi.listPaymentOccurrences({ status: "open" }, signal),
    enabled: Boolean(detailQuery.data),
    retry: false,
  });
  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const selectedAccount = accounts.find((item) => item.id === accountId);
  const selectedCategory = categories.find((item) => item.name === category);
  const selectedOccurrence = occurrencesQuery.data?.find(
    (occurrence) => occurrence.id === paymentOccurrenceId,
  );
  const paymentOccurrences = compatibleOccurrences(
    occurrencesQuery.data ?? [],
    detailQuery.data,
  );
  const isReferenceLoading =
    accountsQuery.isLoading || categoriesQuery.isLoading;
  const isFormLoading =
    detailQuery.isLoading || (Boolean(detailQuery.data) && isReferenceLoading);

  const requiredMessage = getValidationMessage(
    t,
    i18n.resolvedLanguage,
    "required",
  );
  const schema = z.object({
    amount: z
      .number({
        error: getValidationMessage(t, i18n.resolvedLanguage, "amount"),
      })
      .positive(
        getValidationMessage(t, i18n.resolvedLanguage, "positiveAmount"),
      ),
    transactionDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        getValidationMessage(t, i18n.resolvedLanguage, "date"),
      ),
    accountId: z.string().uuid(requiredMessage),
    categoryId:
      paymentOccurrenceId === NORMAL_MOVEMENT
        ? z.string().uuid(requiredMessage)
        : z.string().optional(),
  });

  useEffect(() => {
    const current = detailQuery.data;
    if (!current || hydratedId.current === current.id) return;
    hydratedId.current = current.id;
    setType(current.type ?? "expense");
    setAmount(current.amount === null ? "" : String(current.amount));
    setTransactionDate(current.transactionDate);
    setAccountId(current.accountSuggestion?.id ?? "");
    setTransferOriginAccountId(current.transfer?.originMatch?.accountId ?? "");
    setTransferDestinationAccountId(
      current.transfer?.destinationMatch?.accountId ?? "",
    );
  }, [detailQuery.data]);

  useEffect(() => {
    if (accountId && !accounts.some((account) => account.id === accountId))
      setAccountId("");
  }, [accountId, accounts]);

  useEffect(() => {
    if (category && !categories.some((item) => item.name === category))
      setCategory("");
  }, [categories, category]);

  const invalidateAndClose = async () => {
    await invalidatePendingAndFinance(queryClient);
    toast.show(t("movements.createdToast"), {
      message: t("movements.createdMessage"),
      preset: "success",
    });
    router.back();
  };

  const confirmMutation = useMutation({
    mutationFn: async (
      payload: z.infer<typeof schema> & {
        currency: string;
        categoryId?: string | null;
      },
    ) => {
      const current = detailQuery.data;
      if (!current) throw new Error(t("states.error"));
      const originInstallationId = await getInstallationId();
      if (selectedOccurrence)
        return financeApi.confirmPendingMovement(pendingId, {
          mode: "payment",
          paymentOccurrenceId: selectedOccurrence.id,
          title: current.title,
          type: "expense",
          amount: payload.amount,
          currency: selectedOccurrence.currency,
          transactionDate: payload.transactionDate,
          accountId: payload.accountId,
          categoryId: null,
          note: note.trim() || null,
          originInstallationId,
        });
      return financeApi.confirmPendingMovement(pendingId, {
        mode: "transaction",
        title: current.title,
        type,
        ...payload,
        categoryId: payload.categoryId!,
        note: note.trim() || null,
      });
    },
    onSuccess: invalidateAndClose,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("states.error"),
      ),
  });

  const quickSideConfirmMutation = useMutation({
    mutationFn: async (input: {
      accountId: string;
      side: "origin" | "destination";
      title: string;
    }) => {
      const current = detailQuery.data;
      if (!current || current.amount === null)
        throw new Error(t("states.error"));
      return financeApi.confirmPendingMovement(pendingId, {
        mode: "transaction",
        title: input.title,
        type: input.side === "origin" ? "expense" : "income",
        amount: current.amount,
        transactionDate: current.transactionDate,
        accountId: input.accountId,
        note: null,
      });
    },
    onSuccess: invalidateAndClose,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("states.error"),
      ),
  });

  const transferConfirmMutation = useMutation({
    mutationFn: async (input: {
      originAccountId: string;
      destinationAccountId: string;
    }) => {
      const current = detailQuery.data;
      if (!current || current.amount === null || !current.currency)
        throw new Error(t("states.error"));
      return financeApi.createTransfer({
        originAccountId: input.originAccountId,
        destinationAccountId: input.destinationAccountId,
        amount: current.amount,
        currency: current.currency,
        transactionDate: current.transactionDate,
        pendingMovementId: current.id,
      });
    },
    onSuccess: invalidateAndClose,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("states.error"),
      ),
  });

  const discardMutation = useMutation({
    mutationFn: () => financeApi.discardPendingMovement(pendingId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
        queryClient.invalidateQueries({
          queryKey: ["pending-movements", "summary"],
        }),
      ]);
      toast.show(t("movementUx.pendingDiscarded"), { preset: "success" });
      router.back();
    },
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("states.error"),
      ),
  });

  const submit = () => {
    setErrorMessage(null);
    const payload = validation.validate(schema, {
      amount: parseDecimalInput(amount),
      transactionDate,
      accountId,
      categoryId:
        paymentOccurrenceId === NORMAL_MOVEMENT
          ? (selectedCategory?.id ?? "")
          : undefined,
    });
    if (payload && selectedAccount)
      confirmMutation.mutate({
        ...payload,
        currency: selectedOccurrence?.currency ?? selectedAccount.currency,
      });
  };

  const isPending =
    confirmMutation.isPending ||
    discardMutation.isPending ||
    quickSideConfirmMutation.isPending ||
    transferConfirmMutation.isPending;

  const showFullForm =
    !detail?.transfer || scenario === null || manualFallbackOpen;
  const showScenario1Summary =
    Boolean(detail?.transfer) && scenario === 1 && !transferEditOpen;
  const showScenario1Editor =
    Boolean(detail?.transfer) && scenario === 1 && transferEditOpen;
  const showScenario2Summary =
    Boolean(detail?.transfer) && scenario === 2 && !manualFallbackOpen;
  const showScenario3Summary =
    Boolean(detail?.transfer) && scenario === 3 && !manualFallbackOpen;

  return (
    <>
      <Stack.Screen options={{ title: t("movementUx.reviewPendingTitle") }} />
      <Screen>
        {isFormLoading ? (
          <SkeletonForm
            label={t("states.loading")}
            showSegment
            fieldCount={3}
          />
        ) : null}
        {detailQuery.error ? (
          <DataStateCard
            message={
              detailQuery.error instanceof Error
                ? detailQuery.error.message
                : t("states.error")
            }
            onRetry={() => {
              void detailQuery.refetch();
            }}
          />
        ) : null}

        {detail && !isFormLoading ? (
          <YStack gap="$4" pb="$5">
            {errorMessage ? (
              <Paragraph color="$red10">{errorMessage}</Paragraph>
            ) : null}

            {showScenario1Summary && detail.transfer?.originMatch && detail.transfer.destinationMatch ? (
              <TransferScenario1Summary
                detail={detail}
                origin={detail.transfer.originMatch}
                destination={detail.transfer.destinationMatch}
                isPending={isPending}
                onConfirm={() =>
                  transferConfirmMutation.mutate({
                    originAccountId: detail.transfer!.originMatch!.accountId,
                    destinationAccountId:
                      detail.transfer!.destinationMatch!.accountId,
                  })
                }
                onEdit={() => setTransferEditOpen(true)}
                onDiscard={() => setDiscardOpen(true)}
              />
            ) : null}

            {showScenario1Editor && accountsQuery.isLoading ? (
              <SkeletonForm label={t("states.loading")} fieldCount={2} />
            ) : null}
            {showScenario1Editor && !accountsQuery.isLoading ? (
              <TransferScenario1Editor
                accounts={accounts}
                originAccountId={transferOriginAccountId}
                destinationAccountId={transferDestinationAccountId}
                onOriginChange={setTransferOriginAccountId}
                onDestinationChange={setTransferDestinationAccountId}
                isPending={isPending}
                onCancel={() => setTransferEditOpen(false)}
                onConfirm={() =>
                  transferConfirmMutation.mutate({
                    originAccountId: transferOriginAccountId,
                    destinationAccountId: transferDestinationAccountId,
                  })
                }
              />
            ) : null}

            {showScenario2Summary && detail.transfer ? (
              <TransferScenario2Summary
                detail={detail}
                transfer={detail.transfer}
                isPending={isPending}
                onConfirm={(input) => quickSideConfirmMutation.mutate(input)}
                onEdit={() => setManualFallbackOpen(true)}
                onDiscard={() => setDiscardOpen(true)}
              />
            ) : null}

            {showScenario3Summary ? (
              <TransferScenario3Summary
                isPending={isPending}
                onDiscard={() => setDiscardOpen(true)}
                onRegisterManually={() => setManualFallbackOpen(true)}
              />
            ) : null}

            {showFullForm && !isReferenceLoading ? (
              <YStack gap="$5">
                {detail.transfer ? (
                  <Paragraph color="$color10" fontSize="$1">
                    {t("movementUx.transferManualFallbackHint")}
                  </Paragraph>
                ) : null}
                <MovementTypeSelector
                  value={type}
                  onValueChange={(value) => {
                    setType(value);
                    setCategory("");
                    setPaymentOccurrenceId(NORMAL_MOVEMENT);
                    validation.clearError("categoryId");
                    setErrorMessage(null);
                  }}
                />

                <YStack gap="$1" px="$1">
                  <Paragraph color="$color10" fontSize="$1" fontWeight="600">
                    {t("forms.title")}
                  </Paragraph>
                  <Paragraph
                    color="$color12"
                    fontFamily="$heading"
                    fontSize="$5"
                    fontWeight="800"
                    lineHeight="$6"
                  >
                    {detail.title}
                  </Paragraph>
                </YStack>

                <MovementAmountField
                  currency={selectedAccount?.currency ?? detail.currency ?? "PEN"}
                  error={validation.errors.amount}
                  value={amount}
                  onChangeText={(value) => {
                    setAmount(value);
                    validation.clearError("amount");
                  }}
                />

                <YStack gap="$4">
                  <FintFormField
                    label={t("forms.account")}
                    required
                    error={validation.errors.accountId}
                    showLabel={false}
                  >
                    <FintSheetSelect
                      label={t("forms.account")}
                      showLabel={false}
                      placeholder={
                        accounts.length
                          ? t("movements.selectAccount")
                          : t("debts.noPaymentAccounts")
                      }
                      value={accountId}
                      onValueChange={(value) => {
                        setAccountId(value);
                        validation.clearError("accountId");
                      }}
                      options={accounts.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.currency}`,
                      }))}
                      renderTrigger={({ onPress, selectedLabel }) => (
                        <MovementPickerTrigger
                          icon={<WalletCards size={21} color="$primary" />}
                          invalid={Boolean(validation.errors.accountId)}
                          label={t("forms.account")}
                          required
                          onPress={onPress}
                          value={selectedLabel}
                        />
                      )}
                    />
                  </FintFormField>
                  {type === "expense" && paymentOccurrences.length ? (
                    <FintFormField
                      label={t("movementUx.applyToPayment")}
                      showLabel={false}
                    >
                      <FintSheetSelect
                        label={t("movementUx.applyToPayment")}
                        showLabel={false}
                        placeholder={t("movementUx.normalMovement")}
                        value={paymentOccurrenceId}
                        onValueChange={(value) => {
                          setPaymentOccurrenceId(value);
                          validation.clearError("categoryId");
                        }}
                        options={[
                          {
                            value: NORMAL_MOVEMENT,
                            label: t("movementUx.normalMovement"),
                          },
                          ...paymentOccurrences.map((occurrence) => ({
                            value: occurrence.id,
                            label: `${occurrence.title} · ${formatMoney(occurrence.remainingAmount ?? 0, occurrence.currency)}`,
                          })),
                        ]}
                        renderTrigger={({ onPress, selectedLabel }) => (
                          <MovementPickerTrigger
                            icon={<CalendarClock size={21} color="$primary" />}
                            label={t("movementUx.applyToPayment")}
                            onPress={onPress}
                            value={selectedLabel}
                          />
                        )}
                      />
                    </FintFormField>
                  ) : null}
                  {paymentOccurrenceId === NORMAL_MOVEMENT ? (
                    <FintFormField
                      label={t("forms.category")}
                      required
                      error={validation.errors.categoryId}
                      showLabel={false}
                    >
                      <CategoryPickerSheet
                        categories={categories}
                        showLabel={false}
                        type={type}
                        value={category}
                        onValueChange={(value) => {
                          setCategory(value);
                          validation.clearError("categoryId");
                        }}
                        renderTrigger={({ onPress, selectedLabel }) => (
                          <MovementPickerTrigger
                            icon={<Shapes size={21} color="$primary" />}
                            invalid={Boolean(validation.errors.categoryId)}
                            label={t("forms.category")}
                            required
                            onPress={onPress}
                            value={selectedLabel}
                          />
                        )}
                      />
                    </FintFormField>
                  ) : (
                    <Paragraph color="$color10" fontSize="$1">
                      {t("movementUx.paymentAppliedHint")}
                    </Paragraph>
                  )}
                </YStack>

                <FintFormField
                  label={t("movements.date")}
                  required
                  error={validation.errors.transactionDate}
                  showLabel={false}
                >
                  <FintDateField
                    label={t("movements.date")}
                    showLabel={false}
                    placeholder={t("movements.selectDate")}
                    value={transactionDate}
                    onValueChange={(value) => {
                      setTransactionDate(value);
                      validation.clearError("transactionDate");
                    }}
                    renderTrigger={({ onPress, selectedLabel }) => (
                      <MovementPickerTrigger
                        icon={<CalendarDays size={21} color="$primary" />}
                        invalid={Boolean(validation.errors.transactionDate)}
                        label={t("movements.date")}
                        required
                        onPress={onPress}
                        value={selectedLabel}
                      />
                    )}
                  />
                </FintFormField>
                <MovementNoteField
                  label={t("movementUx.noteOptional")}
                  placeholder={t("movementUx.notePlaceholder")}
                  value={note}
                  onChangeText={setNote}
                />

                {accountsQuery.error || categoriesQuery.error ? (
                  <Paragraph color="$red10">
                    {t("movements.referencesError")}
                  </Paragraph>
                ) : null}

                <YStack gap="$2">
                  <FintButton
                    width="100%"
                    minH={52}
                    disabled={isPending || isReferenceLoading}
                    icon={
                      confirmMutation.isPending ? (
                        <FintSpinner color="$primaryForeground" />
                      ) : (
                        <Save size={18} />
                      )
                    }
                    onPress={submit}
                  >
                    {confirmMutation.isPending
                      ? t("movements.creating")
                      : t("movementUx.confirmPending")}
                  </FintButton>
                  {detail.transfer && (scenario === 2 || scenario === 3) ? (
                    <FintButton
                      width="100%"
                      minH={44}
                      variant="outlined"
                      disabled={isPending}
                      onPress={() => setManualFallbackOpen(false)}
                    >
                      {t("actions.cancel")}
                    </FintButton>
                  ) : null}
                  <FintButton
                    width="100%"
                    minH={48}
                    variant="outlined"
                    color="$red10"
                    borderColor="$red6"
                    disabled={isPending || !pendingId}
                    icon={<Trash2 size={16} />}
                    onPress={() => setDiscardOpen(true)}
                  >
                    {t("movementUx.discardPending")}
                  </FintButton>
                </YStack>
              </YStack>
            ) : null}
          </YStack>
        ) : null}
      </Screen>
      <DiscardPendingDialog
        isPending={discardMutation.isPending}
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => discardMutation.mutate()}
      />
    </>
  );
}

function TransferScenario1Summary({
  detail,
  destination,
  isPending,
  onConfirm,
  onDiscard,
  onEdit,
  origin,
}: {
  detail: PendingMovementDetail;
  destination: { accountId: string; accountName: string };
  isPending: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
  onEdit: () => void;
  origin: { accountId: string; accountName: string };
}) {
  const { t, i18n } = useTranslation();
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${detail.transactionDate}T00:00:00`));
  return (
    <FintCard bg="$accent1" borderColor="$accent4" gap="$4" p="$4">
      <XStack items="center" gap="$3">
        <YStack
          width={44}
          height={44}
          rounded="$10"
          bg="$accent3"
          items="center"
          justify="center"
        >
          <ArrowLeftRight size={20} color="$primary" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$4"
            fontWeight="800"
          >
            {t("movementUx.transferCardTitle", {
              origin: origin.accountName,
              destination: destination.accountName,
            })}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$2">
            {formatMoney(detail.amount ?? 0, detail.currency ?? "PEN")} ·{" "}
            {dateLabel}
          </Paragraph>
        </YStack>
      </XStack>

      <YStack gap="$2">
        <FintButton
          width="100%"
          minH={52}
          disabled={isPending}
          icon={
            isPending ? (
              <FintSpinner color="$primaryForeground" />
            ) : (
              <Check size={18} />
            )
          }
          onPress={onConfirm}
        >
          {t("movementUx.confirmPending")}
        </FintButton>
        <XStack justify="center" gap="$4">
          <Button
            chromeless
            size="$2"
            disabled={isPending}
            onPress={onEdit}
            aria-label={t("actions.edit")}
          >
            <Paragraph color="$color10" fontSize="$2" fontWeight="700">
              {t("actions.edit")}
            </Paragraph>
          </Button>
          <Button
            chromeless
            size="$2"
            disabled={isPending}
            onPress={onDiscard}
            aria-label={t("movementUx.discardShort")}
          >
            <Paragraph color="$red10" fontSize="$2" fontWeight="700">
              {t("movementUx.discardShort")}
            </Paragraph>
          </Button>
        </XStack>
      </YStack>
    </FintCard>
  );
}

function TransferScenario1Editor({
  accounts,
  destinationAccountId,
  isPending,
  onCancel,
  onConfirm,
  onDestinationChange,
  onOriginChange,
  originAccountId,
}: {
  accounts: AccountOption[];
  destinationAccountId: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onDestinationChange: (value: string) => void;
  onOriginChange: (value: string) => void;
  originAccountId: string;
}) {
  const { t } = useTranslation();
  const canConfirm =
    Boolean(originAccountId) &&
    Boolean(destinationAccountId) &&
    originAccountId !== destinationAccountId;
  return (
    <FintCard gap="$4" p="$4">
      <Paragraph color="$color10" fontSize="$2">
        {t("movementUx.transferEditHint")}
      </Paragraph>
      <FintFormField label={t("movementUx.transferPickOrigin")} required showLabel={false}>
        <FintSheetSelect
          label={t("movementUx.transferPickOrigin")}
          showLabel={false}
          placeholder={t("movements.selectAccount")}
          value={originAccountId}
          onValueChange={onOriginChange}
          options={accounts
            .filter((account) => account.id !== destinationAccountId)
            .map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))}
          renderTrigger={({ onPress, selectedLabel }) => (
            <MovementPickerTrigger
              icon={<WalletCards size={21} color="$primary" />}
              label={t("movementUx.transferPickOrigin")}
              required
              onPress={onPress}
              value={selectedLabel}
            />
          )}
        />
      </FintFormField>
      <FintFormField label={t("movementUx.transferPickDestination")} required showLabel={false}>
        <FintSheetSelect
          label={t("movementUx.transferPickDestination")}
          showLabel={false}
          placeholder={t("movements.selectAccount")}
          value={destinationAccountId}
          onValueChange={onDestinationChange}
          options={accounts
            .filter((account) => account.id !== originAccountId)
            .map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))}
          renderTrigger={({ onPress, selectedLabel }) => (
            <MovementPickerTrigger
              icon={<WalletCards size={21} color="$primary" />}
              label={t("movementUx.transferPickDestination")}
              required
              onPress={onPress}
              value={selectedLabel}
            />
          )}
        />
      </FintFormField>
      <YStack gap="$2">
        <FintButton
          width="100%"
          minH={50}
          disabled={isPending || !canConfirm}
          icon={
            isPending ? <FintSpinner color="$primaryForeground" /> : <Check size={18} />
          }
          onPress={onConfirm}
        >
          {t("movementUx.transferConfirmAction")}
        </FintButton>
        <FintButton
          width="100%"
          minH={44}
          variant="outlined"
          disabled={isPending}
          onPress={onCancel}
        >
          {t("actions.cancel")}
        </FintButton>
      </YStack>
    </FintCard>
  );
}

function TransferScenario2Summary({
  detail,
  isPending,
  onConfirm,
  onDiscard,
  onEdit,
  transfer,
}: {
  detail: PendingMovementDetail;
  isPending: boolean;
  onConfirm: (input: {
    accountId: string;
    side: "origin" | "destination";
    title: string;
  }) => void;
  onDiscard: () => void;
  onEdit: () => void;
  transfer: NonNullable<PendingMovementDetail["transfer"]>;
}) {
  const { t, i18n } = useTranslation();
  const side: "origin" | "destination" = transfer.originMatch
    ? "origin"
    : "destination";
  const match = transfer.originMatch ?? transfer.destinationMatch;
  if (!match) return null;
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${detail.transactionDate}T00:00:00`));
  const title = t(
    side === "origin" ? "movementUx.transferOutTitle" : "movementUx.transferInTitle",
    { account: match.accountName },
  );
  const note = t(
    side === "origin"
      ? "movementUx.transferNoteToOutside"
      : "movementUx.transferNoteFromOutside",
  );
  return (
    <FintCard bg="$accent1" borderColor="$accent4" gap="$4" p="$4">
      <XStack items="center" gap="$3">
        <YStack
          width={44}
          height={44}
          rounded="$10"
          bg="$accent3"
          items="center"
          justify="center"
        >
          <ArrowLeftRight size={20} color="$primary" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$4"
            fontWeight="800"
          >
            {title}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$2">
            {formatMoney(detail.amount ?? 0, detail.currency ?? "PEN")} ·{" "}
            {dateLabel}
          </Paragraph>
          <Paragraph color="$color9" fontSize="$1">
            {note}
          </Paragraph>
        </YStack>
      </XStack>

      <YStack gap="$2">
        <FintButton
          width="100%"
          minH={52}
          disabled={isPending}
          icon={
            isPending ? (
              <FintSpinner color="$primaryForeground" />
            ) : (
              <Check size={18} />
            )
          }
          onPress={() => onConfirm({ accountId: match.accountId, side, title })}
        >
          {t("movementUx.confirmPending")}
        </FintButton>
        <XStack justify="center" gap="$4">
          <Button
            chromeless
            size="$2"
            disabled={isPending}
            onPress={onEdit}
            aria-label={t("actions.edit")}
          >
            <Paragraph color="$color10" fontSize="$2" fontWeight="700">
              {t("actions.edit")}
            </Paragraph>
          </Button>
          <Button
            chromeless
            size="$2"
            disabled={isPending}
            onPress={onDiscard}
            aria-label={t("movementUx.discardShort")}
          >
            <Paragraph color="$red10" fontSize="$2" fontWeight="700">
              {t("movementUx.discardShort")}
            </Paragraph>
          </Button>
        </XStack>
      </YStack>
    </FintCard>
  );
}

function TransferScenario3Summary({
  isPending,
  onDiscard,
  onRegisterManually,
}: {
  isPending: boolean;
  onDiscard: () => void;
  onRegisterManually: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintCard gap="$4" p="$4">
      <XStack items="center" gap="$3">
        <YStack
          width={44}
          height={44}
          rounded="$10"
          bg="$muted"
          items="center"
          justify="center"
        >
          <ArrowLeftRight size={20} color="$color10" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$4"
            fontWeight="800"
          >
            {t("movementUx.transferUnknownTitle")}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$2">
            {t("movementUx.transferUnknownHint")}
          </Paragraph>
        </YStack>
      </XStack>

      <YStack gap="$2">
        <FintButton
          width="100%"
          minH={50}
          disabled={isPending}
          icon={<Trash2 size={17} />}
          onPress={onDiscard}
        >
          {t("movementUx.discardShort")}
        </FintButton>
        <Button
          chromeless
          size="$3"
          disabled={isPending}
          onPress={onRegisterManually}
          aria-label={t("movementUx.transferRegisterManually")}
        >
          <Paragraph color="$color10" fontSize="$2" fontWeight="700">
            {t("movementUx.transferRegisterManually")}
          </Paragraph>
        </Button>
      </YStack>
    </FintCard>
  );
}

async function invalidatePendingAndFinance(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["summary"] }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["reports"] }),
  ]);
}

function compatibleOccurrences(
  occurrences: PaymentOccurrence[],
  detail: PendingMovementDetail | undefined,
) {
  if (
    !detail ||
    detail.type !== "expense" ||
    detail.amount === null ||
    !detail.currency
  )
    return [];
  return occurrences.filter(
    (occurrence) =>
      occurrence.currency === detail.currency &&
      occurrence.amountStatus === "confirmed" &&
      (occurrence.remainingAmount ?? 0) >= detail.amount!,
  );
}

function DiscardPendingDialog({
  isPending,
  onCancel,
  onConfirm,
  open,
}: {
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={open}
      isPending={isPending}
      title={t("movementUx.discardPendingTitle")}
      description={t("movementUx.discardPendingDescription")}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("movementUx.discardPending")}
      destructive
      icon={<Trash2 size={17} color="$primaryForeground" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
