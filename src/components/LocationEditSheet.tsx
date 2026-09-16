import { ChevronLeft, MapPin, Search, Trash2, X } from '@tamagui/lucide-icons-2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { type Region, PROVIDER_GOOGLE } from 'react-native-maps'
import { Button, Input, Paragraph, Sheet, XStack, YStack } from 'tamagui'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { describeLocation, getLastKnownPosition, requestAndCaptureLocation, type CapturedLocation } from '../location/captureLocation'
import { suggestionKey, useLocationSearch } from '../location/useLocationSearch'
import { FintButton, FintSpinner } from '../ui'
import { regionFor } from './MiniMap'
import { PlaceCategoryIcon } from './PlaceCategoryIcon'

const MAP_ZOOM = 16
const PIN_SIZE = 40
/** Centro por defecto si no hay ubicación previa ni permiso de GPS todavía (Lima, para no abrir en el medio del océano). */
const FALLBACK_CENTER = { latitude: -12.0464, longitude: -77.0428 }

/** "Plaza San Miguel, San Miguel, Lima" -> nombre del lugar arriba, resto de la dirección abajo. */
function splitAddress(formattedAddress: string | null) {
  if (!formattedAddress) return { primary: null, secondary: null }
  const [primary, ...rest] = formattedAddress.split(', ')
  return { primary: primary || null, secondary: rest.join(', ') || null }
}

export function LocationEditSheet({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: CapturedLocation | null
  onSave: (next: CapturedLocation | null) => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const isFirstRegion = useRef(true)
  const isProgrammaticMove = useRef(false)
  const isMapReady = useRef(false)
  const pendingRegion = useRef<Region | null>(null)

  const [draft, setDraft] = useState<CapturedLocation | null>(value)
  const [isLocating, setIsLocating] = useState(false)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const search = useLocationSearch(open)

  const jumpTo = useCallback((next: { latitude: number; longitude: number }) => {
    isProgrammaticMove.current = true
    const region = regionFor(next.latitude, next.longitude, MAP_ZOOM)
    if (isMapReady.current) mapRef.current?.animateToRegion(region, 0)
    else pendingRegion.current = region
  }, [])

  const handleMapReady = () => {
    isMapReady.current = true
    if (pendingRegion.current) {
      mapRef.current?.animateToRegion(pendingRegion.current, 0)
      pendingRegion.current = null
    }
  }

  const updateCenter = useCallback(async (next: { latitude: number; longitude: number }) => {
    setDraft((prev) => ({ latitude: next.latitude, longitude: next.longitude, formattedAddress: prev?.formattedAddress ?? null }))
    setIsResolvingAddress(true)
    const address = await describeLocation(next.latitude, next.longitude)
    setIsResolvingAddress(false)
    setDraft((prev) => (prev ? { ...prev, formattedAddress: address } : prev))
  }, [])

  useEffect(() => {
    if (!open) return
    isFirstRegion.current = true
    search.reset()

    if (value) {
      setDraft(value)
      jumpTo(value)
      return
    }
    setDraft(null)
    jumpTo(FALLBACK_CENTER)
    let cancelled = false
    void getLastKnownPosition().then((position) => {
      if (cancelled || !position) return
      jumpTo(position)
      void updateCenter(position)
    })
    return () => {
      cancelled = true
    }
  }, [open, value, jumpTo, updateCenter])

  const closeSheet = useCallback(() => {
    Keyboard.dismiss()
    onOpenChange(false)
  }, [onOpenChange])
  useSheetBackHandler(open, closeSheet)

  const handleRegionChangeComplete = (region: Region) => {
    if (isFirstRegion.current) {
      isFirstRegion.current = false
      return
    }
    if (isProgrammaticMove.current) {
      isProgrammaticMove.current = false
      return
    }
    void updateCenter({ latitude: region.latitude, longitude: region.longitude })
  }

  const runSearch = async () => {
    Keyboard.dismiss()
    const result = await search.submit()
    if (result) {
      setDraft(result)
      jumpTo(result)
    }
  }

  const selectSuggestion = async (suggestion: Parameters<typeof search.select>[0]) => {
    Keyboard.dismiss()
    const resolved = await search.select(suggestion)
    if (resolved) {
      setDraft(resolved)
      jumpTo(resolved)
    }
  }

  const useCurrentLocation = async () => {
    setIsLocating(true)
    const result = await requestAndCaptureLocation()
    setIsLocating(false)
    if (result) {
      setDraft(result)
      jumpTo(result)
    }
  }

  const { primary, secondary } = splitAddress(draft?.formattedAddress ?? null)

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[100]} snapPointsMode="percent" dismissOnSnapToBottom={false} zIndex={110_000}>
      <Sheet.Overlay bg="rgba(0,0,0,0.4)" />
      <Sheet.Frame bg="$background" p={0}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={regionFor((value ?? FALLBACK_CENTER).latitude, (value ?? FALLBACK_CENTER).longitude, MAP_ZOOM)}
          onMapReady={handleMapReady}
          onRegionChangeComplete={handleRegionChangeComplete}
          rotateEnabled={false}
          pitchEnabled={false}
          showsCompass={false}
          toolbarEnabled={false}
        />

        <YStack position="absolute" l="50%" t="50%" ml={-PIN_SIZE / 2} mt={-PIN_SIZE * 0.86} pointerEvents="none" items="center">
          <YStack bg="rgba(4,48,54,0.72)" px="$2.5" py="$1" rounded={999} mb="$2">
            <Paragraph color="#F6FBFC" fontSize={10.5} fontWeight="700">
              {t('location.dragHint')}
            </Paragraph>
          </YStack>
          <MapPin size={PIN_SIZE} color="#FFFFFF" fill="#0F6E76" strokeWidth={2} />
          <YStack width={18} height={7} rounded={999} bg="rgba(4,48,54,0.32)" mt={-6} />
        </YStack>

        <YStack position="absolute" t={insets.top + 10} l="$3" r="$3" gap="$2">
          <XStack items="center" gap="$2">
            <Button
              circular
              size="$4"
              bg="$card"
              borderWidth={1}
              borderColor="$borderColor"
              shadowColor="rgba(4,48,54,0.2)"
              shadowRadius={10}
              shadowOffset={{ width: 0, height: 4 }}
              icon={<ChevronLeft size={20} color="$color12" />}
              onPress={closeSheet}
              aria-label={t('actions.cancel')}
            />
            <XStack flex={1} items="center" gap="$2" bg="$card" borderColor="$borderColor" borderWidth={1} rounded={14} px="$3" py="$1" shadowColor="rgba(4,48,54,0.2)" shadowRadius={10} shadowOffset={{ width: 0, height: 4 }}>
              <Search size={17} color="$color10" />
              <Input
                flex={1}
                unstyled
                color="$color12"
                placeholderTextColor="$mutedForeground"
                placeholder={t('location.searchPlaceholder')}
                value={search.query}
                onChangeText={(next) => {
                  search.setQuery(next)
                  search.setSearchFailed(false)
                }}
                onSubmitEditing={() => void runSearch()}
                returnKeyType="search"
              />
              {search.isSearching ? (
                <FintSpinner size="small" color="$primary" />
              ) : search.query.trim() ? (
                <Button circular chromeless size="$2" icon={<X size={15} color="$color10" />} onPress={() => search.reset()} aria-label={t('actions.cancel')} />
              ) : null}
            </XStack>
          </XStack>

          {search.isSuggesting ? (
            <XStack items="center" gap="$2" px="$3" py="$2.5" bg="$card" borderColor="$borderColor" borderWidth={1} rounded={14} shadowColor="rgba(4,48,54,0.2)" shadowRadius={10} shadowOffset={{ width: 0, height: 4 }}>
              <FintSpinner size="small" color="$primary" />
              <Paragraph color="$color10" fontSize="$1">
                {t('location.searchingSuggestions')}
              </Paragraph>
            </XStack>
          ) : search.suggestions.length > 0 ? (
            <YStack bg="$card" borderColor="$borderColor" borderWidth={1} rounded={14} overflow="hidden" shadowColor="rgba(4,48,54,0.2)" shadowRadius={14} shadowOffset={{ width: 0, height: 6 }}>
              {search.suggestions.map((suggestion, index) => {
                const key = suggestionKey(suggestion)
                const isResolving = search.resolvingKey === key
                return (
                  <XStack
                    key={key}
                    items="center"
                    gap="$3"
                    px="$3"
                    py="$2.5"
                    minH={58}
                    borderTopWidth={index > 0 ? 1 : 0}
                    borderColor="$borderColor"
                    cursor="pointer"
                    role="button"
                    opacity={search.resolvingKey && !isResolving ? 0.5 : 1}
                    pressStyle={{ bg: '$secondary' }}
                    onPress={() => void selectSuggestion(suggestion)}
                  >
                    <YStack width={28} height={28} rounded={14} bg="$background" items="center" justify="center" shrink={0}>
                      {isResolving ? <FintSpinner size="small" color="$primary" /> : <PlaceCategoryIcon category={suggestion.category} />}
                    </YStack>
                    <YStack flex={1} minW={0} gap={1}>
                      <Paragraph color="$color12" fontSize="$3" fontWeight="700" numberOfLines={1}>
                        {suggestion.primaryText || t('location.coordinatesOnly')}
                      </Paragraph>
                      {suggestion.secondaryText ? (
                        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
                          {suggestion.secondaryText}
                        </Paragraph>
                      ) : null}
                    </YStack>
                  </XStack>
                )
              })}
            </YStack>
          ) : search.searchFailed ? (
            <YStack bg="$card" borderColor="$borderColor" borderWidth={1} rounded={14} px="$3" py="$2.5">
              <Paragraph color="$red10" fontSize="$1" fontWeight="600">
                {t('location.searchNotFound')}
              </Paragraph>
            </YStack>
          ) : null}
        </YStack>

        <YStack
          position="absolute"
          l={0}
          r={0}
          b={0}
          bg="$card"
          style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          px="$4"
          pt="$3"
          pb={Math.max(insets.bottom, 16)}
          gap="$3"
          shadowColor="rgba(4,48,54,0.25)"
          shadowRadius={18}
          shadowOffset={{ width: 0, height: -6 }}
        >
          <XStack items="center" gap="$2">
            <YStack width={34} height={34} rounded={17} bg="$elevated" items="center" justify="center" shrink={0}>
              <MapPin size={17} color="$primary" />
            </YStack>
            <YStack flex={1} minW={0}>
              <Paragraph color="$color12" fontSize="$4" fontWeight="700" numberOfLines={1}>
                {isResolvingAddress ? t('location.detecting') : (primary ?? t('location.coordinatesOnly'))}
              </Paragraph>
              {secondary ? (
                <Paragraph color="$color10" fontSize="$2" numberOfLines={1}>
                  {secondary}
                </Paragraph>
              ) : null}
            </YStack>
          </XStack>

          <XStack gap="$2">
            <FintButton flex={1} variant="outlined" disabled={isLocating} icon={isLocating ? <FintSpinner size="small" color="$primary" /> : <MapPin size={16} />} onPress={() => void useCurrentLocation()}>
              {t('location.useCurrent')}
            </FintButton>
            {value ? (
              <Button
                circular
                variant="outlined"
                borderColor="$red6"
                size="$4"
                icon={<Trash2 size={17} color="$red10" />}
                onPress={() => {
                  onSave(null)
                  closeSheet()
                }}
                aria-label={t('location.remove')}
              />
            ) : null}
          </XStack>

          <FintButton
            width="100%"
            minH={50}
            disabled={!draft}
            onPress={() => {
              if (draft) onSave(draft)
              closeSheet()
            }}
          >
            {t('actions.save')}
          </FintButton>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}
