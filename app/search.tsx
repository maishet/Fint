import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CalendarDays, Check, Clock, FileText, Search, X } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Pressable, ScrollView, TextInput, useWindowDimensions, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../src/api/finance";
import type { Transaction } from "../src/api/types";
import { useAuth } from "../src/auth/AuthProvider";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { getCurrencySymbol } from "../src/finance/currencies";
import { useCategoryIcons } from "../src/finance/useCategoryIcons";
import { categoryTint } from "../src/finance/categoryTint";
import { useCategoryHue } from "../src/finance/emojiHue";
import { useThemeMode } from "../src/theme/ThemeMode";
import { SkeletonBlock, SkeletonGroup } from "../src/components/Skeleton";
import { getAppLocale } from "../src/i18n";
import { frequentCategories, last30DaysRange } from "../src/movement-form/logic";
import { DayHeader } from "../src/movements/DayHeader";
import { buildEntries, groupTransfers, type MovementItem } from "../src/movements/logic";
import { addRecent, amountQuery, applyFilters, highlightParts, matches, NO_FILTERS, summarize, topAccount, type SearchFilters } from "../src/search/logic";
import { getRecentSearches, storeRecentSearches } from "../src/search/recentStorage";
import { withAlpha } from "../src/theme/color";
import { COMPACT_FONT_SCALE, motion, radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { Amount, Chip, FintButton, FText, Monogram, PressableScale, RowAmount } from "../src/ui";
import { detailParams } from "../src/movements/detailParams";

/** Los resultados se actualizan este tiempo después de la última tecla. */
const DEBOUNCE_MS = 250;
/** Páginas de 50 que se traen por búsqueda: los 200 más recientes (los filtros rápidos corren sobre ellos). */
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
/** El filtro "Más de …", en la moneda de cada movimiento. */
const OVER = 100;

async function searchTransactions(q: string, signal: AbortSignal) {
  const items: Transaction[] = [];
  let cursor: string | undefined;
  let total = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await financeApi.getTransactionPage({ q, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal);
    if (page === 0) total = result.summary.totalCount;
    items.push(...result.items);
    if (!result.pageInfo.hasNextPage || !result.pageInfo.nextCursor) break;
    cursor = result.pageInfo.nextCursor;
  }
  return { items, total };
}

/**
 * La búsqueda global (`Busqueda` del design system): la abre el buscador del hero del Inicio y busca en todas las
 * fechas y cuentas (el servidor busca en la nota, la categoría, la cuenta y el monto). Sin texto, las búsquedas
 * recientes y las categorías que más registra la persona; con texto, un resumen, los filtros rápidos y los
 * movimientos por día con la coincidencia resaltada. La búsqueda del tab Movimientos sigue siendo la del mes.
 *
 * El diseño muestra comercios ("Tambo+", "Donde más compras"): los movimientos todavía no traen el comercio
 * (`merchant` del contrato v2), así que aquí van las categorías.
 */
export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const iconFor = useCategoryIcons();
  useScreenStatusBar();

  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    if (!userId) return;
    void getRecentSearches(userId).then(setRecent);
  }, [userId]);

  const remember = (value: string) => {
    if (!userId || !value.trim()) return;
    const next = addRecent(recent, value);
    setRecent(next);
    void storeRecentSearches(userId, next);
  };
  const forget = (value: string | null) => {
    if (!userId) return;
    const next = value === null ? [] : recent.filter((r) => r !== value);
    setRecent(next);
    void storeRecentSearches(userId, next);
  };

  const resultsQuery = useQuery({
    queryKey: ["transactions", "search", query],
    queryFn: ({ signal }) => searchTransactions(query, signal),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Las categorías que más registra, para empezar sin escribir.
  const range = useMemo(() => last30DaysRange(), []);
  const recentTxQuery = useQuery({
    queryKey: ["transactions", "recent-30", range.from],
    queryFn: () => financeApi.listAllTransactions(range),
    staleTime: 5 * 60_000,
  });
  const categoriesQuery = useQuery({ queryKey: ["categories", "expense"], queryFn: () => financeApi.listCategories("expense") });
  const frequent = useMemo(
    () => frequentCategories(recentTxQuery.data ?? [], "expense", categoriesQuery.data ?? [], 5),
    [categoriesQuery.data, recentTxQuery.data],
  );

  const all = query && resultsQuery.data ? resultsQuery.data.items : [];
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const account = useMemo(() => topAccount(all), [all]);
  const mainCurrency = summary.totals[0]?.currency ?? filtered[0]?.currency ?? "PEN";
  const entries = useMemo(() => buildEntries(groupTransfers(filtered), mainCurrency), [filtered, mainCurrency]);
  const truncated = resultsQuery.data ? resultsQuery.data.total > all.length : false;

  // El número de resultados se anuncia al actualizarse.
  useEffect(() => {
    if (!query || !resultsQuery.data || resultsQuery.isPlaceholderData) return;
    AccessibilityInfo.announceForAccessibility(t("search.found", { count: filtered.length }));
  }, [filtered.length, query, resultsQuery.data, resultsQuery.isPlaceholderData, t]);

  const searchFor = (value: string) => {
    setText(value);
    setQuery(value.trim());
    remember(value);
    input.current?.blur();
  };

  const toggle = (patch: Partial<SearchFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const symbol = getCurrencySymbol(mainCurrency);
  const chips: { key: string; label: string; icon?: ReactNode; on: boolean; press: () => void }[] = [
    {
      key: "expense",
      label: t("search.expenses"),
      icon: <ArrowDown size={14} color={filters.type === "expense" ? "$canvas" : "$inkMuted"} strokeWidth={2} />,
      on: filters.type === "expense",
      press: () => toggle({ type: filters.type === "expense" ? null : "expense" }),
    },
    {
      key: "income",
      label: t("search.incomes"),
      icon: <ArrowUp size={14} color={filters.type === "income" ? "$canvas" : "$inkMuted"} strokeWidth={2} />,
      on: filters.type === "income",
      press: () => toggle({ type: filters.type === "income" ? null : "income" }),
    },
    {
      key: "month",
      label: t("search.thisMonth"),
      icon: <CalendarDays size={14} color={filters.thisMonth ? "$canvas" : "$inkMuted"} strokeWidth={2} />,
      on: filters.thisMonth,
      press: () => toggle({ thisMonth: !filters.thisMonth }),
    },
    {
      key: "over",
      label: t("search.over", { amount: `${symbol} ${OVER}` }),
      on: filters.over != null,
      press: () => toggle({ over: filters.over == null ? OVER : null }),
    },
    ...(account
      ? [{ key: "account", label: account, on: filters.account === account, press: () => toggle({ account: filters.account === account ? null : account }) }]
      : []),
    {
      key: "note",
      label: t("search.withNote"),
      icon: <FileText size={14} color={filters.withNote ? "$canvas" : "$inkMuted"} strokeWidth={2} />,
      on: filters.withNote,
      press: () => toggle({ withNote: !filters.withNote }),
    },
  ];

  const openMovement = (tx: Transaction) => {
    remember(query);
    if (tx.paymentOccurrenceId || tx.type === "transfer") return;
    router.push({ pathname: "/transaction-detail", params: detailParams(tx) });
  };

  // El mes va en minúscula dentro de la frase ("desde setiembre"), salvo en inglés.
  const since = summary.since
    ? (() => {
        const month = new Intl.DateTimeFormat(locale, { month: "long", ...(summary.since.y !== new Date().getFullYear() ? { year: "numeric" } : {}) }).format(
          new Date(summary.since.y, summary.since.m, 1),
        );
        return locale.startsWith("en") ? month : month.toLocaleLowerCase(locale);
      })()
    : null;
  const maxBar = Math.max(...summary.bars, 0);

  let body: ReactNode;
  if (!query) {
    body = (
      <Animated.View key="start" entering={FadeIn.duration(motion.fade.duration)}>
        {recent.length ? (
          <YStack mt={22} px={space[5]}>
            <XStack items="center" justify="space-between" mb={4}>
              <FText accessibilityRole="header" maxFontSizeMultiplier={1.5} style={GROUP_TITLE}>
                {t("search.recent")}
              </FText>
              <Pressable onPress={() => forget(null)} accessibilityRole="button" hitSlop={12}>
                <FText tone="inkMuted" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 13, lineHeight: 18 }}>
                  {t("search.clearRecent")}
                </FText>
              </Pressable>
            </XStack>
            {recent.map((item, i) => {
              const isAmount = amountQuery(item) !== null;
              return (
                <Pressable key={item} onPress={() => searchFor(item)} accessibilityRole="button">
                  {({ pressed }) => (
                    <XStack items="center" gap={12} minH={52} py={8} borderTopWidth={i ? 1 : 0} borderColor="$line" bg={pressed ? "$surfaceSunken" : "transparent"}>
                      <View width={36} height={36} rounded={14} bg="$surface" items="center" justify="center">
                        <Clock size={16} color="$inkMuted" strokeWidth={2} />
                      </View>
                      <XStack flex={1} items="baseline" gap={8} minW={0} flexWrap="wrap">
                        <FText numberOfLines={1} style={isAmount ? { fontFamily: fontFace.mono[600], fontSize: 16, lineHeight: 21 } : { fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
                          {item}
                        </FText>
                        {isAmount ? (
                          <FText variant="caption" tone="inkFaint">
                            {t("search.amount")}
                          </FText>
                        ) : null}
                      </XStack>
                      <Pressable onPress={() => forget(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("search.removeRecent", { text: item })}>
                        <X size={16} color="$inkFaint" strokeWidth={2} />
                      </Pressable>
                    </XStack>
                  )}
                </Pressable>
              );
            })}
          </YStack>
        ) : null}
        {frequent.length ? (
          <YStack mt={22} px={space[5]}>
            <FText accessibilityRole="header" maxFontSizeMultiplier={1.5} style={GROUP_TITLE}>
              {t("search.frequent")}
            </FText>
            {/* "Lo que más registras" en fichas de dos columnas con el fondo de cada categoría. */}
            <XStack mt={10} gap={8} flexWrap="wrap">
              {frequent.map((c) => {
                const label = getCategoryLabel(c.name, t);
                return <FrequentTile key={c.id} name={c.name} label={label} emoji={c.icon} onPress={() => searchFor(label)} />;
              })}
            </XStack>
          </YStack>
        ) : null}
      </Animated.View>
    );
  } else if (resultsQuery.isLoading) {
    body = (
      <SkeletonGroup label={t("states.loading")}>
        <YStack px={space[5]} mt={20}>
          <SkeletonBlock width={200} height={18} rounded={6} mb={8} />
          {[0, 1, 2, 3].map((i) => (
            <XStack key={i} items="center" gap={12} py={12} borderTopWidth={i ? 1 : 0} borderColor="$line">
              <SkeletonBlock width={44} height={44} rounded={14} />
              <YStack flex={1} gap={8}>
                <SkeletonBlock width="60%" height={14} rounded={6} />
                <SkeletonBlock width="40%" height={11} rounded={6} />
              </YStack>
              <SkeletonBlock width={64} height={14} rounded={6} />
            </XStack>
          ))}
        </YStack>
      </SkeletonGroup>
    );
  } else if (resultsQuery.error) {
    body = (
      <FText tone="inkMuted" style={{ margin: space[5], textAlign: "center" }}>
        {t("search.error")}
      </FText>
    );
  } else if (filtered.length === 0) {
    const suggestions = [...recent.filter((r) => r !== query), ...frequent.map((c) => getCategoryLabel(c.name, t))].slice(0, 3);
    body = (
      <Animated.View key={`empty-${query}`} entering={FadeIn.duration(motion.fade.duration)}>
        <YStack items="center" px={space[6]} mt={48}>
          <View width={60} height={60} rounded={20} bg="$surface" items="center" justify="center">
            <Search size={24} color="$ink" strokeWidth={2} />
          </View>
          <FText accessibilityRole="header" style={{ ...GROUP_TITLE, fontSize: 20, lineHeight: 25, marginTop: space[4], textAlign: "center" }}>
            {t("search.emptyTitle", { query })}
          </FText>
          <FText tone="inkMuted" style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20 }}>
            {t("search.emptyBody")}
          </FText>
          {suggestions.length ? (
            <XStack mt={space[4]} gap={8} flexWrap="wrap" justify="center">
              {suggestions.map((s) => (
                <Chip key={s} label={s} onPress={() => searchFor(s)} />
              ))}
            </XStack>
          ) : null}
          <FintButton
            variant="solid"
            mt={space[5]}
            onPress={() => router.push({ pathname: "/transaction-form", params: { type: "expense", ...(amountQuery(query) !== null ? { amount: String(amountQuery(query)) } : { note: query }) } })}
          >
            {t("search.register")}
          </FintButton>
        </YStack>
      </Animated.View>
    );
  } else {
    body = (
      <Animated.View key={`results-${query}`} entering={FadeIn.duration(motion.fade.duration)}>
        {/* Resumen (H-07): cuántos y desde cuándo, la suma con su signo y el ritmo de los últimos meses. */}
        <XStack mx={space[5]} mt={18} items="flex-end" gap={12}>
          <YStack flex={1} minW={0} gap={2}>
            <FText style={GROUP_TITLE}>
              {[t("search.count", { count: summary.count }), since ? t("search.since", { month: since }) : null].filter(Boolean).join(" · ")}
            </FText>
            {summary.totals.map((total) => (
              <Amount
                key={total.currency}
                value={total.value}
                currency={total.currency}
                kind={total.value > 0 ? "income" : total.value < 0 ? "expense" : "neutral"}
                tone="inkMuted"
                style={{ fontFamily: fontFace.mono[600], fontSize: 14, lineHeight: 19 }}
              />
            ))}
          </YStack>
          {maxBar > 0 ? (
            <XStack items="flex-end" gap={4} height={36} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {summary.bars.map((value, i) => (
                <View
                  key={i}
                  width={8}
                  height={Math.max(4, (value / maxBar) * 36)}
                  rounded={3}
                  bg={i === 2 ? "$ink" : "$lineStrong"}
                />
              ))}
            </XStack>
          ) : null}
        </XStack>
        {entries.map((entry) =>
          entry.type === "day" ? (
            <DayHeader key={entry.key} day={entry.day} net={entry.net} locale={locale} />
          ) : (
            <View key={entry.key} px={space[5]}>
              <ResultRow item={entry.item} first={entry.first} query={query} emoji={rowEmoji(entry.item, iconFor)} onOpen={openMovement} />
            </View>
          ),
        )}
        {truncated ? (
          <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: space[4] }}>
            {t("search.more", { count: all.length })}
          </FText>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      {/* Campo de la hoja de componentes: `surface` con filete `lineStrong`; enfocado, borde tinta de 2. */}
      <XStack items="center" gap={12} px={space[5]} pt={space[2]}>
        <XStack
          flex={1}
          minH={48}
          items="center"
          gap={10}
          px={14}
          rounded={radius.pill}
          bg="$surface"
          borderWidth={focused ? 2 : 1}
          borderColor={focused ? "$ink" : "$lineStrong"}
        >
          <Search size={18} color="$inkMuted" strokeWidth={2} />
          <TextInput
            ref={input}
            autoFocus
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => remember(text)}
            placeholder={t("search.placeholder")}
            placeholderTextColor={theme.inkFaint.val}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityRole="search"
            accessibilityLabel={t("search.label")}
            selectionColor={theme.ink.val}
            style={[textStyles.body as TextStyle, { flex: 1, fontSize: 16, color: theme.ink.val, paddingVertical: 0 }]}
          />
          {text ? (
            <Pressable onPress={() => setText("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("search.clear")}>
              <View width={20} height={20} rounded={radius.pill} bg="$inkFaint" items="center" justify="center">
                <X size={12} color="$surface" strokeWidth={2.6} />
              </View>
            </Pressable>
          ) : null}
        </XStack>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 15, lineHeight: 20 }}>
            {t("search.cancel")}
          </FText>
        </Pressable>
      </XStack>

      {query ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: space[5], paddingTop: 12 }}>
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} icon={chip.on ? <Check size={14} color="$canvas" strokeWidth={2.4} /> : chip.icon} selected={chip.on} onPress={chip.press} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}>
        {body}
      </ScrollView>
    </YStack>
  );
}

function rowEmoji(item: MovementItem, iconFor: (category: string, type: Transaction["type"]) => string | null) {
  return item.kind === "movement" ? iconFor(item.movement.category, item.movement.type) : null;
}

/** El texto con la coincidencia resaltada en amarillo al 40 % (marca D). Desde 1.3 se parte en varias líneas. */
function Highlighted({ text, query, style, tone = "ink", wrap = false }: { text: string; query: string; style?: TextStyle; tone?: "ink" | "inkFaint"; wrap?: boolean }) {
  const theme = useTheme();
  const wash = withAlpha(theme.brand.val, 0.4);
  return (
    <FText tone={tone} numberOfLines={wrap ? undefined : 1} style={style}>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <Text key={i} style={{ backgroundColor: wash }}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </FText>
  );
}

/**
 * Una fila de resultado (marca D): a todo el ancho con el filete arriba, el cuadro de 44, la categoría (o la nota o
 * la cuenta) con la coincidencia resaltada y el monto con signo. Desde `COMPACT_FONT_SCALE` el monto baja.
 */
function ResultRow({
  item,
  first,
  query,
  emoji,
  onOpen,
}: {
  item: MovementItem;
  first: boolean;
  query: string;
  emoji: string | null;
  onOpen: (tx: Transaction) => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const tx = item.kind === "movement" ? item.movement : item.origin;
  const transfer = item.kind === "transfer" || tx.type === "transfer";
  const title =
    item.kind === "transfer"
      ? t("movementsTab.transferTitle", { origin: item.origin.account, destination: item.destination.account })
      : transfer
        ? t("movementsTab.transfer")
        : getCategoryLabel(tx.category, t);
  const noteMatch = !matches(title, query) && matches(tx.note, query);
  const subtitle = noteMatch ? `${t("search.notePrefix")} “${tx.note}”` : tx.note || tx.account;
  const amount = item.kind === "transfer" ? item.amount : tx.amount;
  const kind = transfer ? "transfer" : tx.type === "income" ? "income" : "expense";
  const figure = <RowAmount value={amount} currency={item.kind === "transfer" ? item.currency : tx.currency} kind={kind} />;

  return (
    <Pressable onPress={() => onOpen(tx)} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`}>
      {({ pressed }) => (
        <XStack items={stacked ? "flex-start" : "center"} gap={space[3]} py={space[3]} borderTopWidth={first ? 0 : 1} borderColor="$line" bg={pressed ? "$surfaceSunken" : "$canvas"}>
          <Monogram name={title} emoji={transfer ? null : emoji} size={44} />
          <YStack flex={1} minW={0} gap={2}>
            <Highlighted text={title} query={query} wrap={stacked} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }} />
            <Highlighted text={subtitle} query={query} wrap={stacked} tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }} />
            {stacked ? <View mt={2}>{figure}</View> : null}
          </YStack>
          {stacked ? null : figure}
        </XStack>
      )}
    </Pressable>
  );
}

/** Título de grupo de la búsqueda (Recientes, Lo que más registras, el resumen): 16 en Figtree Bold. */
const GROUP_TITLE = { fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 } as const;

/** Una ficha de "Lo que más registras": la mitad del ancho, el emoji grande y el nombre sobre el fondo de su tono. */
function FrequentTile({ name, label, emoji, onPress }: { name: string; label: string; emoji?: string | null; onPress: () => void }) {
  const { themeMode } = useThemeMode();
  const hue = useCategoryHue(emoji, name);
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: "48.5%", flexGrow: 1 }}>
      <YStack p={12} gap={10} rounded={20} style={{ backgroundColor: emoji ? categoryTint(hue, themeMode) : undefined }} bg={emoji ? undefined : "$surface"}>
        {emoji ? (
          <Text allowFontScaling={false} style={{ fontSize: 28, lineHeight: 34 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {emoji}
          </Text>
        ) : (
          <Monogram name={label} size={32} />
        )}
        <FText style={{ fontFamily: fontFace.display[700], fontSize: 14, lineHeight: 19 }}>{label}</FText>
      </YStack>
    </PressableScale>
  );
}
