import type { TFunction } from 'i18next'
import { useCallback, useState } from 'react'
import type { ZodType } from 'zod'

type ValidationMessageKey =
  | 'amount'
  | 'date'
  | 'email'
  | 'maxAmount'
  | 'minTwo'
  | 'passwordMin'
  | 'positiveAmount'
  | 'required'
  | 'senderEmails'

const validationDefaults: Record<'en' | 'es' | 'pt', Record<ValidationMessageKey, string>> = {
  es: {
    amount: 'Ingresa un monto válido.',
    date: 'Selecciona una fecha válida.',
    email: 'Ingresa un correo válido.',
    maxAmount: 'El monto no puede superar el saldo pendiente.',
    minTwo: 'Ingresa al menos 2 caracteres.',
    passwordMin: 'La contraseña debe tener al menos 6 caracteres.',
    positiveAmount: 'El monto debe ser mayor que cero.',
    required: 'Este campo es obligatorio.',
    senderEmails: 'Ingresa solo direcciones de correo válidas.',
  },
  en: {
    amount: 'Enter a valid amount.',
    date: 'Select a valid date.',
    email: 'Enter a valid email address.',
    maxAmount: 'The amount cannot exceed the outstanding balance.',
    minTwo: 'Enter at least 2 characters.',
    passwordMin: 'The password must contain at least 6 characters.',
    positiveAmount: 'The amount must be greater than zero.',
    required: 'This field is required.',
    senderEmails: 'Enter valid email addresses only.',
  },
  pt: {
    amount: 'Informe um valor válido.',
    date: 'Selecione uma data válida.',
    email: 'Informe um endereço de e-mail válido.',
    maxAmount: 'O valor não pode superar o saldo pendente.',
    minTwo: 'Informe pelo menos 2 caracteres.',
    passwordMin: 'A senha deve ter pelo menos 6 caracteres.',
    positiveAmount: 'O valor deve ser maior que zero.',
    required: 'Este campo é obrigatório.',
    senderEmails: 'Informe apenas endereços de e-mail válidos.',
  },
}

export function getValidationMessage(t: TFunction, language: string | undefined, key: ValidationMessageKey) {
  const locale = language === 'en' || language === 'pt' ? language : 'es'
  return t(`validation.${key}`, { defaultValue: validationDefaults[locale][key] })
}

export function parseDecimalInput(value: string) {
  return Number(value.trim().replace(',', '.'))
}

export function useSubmitValidation<TField extends string>() {
  const [errors, setErrors] = useState<Partial<Record<TField, string>>>({})

  const validate = useCallback(<TOutput,>(schema: ZodType<TOutput>, values: unknown): TOutput | null => {
    const result = schema.safeParse(values)
    if (result.success) {
      setErrors({})
      return result.data
    }

    const nextErrors: Partial<Record<TField, string>> = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      if (typeof field === 'string' && !nextErrors[field as TField]) nextErrors[field as TField] = issue.message
    }
    setErrors(nextErrors)
    return null
  }, [])

  const setError = useCallback((field: TField, message: string) => {
    setErrors((current) => ({ ...current, [field]: message }))
  }, [])

  const validateField = useCallback((field: TField, schema: ZodType, value: unknown) => {
    const result = schema.safeParse(value)
    if (result.success) {
      setErrors((current) => {
        if (!current[field]) return current
        const next = { ...current }
        delete next[field]
        return next
      })
      return
    }
    const message = result.error.issues[0]?.message
    if (message) setErrors((current) => ({ ...current, [field]: message }))
  }, [])

  const clearError = useCallback((...fields: TField[]) => {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) return current
      const next = { ...current }
      for (const field of fields) delete next[field]
      return next
    })
  }, [])

  const resetErrors = useCallback(() => setErrors({}), [])

  return { clearError, errors, resetErrors, setError, validate, validateField }
}
