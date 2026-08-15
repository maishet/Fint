import type { ReactNode } from 'react'
import { useRef } from 'react'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { YStack } from 'tamagui'
import { haptics } from '../ui/haptics'

/**
 * Fila con acción al deslizar hacia la izquierda. El propio deslizamiento (al
 * pasar el umbral) **dispara la acción**: `onAction` abre el mismo
 * `FintConfirmDialog` que el botón inline (no borra directo) y la fila se cierra
 * sola. El panel revelado es sólo indicación visual durante el gesto. Se dispara
 * un haptic `warning` al abrirse.
 */
export function SwipeableRow({
  children,
  onAction,
  actionIcon,
  actionColor = '$red9',
  actionLabel,
  enabled = true,
}: {
  children: ReactNode
  onAction: () => void
  actionIcon: ReactNode
  actionColor?: string
  actionLabel: string
  enabled?: boolean
}) {
  const swipeableRef = useRef<SwipeableMethods>(null)

  if (!enabled) return <>{children}</>

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        haptics.warning()
        onAction()
        swipeableRef.current?.close()
      }}
      renderRightActions={() => (
        <YStack
          flex={1}
          bg={actionColor as never}
          rounded={18}
          items="flex-end"
          justify="center"
          pr="$5"
          aria-label={actionLabel}
        >
          {actionIcon}
        </YStack>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  )
}
