import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, ChevronDown, Lock, Plus, Trash2, X } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { z } from "zod";
import { CurrencyCode, CurrencySheet, useCurrencyName } from "../src/accounts/CurrencySheet";
import { addKeyword, MAX_KEYWORDS, previewAmount, sameKeywords, selectableTypes } from "../src/accounts/form";
import { accountLines } from "../src/accounts/logic";
import { useCapabilities } from "../src/api/capabilities";
import { ApiRequestError } from "../src/api/client";
import { financeApi } from "../src/api/finance";
import type { AccountType } from "../src/api/types";
import { DataStateCard } from "../src/components/DataStateCard";
import { UnsavedChangesDialog } from "../src/components/UnsavedChangesDialog";
import { getAccountIcon, getAccountTypeLabel } from "../src/finance/accountTypes";
import { getCurrencySymbol } from "../src/finance/currencies";
import { getValidationMessage, parseDecimalInput, sanitizeAmountInput, useSubmitValidation } from "../src/forms";
import { useUnsavedChangesGuard } from "../src/hooks/useUnsavedChangesGuard";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { Amount, FintButton, FintSheet, FintSpinner, FText, IconButton, PressableScale, SheetField, SheetTextInput } from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { haptics } from "../src/ui/haptics";
import { useNotify } from "../src/ui/notify";

type Sheet = "currency" | "second" | "delete" | "disable" | null;
const SHEET_UNMOUNT_MS = 600;
/** Aire entre el campo enfocado y el botón que sube con el teclado. */
const KEYBOARD_GAP = 24;
const TYPES: AccountType[] = ["cash", "checking_account", "savings_account", "credit_card"];

/**
 * Formulario de cuenta v3: cerrar y título; la vista previa en vivo sobre la
 * losa (la misma fila que aparecerá en Cuentas); nombre, tipo en grilla,
 * moneda en una hoja con buscador, saldo inicial y palabras clave de correo; y
 * el botón fijo abajo.
 *
 * Al editar, Efectivo, Corriente y Ahorros se intercambian, pero una tarjeta no
 * cambia de tipo ni otra cuenta se vuelve tarjeta (fila bloqueada); la moneda
 * tampoco se cambia. Una tarjeta muestra "Saldos por moneda": desactivar una
 * moneda es inmediato (con confirmación) y habilitar otra se aplica al guardar.
 * "Eliminar cuenta" va al final, con la misma confirmación que un movimiento.
 */
export default function AccountFormScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const isEditing = Boolean(accountId);
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeMode();
  const { capabilities } = useCapabilities();
  const currencyName = useCurrencyName();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const accountQuery = useQuery({
    queryKey: ["accounts", "detail", accountId],
    queryFn: ({ signal }) => financeApi.getAccount(accountId!, signal),
    enabled: isEditing,
  });
  const account = accountQuery.data;

  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState("PEN");
  const [openingBalance, setOpeningBalance] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  // La otra moneda: al crear una tarjeta, o al habilitarla en una tarjeta que ya existe (se aplica al guardar).
  const [secondCurrency, setSecondCurrency] = useState("");
  const [secondOpening, setSecondOpening] = useState("");
  const [disableTarget, setDisableTarget] = useState<string | null>(null);
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const initialType: AccountType | null = account ? (isAccountType(account.accountType) ? account.accountType : "cash") : null;
  useEffect(() => {
    if (!account || initializedId === account.id) return;
    setName(account.name);
    setAccountType(isAccountType(account.accountType) ? account.accountType : "cash");
    setCurrency(account.currency);
    setKeywords(account.emailMatchKeywords ?? []);
    setInitializedId(account.id);
  }, [account, initializedId]);

  const isDirty =
    !saved &&
    (isEditing
      ? Boolean(account) &&
        (name !== account!.name || accountType !== initialType || !sameKeywords(keywords, account!.emailMatchKeywords ?? []) || secondCurrency !== "")
      : name !== "" || openingBalance !== "" || accountType !== "cash" || currency !== "PEN" || secondCurrency !== "" || keywords.length > 0);
  const guard = useUnsavedChangesGuard(isDirty);

  const validation = useSubmitValidation<"name" | "openingBalance">();
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, "amount");
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(2, getValidationMessage(t, i18n.resolvedLanguage, "minTwo")),
    openingBalance: z.number({ error: amountMessage }).finite(amountMessage),
  });

  const isCard = accountType === "credit_card";
  const types = selectableTypes(isEditing, initialType);
  const lines = isEditing && account ? accountLines(account) : [];
  const activeCurrencies = isEditing ? lines.map((l) => l.currency) : [currency];
  const canAddCurrency = isCard && capabilities.features.accountCurrencyBalances && activeCurrencies.length < 2 && (!isEditing || Boolean(account));

  const invalidateAll = () =>
    Promise.all(
      ["accounts", "account-options", "summary", "transactions", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );

  const leave = () => {
    setSaved(true);
    guard.bypass(() => router.back());
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      const enableSecond = async (id: string) => {
        if (!isCard || !secondCurrency) return false;
        try {
          await financeApi.enableAccountBalance(id, {
            currency: secondCurrency,
            openingBalance: secondOpening.trim() ? parseDecimalInput(secondOpening) : 0,
          });
          return false;
        } catch {
          return true;
        }
      };
      if (accountId) {
        await financeApi.updateAccount(accountId, {
          name: payload.name,
          accountType,
          emailMatchKeywords: keywords,
        });
        return { secondFailed: await enableSecond(accountId) };
      }
      const created = await financeApi.createAccount({
        name: payload.name,
        accountType,
        currency,
        openingBalance: payload.openingBalance,
        emailMatchKeywords: keywords,
      });
      return { secondFailed: await enableSecond(created.id) };
    },
    onSuccess: async ({ secondFailed }) => {
      await invalidateAll();
      toast.show(t(isEditing ? "accounts.updatedToast" : "accounts.createdToast"), {
        message: t(isEditing ? "accounts.updatedMessage" : "accounts.createdMessage"),
        preset: "success",
        duration: 3500,
      });
      if (secondFailed) {
        toast.show(t(isEditing ? "accountForm.balanceFailedToast" : "accounts.secondCurrencyFailedToast"), {
          message: t(isEditing ? "accountForm.balanceFailedMessage" : "accounts.secondCurrencyFailedMessage"),
          preset: "error",
          duration: 4500,
        });
      }
      leave();
    },
    onError: (error) => {
      // Un nombre repetido va debajo del campo; lo demás, en el aviso de abajo.
      if (error instanceof ApiRequestError && error.code === "account_name_exists") validation.setError("name", t("accounts.duplicateName"));
      else setErrorMessage(error instanceof Error ? error.message : t("states.error"));
    },
  });

  const submit = () => {
    setErrorMessage(null);
    const payload = validation.validate(schema, {
      name,
      openingBalance: openingBalance.trim() ? parseDecimalInput(openingBalance) : 0,
    });
    if (payload) saveMutation.mutate(payload);
  };

  const deleteMutation = useMutation({
    mutationFn: () => financeApi.deleteAccount(accountId!),
    onSuccess: async () => {
      setSheet(null);
      await invalidateAll();
      toast.show(t("accounts.deletedToast"), {
        message: t("accounts.deletedMessage"),
        preset: "success",
        duration: 3500,
      });
      leave();
    },
    onError: (error) =>
      toast.show(t("accounts.deleteError"), {
        message: error instanceof Error ? error.message : t("states.error"),
        preset: "error",
        duration: 4500,
      }),
  });

  const disableMutation = useMutation({
    mutationFn: (code: string) => financeApi.disableAccountBalance(accountId!, code),
    onSuccess: async () => {
      setSheet(null);
      await invalidateAll();
      toast.show(t("accounts.balanceDisabledToast"), {
        message: t("accounts.balanceDisabledMessage"),
        preset: "success",
        duration: 3000,
      });
    },
    onError: (error) => {
      setSheet(null);
      toast.show(t("accounts.disableBalanceError"), {
        message: error instanceof Error ? error.message : t("states.error"),
        preset: "error",
        duration: 4500,
      });
    },
  });

  const changeType = (next: AccountType) => {
    if (next === accountType) return;
    haptics.select();
    setAccountType(next);
    // Solo una tarjeta lleva otra moneda.
    if (next !== "credit_card" && !isEditing) {
      setSecondCurrency("");
      setSecondOpening("");
    }
  };

  const isLoading = isEditing && accountQuery.isLoading;
  const notFound = isEditing && !accountQuery.isLoading && !accountQuery.error && !account;
  const ready = !isLoading && !accountQuery.error && !notFound;

  // Vista previa: lo que se escribe al crear; al editar, los saldos de la cuenta.
  const previewLines = isEditing
    ? [
        ...lines,
        ...(secondCurrency
          ? [
              {
                currency: secondCurrency,
                balance: previewAmount(secondOpening),
              },
            ]
          : []),
      ]
    : [
        { currency, balance: previewAmount(openingBalance) },
        ...(isCard && secondCurrency
          ? [
              {
                currency: secondCurrency,
                balance: previewAmount(secondOpening),
              },
            ]
          : []),
      ];

  return (
    <>
      <UnsavedChangesDialog open={guard.open} onCancel={guard.onCancel} onConfirm={guard.onConfirm} />
      <YStack flex={1} bg="$canvas" pt={insets.top}>
        {/* Cerrar y título. */}
        <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]}>
          <IconButton label={t("accountForm.close")} icon={<X size={18} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText
            variant="title"
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 20,
              lineHeight: 25,
              letterSpacing: -0.4,
            }}
          >
            {t(isEditing ? "accountForm.editTitle" : "accountForm.newTitle")}
          </FText>
          <View width={40} />
        </XStack>

        {/* El campo enfocado sube por encima del teclado y del botón, que sube con él. */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          bottomOffset={footerHeight + KEYBOARD_GAP}
          contentContainerStyle={{
            paddingHorizontal: space[4],
            paddingBottom: space[6],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? <FormSkeleton /> : null}
          {accountQuery.error ? (
            <View mt={space[5]}>
              <DataStateCard message={t("states.error")} onRetry={() => void accountQuery.refetch()} />
            </View>
          ) : null}
          {notFound ? (
            <View mt={space[5]}>
              <DataStateCard message={t("states.accountNotFound")} />
            </View>
          ) : null}

          {ready ? (
            <>
              <AccountPreview
                name={name.trim()}
                placeholder={t("accountForm.previewName")}
                type={accountType}
                typeLabel={getAccountTypeLabel(accountType, t)}
                lines={previewLines}
                sensitive={isEditing}
              />

              {/* Nombre */}
              <Field label={t("accountForm.name")} error={validation.errors.name}>
                <FocusField>
                  {(focus) => (
                    <SheetTextInput
                      {...focus}
                      value={name}
                      onChangeText={(value) => {
                        setName(value);
                        validation.clearError("name");
                      }}
                      placeholder={t("accountForm.namePlaceholder")}
                      autoCapitalize="words"
                      returnKeyType="done"
                      accessibilityLabel={t("accountForm.name")}
                    />
                  )}
                </FocusField>
              </Field>

              {/* Tipo: grilla de dos; una tarjeta en edición, fila bloqueada. */}
              <Field label={t("accountForm.type")} hint={isEditing && types.length > 0 ? t("accountForm.cardLockedHint") : undefined}>
                {types.length === 0 ? (
                  <LockedRow icon={getAccountIcon(accountType)} label={getAccountTypeLabel(accountType, t)} lockedLabel={t("accountForm.locked")} />
                ) : (
                  <YStack gap={8} accessibilityRole="radiogroup">
                    {[TYPES.slice(0, 2), TYPES.slice(2)].map((row) => (
                      <XStack key={row.join()} gap={8}>
                        {row.map((type) => (
                          <TypeTile
                            key={type}
                            type={type}
                            label={t(`accountForm.types.${type}`)}
                            selected={accountType === type}
                            disabled={!types.includes(type)}
                            onPress={() => changeType(type)}
                          />
                        ))}
                      </XStack>
                    ))}
                  </YStack>
                )}
              </Field>

              {/* Moneda: al crear, una fila que abre la hoja; al editar, no se cambia. Una tarjeta la muestra en sus saldos. */}
              {!isEditing ? (
                <Field label={t("accountForm.currency")}>
                  <PressableScale
                    onPress={() => setSheet("currency")}
                    scaleTo={0.99}
                    accessibilityRole="button"
                    accessibilityLabel={`${t("accountForm.currency")}: ${currencyName(currency)}`}
                  >
                    <SheetField>
                      <FText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                        {currencyName(currency)}
                      </FText>
                      <XStack items="center" gap={4}>
                        <FText
                          variant="caption"
                          tone="inkFaint"
                          style={{
                            fontFamily: fontFace.mono[500],
                            fontSize: 13,
                          }}
                        >
                          {currency}
                        </FText>
                        <ChevronDown size={16} color="$inkFaint" strokeWidth={2} />
                      </XStack>
                    </SheetField>
                  </PressableScale>
                </Field>
              ) : !isCard ? (
                <Field label={t("accountForm.currency")}>
                  <LockedRow label={currencyName(currency)} code={currency} lockedLabel={t("accountForm.locked")} />
                </Field>
              ) : null}

              {/* Saldo inicial, solo al crear. */}
              {!isEditing ? (
                <Field label={t("accountForm.openingBalance")} hint={t("accountForm.openingBalanceHint")} error={validation.errors.openingBalance}>
                  <MoneyField
                    currency={currency}
                    value={openingBalance}
                    onChange={(value) => {
                      setOpeningBalance(value);
                      validation.clearError("openingBalance");
                    }}
                    label={t("accountForm.openingBalance")}
                  />
                </Field>
              ) : null}

              {/* Otra moneda al crear una tarjeta. */}
              {!isEditing && isCard && capabilities.features.accountCurrencyBalances ? (
                secondCurrency ? (
                  <Field label={t("accountForm.secondCurrency")}>
                    <YStack gap={8}>
                      <SheetField>
                        <CurrencyCode code={secondCurrency} />
                        <FText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                          {currencyName(secondCurrency)}
                        </FText>
                        <IconButton
                          label={t("accountForm.removeSecondCurrency", {
                            currency: secondCurrency,
                          })}
                          tone="sunken"
                          size={34}
                          icon={<X size={16} color="$inkMuted" strokeWidth={2.2} />}
                          onPress={() => {
                            setSecondCurrency("");
                            setSecondOpening("");
                          }}
                        />
                      </SheetField>
                      <MoneyField
                        currency={secondCurrency}
                        value={secondOpening}
                        onChange={setSecondOpening}
                        label={t("accountForm.openingBalance")}
                      />
                    </YStack>
                  </Field>
                ) : (
                  <AddLink label={t("accountForm.addSecondCurrency")} onPress={() => setSheet("second")} />
                )
              ) : null}

              {/* Saldos por moneda de una tarjeta que ya existe. */}
              {isEditing && isCard && account ? (
                <YStack>
                  <FText
                    variant="caption"
                    tone="inkMuted"
                    style={{
                      fontFamily: fontFace.sans[600],
                      marginTop: 22,
                      marginBottom: 8,
                      marginLeft: 2,
                    }}
                  >
                    {t("accountForm.balances")}
                  </FText>
                  <YStack rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
                    {lines.map((line, i) => {
                      const primary = line.currency === account.currency;
                      return (
                        <XStack key={line.currency} items="center" gap={12} px={14} py={13} borderTopWidth={i ? 1 : 0} borderColor="$line">
                          <CurrencyCode code={line.currency} />
                          <XStack flex={1} minW={0} items="center" gap={6}>
                            <FText variant="body-strong" numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
                              {currencyName(line.currency)}
                            </FText>
                            {primary ? (
                              <View height={20} px={7} rounded={radius.pill} bg="$brandWash" items="center" justify="center">
                                <FText
                                  variant="caption"
                                  tone="brand"
                                  style={{
                                    fontSize: 11,
                                    fontFamily: fontFace.sans[600],
                                  }}
                                >
                                  {t("accountForm.primary")}
                                </FText>
                              </View>
                            ) : null}
                          </XStack>
                          <YStack items="flex-end">
                            <Amount value={line.balance} currency={line.currency} />
                            {!primary ? (
                              <Pressable
                                onPress={() => {
                                  setDisableTarget(line.currency);
                                  setSheet("disable");
                                }}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={t("accounts.disableBalanceAccessibility", { currency: line.currency })}
                              >
                                <FText
                                  variant="caption"
                                  tone="inkMuted"
                                  style={{
                                    fontFamily: fontFace.sans[600],
                                    marginTop: 2,
                                  }}
                                >
                                  {t("accountForm.disable")}
                                </FText>
                              </Pressable>
                            ) : null}
                          </YStack>
                        </XStack>
                      );
                    })}
                    {secondCurrency ? (
                      <YStack px={14} py={13} gap={10} borderTopWidth={1} borderColor="$line">
                        <XStack items="center" gap={12}>
                          <CurrencyCode code={secondCurrency} />
                          <YStack flex={1} minW={0}>
                            <FText variant="body-strong" numberOfLines={1} style={{ fontSize: 14 }}>
                              {currencyName(secondCurrency)}
                            </FText>
                            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                              {t("accountForm.pendingBalance")}
                            </FText>
                          </YStack>
                          <IconButton
                            label={t("accountForm.removeSecondCurrency", {
                              currency: secondCurrency,
                            })}
                            tone="sunken"
                            size={34}
                            icon={<X size={16} color="$inkMuted" strokeWidth={2.2} />}
                            onPress={() => {
                              setSecondCurrency("");
                              setSecondOpening("");
                            }}
                          />
                        </XStack>
                        <MoneyField
                          currency={secondCurrency}
                          value={secondOpening}
                          onChange={setSecondOpening}
                          label={t("accountForm.openingBalance")}
                        />
                      </YStack>
                    ) : canAddCurrency ? (
                      <PressableScale onPress={() => setSheet("second")} scaleTo={0.99} accessibilityRole="button">
                        <XStack height={44} items="center" justify="center" gap={8} borderTopWidth={1} borderColor="$line">
                          <Plus size={16} color="$brand" strokeWidth={2.2} />
                          <FText variant="body-strong" tone="brand" style={{ fontSize: 14 }}>
                            {t("accountForm.enableBalance")}
                          </FText>
                        </XStack>
                      </PressableScale>
                    ) : null}
                  </YStack>
                  <Hint>
                    {!capabilities.features.accountCurrencyBalances && lines.length < 2
                      ? t("accounts.balancesDisabledHint")
                      : lines.length >= 2
                        ? t("accounts.balancesMaxReachedHint")
                        : t("accountForm.balancesHint")}
                  </Hint>
                </YStack>
              ) : null}

              {/* Palabras clave de correo. */}
              <Field
                label={t("accountForm.keywords")}
                hint={keywords.length >= MAX_KEYWORDS ? t("accountForm.keywordsFull") : t("accountForm.keywordsHint")}
              >
                <KeywordsField value={keywords} onChange={setKeywords} />
              </Field>

              {errorMessage ? (
                <View mt={18} p={space[3]} rounded={radius.md} bg="$red2">
                  <FText variant="body" tone="dangerHard" style={{ fontSize: 14 }}>
                    {errorMessage}
                  </FText>
                </View>
              ) : null}

              {isEditing ? (
                <PressableScale onPress={() => setSheet("delete")} accessibilityRole="button" style={{ alignSelf: "center", marginTop: 26 }}>
                  <XStack items="center" gap={8} py={6} px={10}>
                    <Trash2 size={16} color="$dangerHard" strokeWidth={2} />
                    <FText variant="body-strong" tone="dangerHard" style={{ fontSize: 14 }}>
                      {t("accountForm.delete")}
                    </FText>
                  </XStack>
                </PressableScale>
              ) : null}
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
                disabled={saveMutation.isPending}
                icon={saveMutation.isPending ? <FintSpinner color="$onBrand" /> : undefined}
                onPress={submit}
              >
                {saveMutation.isPending
                  ? t(isEditing ? "accounts.updating" : "accounts.creating")
                  : t(isEditing ? "accounts.update" : "accounts.create")}
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
          onSelect={(code) => {
            setCurrency(code);
            if (code === secondCurrency) {
              setSecondCurrency("");
              setSecondOpening("");
            }
          }}
        />
      ) : null}
      {mountedSheet === "second" ? (
        <CurrencySheet
          open={sheet === "second"}
          onClose={() => setSheet(null)}
          title={t(isEditing ? "accountForm.enableBalance" : "accountForm.secondCurrency")}
          value={secondCurrency}
          exclude={activeCurrencies}
          onSelect={setSecondCurrency}
        />
      ) : null}
      {mountedSheet === "delete" && account ? (
        <ConfirmSheet
          open={sheet === "delete"}
          onClose={() => setSheet(null)}
          title={t("accounts.deleteTitle")}
          description={t("accounts.deleteDescription", { name: account.name })}
          confirmLabel={deleteMutation.isPending ? t("accounts.deleting") : t("accounts.deleteConfirm")}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
        />
      ) : null}
      {mountedSheet === "disable" && disableTarget ? (
        <ConfirmSheet
          open={sheet === "disable"}
          onClose={() => setSheet(null)}
          title={t("accounts.disableBalanceTitle")}
          description={t("accounts.disableBalanceDescription", {
            currency: disableTarget,
          })}
          confirmLabel={disableMutation.isPending ? t("accounts.disablingBalance") : t("accounts.disableBalanceConfirm")}
          pending={disableMutation.isPending}
          onConfirm={() => disableMutation.mutate(disableTarget)}
        />
      ) : null}
    </>
  );
}

function isAccountType(value?: string): value is AccountType {
  return value === "cash" || value === "credit_card" || value === "checking_account" || value === "savings_account";
}

/**
 * La vista previa en vivo: la fila que aparecerá en Cuentas sobre la losa, con
 * un resplandor `heroGlow` arriba a la derecha. Cambia mientras se escribe.
 */
function AccountPreview({
  name,
  placeholder,
  type,
  typeLabel,
  lines,
  sensitive,
}: {
  name: string;
  placeholder: string;
  type: AccountType;
  typeLabel: string;
  lines: { currency: string; balance: number }[];
  sensitive: boolean;
}) {
  const theme = useTheme();
  return (
    <XStack mt={18} px={16} py={14} gap={12} items="center" rounded={radius.lg} bg="$slab" overflow="hidden">
      <Canvas
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          right: -70,
          top: -120,
        }}
        pointerEvents="none"
      >
        <Circle c={vec(110, 110)} r={110}>
          <RadialGradient c={vec(110, 110)} r={110} colors={[theme.heroGlow.val, "rgba(0,0,0,0)"]} />
        </Circle>
      </Canvas>
      <View width={38} height={38} rounded={999} bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine" items="center" justify="center">
        {type === "cash" ? (
          <Banknote size={18} color="$slabInk" strokeWidth={1.9} />
        ) : (
          <FText tone="slabInk" style={{ fontFamily: fontFace.display[600], fontSize: 15 }}>
            {name.charAt(0).toUpperCase() || "·"}
          </FText>
        )}
      </View>
      <YStack flex={1} minW={0}>
        <FText variant="body-strong" tone={name ? "slabInk" : "slabMuted"} numberOfLines={1}>
          {name || placeholder}
        </FText>
        <FText variant="caption" tone="slabMuted" numberOfLines={1}>
          {typeLabel}
        </FText>
      </YStack>
      <YStack items="flex-end" shrink={0}>
        {lines.map((line) => (
          <Amount
            key={line.currency}
            value={line.balance}
            currency={line.currency}
            onSlab
            sensitive={sensitive}
            style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.4 }}
          />
        ))}
      </YStack>
    </XStack>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <YStack mt={18}>
      <FText variant="caption" tone="inkMuted" style={{ marginBottom: 6, marginLeft: 2 }}>
        {label}
      </FText>
      {children}
      {error ? (
        <FText
          variant="caption"
          tone="dangerHard"
          style={{
            fontFamily: fontFace.sans[600],
            marginTop: 6,
            marginLeft: 2,
          }}
        >
          {error}
        </FText>
      ) : null}
      {hint ? <Hint>{hint}</Hint> : null}
    </YStack>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <FText variant="caption" tone="inkFaint" style={{ lineHeight: 17, marginTop: 6, marginHorizontal: 2 }}>
      {children}
    </FText>
  );
}

/** Campo hundido que pasa a `surface` con borde `brand` mientras tiene el foco. */
function FocusField({ leading, children }: { leading?: ReactNode; children: (focus: { onFocus: () => void; onBlur: () => void }) => ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <SheetField focused={focused}>
      {leading}
      {children({
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      })}
    </SheetField>
  );
}

/** Monto con el símbolo de la moneda y las cifras en `mono`. */
function MoneyField({ currency, value, onChange, label }: { currency: string; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <FocusField
      leading={
        <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 15 }}>
          {getCurrencySymbol(currency)}
        </FText>
      }
    >
      {(focus) => (
        <SheetTextInput
          {...focus}
          value={value}
          onChangeText={(next) => onChange(sanitizeAmountInput(next))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          accessibilityLabel={`${label} (${currency})`}
          style={{
            fontFamily: fontFace.mono[500],
            fontSize: 16,
            fontVariant: ["tabular-nums"],
          }}
        />
      )}
    </FocusField>
  );
}

/** Fila que no se cambia: el valor y, a la derecha, el candado con "No se cambia". */
function LockedRow({ icon: Icon, label, code, lockedLabel }: { icon?: typeof Banknote; label: string; code?: string; lockedLabel: string }) {
  return (
    <SheetField>
      {Icon ? <Icon size={18} color="$inkMuted" strokeWidth={1.8} /> : null}
      <FText variant="body" numberOfLines={1} style={{ flex: 1 }}>
        {label}
        {code ? (
          <FText variant="body" tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 13 }}>
            {`  ${code}`}
          </FText>
        ) : null}
      </FText>
      <XStack items="center" gap={4}>
        <Lock size={14} color="$inkFaint" strokeWidth={2} />
        <FText variant="caption" tone="inkFaint" style={{ fontSize: 13 }}>
          {lockedLabel}
        </FText>
      </XStack>
    </SheetField>
  );
}

/** Una opción de tipo: icono y nombre. La elegida, en `brandWash` con borde `brand`. */
function TypeTile({
  type,
  label,
  selected,
  disabled,
  onPress,
}: {
  type: AccountType;
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const Icon = disabled ? Lock : getAccountIcon(type);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="none"
      style={{ flex: 1 }}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
    >
      <XStack
        height={52}
        items="center"
        gap={10}
        px={selected ? 11 : 12}
        rounded={radius.md}
        borderWidth={selected ? 2 : 1}
        borderColor={selected ? "$brand" : "$line"}
        bg={selected ? "$brandWash" : "$surface"}
        opacity={disabled ? 0.45 : 1}
      >
        <Icon size={18} color={selected ? "$brand" : "$inkMuted"} strokeWidth={1.8} />
        <FText
          variant="body"
          style={{
            fontSize: 14,
            fontFamily: fontFace.sans[selected ? 600 : 500],
          }}
          numberOfLines={1}
        >
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}

function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={{ alignSelf: "flex-start", marginTop: 14 }}>
      <XStack items="center" gap={6} py={6} px={2}>
        <Plus size={16} color="$brand" strokeWidth={2.2} />
        <FText variant="body-strong" tone="brand" style={{ fontSize: 14 }}>
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}

/**
 * Las palabras clave como chips con su botón para quitar y un campo "Agregar"
 * al final. Enter o una coma la agregan; hasta cinco.
 */
function KeywordsField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const full = value.length >= MAX_KEYWORDS;

  const commit = (text = draft) => {
    const next = addKeyword(value, text);
    if (next.length !== value.length) {
      haptics.select();
      onChange(next);
    }
    setDraft("");
  };

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <XStack
        flexWrap="wrap"
        gap={6}
        p={8}
        minH={48}
        items="center"
        rounded={radius.md}
        bg={focused ? "$surface" : "$surfaceSunken"}
        borderWidth={focused ? 1.5 : 1}
        borderColor={focused ? "$brand" : themeMode === "dark" ? "$line" : "$surfaceSunken"}
      >
        {value.map((keyword) => (
          <XStack
            key={keyword}
            height={30}
            pl={12}
            pr={4}
            gap={2}
            items="center"
            rounded={radius.pill}
            bg="$surface"
            borderWidth={1}
            borderColor="$line"
          >
            <FText variant="caption" style={{ fontSize: 13, fontFamily: fontFace.sans[500] }}>
              {keyword}
            </FText>
            <Pressable
              onPress={() => onChange(value.filter((k) => k !== keyword))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("accounts.emailKeywordsRemoveAccessibility", { keyword })}
              style={{ padding: 4 }}
            >
              <X size={12} color="$inkFaint" strokeWidth={2.4} />
            </Pressable>
          </XStack>
        ))}
        {!full ? (
          <TextInput
            ref={input}
            value={draft}
            onChangeText={(text) => {
              if (text.endsWith(",")) commit(text.slice(0, -1));
              else setDraft(text);
            }}
            onSubmitEditing={() => commit()}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit();
            }}
            submitBehavior="submit"
            returnKeyType="done"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={60}
            placeholder={t("accountForm.keywordsAdd")}
            placeholderTextColor={theme.inkFaint.val}
            selectionColor={theme.brand.val}
            accessibilityLabel={t("accountForm.keywords")}
            style={[
              textStyles.body,
              {
                flexGrow: 1,
                minWidth: 90,
                fontSize: 14,
                color: theme.ink.val,
                paddingVertical: 4,
                paddingHorizontal: 6,
              },
            ]}
          />
        ) : null}
      </XStack>
    </Pressable>
  );
}

/** Confirmación destructiva en hoja, la misma que al eliminar un movimiento. */
function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintSheet open={open} onClose={onClose}>
      <YStack items="center" px={space[5]} pt={space[4]}>
        <View width={56} height={56} rounded={999} bg="$red2" items="center" justify="center">
          <Trash2 size={24} color="$dangerHard" strokeWidth={2} />
        </View>
        <FText
          variant="title"
          style={{
            fontSize: 22,
            lineHeight: 28,
            marginTop: 14,
            textAlign: "center",
          }}
        >
          {title}
        </FText>
        <FText
          variant="body"
          tone="inkMuted"
          style={{
            fontSize: 14,
            lineHeight: 21,
            marginTop: 6,
            textAlign: "center",
          }}
        >
          {description}
        </FText>
        <YStack self="stretch" gap={10} mt={22}>
          <FintButton variant="danger" haptic="warning" disabled={pending} onPress={onConfirm}>
            {confirmLabel}
          </FintButton>
          <FintButton variant="ghost" bg="$surfaceSunken" color="$ink" onPress={onClose}>
            {t("actions.cancel")}
          </FintButton>
        </YStack>
      </YStack>
    </FintSheet>
  );
}

function FormSkeleton() {
  return (
    <YStack gap={18} mt={18}>
      <View height={66} rounded={radius.lg} bg="$surfaceSunken" />
      {[0, 1, 2].map((i) => (
        <YStack key={i} gap={8}>
          <AmountSkeleton width={70} height={10} />
          <View height={48} rounded={radius.md} bg="$surfaceSunken" />
        </YStack>
      ))}
    </YStack>
  );
}
