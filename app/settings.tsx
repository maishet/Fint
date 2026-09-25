import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  EyeOff,
  FileText,
  Globe,
  HelpCircle,
  Lightbulb,
  LogOut,
  Mail,
  MapPin,
  MonitorSmartphone,
  Moon,
  Share2,
  ShieldCheck,
  Star,
  Sun,
  Tag,
  Trash2,
  Wallet,
} from "@tamagui/lucide-icons-2";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Linking, ScrollView, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import { useAuth } from "../src/auth/AuthProvider";
import { resolveDisplayName } from "../src/auth/displayName";
import { changeAppLanguage, getAppLocale, type AppLanguage } from "../src/i18n";
import { useLocationPreference } from "../src/location/LocationPreferenceProvider";
import { useDailyReminders } from "../src/notifications/DailyRemindersProvider";
import {
  refreshPushRegistration,
  registerPushInstallation,
  requestAndRegisterPushInstallation,
  unregisterPushInstallation,
  type PushPermissionState,
} from "../src/notifications/pushNotifications";
import { useSensitiveAmounts } from "../src/privacy/SensitiveAmountsProvider";
import { activeGmailCount } from "../src/settings/logic";
import { Avatar, Group, GroupTitle, Item, OptionSheet } from "../src/settings/SettingsList";
import { getSupportDiagnostics } from "../src/support/diagnostics";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import {
  FintButton,
  FintCard,
  FintSheet,
  FintSpinner,
  FintTimeField,
  FText,
  IconButton,
  PressableScale,
  SheetField,
  SheetTextInput,
  Toggle,
  useNotify,
} from "../src/ui";

type Sheet = "language" | "appearance" | "notifications" | "delete" | null;
const SHEET_UNMOUNT_MS = 600;
const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

/**
 * Ajustes v3: la tarjeta de perfil y listas agrupadas (Preferencias,
 * Notificaciones, Tus datos, Ayuda, Compartir y comunidad, Legal, Cuenta), con
 * la versión en `mono` al final. Cada fila: icono sobre `surfaceSunken`,
 * etiqueta, valor en `inkFaint` y chevron, o un interruptor si es un sí o no.
 * El único acento es el `brand` de los interruptores encendidos.
 */
export default function SettingsScreen() {
  const { i18n, t } = useTranslation();
  const language: AppLanguage = i18n.resolvedLanguage === "en" || i18n.resolvedLanguage === "pt" ? i18n.resolvedLanguage : "es";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const { session, signOut } = useAuth();
  const { themeMode, themePreference, setThemePreference } = useThemeMode();
  const { amountsVisible, toggleAmountsVisibility } = useSensitiveAmounts();
  const { enabled: locationEnabled, setEnabled: setLocationEnabled } = useLocationPreference();
  const { enabled: remindersEnabled, setEnabled: setRemindersEnabled, hour, minute, setReminderTime } = useDailyReminders();
  const diagnostics = getSupportDiagnostics();
  const [pushState, setPushState] = useState<PushPermissionState>("undetermined");
  const [pushSyncing, setPushSyncing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [mountedSheet, setMountedSheet] = useState<Sheet>(null);
  const [signingOut, setSigningOut] = useState(false);

  const accountsQuery = useQuery({ queryKey: ["account-options"], queryFn: () => financeApi.listAccountOptions() });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: () => financeApi.listCategories(), staleTime: 5 * 60_000 });
  const gmailQuery = useQuery({ queryKey: ["gmail-sources"], queryFn: financeApi.listGmailSources });

  useScreenStatusBar();

  const openSheet = (next: Exclude<Sheet, null>) => {
    setMountedSheet(next);
    setSheet(next);
  };
  useEffect(() => {
    if (sheet) return;
    const id = setTimeout(() => setMountedSheet(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [sheet]);

  const syncPushState = useCallback(() => {
    setPushSyncing(true);
    refreshPushRegistration()
      .then(setPushState)
      .catch(() => setPushState("unsupported"))
      .finally(() => setPushSyncing(false));
  }, []);
  useEffect(syncPushState, [syncPushState]);
  // Al volver de los ajustes del teléfono el permiso pudo cambiar: se relee y se completa el registro.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncPushState();
    });
    return () => subscription.remove();
  }, [syncPushState]);

  const turnNotificationsOn = async () => {
    if (pushState === "denied") {
      await Linking.openSettings();
      return;
    }
    setPushSyncing(true);
    try {
      const next = await requestAndRegisterPushInstallation();
      setPushState(next);
      if (next === "granted") setSheet(null);
      else notify.error(t("settings.notifications"), { message: t("settings.notificationsError") });
    } catch (error) {
      notify.error(t("settings.notifications"), { message: error instanceof Error ? error.message : t("settings.notificationsError") });
    } finally {
      setPushSyncing(false);
    }
  };
  const turnNotificationsOff = async () => {
    setPushState("undetermined");
    if (remindersEnabled) setRemindersEnabled(false);
    setSheet(null);
    await unregisterPushInstallation().catch(() => undefined);
  };

  const displayName = resolveDisplayName(session) ?? "My Fint";
  const metadata = session?.user.user_metadata ?? {};
  const photoUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
  const notificationsValue =
    pushState === "granted"
      ? t("settings.notificationsOn")
      : pushState === "denied"
        ? t("settingsScreen.notificationsBlocked")
        : pushState === "unsupported"
          ? t("settings.notificationsUnsupported")
          : t("settings.notificationsOff");
  const reminderTime = formatTime(hour, minute, getAppLocale(language));
  const gmailCount = activeGmailCount(gmailQuery.data ?? []);
  const appearanceLabel = themePreference === "light" ? t("settings.light") : themePreference === "dark" ? t("settings.dark") : t("settings.system");

  const endSession = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      notify.error(t("profile.signOutError"));
      setSigningOut(false);
    }
  };

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }} showsVerticalScrollIndicator={false}>
        <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]}>
          <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText variant="title" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, flex: 1 }} numberOfLines={1}>
            {t("settingsScreen.title")}
          </FText>
        </XStack>

        {/* Perfil: abre Mi perfil. */}
        <PressableScale
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}, ${t("settings.profile")}`}
        >
          <FintCard mx={space[4]} mt={space[4]} p={14}>
            <XStack items="center" gap={12}>
              <Avatar name={displayName} photoUrl={photoUrl} size={52} />
              <YStack flex={1} minW={0}>
                <FText variant="body-strong" numberOfLines={1} style={{ fontSize: 16, letterSpacing: -0.2 }}>
                  {displayName}
                </FText>
                <FText variant="label" tone="inkFaint" numberOfLines={1}>
                  {session?.user.email ?? ""}
                </FText>
              </YStack>
              <ChevronRight size={18} color="$inkFaint" strokeWidth={2} />
            </XStack>
          </FintCard>
        </PressableScale>

        <GroupTitle>{t("settingsScreen.preferences")}</GroupTitle>
        <Group>
          <Item
            icon={themePreference === "system" ? MonitorSmartphone : themeMode === "dark" ? Moon : Sun}
            label={t("settings.appearance")}
            value={appearanceLabel}
            onPress={() => openSheet("appearance")}
          />
          <Item
            icon={Globe}
            label={t("settings.language")}
            value={LANGUAGES.find((l) => l.value === language)?.label}
            onPress={() => openSheet("language")}
          />
          <Item
            icon={EyeOff}
            label={t("settingsScreen.hideAmounts")}
            detail={t("settingsScreen.hideAmountsDetail")}
            onPress={toggleAmountsVisibility}
            right={<Toggle value={!amountsVisible} onValueChange={toggleAmountsVisibility} accessibilityLabel={t("settingsScreen.hideAmounts")} />}
          />
          <Item
            icon={MapPin}
            label={t("settings.locationCapture")}
            detail={t("settingsScreen.locationDetail")}
            onPress={() => setLocationEnabled(!locationEnabled)}
            right={<Toggle value={locationEnabled} onValueChange={setLocationEnabled} accessibilityLabel={t("settings.locationCapture")} />}
          />
        </Group>

        <GroupTitle>{t("settings.notificationsSection")}</GroupTitle>
        <Group>
          <Item
            icon={Bell}
            label={t("settings.notifications")}
            value={notificationsValue}
            right={pushSyncing ? <FintSpinner color="$inkFaint" /> : "chevron"}
            onPress={() => openSheet("notifications")}
          />
          <FintTimeField
            hour={hour}
            minute={minute}
            onChange={setReminderTime}
            title={t("settings.dailyReminderTime")}
            doneLabel={t("actions.done")}
            renderTrigger={({ onPress }) => (
              <Item
                icon={Clock}
                label={t("settingsScreen.dailyReminder")}
                value={remindersEnabled ? reminderTime : undefined}
                valueMono
                tone={pushState === "granted" ? "default" : "dim"}
                disabled={pushState !== "granted"}
                // Encendido, tocar la fila cambia la hora; apagado, lo enciende.
                onPress={() => (remindersEnabled ? onPress() : setRemindersEnabled(true))}
                right={
                  <Toggle
                    value={remindersEnabled}
                    onValueChange={setRemindersEnabled}
                    disabled={pushState !== "granted"}
                    accessibilityLabel={t("settingsScreen.dailyReminder")}
                  />
                }
              />
            )}
          />
        </Group>

        <GroupTitle>{t("settingsScreen.yourData")}</GroupTitle>
        <Group>
          <Item
            icon={Wallet}
            label={t("settingsScreen.accounts")}
            value={countLabel(accountsQuery.data?.length)}
            valueMono
            onPress={() => router.push("/accounts")}
          />
          <Item
            icon={Tag}
            label={t("settings.categories")}
            value={countLabel(categoriesQuery.data?.length)}
            valueMono
            onPress={() => router.push("/categories")}
          />
          <Item
            icon={Mail}
            label={t("settings.gmail")}
            value={
              gmailQuery.data ? (gmailCount ? t("settingsScreen.gmailActive", { count: gmailCount }) : t("settingsScreen.gmailNone")) : undefined
            }
            onPress={() => router.push("/gmail-settings")}
          />
        </Group>

        <GroupTitle>{t("settingsScreen.help")}</GroupTitle>
        <Group>
          <Item icon={HelpCircle} label={t("settings.help")} onPress={() => router.push("/support")} />
          <Item icon={Lightbulb} label={t("settings.suggestion")} onPress={() => router.push("/improvements")} />
        </Group>

        <GroupTitle>{t("settings.shareSection")}</GroupTitle>
        <Group>
          <Item
            icon={Share2}
            label={t("settings.shareApp")}
            detail={t("settingsScreen.shareDetail")}
            onPress={() => void Share.share({ message: t("settings.shareMessage"), url: "https://myfint.app" })}
          />
          <Item icon={Code} label={t("settings.github")} onPress={() => void Linking.openURL("https://github.com/maishet/Fint")} />
          {/* Mientras la app no esté publicada: apagada, con la razón debajo. */}
          <Item icon={Star} label={t("settings.rateStore")} detail={t("settingsScreen.rateDetail")} tone="dim" right="none" />
        </Group>

        <GroupTitle>{t("settings.legal")}</GroupTitle>
        <Group>
          <Item
            icon={ShieldCheck}
            label={t("settings.privacy")}
            onPress={() => router.push({ pathname: "/web-content", params: { content: "privacy" } })}
          />
          <Item icon={FileText} label={t("settings.terms")} onPress={() => router.push({ pathname: "/web-content", params: { content: "terms" } })} />
        </Group>

        <GroupTitle>{t("settingsScreen.account")}</GroupTitle>
        <Group>
          <Item
            icon={LogOut}
            label={t("settings.signOut")}
            right={signingOut ? <FintSpinner color="$inkFaint" /> : "none"}
            disabled={signingOut}
            onPress={() => void endSession()}
          />
          <Item
            icon={Trash2}
            label={t("settings.deleteAccount")}
            detail={t("settingsScreen.deleteDetail")}
            tone="danger"
            right="none"
            onPress={() => openSheet("delete")}
          />
        </Group>

        <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 22, ...textStyles["figure-caption"], fontSize: 12 }}>
          {t("settingsScreen.version", { version: diagnostics.appVersion, build: diagnostics.buildNumber })}
        </FText>
      </ScrollView>

      {mountedSheet === "appearance" ? (
        <OptionSheet
          open={sheet === "appearance"}
          onClose={() => setSheet(null)}
          title={t("settings.appearance")}
          value={themePreference}
          options={[
            { value: "system", label: t("settings.system"), icon: <MonitorSmartphone size={18} color="$inkMuted" strokeWidth={2} /> },
            { value: "light", label: t("settings.light"), icon: <Sun size={18} color="$inkMuted" strokeWidth={2} /> },
            { value: "dark", label: t("settings.dark"), icon: <Moon size={18} color="$inkMuted" strokeWidth={2} /> },
          ]}
          onChange={setThemePreference}
        />
      ) : null}
      {mountedSheet === "language" ? (
        <OptionSheet
          open={sheet === "language"}
          onClose={() => setSheet(null)}
          title={t("settings.language")}
          value={language}
          options={LANGUAGES}
          onChange={(next) => {
            // El idioma también va al registro de notificaciones: el backend escribe los avisos en ese idioma.
            void changeAppLanguage(next)
              .then(() => registerPushInstallation())
              .catch(() => undefined);
          }}
        />
      ) : null}
      {mountedSheet === "notifications" ? (
        <NotificationsSheet
          open={sheet === "notifications"}
          onClose={() => setSheet(null)}
          state={pushState}
          pending={pushSyncing}
          onTurnOn={() => void turnNotificationsOn()}
          onTurnOff={() => void turnNotificationsOff()}
        />
      ) : null}
      {mountedSheet === "delete" ? (
        <DeleteAccountSheet open={sheet === "delete"} onClose={() => setSheet(null)} onDeleted={() => void signOut().catch(() => undefined)} />
      ) : null}
    </YStack>
  );
}

function countLabel(count?: number) {
  return count === undefined ? undefined : String(count);
}

function formatTime(hour: number, minute: number, locale: string) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
}

/** El estado del permiso y la acción que corresponde: activar, desactivar o abrir los ajustes del teléfono si están bloqueadas. */
function NotificationsSheet({
  open,
  onClose,
  state,
  pending,
  onTurnOn,
  onTurnOff,
}: {
  open: boolean;
  onClose: () => void;
  state: PushPermissionState;
  pending: boolean;
  onTurnOn: () => void;
  onTurnOff: () => void;
}) {
  const { t } = useTranslation();
  const body =
    state === "granted"
      ? t("settingsScreen.notifSheet.onBody")
      : state === "denied"
        ? t("settingsScreen.notifSheet.blockedBody")
        : state === "unsupported"
          ? t("settingsScreen.notifSheet.unsupportedBody")
          : t("settingsScreen.notifSheet.offBody");
  return (
    <FintSheet open={open} onClose={onClose} title={t("settings.notifications")} titleSize="compact">
      <YStack px={space[5]} pb={space[2]} gap={18}>
        <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21 }}>
          {body}
        </FText>
        {state === "unsupported" ? null : state === "granted" ? (
          <FintButton variant="outlined" disabled={pending} onPress={onTurnOff}>
            {t("settingsScreen.notifSheet.turnOff")}
          </FintButton>
        ) : (
          <FintButton disabled={pending} icon={pending ? <FintSpinner color="$onBrand" /> : undefined} onPress={onTurnOn}>
            {state === "denied" ? t("settingsScreen.notifSheet.openSystem") : t("settingsScreen.notifSheet.turnOn")}
          </FintButton>
        )}
      </YStack>
    </FintSheet>
  );
}

/** Eliminar la cuenta: hay que escribir la palabra de confirmación ("confirmar") para habilitar el botón, como antes. */
function DeleteAccountSheet({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const word = t("settings.deleteAccountConfirmationToken");
  const canDelete = text.trim().toLocaleLowerCase() === word.toLocaleLowerCase();
  const mutation = useMutation({
    mutationFn: () => financeApi.deleteCurrentUser(word),
    onSuccess: () => {
      onClose();
      onDeleted();
    },
    onError: (error) =>
      notify.error(t("settings.deleteAccount"), { message: error instanceof Error ? error.message : t("settings.deleteAccountError") }),
  });
  return (
    <FintSheet open={open} onClose={() => !mutation.isPending && onClose()}>
      <YStack items="center" px={space[5]} pt={space[4]}>
        <View width={56} height={56} rounded={999} bg="$red2" items="center" justify="center">
          <Trash2 size={24} color="$dangerHard" strokeWidth={2} />
        </View>
        <FText variant="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 14, textAlign: "center" }}>
          {t("settingsScreen.deleteSheet.title")}
        </FText>
        <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }}>
          {t("settingsScreen.deleteSheet.body")}
        </FText>
        <YStack self="stretch" mt={18} gap={6}>
          <FText variant="caption" tone="inkMuted" style={{ marginLeft: 2 }}>
            {t("settingsScreen.deleteSheet.typeToConfirm", { word })}
          </FText>
          <SheetField focused={focused}>
            <SheetTextInput
              value={text}
              onChangeText={setText}
              placeholder={word}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={t("settingsScreen.deleteSheet.typeToConfirm", { word })}
              style={{ fontFamily: fontFace.mono[400] }}
            />
          </SheetField>
        </YStack>
        <YStack self="stretch" gap={10} mt={18}>
          <FintButton
            variant="danger"
            haptic="warning"
            disabled={!canDelete || mutation.isPending}
            opacity={canDelete ? 1 : 0.42}
            onPress={() => mutation.mutate()}
          >
            {mutation.isPending ? <FintSpinner color="$onDanger" /> : t("settings.deleteAccountButton")}
          </FintButton>
          <FintButton variant="ghost" bg="$surfaceSunken" color="$ink" disabled={mutation.isPending} onPress={onClose}>
            {t("actions.cancel")}
          </FintButton>
        </YStack>
      </YStack>
    </FintSheet>
  );
}
