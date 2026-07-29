import { useState } from 'react'
import { Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Mail, Save, UserRound } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useTranslation } from 'react-i18next'
import { Paragraph, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { useAuth } from '../src/auth/AuthProvider'
import { Screen } from '../src/components/Screen'
import { FormTextField } from '../src/components/MovementFormControls'
import { useSubmitValidation } from '../src/forms'
import { FintButton, FintCard } from '../src/ui'

export default function ProfileScreen() {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const language = i18n.resolvedLanguage === 'en' || i18n.resolvedLanguage === 'pt' ? i18n.resolvedLanguage : 'es'
  const text = {
    es: { profile: 'Tu perfil', name: 'Nombre', namePlaceholder: 'Tu nombre', save: 'Guardar nombre', saving: 'Guardando...', email: 'Correo', auth: 'Los cambios de autenticación se gestionan con tu proveedor de acceso.', invalid: 'El nombre debe tener entre 2 y 80 caracteres.', error: 'No pudimos actualizar tu nombre.', success: 'Perfil actualizado.' },
    en: { profile: 'Your profile', name: 'Name', namePlaceholder: 'Your name', save: 'Save name', saving: 'Saving...', email: 'Email', auth: 'Authentication changes are managed through your sign-in provider.', invalid: 'The name must contain between 2 and 80 characters.', error: 'We could not update your name.', success: 'Profile updated.' },
    pt: { profile: 'Seu perfil', name: 'Nome', namePlaceholder: 'Seu nome', save: 'Salvar nome', saving: 'Salvando...', email: 'E-mail', auth: 'As alterações de autenticação são gerenciadas pelo seu provedor de acesso.', invalid: 'O nome deve ter entre 2 e 80 caracteres.', error: 'Não foi possível atualizar seu nome.', success: 'Perfil atualizado.' },
  }[language]
  const { session, updateDisplayName } = useAuth()
  const toast = useToastController()
  const metadata = session?.user.user_metadata ?? {}
  const currentName = typeof metadata.display_name === 'string' ? metadata.display_name : typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : ''
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : typeof metadata.picture === 'string' ? metadata.picture : null
  const [displayName, setDisplayName] = useState(currentName)
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const validation = useSubmitValidation<'displayName'>()

  const save = async () => {
    setServerError(null)
    const schema = z.object({ displayName: z.string().trim().min(2, t('validation.profileName', { defaultValue: text.invalid })).max(80, t('validation.profileName', { defaultValue: text.invalid })) })
    const payload = validation.validate(schema, { displayName })
    if (!payload || payload.displayName === currentName.trim()) return
    setIsSaving(true)
    const { error } = await updateDisplayName(payload.displayName)
    setIsSaving(false)
    if (error) {
      setServerError(text.error)
      toast.show(text.error, { preset: 'error' })
    }
    else toast.show(text.success, { preset: 'success' })
  }

  return (
    <Screen>
      <FintCard gap="$4" items="center">
        {avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 82, height: 82, borderRadius: 41 }} /> : <YStack width={82} height={82} rounded="$12" bg="$secondary" items="center" justify="center"><UserRound size={36} color="$primary" /></YStack>}
        <YStack items="center" gap="$1"><Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="800">{currentName || text.profile}</Paragraph></YStack>
      </FintCard>

      <FintCard gap="$4">
        <FormTextField label={text.name} required error={validation.errors.displayName} icon={<UserRound size={21} color="$primary" />} value={displayName} onChangeText={(value) => { setDisplayName(value); validation.clearError('displayName') }} placeholder={text.namePlaceholder} autoCapitalize="words" maxLength={80} />
        {serverError ? <Paragraph color="$red10" fontSize="$2">{serverError}</Paragraph> : null}
        <YStack gap="$2"><FintButton width="100%" minH={52} disabled={isSaving} icon={<Save size={17} />} onPress={() => { void save() }}>{isSaving ? text.saving : text.save}</FintButton><FintButton width="100%" minH={48} variant="outlined" disabled={isSaving} onPress={() => router.back()}>{t('actions.cancel')}</FintButton></YStack>
      </FintCard>

      <FintCard gap="$3">
        <ReadOnlyRow icon={<Mail size={18} color="$primary" />} label={text.email} value={session?.user.email ?? '-'} />
        <Paragraph color="$color9" fontSize="$1">{text.auth}</Paragraph>
      </FintCard>
    </Screen>
  )
}

function ReadOnlyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <XStack gap="$3" items="center">{icon}<YStack flex={1} minW={0}><Paragraph color="$color9" fontSize="$1">{label}</Paragraph><Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{value}</Paragraph></YStack></XStack>
}
