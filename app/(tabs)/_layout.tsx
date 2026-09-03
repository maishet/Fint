import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "tamagui";
import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  Home,
  Wallet,
} from "@tamagui/lucide-icons-2";
import { AppHeader } from "../../src/components/AppHeader";
import { FintTabBar } from "../../src/components/FintTabBar";

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      // La barra flotante la dibuja FintTabBar; el haptico lo da ella al tocar.
      tabBar={(props) => <FintTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: theme.tabActive.val,
        tabBarInactiveTintColor: theme.tabInactive.val,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background.val,
          borderBottomColor: theme.borderColor.val,
        },
        headerTintColor: theme.color.val,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabs.dashboard"),
          header: () => <AppHeader title={t("tabs.dashboard")} showGreeting />,
          tabBarIcon: ({ color, size }) => <Home color={color as any} size={size} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: t("tabs.accounts"),
          header: () => <AppHeader title={t("tabs.accounts")} />,
          tabBarIcon: ({ color, size }) => <Wallet color={color as any} size={size} />,
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: t("tabs.payments"),
          header: () => <AppHeader title={t("tabs.payments")} />,
          tabBarIcon: ({ color, size }) => <CreditCard color={color as any} size={size} />,
        }}
      />
      <Tabs.Screen
        name="movements"
        options={{
          title: t("tabs.movements"),
          header: () => <AppHeader title={t("tabs.movements")} />,
          tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color as any} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tabs.reports"),
          header: () => <AppHeader title={t("tabs.reports")} />,
          tabBarIcon: ({ color, size }) => <BarChart3 color={color as any} size={size} />,
        }}
      />
    </Tabs>
  );
}
