import { MapPin, Maximize2 } from '@tamagui/lucide-icons-2'
import { useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet } from 'react-native'
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import { Button, Paragraph, YStack } from 'tamagui'

const DEFAULT_ZOOM = 16
const PIN_SIZE = 34

export function regionFor(latitude: number, longitude: number, zoom: number): Region {
  const delta = 360 / 2 ** zoom
  return { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta }
}

type MiniMapProps = {
  latitude: number
  longitude: number
  height: number
  zoom?: number
  rounded?: number
  accessibilityLabel?: string
  interactive?: boolean
  onCenterChange?: (next: { latitude: number; longitude: number }) => void
  hintLabel?: string
  onExpand?: () => void
}

export function MiniMap({ latitude, longitude, height, zoom = DEFAULT_ZOOM, rounded = 14, accessibilityLabel, interactive = false, onCenterChange, hintLabel, onExpand }: MiniMapProps) {
  const mapRef = useRef<MapView>(null)
  const [initialRegion] = useState(() => regionFor(latitude, longitude, zoom))
  const isFirstRender = useRef(true)
  const isProgrammaticMove = useRef(false)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    isProgrammaticMove.current = true
    mapRef.current?.animateToRegion(regionFor(latitude, longitude, zoom), 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude])

  const handleRegionChangeComplete = (region: Region) => {
    if (isProgrammaticMove.current) {
      isProgrammaticMove.current = false
      return
    }
    if (interactive) onCenterChange?.({ latitude: region.latitude, longitude: region.longitude })
  }

  return (
    <YStack width="100%" height={height} rounded={rounded} overflow="hidden" bg="$elevated" accessibilityLabel={accessibilityLabel}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
      />

      <YStack position="absolute" l="50%" t="50%" ml={-PIN_SIZE / 2} mt={-PIN_SIZE * 0.86} pointerEvents="none" items="center">
        <YStack width={16} height={6} rounded={999} bg="rgba(4,48,54,0.32)" position="absolute" t={PIN_SIZE * 0.9} />
        <MapPin size={PIN_SIZE} color="#FFFFFF" fill="#0F6E76" strokeWidth={2} />
      </YStack>

      {interactive && hintLabel ? (
        <YStack position="absolute" t="$2" self="center" bg="rgba(4,48,54,0.7)" px="$2.5" py="$1" rounded={999} pointerEvents="none">
          <Paragraph color="#F6FBFC" fontSize={10.5} fontWeight="700">
            {hintLabel}
          </Paragraph>
        </YStack>
      ) : null}

      {onExpand ? (
        <Button
          position="absolute"
          t="$2"
          r="$2"
          circular
          size="$3"
          bg="rgba(4,48,54,0.7)"
          borderWidth={0}
          pressStyle={{ bg: 'rgba(4,48,54,0.85)' }}
          icon={<Maximize2 size={15} color="#F6FBFC" />}
          onPress={onExpand}
          aria-label={accessibilityLabel}
        />
      ) : null}
    </YStack>
  )
}
