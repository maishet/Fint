import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { type ReactNode, useContext, useState } from 'react'
import { RefreshControl, useWindowDimensions, type ScrollViewProps } from 'react-native'
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme, YStack, type YStackProps } from 'tamagui'
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
const KEYBOARD_GAP = 24

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
  // Con la barra fija arriba del teclado, el campo enfocado tiene que subir
  // también por encima de ella.
  const bottomOffset = (footer ? footerHeight : 0) + KEYBOARD_GAP

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
    <KeyboardStickyView
      offset={{ opened: Math.max(insets.bottom, 16) - 16 }}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
    >
      <YStack
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
    </KeyboardStickyView>
  ) : null

  if (ground) {
    return (
      <YStack flex={1} bg="$headerBackground">
        <KeyboardAwareScrollView
          bottomOffset={bottomOffset}
          style={{ flex: 1, backgroundColor: theme.headerBackground.val }}
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
        </KeyboardAwareScrollView>
        {actionBar}
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background">
      <KeyboardAwareScrollView
        bottomOffset={bottomOffset}
        style={{ flex: 1, backgroundColor: theme.background.val }}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
      >
        <YStack gap="$4" px="$4" pt="$5" pb={bottomInset ?? '$8'} {...props} />
      </KeyboardAwareScrollView>
      {actionBar}
    </YStack>
  )
}
