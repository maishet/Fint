import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppState, Image, Linking, Share } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Download,
  FileText,
  Globe2,
  Github,
  HelpCircle,
  Languages,
  Landmark,
  LogOut,
  Mail,
  MonitorSmartphone,
  Moon,
  Bell,
  Clock,
  AlarmClock,
  Eye,
  EyeOff,
  ImageUp,
  ShieldCheck,
  Share2,
  Sun,
  Tags,
  Trash2,
  Upload,
  UserRound,
} from "@tamagui/lucide-icons-2";
import {
  Button,
  Dialog,
  Input,
  Paragraph,
  Separator,
  XStack,
  YStack,
} from "tamagui";
import { financeApi } from "../src/api/finance";
import { useCapabilities } from "../src/api/capabilities";
import { useAuth } from "../src/auth/AuthProvider";
import { resolveDisplayName } from "../src/auth/displayName";
import { Screen } from "../src/components/Screen";
import { changeAppLanguage, getAppLocale, type AppLanguage } from "../src/i18n";
import { getSupportDiagnostics } from "../src/support/diagnostics";
import { useThemeMode } from "../src/theme/ThemeMode";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintSheetSelect,
  FintSpinner,
  FintSwitchRow,
  FintTimeField,
  useNotify,
} from "../src/ui";
import { exportBackupXlsx } from "../src/finance/backup-export";
import {
  getPushPermissionState,
  registerPushInstallation,
  requestAndRegisterPushInstallation,
  unregisterPushInstallation,
  type PushPermissionState,
} from "../src/notifications/pushNotifications";
import { useSensitiveAmounts } from "../src/privacy/SensitiveAmountsProvider";
import { useDailyReminders } from "../src/notifications/DailyRemindersProvider";

export default function SettingsScreen() {
  const { i18n, t } = useTranslation();
  const language = (
    i18n.resolvedLanguage === "en" || i18n.resolvedLanguage === "pt"
      ? i18n.resolvedLanguage
      : "es"
  ) as AppLanguage;
  const { session, signOut } = useAuth();
  const notify = useNotify();
  const { themeMode, themePreference, setThemePreference } = useThemeMode();
  const { amountsVisible, toggleAmountsVisibility } = useSensitiveAmounts();
  const {
    enabled: dailyRemindersEnabled,
    setEnabled: setDailyRemindersEnabled,
    hour: reminderHour,
    minute: reminderMinute,
    setReminderTime,
  } = useDailyReminders();
  const router = useRouter();
  const { capabilities } = useCapabilities();
  const diagnostics = getSupportDiagnostics();
  const [pushState, setPushState] =
    useState<PushPermissionState>("undetermined");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const metadata = session?.user.user_metadata ?? {};
  const displayName = resolveDisplayName(session) ?? "My Fint";
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const shareApp = () => {
    void Share.share({ message: t("settings.shareMessage"), url: "https://myfint.app" });
  };
  useEffect(() => {
    getPushPermissionState()
      .then(setPushState)
      .catch(() => setPushState("unsupported"));
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        getPushPermissionState()
          .then(setPushState)
          .catch(() => setPushState("unsupported"));
    });
    return () => subscription.remove();
  }, []);
  const handleNotificationsToggle = async (next: boolean) => {
    if (!next) {
      setPushState("undetermined");
      if (dailyRemindersEnabled) setDailyRemindersEnabled(false);
      try {
        await unregisterPushInstallation();
      } catch {
      }
      return;
    }
    if (pushState === "denied") {
      await Linking.openSettings();
      return;
    }
    try {
      const nextState = await requestAndRegisterPushInstallation();
      setPushState(nextState);
      if (nextState !== "granted")
        notify.error(t("settings.notifications"), {
          message: t("settings.notificationsError"),
        });
    } catch (error) {
      setPushState("undetermined");
      notify.error(t("settings.notifications"), {
        message:
          error instanceof Error
            ? error.message
            : t("settings.notificationsError"),
      });
    }
  };
  const exportMutation = useMutation({
    mutationFn: async () => {
      const [accounts, categories, transactions] = await Promise.all([
        financeApi.listAccounts(),
        financeApi.listCategories(),
        financeApi.listAllTransactions(),
      ]);
      if (!accounts.length && !categories.length && !transactions.length) {
        throw new Error(t("settings.export.empty"));
      }
      await exportBackupXlsx(
        { accounts, categories, transactions },
        {
          sheets: {
            accounts: t("settings.export.sheets.accounts"),
            categories: t("settings.export.sheets.categories"),
            movements: t("settings.export.sheets.movements"),
          },
          columns: {
            name: t("settings.export.columns.name"),
            type: t("settings.export.columns.type"),
            currency: t("settings.export.columns.currency"),
            balance: t("settings.export.columns.balance"),
            icon: t("settings.export.columns.icon"),
            date: t("settings.export.columns.date"),
            category: t("settings.export.columns.category"),
            account: t("settings.export.columns.account"),
            amount: t("settings.export.columns.amount"),
            note: t("settings.export.columns.note"),
          },
          types: {
            income: t("forms.income"),
            expense: t("forms.expense"),
            transfer: t("forms.transfer"),
          },
          accountTypes: {
            cash: t("accountTypes.cash"),
            credit_card: t("accountTypes.creditCard"),
            checking_account: t("accountTypes.checkingAccount"),
            savings_account: t("accountTypes.savingsAccount"),
          },
        },
        t("settings.export.action"),
        new Date().toISOString(),
      );
    },
    onSuccess: () => {
      setExportDialogOpen(false);
      notify.success(t("settings.export.success"), {
        message: t("settings.export.successMessage"),
      });
    },
    onError: (error) => {
      setExportDialogOpen(false);
      notify.error(t("settings.export.error"), {
        message: error instanceof Error ? error.message : undefined,
      });
    },
  });

  const deleteConfirmationToken = t("settings.deleteAccountConfirmationToken");
  const canDeleteAccount =
    normalizeConfirmation(deleteConfirmation) ===
    normalizeConfirmation(deleteConfirmationToken);
  const deleteAccountMutation = useMutation({
    mutationFn: () => {
      if (!canDeleteAccount)
        throw new Error(t("settings.deleteAccountConfirmationError"));
      return financeApi.deleteCurrentUser(deleteConfirmationToken);
    },
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
      await signOut().catch(() => undefined);
    },
    onError: (error) =>
      notify.error(t("settings.deleteAccount"), {
        message:
          error instanceof Error
            ? error.message
            : t("settings.deleteAccountError"),
      }),
  });

  return (
    <Screen>
      <FintCard p={0} overflow="hidden">
        <SettingsRow
          icon={
            avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <IconBubble>
                <UserRound size={21} color="$primary" />
              </IconBubble>
            )
          }
          label={displayName}
          detail={session?.user.email ?? t("settings.editProfile")}
          onPress={() => router.push("/profile")}
          tall
        />
      </FintCard>

      <SettingsGroup title={t("settings.configuration")}>
        <FintSheetSelect
          label={t("settings.language")}
          placeholder={t("settings.language")}
          value={language}
          options={[
            {
              value: "es",
              label: "Español",
              icon: <Paragraph fontSize="$5">🇪🇸</Paragraph>,
            },
            {
              value: "en",
              label: "English",
              icon: <Paragraph fontSize="$5">🇺🇸</Paragraph>,
            },
            {
              value: "pt",
              label: "Português",
              icon: <Paragraph fontSize="$5">🇧🇷</Paragraph>,
            },
          ]}
          onValueChange={(value) => {
            void changeAppLanguage(value as AppLanguage)
              .then(() => registerPushInstallation())
              .catch(() => undefined);
          }}
          renderTrigger={({ onPress, selectedLabel }) => (
            <SettingsRow
              icon={<Languages size={19} color="$primary" />}
              label={t("settings.language")}
              value={selectedLabel}
              onPress={onPress}
            />
          )}
        />
        <FintSheetSelect
          label={t("settings.appearance")}
          placeholder={t("settings.appearance")}
          value={themePreference}
          options={[
            {
              value: "system",
              label: t("settings.system"),
              icon: <MonitorSmartphone size={19} color="$primary" />,
            },
            {
              value: "light",
              label: t("settings.light"),
              icon: <Sun size={19} color="$primary" />,
            },
            {
              value: "dark",
              label: t("settings.dark"),
              icon: <Moon size={19} color="$primary" />,
            },
          ]}
          onValueChange={(value) =>
            setThemePreference(value as "system" | "light" | "dark")
          }
          renderTrigger={({ onPress, selectedLabel }) => (
            <SettingsRow
              icon={
                themePreference === "system" ? (
                  <MonitorSmartphone size={19} color="$primary" />
                ) : themeMode === "dark" ? (
                  <Moon size={19} color="$primary" />
                ) : (
                  <Sun size={19} color="$primary" />
                )
              }
              label={t("settings.appearance")}
              value={selectedLabel}
              onPress={onPress}
            />
          )}
        />
        <FintSwitchRow
          icon={
            amountsVisible ? (
              <Eye size={19} color="$primary" />
            ) : (
              <EyeOff size={19} color="$primary" />
            )
          }
          label={t("privacy.amounts.title")}
          detail={
            amountsVisible
              ? t("privacy.amounts.visible")
              : t("privacy.amounts.hidden")
          }
          checked={!amountsVisible}
          onCheckedChange={toggleAmountsVisibility}
        />
        <SettingsRow
          icon={<Landmark size={19} color="$primary" />}
          label={t("settings.financialAccounts")}
          onPress={() => router.push("/(tabs)/accounts")}
        />
        <SettingsRow
          icon={<Tags size={19} color="$primary" />}
          label={t("settings.categories")}
          onPress={() => router.push("/categories")}
        />
        <SettingsRow
          icon={<Mail size={19} color="$primary" />}
          label={t("settings.gmail")}
          // detail={t("settings.gmailDetail")}
          onPress={() => router.push("/gmail-settings")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.dataSection")}>
        {capabilities.features.captureImport ? (
          <SettingsRow
            icon={<ImageUp size={19} color="$primary" />}
            label={t("capture.settingsAction")}
            detail={t("capture.settingsHint")}
            onPress={() => router.push("/capture-import")}
          />
        ) : null}
        <SettingsRow
          icon={<Upload size={19} color="$primary" />}
          label={t("import.action")}
          detail={t("import.hint")}
          onPress={() => router.push("/import-transactions")}
        />
        <SettingsRow
          icon={<Download size={19} color="$primary" />}
          label={t("settings.export.action")}
          detail={t("settings.export.hint")}
          onPress={() => setExportDialogOpen(true)}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.notificationsSection")}>
        <FintSwitchRow
          icon={<Bell size={19} color="$primary" />}
          label={t("settings.notifications")}
          checked={pushState === "granted"}
          disabled={pushState === "unsupported"}
          onCheckedChange={(next) => {
            void handleNotificationsToggle(next);
          }}
        />
        <FintSwitchRow
          icon={<AlarmClock size={19} color="$primary" />}
          label={t("settings.dailyReminders")}
          detail={t("settings.dailyRemindersDetail")}
          checked={dailyRemindersEnabled}
          disabled={pushState !== "granted"}
          onCheckedChange={setDailyRemindersEnabled}
        />
        {dailyRemindersEnabled ? (
          <FintTimeField
            hour={reminderHour}
            minute={reminderMinute}
            onChange={setReminderTime}
            title={t("settings.dailyReminderTime")}
            doneLabel={t("actions.done")}
            renderTrigger={({ onPress }) => (
              <SettingsRow
                icon={<Clock size={19} color="$primary" />}
                label={t("settings.dailyReminderTime")}
                value={formatReminderTime(reminderHour, reminderMinute, language)}
                onPress={onPress}
              />
            )}
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t("settings.contact")}>
        <SettingsRow
          icon={<HelpCircle size={19} color="$primary" />}
          label={t("settings.help")}
          onPress={() => router.push("/support")}
        />
        <SettingsRow
          icon={<Globe2 size={19} color="$primary" />}
          label={t("settings.suggestion")}
          onPress={() => router.push("/improvements")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.shareSection")}>
        <SettingsRow
          icon={<Share2 size={19} color="$primary" />}
          label={t("settings.shareApp")}
          onPress={shareApp}
        />
        <SettingsRow
          icon={<Github size={19} color="$primary" />}
          label={t("settings.github")}
          onPress={() => {
            void Linking.openURL("https://github.com/maishet/Fint");
          }}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.legal")}>
        <SettingsRow
          icon={<ShieldCheck size={19} color="$primary" />}
          label={t("settings.privacy")}
          onPress={() => router.push({ pathname: "/web-content", params: { content: "privacy" } })}
        />
        <SettingsRow
          icon={<FileText size={19} color="$primary" />}
          label={t("settings.terms")}
          onPress={() => router.push({ pathname: "/web-content", params: { content: "terms" } })}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.accountManagement")}>
        <SettingsRow
          icon={<Trash2 size={19} color="$red10" />}
          label={t("settings.deleteAccount")}
          // detail={t("settings.deleteAccountHint")}
          onPress={() => setDeleteDialogOpen(true)}
        />
      </SettingsGroup>

      <FintConfirmDialog
        open={exportDialogOpen}
        isPending={exportMutation.isPending}
        title={t("settings.export.warningTitle")}
        description={t("settings.export.warningDescription")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("settings.export.confirm")}
        pendingLabel={t("settings.export.exporting")}
        icon={<Download size={17} color="$primaryForeground" />}
        onCancel={() => setExportDialogOpen(false)}
        onConfirm={() => exportMutation.mutate()}
      />

      <DeleteAccountDialog
        confirmation={deleteConfirmation}
        isPending={deleteAccountMutation.isPending}
        open={deleteDialogOpen}
        requiredConfirmation={deleteConfirmationToken}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmation("");
        }}
        onChangeConfirmation={setDeleteConfirmation}
        onConfirm={() => {
          if (canDeleteAccount) deleteAccountMutation.mutate();
        }}
      />

      <YStack gap="$2">
        <Paragraph
          color="$color9"
          fontSize="$1"
          fontWeight="800"
          textTransform="uppercase"
        >
          {t("settings.session")}
        </Paragraph>
        <FintButton
          variant="outlined"
          color="$red10"
          borderColor="$red6"
          icon={<LogOut size={18} color="$red10" />}
          onPress={() => {
            void signOut();
          }}
        >
          {t("settings.signOut")}
        </FintButton>
      </YStack>

      <XStack justify="center">
        <Paragraph color="$color9" fontSize="$1">
          {t("settings.version")} {diagnostics.appVersion} ·{" "}
          {t("settings.build")} {diagnostics.buildNumber}
        </Paragraph>
      </XStack>
    </Screen>
  );
}

function DeleteAccountDialog({
  confirmation,
  isPending,
  onCancel,
  onChangeConfirmation,
  onConfirm,
  open,
  requiredConfirmation,
}: {
  confirmation: string;
  isPending: boolean;
  onCancel: () => void;
  onChangeConfirmation: (value: string) => void;
  onConfirm: () => void;
  open: boolean;
  requiredConfirmation: string;
}) {
  const { t } = useTranslation();
  const canDelete =
    normalizeConfirmation(confirmation) ===
    normalizeConfirmation(requiredConfirmation);
  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && !isPending && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Overlay bg="rgba(4,18,28,0.68)" />
        <Dialog.Content
          bordered
          elevate
          bg="$popover"
          borderColor="$borderColor"
          rounded="$7"
          width="88%"
          maxW={420}
          p="$5"
          gap="$4"
        >
          <Dialog.Title
            color="$color12"
            fontFamily="$heading"
            fontSize="$6"
            fontWeight="800"
          >
            {t("settings.deleteAccountTitle")}
          </Dialog.Title>
          <Dialog.Description color="$color10" fontSize="$3">
            {t("settings.deleteAccountDescription", {
              confirmation: requiredConfirmation,
            })}
          </Dialog.Description>
          <YStack gap="$2">
            <Paragraph color="$color11" fontSize="$2" fontWeight="700">
              {t("settings.deleteAccountTypeConfirm", {
                confirmation: requiredConfirmation,
              })}
            </Paragraph>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              bg="$muted"
              borderColor={confirmation && !canDelete ? "$red8" : "$color5"}
              color="$color12"
              placeholder={requiredConfirmation}
              placeholderTextColor="$color8"
              value={confirmation}
              onChangeText={onChangeConfirmation}
            />
          </YStack>
          <XStack gap="$3">
            <Button flex={1} chromeless disabled={isPending} onPress={onCancel}>
              {t("actions.cancel")}
            </Button>
            <Button
              flex={1}
              bg={canDelete ? "$destructive" : "$muted"}
              color={canDelete ? "$primaryForeground" : "$color8"}
              fontWeight="800"
              disabled={!canDelete || isPending}
              opacity={canDelete ? 1 : 0.58}
              icon={
                isPending ? (
                  <FintSpinner color="$primaryForeground" />
                ) : (
                  <Trash2
                    size={17}
                    color={canDelete ? "$primaryForeground" : "$color8"}
                  />
                )
              }
              onPress={onConfirm}
            >
              {isPending
                ? t("settings.deletingAccount")
                : t("settings.deleteAccountButton")}
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function normalizeConfirmation(value: string) {
  return value.trim().toLocaleLowerCase();
}

function formatReminderTime(
  hour: number,
  minute: number,
  language: AppLanguage,
) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  try {
    return date.toLocaleTimeString(getAppLocale(language), {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  }
}

function SettingsGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const items = (Array.isArray(children) ? children : [children]).filter(
    Boolean,
  );
  return (
    <YStack gap="$2">
      <Paragraph
        color="$color9"
        fontSize="$1"
        fontWeight="800"
        textTransform="uppercase"
      >
        {title}
      </Paragraph>
      <FintCard p={0} overflow="hidden">
        {items.map((item, index) => (
          <YStack key={index}>
            {index > 0 ? <Separator ml={52} /> : null}
            {item}
          </YStack>
        ))}
      </FintCard>
    </YStack>
  );
}

function SettingsRow({
  detail,
  icon,
  label,
  onPress,
  tall = false,
  value,
}: {
  detail?: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  tall?: boolean;
  value?: string;
}) {
  return (
    <XStack
      minH={tall ? 82 : 58}
      px="$4"
      py="$3"
      items="center"
      gap="$3"
      pressStyle={{ bg: "$color3" }}
      onPress={onPress}
    >
      {icon}
      <YStack flex={1} minW={0} gap={detail ? "$1" : 0}>
        <Paragraph
          color="$color12"
          fontSize={tall ? "$4" : "$3"}
          fontWeight="700"
          numberOfLines={1}
        >
          {label}
        </Paragraph>
        {detail ? (
          <Paragraph color="$color9" fontSize="$1" numberOfLines={1}>
            {detail}
          </Paragraph>
        ) : null}
      </YStack>
      {value ? (
        <Paragraph color="$color9" fontSize="$2">
          {value}
        </Paragraph>
      ) : null}
      <ChevronRight size={18} color="$color8" />
    </XStack>
  );
}

function IconBubble({ children }: { children: ReactNode }) {
  return (
    <YStack
      width={48}
      height={48}
      rounded="$10"
      bg="$secondary"
      items="center"
      justify="center"
    >
      {children}
    </YStack>
  );
}
