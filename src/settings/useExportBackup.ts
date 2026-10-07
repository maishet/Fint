import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { financeApi } from "../api/finance";
import { exportBackupXlsx } from "../finance/backup-export";

/**
 * Exportar mis datos: cuentas, categorías y movimientos en un Excel. Hoy no
 * tiene fila en Ajustes (decisión de Cristhofer: sigue oculta, como importar y
 * captura); vive aquí para volver a mostrarla con una fila y su aviso previo
 * (`settings.export.warningTitle`), sin reescribir nada.
 */
export function useExportBackup({ onSuccess, onError }: { onSuccess: () => void; onError: (error: unknown) => void }) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const [accounts, categories, transactions] = await Promise.all([
        financeApi.listAccounts(),
        financeApi.listCategories(),
        financeApi.listAllTransactions(),
      ]);
      if (!accounts.length && !categories.length && !transactions.length) throw new Error(t("settings.export.empty"));
      await exportBackupXlsx(
        { accounts, categories, transactions },
        {
          sheets: {
            accounts: t("settings.export.sheets.accounts"),
            categories: t("settings.export.sheets.categories"),
            movements: t("settings.export.sheets.movements"),
          },
          columns: {
            name: t("settings.export.columns.name"),
            type: t("settings.export.columns.type"),
            currency: t("settings.export.columns.currency"),
            balance: t("settings.export.columns.balance"),
            icon: t("settings.export.columns.icon"),
            date: t("settings.export.columns.date"),
            category: t("settings.export.columns.category"),
            account: t("settings.export.columns.account"),
            amount: t("settings.export.columns.amount"),
            note: t("settings.export.columns.note"),
          },
          types: { income: t("forms.income"), expense: t("forms.expense"), transfer: t("forms.transfer") },
          accountTypes: {
            cash: t("accountTypes.cash"),
            credit_card: t("accountTypes.creditCard"),
            checking_account: t("accountTypes.checkingAccount"),
            savings_account: t("accountTypes.savingsAccount"),
          },
        },
        t("settings.export.action"),
        new Date().toISOString(),
      );
    },
    onSuccess,
    onError,
  });
}
