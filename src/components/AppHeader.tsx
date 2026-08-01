import { useRouter } from 'expo-router'
import { Image, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Paragraph, XStack, YStack } from 'tamagui'
import { useAuth } from '../auth/AuthProvider'

interface AppHeaderProps {
  showGreeting?: boolean
  title: string
}

export function AppHeader({ showGreeting = false, title }: AppHeaderProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const router = useRouter()
  const metadata = session?.user.user_metadata ?? {}
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : typeof metadata.picture === 'string' ? metadata.picture : null
  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name : typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : session?.user.email
  const firstName = displayName?.split(' ')[0] || 'Fint'
  const initial = displayName?.slice(0, 1).toUpperCase() || 'F'
  const heading = showGreeting ? t(`header.${getGreetingKey()}`, { name: firstName }) : title

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      <XStack bg="$card" borderBottomColor="$borderColor" borderBottomWidth={1} px="$4" py="$3" items="center" justify="space-between" gap="$3">
        <XStack items="center" gap="$3" flex={1} minW={0}>
          <YStack width={38} height={38} rounded="$8" overflow="hidden" bg="$accent9">
            <Image source={require('../../assets/images/icon.png')} style={{ width: 38, height: 38 }} resizeMode="cover" />
          </YStack>
          <YStack flex={1} minW={0}>
            <Paragraph color="$color9" fontSize="$1" fontWeight="800">Fint</Paragraph>
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800" lineHeight="$5" numberOfLines={1}>{heading}</Paragraph>
          </YStack>
        </XStack>

        <YStack
          width={40}
          height={40}
          rounded={999}
          overflow="hidden"
          bg="$accent3"
          borderColor="$accent6"
          borderWidth={1}
          items="center"
          justify="center"
          pressStyle={{ bg: '$accent4' }}
          onPress={() => router.push('/settings')}
          aria-label={t('header.menuTitle')}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 40, height: 40, borderRadius: 999 }}
              resizeMode="cover"
              accessibilityLabel={displayName ?? undefined}
            />
          ) : (
            <Text style={{ color: '#0F505A', fontFamily: 'InterBold', fontSize: 16, fontWeight: '700', includeFontPadding: false, lineHeight: 40, textAlign: 'center', textAlignVertical: 'center', width: 40 }}>{initial}</Text>
          )}
        </YStack>
      </XStack>

    </SafeAreaView>
  )
}

function getGreetingKey() {
  const hour = new Date().getHours()
  if (hour < 12) return 'goodMorning'
  if (hour < 19) return 'goodAfternoon'
  return 'goodEvening'
}
