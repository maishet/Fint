import type { ReactNode } from 'react'
import { Alert, Image, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  FileText,
  Globe2,
  HelpCircle,
  Languages,
  Landmark,
  LogOut,
  Mail,
  MonitorSmartphone,
  Moon,
  ShieldCheck,
  Sun,
  Tags,
  UserRound,
} from '@tamagui/lucide-icons-2'
import { Paragraph, Separator, XStack, YStack } from 'tamagui'
import { useAuth } from '../src/auth/AuthProvider'
import { Screen } from '../src/components/Screen'
import { changeAppLanguage, type AppLanguage } from '../src/i18n'
import { getSupportDiagnostics } from '../src/support/diagnostics'
import { useThemeMode } from '../src/theme/ThemeMode'
import { FintButton, FintCard, FintSheetSelect } from '../src/ui'

const copy = {
  es: {
    profile: 'Mi perfil', editProfile: 'Editar nombre y consultar los datos de tu cuenta', configuration: 'Configuración', language: 'Idioma', appearance: 'Apariencia', light: 'Claro', dark: 'Oscuro', system: 'Según el dispositivo', financialAccounts: 'Mis cuentas financieras', categories: 'Mis categorías', gmail: 'Cuentas Gmail', gmailDetail: 'Conexión, remitentes y sincronización', contact: 'Ayuda', help: 'Reportar un problema', suggestion: 'Solicitar una mejora', legal: 'Legal', privacy: 'Política de privacidad', privacyDetail: 'Cómo protegemos y utilizamos tus datos', terms: 'Términos y condiciones', termsDetail: 'Reglas y condiciones de uso de Fint', legalUnavailable: 'Este documento aún no tiene una URL pública configurada.', session: 'Cuenta', signOut: 'Cerrar sesión', version: 'Versión', accountHint: 'Tu información y conexiones en un solo lugar',
  },
  en: {
    profile: 'My profile', editProfile: 'Edit your name and review account details', configuration: 'Settings', language: 'Language', appearance: 'Appearance', light: 'Light', dark: 'Dark', system: 'Use device setting', financialAccounts: 'My financial accounts', categories: 'My categories', gmail: 'Gmail accounts', gmailDetail: 'Connection, senders, and sync', contact: 'Help', help: 'Report a problem', suggestion: 'Request an improvement', legal: 'Legal', privacy: 'Privacy policy', privacyDetail: 'How we protect and use your data', terms: 'Terms and conditions', termsDetail: 'Rules and conditions for using Fint', legalUnavailable: 'This document does not have a public URL configured yet.', session: 'Account', signOut: 'Sign out', version: 'Version', accountHint: 'Your information and connections in one place',
  },
  pt: {
    profile: 'Meu perfil', editProfile: 'Edite o nome e consulte os dados da sua conta', configuration: 'Configurações', language: 'Idioma', appearance: 'Aparência', light: 'Claro', dark: 'Escuro', system: 'Conforme o dispositivo', financialAccounts: 'Minhas contas financeiras', categories: 'Minhas categorias', gmail: 'Contas Gmail', gmailDetail: 'Conexão, remetentes e sincronização', contact: 'Ajuda', help: 'Relatar um problema', suggestion: 'Sugerir uma melhoria', legal: 'Legal', privacy: 'Política de privacidade', privacyDetail: 'Como protegemos e utilizamos seus dados', terms: 'Termos e condições', termsDetail: 'Regras e condições de uso da Fint', legalUnavailable: 'Este documento ainda não possui uma URL pública configurada.', session: 'Conta', signOut: 'Sair', version: 'Versão', accountHint: 'Suas informações e conexões em um só lugar',
  },
}

export default function SettingsScreen() {
  const { i18n } = useTranslation()
  const language = (i18n.resolvedLanguage === 'en' || i18n.resolvedLanguage === 'pt' ? i18n.resolvedLanguage : 'es') as AppLanguage
  const text = copy[language]
  const { session, signOut } = useAuth()
  const { themeMode, themePreference, setThemePreference } = useThemeMode()
  const router = useRouter()
  const diagnostics = getSupportDiagnostics()
  const metadata = session?.user.user_metadata ?? {}
  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name : typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : session?.user.email ?? 'Fint'
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : typeof metadata.picture === 'string' ? metadata.picture : null
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL
  const openLegal = (url?: string) => {
    if (!url) {
      Alert.alert(text.legal, text.legalUnavailable)
      return
    }
    void Linking.openURL(url)
  }

  return (
    <Screen>
      <FintCard p={0} overflow="hidden">
        <SettingsRow
          icon={avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} /> : <IconBubble><UserRound size={21} color="$primary" /></IconBubble>}
          label={displayName}
          detail={session?.user.email ?? text.editProfile}
          onPress={() => router.push('/profile')}
          tall
        />
      </FintCard>

      <SettingsGroup title={text.configuration}>
        <FintSheetSelect
          label={text.language}
          placeholder={text.language}
          value={language}
          options={[{ value: 'es', label: 'Español', icon: <Paragraph fontSize="$5">🇪🇸</Paragraph> }, { value: 'en', label: 'English', icon: <Paragraph fontSize="$5">🇺🇸</Paragraph> }, { value: 'pt', label: 'Português', icon: <Paragraph fontSize="$5">🇧🇷</Paragraph> }]}
          onValueChange={(value) => { void changeAppLanguage(value as AppLanguage) }}
          renderTrigger={({ onPress, selectedLabel }) => <SettingsRow icon={<Languages size={19} color="$primary" />} label={text.language} value={selectedLabel} onPress={onPress} />}
        />
        <FintSheetSelect
          label={text.appearance}
          placeholder={text.appearance}
          value={themePreference}
          options={[{ value: 'system', label: text.system, icon: <MonitorSmartphone size={19} color="$primary" /> }, { value: 'light', label: text.light, icon: <Sun size={19} color="$primary" /> }, { value: 'dark', label: text.dark, icon: <Moon size={19} color="$primary" /> }]}
          onValueChange={(value) => setThemePreference(value as 'system' | 'light' | 'dark')}
          renderTrigger={({ onPress, selectedLabel }) => <SettingsRow icon={themePreference === 'system' ? <MonitorSmartphone size={19} color="$primary" /> : themeMode === 'dark' ? <Moon size={19} color="$primary" /> : <Sun size={19} color="$primary" />} label={text.appearance} value={selectedLabel} onPress={onPress} />}
        />
        <SettingsRow icon={<Landmark size={19} color="$primary" />} label={text.financialAccounts} onPress={() => router.push('/(tabs)/accounts')} />
        <SettingsRow icon={<Tags size={19} color="$primary" />} label={text.categories} onPress={() => router.push('/categories')} />
        <SettingsRow icon={<Mail size={19} color="$primary" />} label={text.gmail} detail={text.gmailDetail} onPress={() => router.push('/gmail-settings')} />
      </SettingsGroup>

      <SettingsGroup title={text.contact}>
        <SettingsRow icon={<HelpCircle size={19} color="$primary" />} label={text.help} onPress={() => router.push('/support')} />
        <SettingsRow icon={<Globe2 size={19} color="$primary" />} label={text.suggestion} onPress={() => router.push('/support')} />
      </SettingsGroup>

      <SettingsGroup title={text.legal}>
        <SettingsRow icon={<ShieldCheck size={19} color="$primary" />} label={text.privacy} detail={text.privacyDetail} onPress={() => openLegal(privacyUrl)} />
        <SettingsRow icon={<FileText size={19} color="$primary" />} label={text.terms} detail={text.termsDetail} onPress={() => openLegal(termsUrl)} />
      </SettingsGroup>

      <YStack gap="$2">
        <Paragraph color="$color9" fontSize="$1" fontWeight="800" textTransform="uppercase">{text.session}</Paragraph>
        <FintButton variant="outlined" color="$red10" borderColor="$red6" icon={<LogOut size={18} color="$red10" />} onPress={() => { void signOut() }}>{text.signOut}</FintButton>
      </YStack>

      <XStack justify="center"><Paragraph color="$color9" fontSize="$1">{text.version} {diagnostics.appVersion} · Build {diagnostics.buildNumber}</Paragraph></XStack>
    </Screen>
  )
}

function SettingsGroup({ children, title }: { children: ReactNode; title: string }) {
  const items = Array.isArray(children) ? children : [children]
  return (
    <YStack gap="$2">
      <Paragraph color="$color9" fontSize="$1" fontWeight="800" textTransform="uppercase">{title}</Paragraph>
      <FintCard p={0} overflow="hidden">
        {items.map((item, index) => <YStack key={index}>{index > 0 ? <Separator ml={52} /> : null}{item}</YStack>)}
      </FintCard>
    </YStack>
  )
}

function SettingsRow({ detail, icon, label, onPress, tall = false, value }: { detail?: string; icon: ReactNode; label: string; onPress: () => void; tall?: boolean; value?: string }) {
  return (
    <XStack minH={tall ? 82 : 58} px="$4" py="$3" items="center" gap="$3" pressStyle={{ bg: '$color3' }} onPress={onPress}>
      {icon}
      <YStack flex={1} minW={0} gap={detail ? '$1' : 0}>
        <Paragraph color="$color12" fontSize={tall ? '$4' : '$3'} fontWeight="700" numberOfLines={1}>{label}</Paragraph>
        {detail ? <Paragraph color="$color9" fontSize="$1" numberOfLines={1}>{detail}</Paragraph> : null}
      </YStack>
      {value ? <Paragraph color="$color9" fontSize="$2">{value}</Paragraph> : null}
      <ChevronRight size={18} color="$color8" />
    </XStack>
  )
}

function IconBubble({ children }: { children: ReactNode }) {
  return <YStack width={48} height={48} rounded="$10" bg="$secondary" items="center" justify="center">{children}</YStack>
}
