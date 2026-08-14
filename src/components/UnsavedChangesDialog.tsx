import { Trash2 } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { FintConfirmDialog } from '../ui/FintConfirmDialog'

/**
 * Diálogo de descarte para la guardia de cambios sin guardar. Se alimenta del
 * hook `useUnsavedChangesGuard`: `<UnsavedChangesDialog {...guard} />`.
 */
export function UnsavedChangesDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <FintConfirmDialog
      open={open}
      isPending={false}
      destructive
      icon={<Trash2 size={18} color="$primaryForeground" />}
      title={t('forms.discard.title')}
      description={t('forms.discard.description')}
      cancelLabel={t('forms.discard.keepEditing')}
      confirmLabel={t('forms.discard.confirm')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
