import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { type ReactNode, useContext, useState } from 'react'
import { RefreshControl, useWindowDimensions, type ScrollViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollView, useTheme, YStack, type YStackProps } from 'tamagui'
import { floatingTabBarHeight } from './FintTabBar'

interface ScreenProps extends Omit<YStackProps, 'onScroll'> {
  /** Acción principal fija sobre el borde inferior. Guardar no debería exigir desplazarse. */
  footer?: ReactNode
  ground?: ReactNode
  isRefreshing?: boolean
  onScroll?: ScrollViewProps['onScroll']
  onRefresh?: () => void
  scrollEventThrottle?: number
}

const SHEET_OVERLAP = 26

export function Screen({ footer, ground, isRefreshing = false, onRefresh, onScroll, scrollEventThrottle, ...props }: ScreenProps) {
  const { height: windowHeight } = useWindowDimensions()
  const [groundHeight, setGroundHeight] = useState(0)
  const [footerHeight, setFooterHeight] = useState(0)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const isInTabs = useContext(BottomTabBarHeightContext) !== undefined
  const tabBarHeight = isInTabs ? floatingTabBarHeight(insets.bottom) : 0
  // La barra fija tapa el final del scroll: se mide y se reserva ese alto.
  const bottomInset = footer ? footerHeight + 16 : tabBarHeight ? tabBarHeight + 16 : undefined

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={ground ? theme.headerAccent.val : theme.primary.val}
      colors={[ground ? theme.headerAccent.val : theme.primary.val]}
      progressBackgroundColor={ground ? theme.headerBackground.val : theme.card.val}
    />
  ) : undefined

  const actionBar = footer ? (
    <YStack
      position="absolute"
      b={0}
      l={0}
      r={0}
      bg="$background"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      px="$4"
      pt="$3"
      pb={Math.max(insets.bottom, 16)}
      onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
    >
      {footer}
    </YStack>
  ) : null

  if (ground) {
    return (
      <YStack flex={1} bg="$headerBackground">
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
            minH={Math.max(0, windowHeight - groundHeight + SHEET_OVERLAP)}
            bg="$background"
            mt={-SHEET_OVERLAP}
            pt="$5"
            px="$4"
            pb={bottomInset ?? '$8'}
            gap="$4"
            borderTopWidth={1}
            borderTopColor="rgba(246,251,252,0.22)"
            style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
            {...props}
          />
        </ScrollView>
        {actionBar}
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        flex={1}
        bg="$background"
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
      >
        <YStack gap="$4" px="$4" pt="$5" pb={bottomInset ?? '$8'} {...props} />
      </ScrollView>
      {actionBar}
    </YStack>
  )
}
