import { getStoredCurrentLanguage } from '../i18n/current-language'

/**
 * El backend siempre responde en inglés (no tiene noción de idioma del usuario).
 * Esta es la única traducción de esos mensajes: si un mensaje nuevo aparece aquí
 * sin mapear, se muestra tal cual en inglés en vez de romper la petición.
 */
type Translations = { es: string; en: string; pt: string }

const exactMessages: Record<string, Translations> = {
  'Account not found': {
    es: 'No encontramos esa cuenta.',
    en: 'Account not found.',
    pt: 'Não encontramos essa conta.',
  },
  'Could not load dashboard overview': {
    es: 'No pudimos cargar el resumen.',
    en: 'Could not load dashboard overview.',
    pt: 'Não conseguimos carregar o resumo.',
  },
  'Could not load expense categories': {
    es: 'No pudimos cargar las categorías.',
    en: 'Could not load expense categories.',
    pt: 'Não conseguimos carregar as categorias.',
  },
  'Could not load accounts overview': {
    es: 'No pudimos cargar el resumen de cuentas.',
    en: 'Could not load accounts overview.',
    pt: 'Não conseguimos carregar o resumo de contas.',
  },
  'Could not load transaction page': {
    es: 'No pudimos cargar los movimientos.',
    en: 'Could not load transaction page.',
    pt: 'Não conseguimos carregar os lançamentos.',
  },
  'Could not create payment rule': {
    es: 'No pudimos crear la regla de pago.',
    en: 'Could not create payment rule.',
    pt: 'Não conseguimos criar a regra de pagamento.',
  },
  'Payment rule not found': {
    es: 'No encontramos esa regla de pago.',
    en: 'Payment rule not found.',
    pt: 'Regra de pagamento não encontrada.',
  },
  'Credit card payment rules are no longer supported and cannot be edited': {
    es: 'Las reglas de pago de tarjeta de crédito ya no son compatibles y no se pueden editar.',
    en: 'Credit card payment rules are no longer supported and cannot be edited.',
    pt: 'As regras de pagamento de cartão de crédito não são mais compatíveis e não podem ser editadas.',
  },
  'Amount cannot be changed after payments were registered': {
    es: 'El monto no se puede cambiar después de registrar pagos.',
    en: 'Amount cannot be changed after payments were registered.',
    pt: 'O valor não pode ser alterado depois de registrar pagamentos.',
  },
  'Another occurrence already covers that period': {
    es: 'Ya existe un pago programado para ese período.',
    en: 'Another occurrence already covers that period.',
    pt: 'Já existe um pagamento programado para esse período.',
  },
  'Payment occurrence not found': {
    es: 'No encontramos ese pago programado.',
    en: 'Payment occurrence not found.',
    pt: 'Não encontramos esse pagamento programado.',
  },
  'Credit card payments are no longer supported': {
    es: 'Los pagos de tarjeta de crédito ya no son compatibles.',
    en: 'Credit card payments are no longer supported.',
    pt: 'Os pagamentos de cartão de crédito não são mais compatíveis.',
  },
  'Payment occurrence amount must be configured first': {
    es: 'Primero debes configurar el monto de este pago.',
    en: 'Payment occurrence amount must be configured first.',
    pt: 'Primeiro você precisa configurar o valor deste pagamento.',
  },
  'Payment amount cannot exceed outstanding amount': {
    es: 'El monto no puede superar lo pendiente por pagar.',
    en: 'Payment amount cannot exceed outstanding amount.',
    pt: 'O valor não pode superar o saldo pendente.',
  },
  'Could not create payment transaction': {
    es: 'No pudimos registrar el pago.',
    en: 'Could not create payment transaction.',
    pt: 'Não conseguimos registrar o pagamento.',
  },
  'Could not register payment': {
    es: 'No pudimos registrar el pago.',
    en: 'Could not register payment.',
    pt: 'Não conseguimos registrar o pagamento.',
  },
  'Payment not found': {
    es: 'No encontramos ese pago.',
    en: 'Payment not found.',
    pt: 'Não encontramos esse pagamento.',
  },
  'Payment transaction is not posted': {
    es: 'Ese pago todavía no está confirmado.',
    en: 'Payment transaction is not posted.',
    pt: 'Esse pagamento ainda não está confirmado.',
  },
  'Pending movement not found': {
    es: 'No encontramos ese movimiento pendiente.',
    en: 'Pending movement not found.',
    pt: 'Não encontramos esse lançamento pendente.',
  },
  'Could not create account': {
    es: 'No pudimos crear la cuenta.',
    en: 'Could not create account.',
    pt: 'Não conseguimos criar a conta.',
  },
  'Account name already exists': {
    es: 'Ya existe otra cuenta con ese nombre.',
    en: 'Another account already uses that name.',
    pt: 'Já existe outra conta com esse nome.',
  },
  'Disable the secondary currency balances before changing this account away from credit card': {
    es: 'Desactiva los saldos en moneda secundaria antes de cambiar esta cuenta a otro tipo.',
    en: 'Disable the secondary currency balances before changing this account away from credit card.',
    pt: 'Desative os saldos em moeda secundária antes de mudar esta conta para outro tipo.',
  },
  'Enable a balance in that currency before making it the primary one': {
    es: 'Habilita un saldo en esa moneda antes de convertirla en la principal.',
    en: 'Enable a balance in that currency before making it the primary one.',
    pt: 'Habilite um saldo nessa moeda antes de torná-la a principal.',
  },
  'Cannot change the primary currency once the account has transaction history': {
    es: 'No puedes cambiar la moneda principal una vez que la cuenta tiene movimientos.',
    en: 'Cannot change the primary currency once the account has transaction history.',
    pt: 'Não é possível mudar a moeda principal depois que a conta tem lançamentos.',
  },
  'Only credit card accounts can enable a second currency balance': {
    es: 'Solo las tarjetas de crédito pueden habilitar una segunda moneda.',
    en: 'Only credit card accounts can enable a second currency balance.',
    pt: 'Somente cartões de crédito podem habilitar uma segunda moeda.',
  },
  'That currency already has an active balance': {
    es: 'Esa moneda ya tiene un saldo activo en esta cuenta.',
    en: 'That currency already has an active balance on this account.',
    pt: 'Essa moeda já tem um saldo ativo nesta conta.',
  },
  'An account can have at most 2 active currency balances': {
    es: 'Una cuenta puede tener como máximo 2 monedas activas.',
    en: 'An account can have at most 2 active currency balances.',
    pt: 'Uma conta pode ter no máximo 2 moedas ativas.',
  },
  'Cannot disable the primary currency balance': {
    es: 'No puedes desactivar el saldo de la moneda principal.',
    en: 'Cannot disable the primary currency balance.',
    pt: 'Não é possível desativar o saldo da moeda principal.',
  },
  'Active balance not found for that currency': {
    es: 'No encontramos un saldo activo en esa moneda.',
    en: 'Active balance not found for that currency.',
    pt: 'Não encontramos um saldo ativo nessa moeda.',
  },
  'Balance must be zero before it can be disabled': {
    es: 'El saldo debe estar en cero antes de poder desactivarlo.',
    en: 'Balance must be zero before it can be disabled.',
    pt: 'O saldo precisa estar em zero antes de poder ser desativado.',
  },
  'There is an active automatic payment using this balance; disable it first': {
    es: 'Hay un pago automático activo que usa este saldo; desactívalo primero.',
    en: 'There is an active automatic payment using this balance; disable it first.',
    pt: 'Há um pagamento automático ativo usando este saldo; desative-o primeiro.',
  },
  'Could not create category': {
    es: 'No pudimos crear la categoría.',
    en: 'Could not create category.',
    pt: 'Não conseguimos criar a categoria.',
  },
  'Category name already exists': {
    es: 'Ya existe otra categoría con ese nombre.',
    en: 'Another category already uses that name.',
    pt: 'Já existe outra categoria com esse nome.',
  },
  'Category not found': {
    es: 'No encontramos esa categoría.',
    en: 'Category not found.',
    pt: 'Não encontramos essa categoria.',
  },
  'Could not create transaction': {
    es: 'No pudimos registrar el movimiento.',
    en: 'Could not create transaction.',
    pt: 'Não conseguimos registrar o lançamento.',
  },
  'Transaction not found': {
    es: 'No encontramos ese movimiento.',
    en: 'Transaction not found.',
    pt: 'Não encontramos esse lançamento.',
  },
  'Payment occurrence transactions cannot be edited': {
    es: 'Los movimientos generados por un pago no se pueden editar.',
    en: 'Payment occurrence transactions cannot be edited.',
    pt: 'Os lançamentos gerados por um pagamento não podem ser editados.',
  },
  'Payment occurrence transactions cannot be deleted': {
    es: 'Los movimientos generados por un pago no se pueden eliminar.',
    en: 'Payment occurrence transactions cannot be deleted.',
    pt: 'Os lançamentos gerados por um pagamento não podem ser excluídos.',
  },
  'Pending movement is already resolved': {
    es: 'Ese movimiento pendiente ya fue resuelto.',
    en: 'Pending movement is already resolved.',
    pt: 'Esse lançamento pendente já foi resolvido.',
  },
  'Payment currency must match occurrence currency': {
    es: 'La moneda del pago debe coincidir con la del pago programado.',
    en: 'Payment currency must match occurrence currency.',
    pt: 'A moeda do pagamento deve coincidir com a do pagamento programado.',
  },
  'Could not apply pending payment': {
    es: 'No pudimos aplicar el pago pendiente.',
    en: 'Could not apply pending payment.',
    pt: 'Não conseguimos aplicar o pagamento pendente.',
  },
  'Could not register pending payment': {
    es: 'No pudimos registrar el pago pendiente.',
    en: 'Could not register pending payment.',
    pt: 'Não conseguimos registrar o pagamento pendente.',
  },
  'Pending movement amount is required': {
    es: 'El monto del movimiento pendiente es obligatorio.',
    en: 'Pending movement amount is required.',
    pt: 'O valor do lançamento pendente é obrigatório.',
  },
  'Could not confirm pending movement': {
    es: 'No pudimos confirmar el movimiento pendiente.',
    en: 'Could not confirm pending movement.',
    pt: 'Não conseguimos confirmar o lançamento pendente.',
  },
  'Origin account has no active balance in that currency': {
    es: 'La cuenta de origen no tiene un saldo activo en esa moneda.',
    en: 'Origin account has no active balance in that currency.',
    pt: 'A conta de origem não tem um saldo ativo nessa moeda.',
  },
  'Destination account has no active balance in that currency': {
    es: 'La cuenta de destino no tiene un saldo activo en esa moneda.',
    en: 'Destination account has no active balance in that currency.',
    pt: 'A conta de destino não tem um saldo ativo nessa moeda.',
  },
  'Could not create transfer': {
    es: 'No pudimos crear la transferencia.',
    en: 'Could not create transfer.',
    pt: 'Não conseguimos criar a transferência.',
  },
  'Transfer not found': {
    es: 'No encontramos esa transferencia.',
    en: 'Transfer not found.',
    pt: 'Não encontramos essa transferência.',
  },
  'Transfer is not in a reversible state': {
    es: 'Esta transferencia ya no se puede revertir.',
    en: 'Transfer is not in a reversible state.',
    pt: 'Esta transferência não pode mais ser revertida.',
  },
  'Transfer legs are inconsistent': {
    es: 'La transferencia tiene datos inconsistentes.',
    en: 'Transfer legs are inconsistent.',
    pt: 'A transferência tem dados inconsistentes.',
  },
  'An account is required to enable automatic payment registration': {
    es: 'Se requiere una cuenta para habilitar el registro automático de pagos.',
    en: 'An account is required to enable automatic payment registration.',
    pt: 'É necessária uma conta para habilitar o registro automático de pagamentos.',
  },
  'Payment account has no active balance in the occurrence currency': {
    es: 'La cuenta de pago no tiene un saldo activo en la moneda de este pago.',
    en: 'Payment account has no active balance in the occurrence currency.',
    pt: 'A conta de pagamento não tem um saldo ativo na moeda deste pagamento.',
  },
  'Automatic payment account has no active balance in the rule currency': {
    es: 'La cuenta de pago automático no tiene un saldo activo en la moneda de la regla.',
    en: 'Automatic payment account has no active balance in the rule currency.',
    pt: 'A conta de pagamento automático não tem um saldo ativo na moeda da regra.',
  },
  'Idempotency request could not be claimed': {
    es: 'No pudimos procesar la solicitud. Intenta nuevamente.',
    en: 'Idempotency request could not be claimed.',
    pt: 'Não conseguimos processar a solicitação. Tente novamente.',
  },
  'Idempotency key was reused with a different payload': {
    es: 'La solicitud cambió respecto al intento anterior. Intenta nuevamente.',
    en: 'Idempotency key was reused with a different payload.',
    pt: 'A solicitação mudou em relação à tentativa anterior. Tente novamente.',
  },
  'Identical operation is still in progress': {
    es: 'Esta operación todavía se está procesando.',
    en: 'Identical operation is still in progress.',
    pt: 'Esta operação ainda está sendo processada.',
  },
  'Confirmation is required': {
    es: 'Se requiere confirmación.',
    en: 'Confirmation is required.',
    pt: 'É necessária confirmação.',
  },
  'Enabling a new currency balance is disabled': {
    es: 'Habilitar una nueva moneda está deshabilitado temporalmente.',
    en: 'Enabling a new currency balance is disabled.',
    pt: 'Habilitar uma nova moeda está temporariamente desabilitado.',
  },
  'Recurring payments are disabled': {
    es: 'Los pagos recurrentes están deshabilitados temporalmente.',
    en: 'Recurring payments are disabled.',
    pt: 'Os pagamentos recorrentes estão temporariamente desabilitados.',
  },
  'Pending movement editing is disabled': {
    es: 'La edición de movimientos pendientes está deshabilitada temporalmente.',
    en: 'Pending movement editing is disabled.',
    pt: 'A edição de lançamentos pendentes está temporariamente desabilitada.',
  },
  'Pending-to-payment is disabled': {
    es: 'Confirmar como pago está deshabilitado temporalmente.',
    en: 'Pending-to-payment is disabled.',
    pt: 'Confirmar como pagamento está temporariamente desabilitado.',
  },
}

const dynamicMessages: Array<{ pattern: RegExp; translate: (currency: string) => Translations }> = [
  {
    pattern: /^Account has no active balance in (.+)$/,
    translate: (currency) => ({
      es: `La cuenta no tiene un saldo activo en ${currency}.`,
      en: `Account has no active balance in ${currency}.`,
      pt: `A conta não tem um saldo ativo em ${currency}.`,
    }),
  },
]

export function translateApiErrorMessage(message: string): string {
  const language = getStoredCurrentLanguage()
  const exact = exactMessages[message]
  if (exact) return exact[language]
  for (const { pattern, translate } of dynamicMessages) {
    const match = message.match(pattern)
    if (match) return translate(match[1]!)[language]
  }
  return message
}
