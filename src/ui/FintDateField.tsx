import { CalendarDays, ChevronDown } from '@tamagui/lucide-icons-2'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, LocaleConfig, type DateData } from 'react-native-calendars'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Paragraph, Sheet, useTheme, XStack, YStack, type XStackProps } from 'tamagui'
import { formatDateString } from '../finance/dates'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { getAppLocale } from '../i18n'

LocaleConfig.locales.es = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
  today: 'Hoy',
}

LocaleConfig.locales.pt = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'],
  today: 'Hoje',
}

interface FintDateFieldProps extends Omit<XStackProps, 'onPress'> {
  label: string
  minDate?: string
  onValueChange: (value: string) => void
  placeholder: string
  showLabel?: boolean
  value: string
  renderTrigger?: (props: { onPress: () => void; selectedLabel: string }) => ReactNode
}

export function FintDateField({ label, minDate, onValueChange, placeholder, renderTrigger, showLabel = true, value, ...props }: FintDateFieldProps) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const locale = getAppLocale(i18n.resolvedLanguage)
  const selectedLabel = value ? formatDateString(value, locale) : placeholder
  LocaleConfig.defaultLocale = i18n.resolvedLanguage === 'en' ? '' : i18n.resolvedLanguage === 'pt' ? 'pt' : 'es'
  const closeSheet = useCallback(() => setIsOpen(false), [])
  useSheetBackHandler(isOpen, closeSheet)

  const selectDate = (day: DateData) => {
    onValueChange(day.dateString)
    setIsOpen(false)
  }

  return (
    <>
      {renderTrigger ? renderTrigger({ onPress: () => setIsOpen(true), selectedLabel }) : <XStack
        width="100%"
        minH={64}
        items="center"
        justify="space-between"
        gap="$3"
        bg="$muted"
        borderColor="$input"
        borderWidth={1}
        rounded={14}
        px="$3"
        py="$2"
        pressStyle={{ bg: '$secondary', borderColor: '$ring' }}
        cursor="pointer"
        role="button"
        onPress={() => setIsOpen(true)}
        aria-label={`${label}: ${value || placeholder}`}
        {...props}
      >
        <XStack items="center" gap="$3" flex={1} minW={0}>
          <CalendarDays size={19} color="$primary" />
          <YStack flex={1} minW={0} gap="$1">
            {showLabel ? <Paragraph color="$color10" fontSize="$1">{label}</Paragraph> : null}
            <Paragraph color={value ? '$color12' : '$mutedForeground'} fontWeight="700" numberOfLines={1}>
              {value ? formatDateString(value, locale) : placeholder}
            </Paragraph>
          </YStack>
        </XStack>
        <ChevronDown size={18} color="$color10" />
      </XStack>}

      <Sheet modal open={isOpen} onOpenChange={setIsOpen} snapPointsMode="fit" dismissOnSnapToBottom zIndex={120_000}>
        <Sheet.Overlay bg="rgba(4,18,28,0.62)" />
        <Sheet.Handle bg="$color5" />
        <Sheet.Frame bg="$popover" px="$3" pt="$2" pb={Math.max(insets.bottom, 16)} rounded={18}>
          <Calendar
            current={value || undefined}
            minDate={minDate}
            onDayPress={selectDate}
            markedDates={value ? { [value]: { selected: true, disableTouchEvent: true } } : undefined}
            enableSwipeMonths
            theme={{
              backgroundColor: theme.popover.val,
              calendarBackground: theme.popover.val,
              textSectionTitleColor: theme.color10.val,
              selectedDayBackgroundColor: theme.primary.val,
              selectedDayTextColor: theme.primaryForeground.val,
              todayTextColor: theme.primary.val,
              dayTextColor: theme.color12.val,
              textDisabledColor: theme.color7.val,
              monthTextColor: theme.color12.val,
              arrowColor: theme.primary.val,
              textMonthFontFamily: 'SpaceGroteskBold',
              textDayFontFamily: 'InterRegular',
              textDayHeaderFontFamily: 'InterSemiBold',
              textDayHeaderFontSize: 12,
            }}
          />
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
