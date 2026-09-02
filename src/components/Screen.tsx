import { type ReactNode, useState } from 'react'
import { RefreshControl, useWindowDimensions, type ScrollViewProps } from 'react-native'
import { ScrollView, useTheme, YStack, type YStackProps } from 'tamagui'

interface ScreenProps extends Omit<YStackProps, 'onScroll'> {
  ground?: ReactNode
  isRefreshing?: boolean
  onScroll?: ScrollViewProps['onScroll']
  onRefresh?: () => void
  scrollEventThrottle?: number
}

const SHEET_OVERLAP = 26

export function Screen({ ground, isRefreshing = false, onRefresh, onScroll, scrollEventThrottle, ...props }: ScreenProps) {
  const { height: windowHeight } = useWindowDimensions()
  const [groundHeight, setGroundHeight] = useState(0)
  const theme = useTheme()

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={ground ? theme.headerAccent.val : theme.primary.val}
      colors={[ground ? theme.headerAccent.val : theme.primary.val]}
      progressBackgroundColor={ground ? theme.headerBackground.val : theme.card.val}
    />
  ) : undefined

  if (ground) {
    return (
      <ScrollView
        flex={1}
        bg="$headerBackground"
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
      >
        <YStack
          bg="$headerBackground"
          px="$4"
          pt="$5"
          pb="$7"
          onLayout={(event) => setGroundHeight(event.nativeEvent.layout.height)}
        >
          {ground}
        </YStack>
        <YStack
          minH={Math.max(0, windowHeight - groundHeight)}
          bg="$background"
          mt={-SHEET_OVERLAP}
          pt="$5"
          px="$4"
          pb="$8"
          gap="$4"
          style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          {...props}
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      flex={1}
      bg="$background"
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      refreshControl={refreshControl}
    >
      {}
      <YStack gap="$4" px="$4" pt="$5" pb="$8" {...props} />
    </ScrollView>
  )
}
