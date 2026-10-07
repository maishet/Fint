import { Check, Search } from "@tamagui/lucide-icons-2";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View, XStack } from "tamagui";
import { currencyOptions } from "../finance/currencies";
import { radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintSheet, FText, ListRow, SheetField, SheetTextInput } from "../ui";
import { haptics } from "../ui/haptics";
import { filterCurrencies } from "./form";

/** El nombre de la moneda en el idioma de la app; si no está traducida, el de `currency-codes`. */
export function useCurrencyName() {
  const { t } = useTranslation();
  return (code: string) =>
    t(`accountForm.currencyNames.${code}`, { defaultValue: currencyOptions.find((o) => o.value === code)?.label ?? code });
}

/** El código en `mono` dentro de una placa `surfaceSunken`, como en "Saldos por moneda". */
export function CurrencyCode({ code }: { code: string }) {
  return (
    <View width={40} height={28} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
      <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.mono[500], fontSize: 12 }}>
        {code}
      </FText>
    </View>
  );
}

export interface CurrencySheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  /** Monedas que no se ofrecen (las que la tarjeta ya tiene activas). */
  exclude?: readonly string[];
  onSelect: (code: string) => void;
}

/** Hoja de monedas con buscador: código en `mono`, nombre y la marca en la elegida. Tocar elige y cierra. */
export function CurrencySheet({ open, onClose, title, value, exclude = [], onSelect }: CurrencySheetProps) {
  const { t } = useTranslation();
  const nameOf = useCurrencyName();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Son unas 25: se arman en cada render, sin memo.
  const options = currencyOptions
    .filter((o) => !exclude.includes(o.value))
    .map((o) => ({ code: o.value, name: nameOf(o.value), englishName: o.label }));
  const shown = filterCurrencies(options, query);

  return (
    <FintSheet open={open} onClose={onClose} title={title} scrollable snapPoints={[78]}>
      <XStack px={16} pt={12} pb={6}>
        <View flex={1}>
          <SheetField focused={focused}>
            <Search size={18} color="$inkFaint" strokeWidth={2} />
            <SheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("accountForm.searchCurrency")}
              autoCorrect={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={t("accountForm.searchCurrency")}
            />
          </SheetField>
        </View>
      </XStack>
      {shown.length === 0 ? (
        <FText variant="body" tone="inkMuted" style={{ textAlign: "center", paddingVertical: 24 }}>
          {t("accountForm.noCurrencies")}
        </FText>
      ) : (
        shown.map((option, i) => (
          <ListRow
            key={option.code}
            divider={i > 0}
            leading={<CurrencyCode code={option.code} />}
            title={option.name}
            trailing={option.code === value ? <Check size={18} color="$brand" strokeWidth={2.4} /> : undefined}
            onPress={() => {
              haptics.select();
              onSelect(option.code);
              onClose();
            }}
          />
        ))
      )}
    </FintSheet>
  );
}
