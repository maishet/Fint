import { MapPin, Maximize2 } from '@tamagui/lucide-icons-2'
import { useState } from 'react'
import { Image } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Button, Paragraph, YStack } from 'tamagui'

const TILE_SIZE = 256
const DEFAULT_ZOOM = 16
const MIN_ZOOM = 3
const MAX_ZOOM = 19
const PIN_SIZE = 34
const TILE_HEADERS = { 'User-Agent': 'Fint/1.0 (personal finance app; Android)' }

function project(latitude: number, longitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom
  const x = ((longitude + 180) / 360) * scale
  const rad = (latitude * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale
  return { x, y }
}

function unproject(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom
  const longitude = (x / scale) * 360 - 180
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI
  return { latitude, longitude }
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
  const [width, setWidth] = useState(0)
  const [liveZoom, setLiveZoom] = useState(zoom)
  const effectiveZoom = interactive ? liveZoom : zoom
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const pinchScale = useSharedValue(1)

  const commitPan = (dx: number, dy: number) => {
    if (!onCenterChange || (dx === 0 && dy === 0)) return
    const center = project(latitude, longitude, effectiveZoom)
    const next = unproject(center.x - dx, center.y - dy, effectiveZoom)
    onCenterChange(next)
  }

  const commitZoom = (scale: number) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(effectiveZoom + Math.log2(scale))))
    if (nextZoom !== effectiveZoom) setLiveZoom(nextZoom)
  }

  const pan = Gesture.Pan()
    .enabled(interactive)
    .onUpdate((event) => {
      translateX.value = event.translationX
      translateY.value = event.translationY
    })
    .onEnd((event) => {
      const { translationX, translationY } = event
      translateX.value = withTiming(0, { duration: 150 })
      translateY.value = withTiming(0, { duration: 150 })
      runOnJS(commitPan)(translationX, translationY)
    })

  const pinch = Gesture.Pinch()
    .enabled(interactive)
    .onUpdate((event) => {
      pinchScale.value = event.scale
    })
    .onEnd((event) => {
      const { scale } = event
      pinchScale.value = withTiming(1, { duration: 150 })
      runOnJS(commitZoom)(scale)
    })

  const gesture = Gesture.Simultaneous(pan, pinch)

  const tileLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: pinchScale.value }],
  }))

  const worldTiles = 2 ** effectiveZoom
  const center = project(latitude, longitude, effectiveZoom)
  const originX = center.x - width / 2
  const originY = center.y - height / 2
  const tiles: { key: string; uri: string; left: number; top: number }[] = []
  if (width > 0) {
    const minTileX = Math.floor(originX / TILE_SIZE)
    const maxTileX = Math.floor((originX + width) / TILE_SIZE)
    const minTileY = Math.max(0, Math.floor(originY / TILE_SIZE))
    const maxTileY = Math.min(worldTiles - 1, Math.floor((originY + height) / TILE_SIZE))
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const wrappedX = ((tx % worldTiles) + worldTiles) % worldTiles
        tiles.push({ key: `${tx}-${ty}`, uri: `https://tile.openstreetmap.org/${effectiveZoom}/${wrappedX}/${ty}.png`, left: tx * TILE_SIZE - originX, top: ty * TILE_SIZE - originY })
      }
    }
  }

  const tileImages = tiles.map((tile) => (
    <Image key={tile.key} source={{ uri: tile.uri, headers: TILE_HEADERS }} style={{ position: 'absolute', left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }} />
  ))

  return (
    <YStack
      width="100%"
      height={height}
      rounded={rounded}
      overflow="hidden"
      bg="$elevated"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => {
        const measured = Math.round(event.nativeEvent.layout.width)
        if (measured > 0 && measured !== width) setWidth(measured)
      }}
    >
      {interactive ? (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, tileLayerStyle]}>{tileImages}</Animated.View>
        </GestureDetector>
      ) : (
        tileImages
      )}

      {width > 0 ? (
        <YStack position="absolute" l={width / 2 - PIN_SIZE / 2} t={height / 2 - PIN_SIZE * 0.86} pointerEvents="none" items="center">
          <YStack width={16} height={6} rounded={999} bg="rgba(4,48,54,0.32)" position="absolute" t={PIN_SIZE * 0.9} />
          <MapPin size={PIN_SIZE} color="#FFFFFF" fill="#0F6E76" strokeWidth={2} />
        </YStack>
      ) : null}

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

      <Paragraph position="absolute" b={2} r={6} fontSize={8} color="rgba(4,48,54,0.55)" pointerEvents="none">
        © OpenStreetMap
      </Paragraph>
    </YStack>
  )
}
