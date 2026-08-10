import * as Sentry from '@sentry/react-native'
import { Redirect } from 'expo-router'
import { Alert } from 'react-native'
import { Paragraph, YStack } from 'tamagui'
import { FintButton, FintCard } from '../src/ui'

export default function SentryTestScreen() {
  if (process.env.EXPO_PUBLIC_ENABLE_SENTRY_TESTS !== 'true') return <Redirect href="/" />

  const sendControlledEvent = async () => {
    Sentry.captureException(new Error('My Fint controlled Sentry mobile validation'), {
      tags: { operation: 'sentry_controlled_mobile_validation' },
      extra: {
        safe: 'This event validates sanitization.',
        email: 'qa@example.com',
        amount: 1234.56,
        accountName: 'Cuenta QA',
        token: 'Bearer controlled-secret',
        requestUrl: 'https://finanzas-api-ansq.onrender.com/api/me?token=controlled-secret&email=qa@example.com',
      },
    })
    await Sentry.flush()
    Alert.alert('Sentry', 'Evento controlado enviado. Revisa operation=sentry_controlled_mobile_validation.')
  }

  return (
    <YStack flex={1} bg="$background" justify="center" p="$5">
      <FintCard gap="$4">
        <YStack gap="$2">
          <Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="800">Sentry validation</Paragraph>
          <Paragraph color="$color10">Esta pantalla solo debe habilitarse en preview para validar sanitizacion y source maps.</Paragraph>
        </YStack>
        <FintButton onPress={sendControlledEvent}>Enviar evento controlado</FintButton>
      </FintCard>
    </YStack>
  )
}
