import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, RefreshCw, Save, Trash2 } from "@tamagui/lucide-icons-2";
import { useNotify } from "../src/ui/notify";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Paragraph, XStack, YStack } from "tamagui";
import { z } from "zod";
import { financeApi } from "../src/api/finance";
import type { GmailSource } from "../src/api/types";
import {
  GMAIL_READONLY_SCOPE,
  GOOGLE_SIGNIN_BASE_CONFIG,
} from "../src/auth/googleSignIn";
import { DataStateCard } from "../src/components/DataStateCard";
import { Screen } from "../src/components/Screen";
import { SkeletonBlock, SkeletonGroup } from "../src/components/Skeleton";
import { getValidationMessage, useSubmitValidation } from "../src/forms";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintFormField,
  FintInput,
  FintSpinner,
} from "../src/ui";

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

export default function GmailSettingsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useNotify();
  const sourcesQuery = useQuery({
    queryKey: ["gmail-sources"],
    queryFn: financeApi.listGmailSources,  });
  const connectMutation = useMutation({
    mutationFn: connectGmailNative,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gmail-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ]);
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : undefined;
      toast.error(t("states.error"), {
        message: t("gmail.connectError"),
        detail,
        detailLabel: detail ? t("actions.viewDetail") : undefined,
      });
    },
  });
  const connect = () => connectMutation.mutate();
  const visibleSources = (sourcesQuery.data ?? []).filter(
    (source) => source.status === "active" || source.status === "error",
  );

  return (
    <Screen
      isRefreshing={sourcesQuery.isRefetching}
      onRefresh={() => sourcesQuery.refetch()}
    >
      <FintCard bg="$heroBackground" borderColor="$heroBorder" gap="$3">
        <XStack items="center" gap="$3">
          <YStack
            width={48}
            height={48}
            rounded="$10"
            bg="rgba(93,214,229,0.14)"
            borderColor="rgba(93,214,229,0.24)"
            borderWidth={1}
            items="center"
            justify="center"
          >
            <Mail size={24} color="$heroAccent" />
          </YStack>
          <YStack flex={1}>
            <Paragraph
              color="$heroForeground"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="800"
            >
              {t("gmail.title")}
            </Paragraph>
            <Paragraph color="$heroMuted">{t("gmail.description")}</Paragraph>
          </YStack>
        </XStack>
        <FintButton
          disabled={
            connectMutation.isPending ||
            visibleSources.filter((source) => source.status === "active")
              .length >= 3
          }
          icon={
            connectMutation.isPending ? (
              <FintSpinner color="$primaryForeground" />
            ) : (
              <Plus size={18} />
            )
          }
          onPress={connect}
        >
          {t("gmail.connect")}
        </FintButton>
      </FintCard>
      {sourcesQuery.isLoading ? (
        <GmailSourcesSkeleton label={t("states.loading")} />
      ) : null}
      {sourcesQuery.error ? (
        <DataStateCard
          message={
            sourcesQuery.error instanceof Error
              ? sourcesQuery.error.message
              : t("states.error")
          }
          onRetry={() => {
            void sourcesQuery.refetch();
          }}
        />
      ) : null}
      {visibleSources.map((source) => (
        <GmailSourceCard
          key={source.id}
          source={source}
          onReconnect={connect}
        />
      ))}
      {!sourcesQuery.isLoading && visibleSources.length === 0 ? (
        <DataStateCard message={t("gmail.empty")} />
      ) : null}
    </Screen>
  );
}

function GmailSourcesSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label}>
      {[0, 1].map((item) => (
        <FintCard key={item} gap="$4">
          <XStack items="center" gap="$3">
            <SkeletonBlock height={40} rounded="$9" width={40} />
            <YStack flex={1} gap="$2">
              <SkeletonBlock height={14} width="62%" />
              <SkeletonBlock height={10} width="44%" />
            </YStack>
          </XStack>
          <YStack gap="$2">
            <SkeletonBlock height={11} width="34%" />
            <SkeletonBlock height={9} width="72%" />
            <SkeletonBlock height={88} rounded="$5" />
          </YStack>
          <XStack gap="$2">
            <SkeletonBlock flex={1} height={44} rounded="$6" />
            <SkeletonBlock flex={1} height={44} rounded="$6" />
          </XStack>
          <SkeletonBlock height={44} rounded="$6" />
        </FintCard>
      ))}
    </SkeletonGroup>
  );
}

function GmailSourceCard({
  onReconnect,
  source,
}: {
  onReconnect: () => void;
  source: GmailSource;
}) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useNotify();
  const [senders, setSenders] = useState(source.senderFilters.join(", "));
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const validation = useSubmitValidation<"senders">();
  const senderFilterSchema = z.object({
    senders: z
      .string()
      .refine(
        (value) =>
          parseSenderFilters(value).every(
            (token) => z.string().email().safeParse(token).success,
          ),
        getValidationMessage(t, i18n.resolvedLanguage, "senderEmails"),
      ),
  });
  const syncMutation = useMutation({
    mutationFn: () => financeApi.syncGmailSource(source.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
      queryClient.invalidateQueries({
        queryKey: ["pending-movements", "summary"],
      });
      queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
      toast.show(t("gmail.syncComplete"), {
        message: t("gmail.syncSummary", {
          processed: result.processed,
          created: result.created,
        }),
        preset: "success",
      });
    },
  });
  const saveMutation = useMutation({
    mutationFn: (senderFilters: string[]) =>
      financeApi.updateGmailSource(source.id, {
        labelIds: ["INBOX"],
        senderFilters,
      }),
    onSuccess: () => {
      setSaveErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
      toast.show(t("gmail.filterSaved"), { preset: "success" });
    },
    onError: (error) =>
      setSaveErrorMessage(
        error instanceof Error ? error.message : t("states.error"),
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: () => financeApi.disconnectGmailSource(source.id),
    onSuccess: () => {
      setDisconnectOpen(false);
      queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.show(t("gmail.disconnected"), { preset: "success" });
    },
    onError: (error) =>
      toast.show(t("gmail.disconnectError"), {
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      }),
  });
  const pending =
    syncMutation.isPending ||
    saveMutation.isPending ||
    deleteMutation.isPending;
  const saveFilters = () => {
    setSaveErrorMessage(null);
    const payload = validation.validate(senderFilterSchema, { senders });
    if (payload) saveMutation.mutate(parseSenderFilters(payload.senders));
  };

  return (
    <>
      <FintCard gap="$4">
        <XStack items="center" gap="$3">
          <YStack
            width={40}
            height={40}
            rounded="$9"
            bg="$secondary"
            items="center"
            justify="center"
          >
            <Mail size={20} color="$primary" />
          </YStack>
          <YStack flex={1}>
            <Paragraph color="$color12" fontWeight="800">
              {source.emailAddress}
            </Paragraph>
            <Paragraph color="$color10" fontSize="$1">
              {source.lastSyncAt
                ? t("gmail.lastSync", {
                    date: new Date(source.lastSyncAt).toLocaleString(),
                  })
                : t("gmail.notSynced")}
            </Paragraph>
          </YStack>
        </XStack>
        {source.status === "error" ? (
          <YStack
            bg="$red2"
            borderColor="$red6"
            borderWidth={1}
            rounded="$5"
            p="$3"
            gap="$2"
          >
            <Paragraph color="$red11" fontWeight="700">
              {t("gmail.reconnectRequired")}
            </Paragraph>
            <FintButton
              size="$3"
              variant="outlined"
              color="$red10"
              borderColor="$red6"
              onPress={onReconnect}
            >
              {t("gmail.reconnect")}
            </FintButton>
          </YStack>
        ) : null}
        <FintFormField
          label={t("gmail.senders")}
          error={validation.errors.senders}
          hint={
            <Paragraph color="$color10" fontSize="$1">
              {t("gmail.sendersHelp")}
            </Paragraph>
          }
        >
          <FintInput
            borderColor={validation.errors.senders ? "$red8" : undefined}
            multiline
            minH={88}
            textAlignVertical="top"
            placeholder={t("gmail.sendersPlaceholder")}
            value={senders}
            onChangeText={(value) => {
              setSenders(value);
              validation.clearError("senders");
            }}
          />
        </FintFormField>
        <XStack gap="$2">
          <FintButton
            flex={1}
            variant="outlined"
            disabled={pending || source.status === "error"}
            icon={
              syncMutation.isPending ? (
                <FintSpinner size="small" color="$primary" />
              ) : (
                <RefreshCw size={16} />
              )
            }
            onPress={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? t("gmail.syncing") : t("gmail.sync")}
          </FintButton>
          <FintButton
            flex={1}
            disabled={pending || source.status === "error"}
            icon={<Save size={16} />}
            onPress={saveFilters}
          >
            {t("actions.save")}
          </FintButton>
        </XStack>
        {saveErrorMessage ? (
          <Paragraph color="$red10">{saveErrorMessage}</Paragraph>
        ) : null}
        <FintButton
          variant="outlined"
          color="$red10"
          borderColor="$red6"
          disabled={pending}
          icon={<Trash2 size={16} />}
          onPress={() => setDisconnectOpen(true)}
        >
          {t("gmail.disconnect")}
        </FintButton>
      </FintCard>
      <FintConfirmDialog
        open={disconnectOpen}
        isPending={deleteMutation.isPending}
        title={t("gmail.disconnect")}
        description={t("gmail.disconnectConfirm")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("gmail.disconnect")}
        destructive
        icon={<Trash2 size={17} color="$primaryForeground" />}
        onCancel={() => setDisconnectOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

function parseSenderFilters(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}
