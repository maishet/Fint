import { useState } from 'react'
import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { HelpCircle, Lightbulb, Send } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Paragraph, XStack, YStack } from 'tamagui'
import { buildSupportMailto } from '../src/support/diagnostics'
import { trackAnalyticsEvent } from '../src/analytics/privacy'
import { Screen } from '../src/components/Screen'
import { FintButton, FintCard, FintInput, FintSheetSelect } from '../src/ui'

const copy = {
  es: { title: 'Ayuda y soporte', subtitle: 'Reporta incidentes sin compartir datos financieros.', category: 'Categoría', description: '¿Qué ocurrió?', steps: 'Pasos para reproducirlo, si es posible', required: 'Agrega una descripción', submit: 'Reportar un problema', improvement: 'Solicitar una mejora', improvementHint: 'Elige “Sugerencia de mejora” como categoría y describe el valor esperado.', login: 'Inicio de sesión: verifica la confirmación del correo y tus credenciales.', gmail: 'Gmail: vuelve a conectar la cuenta si Google revocó el acceso.', duplicates: 'Movimientos duplicados: revisa los pendientes de Gmail antes de confirmarlos.', categories: ['Inicio de sesión o cuenta', 'Cuentas y saldos', 'Movimientos o categorías', 'Deudas y pagos', 'Conexión o sincronización Gmail', 'Rendimiento o cierre inesperado', 'Privacidad y eliminación de datos', 'Sugerencia de mejora'] },
  en: { title: 'Help and support', subtitle: 'Report incidents without sharing financial data.', category: 'Category', description: 'What happened?', steps: 'Steps to reproduce, if possible', required: 'Add a description', submit: 'Report a problem', improvement: 'Request an improvement', improvementHint: 'Choose “Suggestion” as the category and describe the expected value.', login: 'Sign in: verify email confirmation and credentials.', gmail: 'Gmail: reconnect the account if Google revoked access.', duplicates: 'Duplicate movements: review pending Gmail detections before confirming.', categories: ['Sign in or account', 'Accounts and balances', 'Movements or categories', 'Debts and payments', 'Gmail connection or sync', 'Performance or unexpected close', 'Privacy and data deletion', 'Improvement suggestion'] },
  pt: { title: 'Ajuda e suporte', subtitle: 'Relate problemas sem compartilhar dados financeiros.', category: 'Categoria', description: 'O que aconteceu?', steps: 'Passos para reproduzir, se possível', required: 'Adicione uma descrição', submit: 'Relatar um problema', improvement: 'Sugerir uma melhoria', improvementHint: 'Escolha “Sugestão de melhoria” como categoria e descreva o resultado esperado.', login: 'Login: verifique a confirmação do e-mail e suas credenciais.', gmail: 'Gmail: reconecte a conta se o Google revogou o acesso.', duplicates: 'Movimentações duplicadas: revise as pendências do Gmail antes de confirmar.', categories: ['Login ou conta', 'Contas e saldos', 'Movimentações ou categorias', 'Dívidas e pagamentos', 'Conexão ou sincronização Gmail', 'Desempenho ou fechamento inesperado', 'Privacidade e exclusão de dados', 'Sugestão de melhoria'] },
}

export default function SupportScreen() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage === 'en' || i18n.resolvedLanguage === 'pt' ? i18n.resolvedLanguage : 'es'
  const text = copy[language]
  const toast = useToastController()
  const [category, setCategory] = useState(text.categories[0])
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')

  const submit = async () => {
    if (!description.trim()) {
      toast.show(text.required, { preset: 'error' })
      return
    }
    await trackAnalyticsEvent('support_report_submitted', { category })
    await Linking.openURL(buildSupportMailto({ category, description, steps, includeDiagnostics: false }))
  }

  return (
    <Screen>
      <FintCard bg="#0F5D73" borderColor="#28788C" gap="$3"><XStack gap="$3" items="center"><YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" items="center" justify="center"><HelpCircle size={24} color="#5DD6E5" /></YStack><YStack flex={1}><Paragraph color="#F4FBFD" fontFamily="$heading" fontSize="$6" fontWeight="800">{text.title}</Paragraph><Paragraph color="#B9D7E1">{text.subtitle}</Paragraph></YStack></XStack></FintCard>
      <FintSheetSelect label={text.category} placeholder={text.category} value={category} options={text.categories.map((item) => ({ value: item, label: item }))} onValueChange={(value) => { setCategory(value); void trackAnalyticsEvent('support_report_started', { category: value }) }} />
      <FintInput multiline minH={110} textAlignVertical="top" placeholder={text.description} value={description} onChangeText={setDescription} />
      <FintInput multiline minH={90} textAlignVertical="top" placeholder={text.steps} value={steps} onChangeText={setSteps} />
      <FintButton icon={<Send size={16} />} onPress={submit}>{text.submit}</FintButton>
      <FintCard gap="$2"><XStack gap="$2" items="center"><Lightbulb size={18} color="$primary" /><Paragraph color="$color12" fontWeight="800">{text.improvement}</Paragraph></XStack><Paragraph color="$color10">{text.improvementHint}</Paragraph></FintCard>
      <FintCard gap="$2"><Paragraph color="$color12" fontWeight="800">FAQ</Paragraph><Paragraph color="$color10">{text.login}</Paragraph><Paragraph color="$color10">{text.gmail}</Paragraph><Paragraph color="$color10">{text.duplicates}</Paragraph></FintCard>
    </Screen>
  )
}
