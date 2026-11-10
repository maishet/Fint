import { useState } from 'react'
import { Input, type InputProps } from 'tamagui'

export interface FintInputProps extends InputProps {
  /** Con error: borde `dangerHard` de 1.5px aunque tenga el foco (el mensaje va aparte, con `ErrorLine`). */
  invalid?: boolean
}

/**
 * Campo de texto suelto en una pantalla: `surface` con filete `lineStrong` de 1px en reposo (3.0:1 contra el relleno
 * y 3.4:1 contra el fondo en claro, 3.5:1 en oscuro; sin él, el relleno solo da 1.1:1), borde `ink` de 1.5px
 * enfocado y `dangerHard` con error. Bloqueado (`readOnly`) pasa a `surfaceSunken` con el texto en `inkMuted`.
 */
export function FintInput({ invalid = false, readOnly, onFocus, onBlur, ...props }: FintInputProps) {
  const [focused, setFocused] = useState(false)
  const locked = readOnly === true
  const active = invalid || (focused && !locked)
  return (
    <Input
      bg={locked ? '$surfaceSunken' : '$surface'}
      borderWidth={active ? 1.5 : 1}
      borderColor={invalid ? '$dangerHard' : focused && !locked ? '$ink' : '$lineStrong'}
      color={locked ? '$inkMuted' : '$ink'}
      placeholderTextColor="$inkFaint"
      focusStyle={{ borderColor: invalid ? '$dangerHard' : '$ink', borderWidth: 1.5 }}
      rounded={16}
      minH={52}
      size="$4"
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      {...props}
    />
  )
}
