import type { EventArg, NavigationAction } from '@react-navigation/native'
import { useNavigation } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'

type BeforeRemoveEvent = EventArg<'beforeRemove', true, { action: NavigationAction }>

/**
 * Guardia de "cambios sin guardar". Intercepta la salida de una pantalla de
 * formulario (botón atrás del header, gesto, botón cancelar → todos disparan el
 * evento `beforeRemove`) y, si hay cambios sin guardar, muestra un diálogo de
 * descarte antes de dejar salir.
 *
 * Uso:
 *   const guard = useUnsavedChangesGuard(isDirty)
 *   // al guardar con éxito, saltar la guardia: guard.bypass(() => router.back())
 *   // render: <UnsavedChangesDialog {...guard} />
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const navigation = useNavigation()
  const [open, setOpen] = useState(false)
  const isDirtyRef = useRef(isDirty)
  const bypassRef = useRef(false)
  const pendingActionRef = useRef<NavigationAction | null>(null)

  isDirtyRef.current = isDirty

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: BeforeRemoveEvent) => {
      // Salida ya autorizada (guardado exitoso) o sin cambios: dejar pasar.
      if (bypassRef.current || !isDirtyRef.current) return
      event.preventDefault()
      pendingActionRef.current = event.data.action
      setOpen(true)
    })
    return unsubscribe
  }, [navigation])

  const onCancel = useCallback(() => {
    pendingActionRef.current = null
    setOpen(false)
  }, [])

  const onConfirm = useCallback(() => {
    setOpen(false)
    bypassRef.current = true
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) navigation.dispatch(action)
  }, [navigation])

  /** Ejecuta una navegación sin disparar el diálogo (p. ej. tras guardar). */
  const bypass = useCallback((run: () => void) => {
    bypassRef.current = true
    run()
  }, [])

  return { open, onCancel, onConfirm, bypass }
}
