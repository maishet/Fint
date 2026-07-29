import type { ReactNode } from 'react'
import { Paragraph, YStack, type YStackProps } from 'tamagui'

interface FintFormFieldProps extends YStackProps {
  children: ReactNode
  error?: string
  hint?: ReactNode
  invalidBorder?: boolean
  label: string
  required?: boolean
  showLabel?: boolean
}

export function FintFormField({ children, error, hint, invalidBorder = false, label, required = false, showLabel = true, ...props }: FintFormFieldProps) {
  return (
    <YStack width="100%" gap="$2" {...props}>
      {showLabel ? <YStack gap="$1">
        <Paragraph color="$color10" fontSize="$2" fontWeight="600">
          {label}{required ? ' *' : ''}
        </Paragraph>
        {hint}
      </YStack> : null}
      {invalidBorder ? (
        <YStack width="100%" borderColor={error ? '$red8' : 'transparent'} borderWidth={1} rounded={15} p={1}>
          {children}
        </YStack>
      ) : children}
      {error ? <Paragraph color="$red10" fontSize="$1" fontWeight="600">{error}</Paragraph> : null}
    </YStack>
  )
}
