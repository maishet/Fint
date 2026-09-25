import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { ChevronLeft, CircleAlert, Ellipsis, Plus, RefreshCw, Trash2, X } from "@tamagui/lucide-icons-2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, View, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import type { GmailSource } from "../src/api/types";
import { GMAIL_READONLY_SCOPE, GOOGLE_SIGNIN_BASE_CONFIG } from "../src/auth/googleSignIn";
import { DataStateCard } from "../src/components/DataStateCard";
import { getAppLocale } from "../src/i18n";
import { addSenders, GMAIL_MAX_SOURCES, gmailCardState, sameSenders, syncDay, visibleGmailSources } from "../src/settings/logic";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { FintButton, FintCard, FintSheet, FintSpinner, FText, IconButton, PressableScale, useNotify } from "../src/ui";
import { DashedOutline } from "../src/ui/DashedOutline";
import { GoogleMark } from "../src/ui/GoogleMark";
import { haptics } from "../src/ui/haptics";

async function connectGmailNative() {
  GoogleSignin.configure({
    ...GOOGLE_SIGNIN_BASE_CONFIG,
    offlineAccess: true,
    scopes: [GMAIL_READONLY_SCOPE],
    // Sin esto, si el usuario ya había concedido este scope antes, Google no
    // reemite un refresh token y el backend se queda sin acceso persistente.
    forceCodeForRefreshToken: true,
  });
  try {
    // Sin esto, si ya hay una sesión nativa de Google en caché (p.ej. del login),
    // signIn() la reutiliza en silencio y nunca muestra el selector de cuenta.
    await GoogleSignin.signOut().catch(() => undefined);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return;

    const serverAuthCode = response.data.serverAuthCode;
    if (!serverAuthCode) throw new Error("missing_gmail_server_auth_code");
    await financeApi.connectGmailNative(serverAuthCode);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return;
    throw error;
  } finally {
    GoogleSignin.configure(GOOGLE_SIGNIN_BASE_CONFIG);
  }
}

/**
 * Cuentas Gmail v3: una tarjeta por correo conectado, hasta tres. Activa: el
 * punto `flowIn` y la última sincronización, los remitentes como fichas en
 * `mono` y "Sincronizar" con el resultado de la última vez. Sin remitentes:
 * filete `brand` a la izquierda, explica que no se lee nada hasta agregarlos y
 * ofrece el botón. Si Google pide reconectar, "Reconectar correo". El menú de
 * tres puntos ofrece Desconectar, con confirmación.
 */
export default function GmailSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { themeMode } = useThemeMode();
  const sourcesQuery = useQuery({ queryKey: ["gmail-sources"], queryFn: financeApi.listGmailSources });
  const [menuFor, setMenuFor] = useState<GmailSource | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const connectMutation = useMutation({
    mutationFn: connectGmailNative,
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["gmail-sources"] }), queryClient.invalidateQueries({ queryKey: ["me"] })]);
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : undefined;
      notify.error(t("states.error"), { message: t("gmail.connectError"), detail, detailLabel: detail ? t("actions.viewDetail") : undefined });
    },
  });
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => financeApi.disconnectGmailSource(id),
    onSuccess: () => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      notify.success(t("gmail.disconnected"));
    },
    onError: (error) => notify.error(t("gmail.disconnectError"), { message: error instanceof Error ? error.message : undefined }),
  });

  const sources = visibleGmailSources(sourcesQuery.data ?? []);
  const full = sources.length >= GMAIL_MAX_SOURCES;

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={sourcesQuery.isRefetching} onRefresh={() => void sourcesQuery.refetch()} />}
      >
        <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]}>
          <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText variant="title" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, flex: 1 }} numberOfLines={1}>
            {t("settings.gmail")}
          </FText>
        </XStack>
        <FText variant="label" tone="inkMuted" style={{ paddingHorizontal: space[4], paddingTop: 6, lineHeight: 19 }}>
          {t("gmailScreen.intro")}
        </FText>

        {sourcesQuery.isLoading ? <CardsSkeleton /> : null}
        {sourcesQuery.error ? (
          <YStack px={space[4]} mt={14}>
            <DataStateCard
              message={sourcesQuery.error instanceof Error ? sourcesQuery.error.message : t("states.error")}
              onRetry={() => void sourcesQuery.refetch()}
            />
          </YStack>
        ) : null}

        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            onReconnect={() => connectMutation.mutate()}
            reconnecting={connectMutation.isPending}
            onMore={() => {
              setMenuFor(source);
              setMenuOpen(true);
            }}
          />
        ))}

        {sourcesQuery.isSuccess ? (
          <>
            <PressableScale
              onPress={() => connectMutation.mutate()}
              disabled={full || connectMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={sources.length ? t("gmailScreen.connectAnother") : t("gmailScreen.connectFirst")}
            >
              <XStack mx={space[4]} mt={14} height={50} rounded={radius.lg} items="center" justify="center" gap={8} opacity={full ? 0.42 : 1}>
                {/* En Android el borde punteado con esquinas redondeadas sale continuo: va en SVG. */}
                <DashedOutline radius={radius.lg} />
                {connectMutation.isPending ? <FintSpinner color="$brand" /> : <Plus size={16} color="$brand" strokeWidth={2.2} />}
                <FText variant="body-strong" tone="brand" style={{ fontSize: 14 }}>
                  {sources.length ? t("gmailScreen.connectAnother") : t("gmailScreen.connectFirst")}
                </FText>
              </XStack>
            </PressableScale>
            <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 8 }}>
              {full ? t("gmailScreen.limitReached") : t("gmailScreen.limit")}
            </FText>
          </>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Menú de tres puntos: solo Desconectar, que pide confirmación. */}
      {menuFor ? (
        <FintSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={menuFor.emailAddress} titleSize="compact">
          <YStack px={space[2]} pb={space[2]}>
            <PressableScale
              scaleTo={1}
              dim
              onPress={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              accessibilityRole="button"
            >
              <XStack minH={52} px={space[3]} gap={12} items="center">
                <Trash2 size={18} color="$dangerHard" strokeWidth={2} />
                <FText tone="dangerHard" style={{ fontFamily: fontFace.sans[500] }}>
                  {t("gmail.disconnect")}
                </FText>
              </XStack>
            </PressableScale>
          </YStack>
        </FintSheet>
      ) : null}
      {menuFor ? (
        <FintSheet open={confirmOpen} onClose={() => !disconnectMutation.isPending && setConfirmOpen(false)}>
          <YStack items="center" px={space[5]} pt={space[4]}>
            <View width={56} height={56} rounded={999} bg="$red2" items="center" justify="center">
              <Trash2 size={24} color="$dangerHard" strokeWidth={2} />
            </View>
            <FText variant="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 14, textAlign: "center" }}>
              {t("gmail.disconnect")}
            </FText>
            <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }}>
              {t("gmail.disconnectConfirm")}
            </FText>
            <FText variant="label" style={{ marginTop: 8, textAlign: "center", fontFamily: fontFace.mono[400] }}>
              {menuFor.emailAddress}
            </FText>
            <YStack self="stretch" gap={10} mt={22}>
              <FintButton
                variant="danger"
                haptic="warning"
                disabled={disconnectMutation.isPending}
                onPress={() => disconnectMutation.mutate(menuFor.id)}
              >
                {disconnectMutation.isPending ? <FintSpinner color="$onDanger" /> : t("gmail.disconnect")}
              </FintButton>
              <FintButton
                variant="ghost"
                bg="$surfaceSunken"
                color="$ink"
                disabled={disconnectMutation.isPending}
                onPress={() => setConfirmOpen(false)}
              >
                {t("actions.cancel")}
              </FintButton>
            </YStack>
          </YStack>
        </FintSheet>
      ) : null}
    </YStack>
  );
}

function SourceCard({
  source,
  onReconnect,
  reconnecting,
  onMore,
}: {
  source: GmailSource;
  onReconnect: () => void;
  reconnecting: boolean;
  onMore: () => void;
}) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const state = gmailCardState(source);
  const [senders, setSenders] = useState<string[]>(source.senderFilters);
  const [editing, setEditing] = useState(state === "active");
  const [lastSync, setLastSync] = useState<{ processed: number; created: number } | null>(null);
  const dirty = !sameSenders(senders, source.senderFilters);

  // Si el servidor cambia la lista (otro dispositivo, al guardar), se toma la nueva mientras no haya cambios sin guardar.
  const serverKey = source.senderFilters.join(",");
  useEffect(() => {
    setSenders(source.senderFilters);
  }, [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncMutation = useMutation({
    mutationFn: () => financeApi.syncGmailSource(source.id),
    onSuccess: (result) => {
      setLastSync({ processed: result.processed, created: result.created });
      queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
    },
    onError: (error) => notify.error(t("states.error"), { message: error instanceof Error ? error.message : undefined }),
  });
  const saveMutation = useMutation({
    mutationFn: (senderFilters: string[]) => financeApi.updateGmailSource(source.id, { labelIds: ["INBOX"], senderFilters }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
      notify.success(t("gmail.filterSaved"));
    },
    onError: (error) => notify.error(t("states.error"), { message: error instanceof Error ? error.message : undefined }),
  });

  const locale = getAppLocale(i18n.resolvedLanguage);
  const syncedWhen = source.lastSyncAt
    ? (() => {
        const at = new Date(source.lastSyncAt);
        const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
        const day = syncDay(source.lastSyncAt, new Date());
        if (day === "today") return t("gmailScreen.today", { time });
        if (day === "yesterday") return t("gmailScreen.yesterday", { time });
        return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(at);
      })()
    : null;
  const status =
    state === "reconnect"
      ? t("gmailScreen.reconnectStatus")
      : state === "needsSenders"
        ? t("gmailScreen.needsSenders")
        : syncedWhen
          ? t("gmailScreen.activeSince", { when: syncedWhen })
          : t("gmailScreen.activeNever");
  const dot = state === "active" ? "$flowIn" : state === "reconnect" ? "$dangerHard" : "$inkFaint";
  const pending = syncMutation.isPending || saveMutation.isPending;

  return (
    <FintCard mx={space[4]} mt={14} p={14} overflow="hidden">
      {/* Sin remitentes: filete `brand` a la izquierda. */}
      {state === "needsSenders" ? <View position="absolute" l={0} t={0} b={0} width={3} bg="$brand" /> : null}
      <XStack items="center" gap={10}>
        <GoogleMark size={18} />
        <YStack flex={1} minW={0}>
          <FText variant="body-strong" numberOfLines={1} style={{ fontSize: 14 }}>
            {source.emailAddress}
          </FText>
          <XStack items="center" gap={5}>
            <View width={6} height={6} rounded={999} bg={dot} />
            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
              {status}
            </FText>
          </XStack>
        </YStack>
        <IconButton
          size={34}
          tone="sunken"
          label={t("gmailScreen.more")}
          icon={<Ellipsis size={18} color="$inkFaint" strokeWidth={2.4} />}
          onPress={onMore}
        />
      </XStack>

      {state === "reconnect" ? (
        <>
          <FText variant="caption" tone="inkMuted" style={{ marginTop: 10, lineHeight: 17 }}>
            {t("gmailScreen.reconnectBody")}
          </FText>
          <XStack mt={12}>
            <Pill tone="soft" label={t("gmailScreen.reconnect")} pending={reconnecting} onPress={onReconnect} />
          </XStack>
        </>
      ) : null}

      {state === "needsSenders" && !editing ? (
        <>
          <FText variant="caption" tone="inkMuted" style={{ marginTop: 10, lineHeight: 17 }}>
            {t("gmailScreen.needsSendersBody")}
          </FText>
          <XStack mt={12}>
            <Pill tone="soft" label={t("gmailScreen.addSenders")} onPress={() => setEditing(true)} />
          </XStack>
        </>
      ) : null}

      {state !== "reconnect" && editing ? (
        <>
          <FText variant="caption" tone="inkMuted" style={{ marginTop: 14, marginBottom: 6 }}>
            {t("gmailScreen.senders")}
          </FText>
          <SendersField value={senders} onChange={setSenders} autoFocus={state === "needsSenders"} />
          <XStack mt={12} gap={8} items="center" flexWrap="wrap">
            {dirty ? (
              <Pill
                tone="solid"
                label={state === "needsSenders" ? t("gmail.activate") : t("gmailScreen.save")}
                pending={saveMutation.isPending}
                disabled={pending || senders.length === 0}
                onPress={() => saveMutation.mutate(senders)}
              />
            ) : null}
            {state === "active" ? (
              <Pill
                tone="soft"
                icon={<RefreshCw size={14} color="$brand" strokeWidth={2.2} />}
                label={syncMutation.isPending ? t("gmail.syncing") : t("gmail.sync")}
                pending={syncMutation.isPending}
                disabled={pending || dirty}
                onPress={() => syncMutation.mutate()}
              />
            ) : null}
            {dirty ? (
              <FText variant="caption" tone="inkFaint">
                {t("gmailScreen.unsaved")}
              </FText>
            ) : lastSync ? (
              <FText variant="caption" tone="inkFaint">
                <FText variant="caption" tone="inkMuted" style={{ ...textStyles["figure-caption"], fontSize: 12 }}>
                  {t("gmailScreen.lastSync", { processed: lastSync.processed, created: lastSync.created })}
                </FText>
              </FText>
            ) : null}
          </XStack>
        </>
      ) : null}
    </FintCard>
  );
}

/** Botón píldora de 36px: `soft` en `brandWash` con texto `brand`; `solid` en `brand`. */
function Pill({
  label,
  onPress,
  tone,
  icon,
  pending = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone: "soft" | "solid";
  icon?: React.ReactNode;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || pending}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: pending }}
    >
      <XStack
        height={36}
        px={14}
        gap={6}
        items="center"
        rounded={radius.pill}
        bg={tone === "soft" ? "$brandWash" : "$brand"}
        opacity={disabled && !pending ? 0.42 : 1}
      >
        {pending ? <FintSpinner color={tone === "soft" ? "$brand" : "$onBrand"} /> : icon}
        <FText variant="label" tone={tone === "soft" ? "brand" : "onBrand"} style={{ fontFamily: fontFace.sans[600] }}>
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}

/**
 * Remitentes como fichas en `mono` dentro de un recuadro hundido, con el campo
 * "Agregar" al final. Se agregan con Enter, coma o al salir del campo; si lo
 * escrito no es un correo, el mensaje va debajo y el texto se queda para
 * corregirlo.
 */
function SendersField({ value, onChange, autoFocus = false }: { value: string[]; onChange: (next: string[]) => void; autoFocus?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  const commit = (text = draft) => {
    if (!text.trim()) {
      setDraft("");
      return;
    }
    const result = addSenders(value, text);
    if ("error" in result) {
      setError(result.error === "invalid" ? t("gmailScreen.invalidSender") : t("gmailScreen.duplicateSender"));
      if (result.error === "duplicate") setDraft("");
      return;
    }
    haptics.select();
    onChange(result.senders);
    setDraft("");
    setError(null);
  };

  return (
    <YStack>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <XStack
          flexWrap="wrap"
          gap={6}
          p={8}
          minH={46}
          items="center"
          rounded={radius.md}
          bg={focused ? "$surface" : "$surfaceSunken"}
          borderWidth={focused || error ? 1.5 : 1}
          borderColor={error ? "$dangerHard" : focused ? "$brand" : themeMode === "dark" ? "$line" : "$surfaceSunken"}
        >
          {value.map((sender) => (
            <XStack
              key={sender}
              height={28}
              pl={10}
              pr={4}
              gap={2}
              items="center"
              rounded={radius.pill}
              bg="$surface"
              borderWidth={1}
              borderColor="$line"
            >
              <FText variant="caption" style={{ fontFamily: fontFace.mono[400], fontSize: 12 }}>
                {sender}
              </FText>
              <Pressable
                onPress={() => onChange(value.filter((s) => s !== sender))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("gmailScreen.removeSender", { sender })}
                style={{ padding: 4 }}
              >
                <X size={11} color="$inkFaint" strokeWidth={2.4} />
              </Pressable>
            </XStack>
          ))}
          <TextInput
            ref={input}
            value={draft}
            autoFocus={autoFocus}
            onChangeText={(text) => {
              setError(null);
              if (/[,;\n]$/.test(text)) commit(text.slice(0, -1));
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
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={value.length ? t("gmailScreen.addSender") : t("gmailScreen.senderPlaceholder")}
            placeholderTextColor={theme.inkFaint.val}
            selectionColor={theme.brand.val}
            accessibilityLabel={t("gmailScreen.senders")}
            style={{
              ...textStyles.label,
              fontFamily: fontFace.mono[400],
              fontSize: 13,
              color: theme.ink.val,
              minWidth: 120,
              flexGrow: 1,
              paddingVertical: 4,
              paddingHorizontal: 6,
            }}
          />
        </XStack>
      </Pressable>
      {error ? (
        <XStack items="center" gap={5} mx={2} mt={6} accessibilityRole="alert">
          <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
          <FText variant="caption" tone="dangerHard" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
            {error}
          </FText>
        </XStack>
      ) : null}
    </YStack>
  );
}

function CardsSkeleton() {
  return (
    <YStack gap={14} mt={14} px={space[4]}>
      {[0, 1].map((i) => (
        <View key={i} height={150} rounded={radius.lg} bg="$surfaceSunken" />
      ))}
    </YStack>
  );
}
