import { MapPin, Search, Trash2, X } from '@tamagui/lucide-icons-2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Input, Paragraph, Sheet, XStack, YStack } from 'tamagui'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { describeLocation, requestAndCaptureLocation, searchLocation, searchLocationSuggestions, type CapturedLocation } from '../location/captureLocation'
import { FintButton, FintSpinner } from '../ui'
import { MiniMap } from './MiniMap'

const SUGGESTION_DEBOUNCE_MS = 450

/** "Plaza San Miguel, San Miguel, Lima" -> nombre del lugar arriba, resto de la dirección abajo (como el select de Google). */
function splitAddress(formattedAddress: string | null) {
  if (!formattedAddress) return { primary: null, secondary: null }
  const [primary, ...rest] = formattedAddress.split(', ')
  const secondary = rest.join(', ')
  return { primary: primary || null, secondary: secondary || null }
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
  const [draft, setDraft] = useState<CapturedLocation | null>(value)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const [suggestions, setSuggestions] = useState<CapturedLocation[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setQuery('')
      setSearchFailed(false)
      setSuggestions([])
    }
  }, [open, value])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      setIsSuggesting(false)
      return
    }
    setIsSuggesting(true)
    debounceRef.current = setTimeout(() => {
      void searchLocationSuggestions(trimmed).then((results) => {
        setSuggestions(results)
        setIsSuggesting(false)
      })
    }, SUGGESTION_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const closeSheet = useCallback(() => {
    Keyboard.dismiss()
    onOpenChange(false)
  }, [onOpenChange])
  useSheetBackHandler(open, closeSheet)

  const updateCenter = async (next: { latitude: number; longitude: number }) => {
    setDraft((prev) => ({ latitude: next.latitude, longitude: next.longitude, formattedAddress: prev?.formattedAddress ?? null }))
    setIsResolvingAddress(true)
    const address = await describeLocation(next.latitude, next.longitude)
    setIsResolvingAddress(false)
    setDraft((prev) => (prev ? { ...prev, formattedAddress: address } : prev))
  }

  const runSearch = async () => {
    if (!query.trim() || isSearching) return
    Keyboard.dismiss()
    setIsSearching(true)
    setSearchFailed(false)
    const result = await searchLocation(query)
    setIsSearching(false)
    if (result) setDraft(result)
    else setSearchFailed(true)
    setSuggestions([])
  }

  const selectSuggestion = (suggestion: CapturedLocation) => {
    Keyboard.dismiss()
    setDraft(suggestion)
    setQuery('')
    setSuggestions([])
  }

  const useCurrentLocation = async () => {
    setIsLocating(true)
    const result = await requestAndCaptureLocation()
    setIsLocating(false)
    if (result) setDraft(result)
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPointsMode="fit" dismissOnSnapToBottom zIndex={110_000}>
      <Sheet.Overlay bg="rgba(0,0,0,0.4)" />
      <Sheet.Handle bg="$color6" />
      <Sheet.Frame bg="$popover" gap="$3" px="$4" pt="$2" pb={Math.max(insets.bottom, 16)} rounded={14}>
        <XStack items="center" justify="space-between">
          <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="600">
            {t('location.editTitle')}
          </Paragraph>
          <Button circular chromeless size="$3" icon={<X size={20} color="$color11" />} onPress={closeSheet} aria-label={t('actions.cancel')} />
        </XStack>

        <XStack items="center" gap="$2" bg="$muted" borderColor="$input" borderWidth={1} rounded={14} px="$3">
          <Search size={17} color="$color10" />
          <Input
            flex={1}
            unstyled
            color="$color12"
            placeholderTextColor="$mutedForeground"
            placeholder={t('location.searchPlaceholder')}
            value={query}
            onChangeText={(next) => {
              setQuery(next)
              setSearchFailed(false)
            }}
            onSubmitEditing={() => void runSearch()}
            returnKeyType="search"
          />
          {isSearching ? (
            <FintSpinner size="small" color="$primary" />
          ) : (
            <Button circular chromeless size="$2" icon={<Search size={15} color="$primary" />} disabled={!query.trim()} onPress={() => void runSearch()} aria-label={t('location.searchAction')} />
          )}
        </XStack>
        {isSuggesting ? (
          <XStack items="center" gap="$2" px="$1">
            <FintSpinner size="small" color="$primary" />
            <Paragraph color="$color10" fontSize="$1">
              {t('location.searchingSuggestions')}
            </Paragraph>
          </XStack>
        ) : suggestions.length > 0 ? (
          <YStack bg="$card" borderColor="$borderColor" borderWidth={1} rounded={14} overflow="hidden">
            {suggestions.map((suggestion, index) => {
              const { primary, secondary } = splitAddress(suggestion.formattedAddress)
              return (
                <XStack
                  key={`${suggestion.latitude}-${suggestion.longitude}`}
                  items="center"
                  gap="$3"
                  px="$3"
                  py="$2.5"
                  minH={58}
                  borderTopWidth={index > 0 ? 1 : 0}
                  borderColor="$borderColor"
                  cursor="pointer"
                  role="button"
                  pressStyle={{ bg: '$secondary' }}
                  onPress={() => selectSuggestion(suggestion)}
                >
                  <YStack width={28} height={28} rounded={14} bg="$background" items="center" justify="center" shrink={0}>
                    <MapPin size={15} color="$color10" />
                  </YStack>
                  <YStack flex={1} minW={0} gap={1}>
                    <Paragraph color="$color12" fontSize="$3" fontWeight="700" numberOfLines={1}>
                      {primary ?? t('location.coordinatesOnly')}
                    </Paragraph>
                    {secondary ? (
                      <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
                        {secondary}
                      </Paragraph>
                    ) : null}
                  </YStack>
                </XStack>
              )
            })}
          </YStack>
        ) : searchFailed ? (
          <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">
            {t('location.searchNotFound')}
          </Paragraph>
        ) : null}

        {draft ? (
          <YStack gap="$2">
            <MiniMap interactive latitude={draft.latitude} longitude={draft.longitude} height={220} rounded={16} onCenterChange={(next) => void updateCenter(next)} hintLabel={t('location.dragHint')} />
            <XStack items="center" gap="$2">
              <MapPin size={15} color="$primary" />
              <Paragraph flex={1} color="$color11" fontSize="$2" fontWeight="600" numberOfLines={2}>
                {isResolvingAddress ? t('location.detecting') : (draft.formattedAddress ?? t('location.coordinatesOnly'))}
              </Paragraph>
            </XStack>
          </YStack>
        ) : (
          <YStack items="center" justify="center" height={120} bg="$elevated" rounded={16}>
            <Paragraph color="$color10" fontSize="$2">
              {t('location.noneYet')}
            </Paragraph>
          </YStack>
        )}

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
      </Sheet.Frame>
    </Sheet>
  )
}
