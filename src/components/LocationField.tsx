import { MapPin, Search, X } from '@tamagui/lucide-icons-2'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Paragraph, XStack, YStack } from 'tamagui'
import {
  describeLocation,
  getLocationPermissionState,
  requestAndCaptureLocation,
  type CapturedLocation,
  type LocationPermissionState,
} from '../location/captureLocation'
import { useLocationPreference } from '../location/LocationPreferenceProvider'
import { FintButton, FintCard, FintSpinner } from '../ui'
import { FintListGroup, FintListRow } from './FintListGroup'
import { LocationEditSheet } from './LocationEditSheet'
import { MiniMap } from './MiniMap'

export function LocationField({
  onChange,
  value,
  autoCapture = true,
}: {
  onChange: (next: CapturedLocation | null) => void
  value: CapturedLocation | null
  autoCapture?: boolean
}) {
  const { t } = useTranslation()
  const { enabled: locationCaptureEnabled, isHydrated } = useLocationPreference()
  const [permission, setPermission] = useState<LocationPermissionState | 'checking'>('checking')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const autoTriedRef = useRef(false)

  const capture = async () => {
    setIsCapturing(true)
    const result = await requestAndCaptureLocation()
    const state = await getLocationPermissionState()
    setPermission(state)
    setIsCapturing(false)
    if (result) onChange(result)
  }

  useEffect(() => {
    if (!isHydrated || !locationCaptureEnabled) return
    let cancelled = false
    void getLocationPermissionState().then((state) => {
      if (cancelled) return
      setPermission(state)
      if (autoCapture && state === 'granted' && !value && !autoTriedRef.current) {
        autoTriedRef.current = true
        void capture()
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, locationCaptureEnabled])

  if (!isHydrated || !locationCaptureEnabled) return null

  const updateCenter = async (next: { latitude: number; longitude: number }) => {
    onChange({ latitude: next.latitude, longitude: next.longitude, formattedAddress: value?.formattedAddress ?? null })
    setIsResolvingAddress(true)
    const address = await describeLocation(next.latitude, next.longitude)
    setIsResolvingAddress(false)
    onChange({ latitude: next.latitude, longitude: next.longitude, formattedAddress: address })
  }

  const sheet = (
    <LocationEditSheet
      open={isSheetOpen}
      onOpenChange={setIsSheetOpen}
      value={value}
      onSave={(next) => onChange(next)}
    />
  )

  if (value) {
    return (
      <YStack gap="$2">
        <FintListGroup>
          <FintListRow
            icon={<MapPin size={22} color="$primary" />}
            label={t('location.addedLabel')}
            value={isResolvingAddress ? t('location.detecting') : (value.formattedAddress ?? t('location.coordinatesOnly'))}
            onPress={() => setIsSheetOpen(true)}
            trailing={
              <Button
                circular
                chromeless
                size="$2"
                icon={<X size={16} color="$color8" />}
                pressStyle={{ bg: '$color4' }}
                onPress={() => onChange(null)}
                aria-label={t('location.remove')}
              />
            }
          />
        </FintListGroup>
        <MiniMap
          interactive
          latitude={value.latitude}
          longitude={value.longitude}
          height={160}
          onCenterChange={(next) => void updateCenter(next)}
          hintLabel={t('location.dragHint')}
          accessibilityLabel={t('location.mapAccessibility')}
          onExpand={() => setIsSheetOpen(true)}
        />
        {sheet}
      </YStack>
    )
  }

  if (permission === 'checking') return null

  if (permission === 'denied') {
    return (
      <>
        <FintListGroup>
          <FintListRow icon={<Search size={22} color="$primary" />} label={t('location.searchPlaceholder')} onPress={() => setIsSheetOpen(true)} />
        </FintListGroup>
        {sheet}
      </>
    )
  }

  if (permission === 'undetermined') {
    return (
      <FintCard gap="$3">
        <XStack items="flex-start" gap="$3">
          <YStack width={38} height={38} rounded={19} bg="$background" items="center" justify="center" shrink={0}>
            <MapPin size={19} color="$primary" />
          </YStack>
          <YStack flex={1} gap="$1">
            <Paragraph color="$color12" fontSize="$3" fontWeight="700" letterSpacing={-0.1}>
              {t('location.autoBannerTitle')}
            </Paragraph>
            <Paragraph color="$color10" fontSize="$1" lineHeight={17}>
              {t('location.autoBannerBody')}
            </Paragraph>
          </YStack>
        </XStack>
        <FintButton
          self="flex-start"
          size="$3"
          disabled={isCapturing}
          icon={isCapturing ? <FintSpinner size="small" color="$primaryForeground" /> : <MapPin size={14} />}
          onPress={() => void capture()}
        >
          {t('location.autoBannerConfirm')}
        </FintButton>
      </FintCard>
    )
  }

  // permission === 'granted' pero sin valor: capturando en segundo plano, o
  // (si autoCapture es false, o la captura automática falló) quedan la fila
  // manual y la búsqueda para resolverlo a mano.
  return (
    <YStack gap="$2">
      <FintListGroup>
        <FintListRow
          icon={isCapturing ? <FintSpinner size="small" color="$primary" /> : <MapPin size={22} color="$primary" />}
          label={isCapturing ? t('location.detecting') : t('location.addLabel')}
          onPress={isCapturing ? undefined : () => void capture()}
        />
        {isCapturing ? null : (
          <>
            <YStack height={1} bg="$borderColor" ml={49} />
            <FintListRow icon={<Search size={22} color="$primary" />} label={t('location.searchPlaceholder')} onPress={() => setIsSheetOpen(true)} />
          </>
        )}
      </FintListGroup>
      {sheet}
    </YStack>
  )
}
