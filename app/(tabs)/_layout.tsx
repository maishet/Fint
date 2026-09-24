import { Tabs } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "tamagui";
import { ArrowLeftRight, ChartColumn, CreditCard, House } from "@tamagui/lucide-icons-2";
import { AppHeader } from "../../src/components/AppHeader";
import { FintTabBar } from "../../src/components/FintTabBar";
import { RecordSheet } from "../../src/components/RecordSheet";

/**
 * Cuatro tabs y un botón central que abre la hoja de registro. Registrar es lo
 * único que se hace varias veces al día, así que es lo único con botón propio.
 * Cuentas dejó de ser un tab: se abre desde el saldo del Inicio.
 */
export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [recordOpen, setRecordOpen] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <FintTabBar {...props} centerAction={{ label: t("home.record.fab"), onPress: () => setRecordOpen(true) }} />
        )}
        screenOptions={{
          tabBarActiveTintColor: theme.brand.val,
          tabBarInactiveTintColor: theme.inkFaint.val,
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.background.val,
            borderBottomColor: theme.borderColor.val,
          },
          headerTintColor: theme.color.val,
          animation: "fade",
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t("tabs.dashboard"),
            // El hero dibuja su propia barra con avatar, buscador y campana.
            headerShown: false,
            tabBarIcon: ({ color, size }) => <House color={color as any} size={size} />,
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
          name="debts"
          options={{
            title: t("tabs.payments"),
            header: () => <AppHeader title={t("tabs.payments")} />,
            tabBarIcon: ({ color, size }) => <CreditCard color={color as any} size={size} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t("tabs.reports"),
            header: () => <AppHeader title={t("tabs.reports")} />,
            tabBarIcon: ({ color, size }) => <ChartColumn color={color as any} size={size} />,
          }}
        />
      </Tabs>
      <RecordSheet open={recordOpen} onClose={() => setRecordOpen(false)} />
    </>
  );
}
