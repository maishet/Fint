import { Paragraph } from 'tamagui'
import { FintCard } from '../ui'

interface MetricCardProps {
  label: string
  value: string
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <FintCard flex={1} minW={150} gap="$2">
      <Paragraph color="$color10" fontSize="$3" fontWeight="600">
        {label}
      </Paragraph>
      <Paragraph color="$color12" fontSize="$7" fontWeight="600" lineHeight="$7">
        {value}
      </Paragraph>
    </FintCard>
  )
}
