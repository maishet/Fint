import { useState } from 'react'
import { Input, type InputProps } from 'tamagui'

export interface FintInputProps extends InputProps {
  invalid?: boolean
}

export function FintInput({ invalid = false, readOnly, onFocus, onBlur, ...props }: FintInputProps) {
  const [focused, setFocused] = useState(false)
  const locked = readOnly === true
  return (
    <Input
      bg={locked ? '$surfaceSunken' : '$surface'}
      borderWidth={1.5}
      borderColor={invalid ? '$dangerHard' : focused && !locked ? '$ink' : 'transparent'}
      color={locked ? '$inkMuted' : '$ink'}
      placeholderTextColor="$inkFaint"
      focusStyle={{ borderColor: invalid ? '$dangerHard' : '$ink' }}
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
