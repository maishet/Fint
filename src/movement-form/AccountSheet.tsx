import { Check } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { XStack, type ColorTokens } from "tamagui";
import type { AccountOption } from "../api/types";
import { getAccountTypeLabel } from "../finance/accountTypes";
import { categoryColorIndex } from "../home/spending";
import { Amount, FintSheet, ListRow, Monogram } from "../ui";
import { haptics } from "../ui/haptics";
import { accountBalance, accountCurrencies } from "./logic";

export interface AccountChoice {
  account: AccountOption;
  currency: string;
}

export interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  accounts: readonly AccountOption[];
  selected: { id: string; currency?: string } | null;
  onSelect: (choice: AccountChoice) => void;
  /**
   * Una fila por saldo: una tarjeta con soles y dólares aparece dos veces y
   * elegir una fila elige también la moneda. En transferencias va apagado
   * porque la moneda sale de lo que comparten las dos cuentas.
   */
  perBalance?: boolean;
}

/** La inicial de la cuenta en el color de identidad que le toca por su nombre. */
export function AccountMonogram({ name, size = 38 }: { name: string; size?: 32 | 38 }) {
  return <Monogram name={name} size={size} color={`$chart${categoryColorIndex(name)}` as ColorTokens} />;
}

/** Hoja para elegir la cuenta del movimiento: nombre, tipo y saldo disponible. */
export function AccountSheet({ open, onClose, title, accounts, selected, onSelect, perBalance = true }: AccountSheetProps) {
  const { t } = useTranslation();

  const rows = accounts.flatMap((account) => {
    const currencies = perBalance ? accountCurrencies(account) : [account.currency];
    return currencies.map((currency) => ({ account, currency, multi: currencies.length > 1 }));
  });

  return (
    <FintSheet open={open} onClose={onClose} title={title} scrollable={rows.length > 6} snapPoints={rows.length > 6 ? [70] : undefined}>
      <XStack height={8} />
      {rows.map(({ account, currency, multi }, i) => {
        const isSelected = selected?.id === account.id && (!perBalance || !selected.currency || selected.currency === currency);
        const balance = accountBalance(account, currency);
        const typeLabel = account.accountType ? getAccountTypeLabel(account.accountType, t) : null;
        return (
          <ListRow
            key={`${account.id}-${currency}`}
            divider={i > 0}
            leading={<AccountMonogram name={account.name} />}
            title={multi ? `${account.name} · ${currency}` : account.name}
            subtitle={[typeLabel, currency].filter(Boolean).join(" · ")}
            trailing={
              <XStack items="center" gap={10}>
                {balance !== null ? <Amount value={balance} currency={currency} variant="amount-sm" tone="inkMuted" /> : null}
                {isSelected ? <Check size={18} color="$brand" strokeWidth={2.4} /> : null}
              </XStack>
            }
            onPress={() => {
              haptics.select();
              onSelect({ account, currency });
              onClose();
            }}
          />
        );
      })}
    </FintSheet>
  );
}
