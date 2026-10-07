/**
 * Textos de la pantalla Cuentas v3. Bundle aparte, registrado en `index.ts`.
 * Eliminar y sus mensajes reutilizan las claves `accounts.*` que ya existían.
 */
export const accountsScreenTranslations = {
  es: {
    accountsScreen: {
      title: "Cuentas",
      back: "Volver",
      netWorth: "Patrimonio neto",
      currency: "Moneda del patrimonio",
      assets: "Activos",
      liabilities: "Pasivos",
      groups: { bank: "Bancos", cash: "Efectivo", card: "Tarjetas de crédito", other: "Otras" },
      emptyTitle: "Agrega tu primera cuenta para empezar",
      emptyAction: "Agregar cuenta",
      edit: "Editar",
      delete: "Eliminar",
    },
  },
  en: {
    accountsScreen: {
      title: "Accounts",
      back: "Back",
      netWorth: "Net worth",
      currency: "Net worth currency",
      assets: "Assets",
      liabilities: "Liabilities",
      groups: { bank: "Banks", cash: "Cash", card: "Credit cards", other: "Other" },
      emptyTitle: "Add your first account to get started",
      emptyAction: "Add account",
      edit: "Edit",
      delete: "Delete",
    },
  },
  pt: {
    accountsScreen: {
      title: "Contas",
      back: "Voltar",
      netWorth: "Patrimônio líquido",
      currency: "Moeda do patrimônio",
      assets: "Ativos",
      liabilities: "Passivos",
      groups: { bank: "Bancos", cash: "Dinheiro", card: "Cartões de crédito", other: "Outras" },
      emptyTitle: "Adicione sua primeira conta para começar",
      emptyAction: "Adicionar conta",
      edit: "Editar",
      delete: "Excluir",
    },
  },
} as const;
