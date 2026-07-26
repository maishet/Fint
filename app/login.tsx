import * as ExpoLinking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Eye, EyeOff, LockKeyhole, Mail } from '@tamagui/lucide-icons-2'
import { useEffect, useRef, useState } from 'react'
import { Image, KeyboardAvoidingView, Platform } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Redirect } from 'expo-router'
import { Button, H1, H2, Input, Paragraph, Separator, XStack, YStack } from 'tamagui'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../src/auth/AuthProvider'
import { FintButton, FintCard } from '../src/ui'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const { t } = useTranslation()
  const { session, signIn, signInWithGoogle, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => () => {
    isMountedRef.current = false
  }, [])

  if (session) return <Redirect href="/(tabs)/dashboard" />

  const redirectTo = ExpoLinking.createURL('auth/callback')

  const runAuthAction = async (action: 'signin' | 'signup' | 'google') => {
    if (action !== 'google' && (!email.trim() || password.length < 6)) {
      setErrorMessage(t('auth.invalidForm'))
      return
    }
    if (action === 'signup' && password !== confirmPassword) {
      setErrorMessage(t('auth.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    const result = action === 'signin'
      ? await signIn(email.trim(), password)
      : action === 'signup'
        ? await signUp(email.trim(), password)
        : await signInWithGoogle(redirectTo)

    if (!isMountedRef.current) return
    if (result.error) {
      setErrorMessage(getFriendlyAuthError(result.error.message, t))
    } else if (action === 'signup') {
      setSuccessMessage('Cuenta creada. Si Supabase requiere confirmacion, revisa tu correo antes de entrar.')
    }
    setIsSubmitting(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <YStack flex={1} items="center" justify="center" gap="$4" p="$5" bg="$background">
        <YStack width="100%" maxW={360} items="center" gap="$4">
          <YStack items="center" gap="$3">
            <YStack width={72} height={72} rounded="$10" bg="$accent10" items="center" justify="center" overflow="hidden">
              <Image source={require('../assets/images/icon.png')} style={{ width: 72, height: 72 }} resizeMode="cover" />
            </YStack>
            <YStack items="center" gap="$2">
              <H1 color="$color12" fontFamily="$heading" size="$8" text="center" maxW={330}>{t('auth.headline')}</H1>
              <Paragraph color="$color10" text="center" maxW={300} lineHeight="$5">{t('auth.intro')}</Paragraph>
            </YStack>
          </YStack>

          <FintCard width="100%" gap="$4" p="$5">
            <YStack items="center" gap="$1">
              <H2 color="$color12" fontFamily="$heading" size="$7">{authMode === 'login' ? t('auth.welcome') : t('auth.registerTitle')}</H2>
              <Paragraph color="$color10" text="center">{authMode === 'login' ? t('auth.loginHint') : t('auth.registerHint')}</Paragraph>
            </YStack>

            <YStack gap="$3">
              <AuthField icon={<Mail size={18} color="$color9" />}><Input flex={1} unstyled autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder={t('auth.email')} color="$color12" placeholderTextColor="$color9" value={email} onChangeText={setEmail} /></AuthField>
              <AuthField icon={<LockKeyhole size={18} color="$color9" />}>
                <Input flex={1} unstyled autoComplete="password" placeholder={t('auth.password')} color="$color12" placeholderTextColor="$color9" secureTextEntry={!isPasswordVisible} value={password} onChangeText={setPassword} />
                <Button chromeless circular size="$2.5" aria-label={isPasswordVisible ? 'Ocultar contrasena' : 'Mostrar contrasena'} onPress={() => setIsPasswordVisible((current) => !current)}>{isPasswordVisible ? <EyeOff size={18} color="$color9" /> : <Eye size={18} color="$color9" />}</Button>
              </AuthField>
              {authMode === 'register' ? <AuthField icon={<LockKeyhole size={18} color="$color9" />}><Input flex={1} unstyled autoComplete="password-new" placeholder={t('auth.confirmPassword')} color="$color12" placeholderTextColor="$color9" secureTextEntry={!isPasswordVisible} value={confirmPassword} onChangeText={setConfirmPassword} /></AuthField> : null}
            </YStack>

            {errorMessage ? <MessageCard tone="error" message={errorMessage} /> : null}
            {successMessage ? <MessageCard tone="success" message={successMessage} /> : null}
            <FintButton disabled={isSubmitting} onPress={() => runAuthAction(authMode === 'login' ? 'signin' : 'signup')}>{isSubmitting ? t('auth.processing') : authMode === 'login' ? t('auth.signIn') : t('auth.signUp')}</FintButton>

            <XStack items="center" gap="$3"><Separator flex={1} /><Paragraph color="$color9" fontSize="$2" fontWeight="700">{t('auth.continueWith')}</Paragraph><Separator flex={1} /></XStack>
            <FintButton theme="accent" variant="outlined" disabled={isSubmitting} onPress={() => runAuthAction('google')}><XStack items="center" justify="center" gap="$2"><GoogleMark /><Paragraph color="$accent10" fontWeight="700">{t('auth.google')}</Paragraph></XStack></FintButton>

            <XStack items="center" justify="center" gap="$1.5">
              <Paragraph color="$color9">{authMode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}</Paragraph>
              <Button chromeless p={0} height="auto" onPress={() => { setAuthMode((current) => (current === 'login' ? 'register' : 'login')); setErrorMessage(null); setSuccessMessage(null) }}><Paragraph color="$accent10" fontWeight="800">{authMode === 'login' ? t('auth.registerLink') : t('auth.loginLink')}</Paragraph></Button>
            </XStack>
          </FintCard>
        </YStack>
      </YStack>
    </KeyboardAvoidingView>
  )
}

function AuthField({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return <XStack items="center" gap="$3" bg="$muted" borderColor="$color5" borderWidth={1} minH={48} px="$3" rounded="$5" focusStyle={{ borderColor: '$accent8' }}>{icon}{children}</XStack>
}

function MessageCard({ message, tone }: { message: string; tone: 'error' | 'success' }) {
  return <YStack bg={tone === 'error' ? '$red2' : '$green2'} borderColor={tone === 'error' ? '$red6' : '$green6'} borderWidth={1} p="$3" rounded="$5"><Paragraph color={tone === 'error' ? '$red11' : '$green11'} fontSize="$3" fontWeight="700">{message}</Paragraph></YStack>
}

function GoogleMark() {
  return <Svg width={20} height={20} viewBox="0 0 48 48"><Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" /><Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" /><Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" /></Svg>
}

function getFriendlyAuthError(message: string, t: (key: string) => string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login')) return t('auth.invalidCredentials')
  if (normalized.includes('email not confirmed')) return t('auth.emailNotConfirmed')
  if (normalized.includes('already registered')) return t('auth.alreadyRegistered')
  return message
}
