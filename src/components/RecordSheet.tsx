import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FileDown, Inbox, Mail, Settings, Tags } from "@tamagui/lucide-icons-2";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View, XStack, YStack } from "tamagui";
import { radius, space } from "../theme/tokens";
import { FintSheet, FText, ListRow, PressableScale } from "../ui";

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * La hoja del botón central: Egreso, Ingreso y Transferencia, en ese orden,
 * que es el de frecuencia real. Es siempre la misma hoja, desde cualquier tab.
 */
export function RecordSheet({ open, onClose }: SheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (type: "expense" | "income" | "transfer") => {
    onClose();
    router.push({ pathname: "/transaction-form", params: { type } });
  };

  return (
    <FintSheet open={open} onClose={onClose} title={t("home.record.title")}>
      <YStack px={space[4]} pt={space[4]} gap={space[2]}>
        <Option
          icon={<ArrowUpRight size={20} color="$ink" strokeWidth={1.8} />}
          title={t("home.record.expense")}
          hint={t("home.record.expenseHint")}
          onPress={() => go("expense")}
        />
        <Option
          icon={<ArrowDownLeft size={20} color="$flowIn" strokeWidth={1.8} />}
          title={t("home.record.income")}
          hint={t("home.record.incomeHint")}
          onPress={() => go("income")}
        />
        <Option
          icon={<ArrowLeftRight size={20} color="$inkMuted" strokeWidth={1.8} />}
          title={t("home.record.transfer")}
          hint={t("home.record.transferHint")}
          onPress={() => go("transfer")}
        />
      </YStack>
    </FintSheet>
  );
}

function Option({ icon, title, hint, onPress }: { icon: ReactNode; title: string; hint: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`}>
      <XStack items="center" gap={space[3]} p={space[3]} rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line">
        <View width={40} height={40} rounded={radius.md} bg="$surfaceSunken" items="center" justify="center">
          {icon}
        </View>
        <YStack flex={1} minW={0}>
          <FText variant="body-strong">{title}</FText>
          <FText variant="caption" tone="inkFaint" numberOfLines={1}>
            {hint}
          </FText>
        </YStack>
      </XStack>
    </PressableScale>
  );
}

/** La acción "Más" del hero: lo que se usa de vez en cuando. */
export function MoreSheet({ open, onClose }: SheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (href: Href) => {
    onClose();
    router.push(href);
  };
  const items: { icon: ReactNode; label: string; href: Href }[] = [
    { icon: <ArrowLeftRight size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.transfer"), href: { pathname: "/transaction-form", params: { type: "transfer" } } },
    { icon: <Inbox size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.pending"), href: "/pending-movements" },
    { icon: <Tags size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.categories"), href: "/categories" },
    { icon: <FileDown size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.import"), href: "/import-transactions" },
    { icon: <Mail size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.gmail"), href: "/gmail-settings" },
    { icon: <Settings size={18} color="$inkMuted" strokeWidth={1.8} />, label: t("home.more.settings"), href: "/settings" },
  ];

  return (
    <FintSheet open={open} onClose={onClose} title={t("home.more.title")}>
      <YStack mx={space[4]} mt={space[4]} rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
        {items.map((item, i) => (
          <ListRow
            key={item.label}
            divider={i > 0}
            title={item.label}
            leading={
              <View width={32} height={32} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
                {item.icon}
              </View>
            }
            onPress={() => go(item.href)}
          />
        ))}
      </YStack>
    </FintSheet>
  );
}
