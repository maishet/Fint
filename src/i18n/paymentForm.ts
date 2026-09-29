/**
 * Textos del formulario de pago recurrente v3. Bundle aparte, registrado en
 * `index.ts`. Títulos, mensajes de guardar, frecuencias y débito automático
 * reutilizan las claves `payments.*` que ya existían.
 */
export const paymentFormTranslations = {
  es: {
    paymentForm: {
      close: "Cerrar",
      amount: "Monto de cada pago",
      currency: "Moneda: {{currency}}",
      name: "Nombre",
      frequency: "Frecuencia",
      category: "Categoría",
      choose: "Elegir",
      chooseAccount: "Elegir cuenta",
      next_one: "Próximo: {{list}}",
      next_other: "Próximos: {{list}}",
      and: "y",
      currencyLocked: "La moneda no se cambia al editar un pago recurrente.",
      amountLocked: "Ya tiene pagos registrados: el monto y la moneda no se cambian.",
    },
  },
  en: {
    paymentForm: {
      close: "Close",
      amount: "Amount of each payment",
      currency: "Currency: {{currency}}",
      name: "Name",
      frequency: "Frequency",
      category: "Category",
      choose: "Choose",
      chooseAccount: "Choose account",
      next_one: "Next: {{list}}",
      next_other: "Next: {{list}}",
      and: "and",
      currencyLocked: "The currency can't be changed when editing a recurring payment.",
      amountLocked: "It already has recorded payments: the amount and currency can't be changed.",
    },
  },
  pt: {
    paymentForm: {
      close: "Fechar",
      amount: "Valor de cada pagamento",
      currency: "Moeda: {{currency}}",
      name: "Nome",
      frequency: "Frequência",
      category: "Categoria",
      choose: "Escolher",
      chooseAccount: "Escolher conta",
      next_one: "Próximo: {{list}}",
      next_other: "Próximos: {{list}}",
      and: "e",
      currencyLocked: "A moeda não se altera ao editar um pagamento recorrente.",
      amountLocked: "Já tem pagamentos registrados: o valor e a moeda não se alteram.",
    },
  },
} as const;
