import { RefreshControl, type ScrollViewProps } from 'react-native'
import { ScrollView, YStack, type YStackProps } from 'tamagui'

interface ScreenProps extends Omit<YStackProps, 'onScroll'> {
  isRefreshing?: boolean
  onScroll?: ScrollViewProps['onScroll']
  onRefresh?: () => void
  scrollEventThrottle?: number
}

export function Screen({ isRefreshing = false, onRefresh, onScroll, scrollEventThrottle, ...props }: ScreenProps) {
  return (
    <ScrollView
      flex={1}
      bg="$background"
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      refreshControl={onRefresh ? <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} /> : undefined}
    >
      <YStack gap="$4" p="$4" pb="$8" {...props} />
    </ScrollView>
  )
}
