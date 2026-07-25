import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'tamagui'
import { ArrowLeftRight, BarChart3, CreditCard, Home, Wallet } from '@tamagui/lucide-icons-2'
import { AppHeader } from '../../src/components/AppHeader'

export default function TabLayout() {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary.val,
        tabBarInactiveTintColor: theme.color10.val,
        headerShown: true,
        tabBarStyle: {
          backgroundColor: theme.card.val,
          borderTopColor: theme.borderColor.val,
        },
        tabBarLabelStyle: {
          fontFamily: 'InterSemiBold',
          fontSize: 11,
        },
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
          title: t('tabs.dashboard'),
          header: () => <AppHeader title={t('tabs.dashboard')} />,
          tabBarIcon: ({ color }) => <Home color={color as any} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: t('tabs.accounts'),
          header: () => <AppHeader title={t('tabs.accounts')} />,
          tabBarIcon: ({ color }) => <Wallet color={color as any} />,
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: t('tabs.debts'),
          header: () => <AppHeader title={t('tabs.debts')} />,
          tabBarIcon: ({ color }) => <CreditCard color={color as any} />,
        }}
      />
      <Tabs.Screen
        name="movements"
        options={{
          title: t('tabs.movements'),
          header: () => <AppHeader title={t('tabs.movements')} />,
          tabBarIcon: ({ color }) => <ArrowLeftRight color={color as any} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('tabs.reports', { defaultValue: 'Reportes' }),
          header: () => <AppHeader title={t('tabs.reports', { defaultValue: 'Reportes' })} />,
          tabBarIcon: ({ color }) => <BarChart3 color={color as any} />,
        }}
      />
    </Tabs>
  )
}
