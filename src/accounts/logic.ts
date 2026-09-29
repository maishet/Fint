import type { Account } from "../api/types";

/**
 * Lógica pura de la pantalla Cuentas: los saldos de cada cuenta y los grupos
 * por tipo (Bancos, Efectivo, Tarjetas de crédito). Sin React, para poder probarla.
 */

export type AccountGroupKey = "bank" | "cash" | "card" | "other";

/** Un saldo por moneda: una tarjeta puede tener línea en soles y en dólares; el resto, una sola. */
export function accountLines(account: Account): { currency: string; balance: number }[] {
  return account.balances?.length ? account.balances : [{ currency: account.currency, balance: account.balance }];
}

export function accountGroup(accountType: string): AccountGroupKey {
  if (accountType === "checking_account" || accountType === "savings_account") return "bank";
  if (accountType === "cash") return "cash";
  if (accountType === "credit_card") return "card";
  return "other";
}

export interface AccountGroup {
  key: AccountGroupKey;
  /** Suma de los saldos del grupo en `currency` (nunca se mezclan monedas). */
  total: number;
  accounts: Account[];
}

/**
 * Las cuentas que tienen saldo en `currency`, agrupadas por tipo en el orden
 * Bancos, Efectivo, Tarjetas, Otras. Dentro de cada grupo, de mayor a menor
 * saldo (en valor absoluto: la tarjeta que más se debe va primero). Un grupo
 * vacío no aparece.
 */
export function groupAccounts(accounts: readonly Account[], currency: string): AccountGroup[] {
  const order: AccountGroupKey[] = ["bank", "cash", "card", "other"];
  const inCurrency = (a: Account) => accountLines(a).find((l) => l.currency === currency)?.balance;
  const groups = new Map<AccountGroupKey, Account[]>();
  for (const account of accounts) {
    if (inCurrency(account) === undefined) continue;
    const key = accountGroup(account.accountType);
    groups.set(key, [...(groups.get(key) ?? []), account]);
  }
  return order
    .filter((key) => groups.has(key))
    .map((key) => {
      const list = [...groups.get(key)!].sort((a, b) => Math.abs(inCurrency(b) ?? 0) - Math.abs(inCurrency(a) ?? 0));
      const total = Math.round(list.reduce((sum, a) => sum + (inCurrency(a) ?? 0), 0) * 100) / 100;
      return { key, total, accounts: list };
    });
}

/**
 * Activos y pasivos en `currency`, a partir de los saldos: lo positivo suma a
 * activos (también una tarjeta con saldo a favor) y lo negativo a pasivos. Así
 * activos menos pasivos es el patrimonio que muestra la tarjeta; el backend deja
 * fuera de activos el saldo a favor de una tarjeta y la cuenta no cuadraba.
 */
export function assetsAndLiabilities(accounts: readonly Account[], currency: string): { assets: number; liabilities: number } {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    for (const line of accountLines(account)) {
      if (line.currency !== currency) continue;
      if (line.balance >= 0) assets += line.balance;
      else liabilities += -line.balance;
    }
  }
  return { assets: Math.round(assets * 100) / 100, liabilities: Math.round(liabilities * 100) / 100 };
}
