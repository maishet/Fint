import { Home, LocateFixed, MapPin, Maximize2, Plus, Search, Star, Briefcase, X } from "@tamagui/lucide-icons-2";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, type TextStyle } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Details, type Region } from "react-native-maps";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../api/finance";
import { LocationEditSheet } from "../components/LocationEditSheet";
import { regionFor } from "../components/MiniMap";
import { PlaceCategoryIcon } from "../components/PlaceCategoryIcon";
import { USER_PIN_TIP, UserMapPin } from "../components/UserMapPin";
import { toDateString } from "../finance/dates";
import { formatAmount } from "../finance/formatAmount";
import { getAppLocale } from "../i18n";
import { describeLocationDetailed, getLastKnownPosition, requestAndCaptureLocation, type CapturedLocation } from "../location/captureLocation";
import { distanceMeters, findSavedPlace, formatDistance, SAVED_PLACE_RADIUS_M, type SavedPlace, type SavedPlaceKind } from "../location/places";
import { useSavedPlaces } from "../location/savedPlaces";
import { suggestionKey, useLocationSearch } from "../location/useLocationSearch";
import { highlightParts } from "../search/logic";
import { withAlpha } from "../theme/color";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { Chip, FintButton, FintSheet, FintSpinner, FText, SheetField, SheetTextInput } from "../ui";
import { randomId } from "../shared/id";
import { haptics } from "../ui/haptics";
import { useNotify } from "../ui/notify";

const MAP_ZOOM = 16;
const MAP_HEIGHT = 196;
const PIN_SIZE = 38;
/** Lo que tarda la hoja en asentarse (`spring-sheet`). */
const MAP_MOUNT_DELAY_MS = 450;
/** Lima, para no abrir en medio del océano si todavía no hay ubicación. */
const FALLBACK_CENTER = { latitude: -12.0464, longitude: -77.0428 };
/** Lo que se ve del formulario arriba de la hoja. */
const PEEK = 52;

/** Metros por punto de pantalla en el zoom del mapa: para dibujar el círculo de precisión a su tamaño real. */
function metersPerPoint(latitude: number) {
  return (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** MAP_ZOOM;
}

export interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  value: CapturedLocation | null;
  /** El lugar detectado para sugerir (nunca se guarda solo). */
  suggestion: CapturedLocation | null;
  /** De qué movimiento es: "Egreso de S/ 84.50 · hoy". */
  context?: string;
  onSave: (next: CapturedLocation | null) => void;
}

/**
 * Hoja de ubicación (`HojaUbicacion`): casi a pantalla completa, con el buscador, el mapa con el pin fijo al centro
 * y su círculo de precisión, la tarjeta del lugar (dirección en tres niveles, precisión, "Estás aquí", veces aquí) y,
 * según el caso, ponerle nombre (Casa, Trabajo, otro) o lo gastado ahí este mes. Debajo, los lugares guardados y los
 * recientes. Mientras se busca, el mapa y la tarjeta dejan lugar a los resultados cercanos. El pie queda fijo.
 *
 * No se cierra arrastrando porque el mapa se arrastra; se cierra con el velo, la X o "atrás".
 */
export function LocationSheet({ open, onClose, value, suggestion, context, onSave }: LocationSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const isMapReady = useRef(false);
  const pendingRegion = useRef<Region | null>(null);
  const [draft, setDraft] = useState<CapturedLocation | null>(value ?? suggestion);
  const [initial, setInitial] = useState(() => value ?? suggestion ?? FALLBACK_CENTER);
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  // El nombre elegido para el lugar (se guarda con "Guardar ubicación").
  const [naming, setNaming] = useState<{ kind: SavedPlaceKind; name: string } | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  // El mapa nace cuando la hoja ya terminó de subir. Si nace durante la animación, Google Maps (Android) deja
  // congelada la primera imagen (el mundo entero) aunque su cámara esté en el lugar. Mientras tanto se ve el marco.
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => {
    if (!open || expanded) {
      setMapMounted(false);
      if (!open) pendingRegion.current = null;
      return;
    }
    const id = setTimeout(() => setMapMounted(true), MAP_MOUNT_DELAY_MS);
    return () => clearTimeout(id);
  }, [open, expanded]);
  useEffect(() => {
    isMapReady.current = false;
  }, [mapMounted, themeMode]);

  const search = useLocationSearch(open);
  const { places: savedPlaces, save: savePlace, remove: removePlace } = useSavedPlaces();
  const notify = useNotify();
  const frequentQuery = useQuery({ queryKey: ["frequent-locations"], queryFn: financeApi.getFrequentLocations, staleTime: 5 * 60_000, enabled: open });
  // Lo gastado este mes en el lugar: los egresos del mes a menos de 50 m.
  const monthRange = useMemo(() => {
    const now = new Date();
    return { from: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) };
  }, []);
  const monthQuery = useQuery({
    queryKey: ["transactions", "month-expenses", monthRange.from],
    queryFn: () => financeApi.listAllTransactions({ ...monthRange, type: "expense" }),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const jumpTo = useCallback((next: { latitude: number; longitude: number }) => {
    const region = regionFor(next.latitude, next.longitude, MAP_ZOOM);
    if (isMapReady.current) mapRef.current?.animateToRegion(region, 400);
    else pendingRegion.current = region;
  }, []);

  const handleMapReady = () => {
    isMapReady.current = true;
    if (pendingRegion.current) {
      mapRef.current?.animateToRegion(pendingRegion.current, 0);
      pendingRegion.current = null;
    }
  };

  const resolve = useCallback(async (next: { latitude: number; longitude: number }) => {
    setDraft({ latitude: next.latitude, longitude: next.longitude, formattedAddress: null });
    setNaming(null);
    setIsResolving(true);
    const address = await describeLocationDetailed(next.latitude, next.longitude);
    setIsResolving(false);
    setDraft((prev) => (prev && prev.latitude === next.latitude && prev.longitude === next.longitude ? { ...prev, ...address } : prev));
  }, []);

  useEffect(() => {
    if (!open) return;
    search.reset();
    setNaming(null);
    setOtherOpen(false);
    const start = value ?? suggestion;
    setDraft(start);
    let cancelled = false;
    void getLastKnownPosition().then((position) => {
      if (cancelled || !position) return;
      setHere(position);
      if (start) return;
      setInitial(position);
      jumpTo(position);
      void resolve(position);
    });
    if (start) {
      setInitial(start);
      jumpTo(start);
    }
    return () => {
      cancelled = true;
    };
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mientras se arrastra el mapa, el pin sube 6px, su sombra se achica y el círculo de precisión se desvanece; al
  // soltar, baja con `spring-gesture` y el círculo vuelve con `fade`.
  const lift = useSharedValue(0);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * lift.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.35 * lift.value }], opacity: 1 - 0.4 * lift.value }));
  const accuracyStyle = useAnimatedStyle(() => ({ opacity: 1 - lift.value }));

  // Solo cuenta lo que mueve la persona (`isGesture`): montar el mapa o centrarlo desde la app no pisa el lugar elegido.
  const onRegionChange = (_: Region, details?: Details) => {
    if (details?.isGesture && lift.value === 0) lift.value = withTiming(1, motion.press);
  };
  const onRegionChangeComplete = (region: Region, details?: Details) => {
    lift.value = withSpring(0, motion.springGesture);
    if (details?.isGesture) void resolve({ latitude: region.latitude, longitude: region.longitude });
  };

  const choose = (next: CapturedLocation) => {
    haptics.select();
    setDraft(next);
    setNaming(null);
    setOtherOpen(false);
    // Si el mapa está desmontado (se estaba buscando), vuelve a montarse ya centrado aquí.
    setInitial(next);
    jumpTo(next);
  };

  const pickSuggestion = async (s: Parameters<typeof search.select>[0]) => {
    Keyboard.dismiss();
    const resolved = await search.select(s);
    if (resolved) choose({ ...resolved, parts: { primary: s.primaryText || null, secondary: s.secondaryText, tertiary: null }, category: s.category });
  };

  const runSearch = async () => {
    Keyboard.dismiss();
    const result = await search.submit();
    if (result) choose(result);
  };

  const useCurrent = async () => {
    setIsLocating(true);
    const result = await requestAndCaptureLocation();
    setIsLocating(false);
    if (result) {
      setHere(result);
      choose(result);
    }
  };

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const save = () => {
    if (!draft) return;
    const saved = findSavedPlace(savedPlaces, draft);
    let placeName = saved?.name ?? null;
    if (naming?.name.trim()) {
      placeName = naming.name.trim();
      void savePlace({
        id: saved?.id ?? randomId(),
        name: placeName,
        kind: naming.kind,
        latitude: draft.latitude,
        longitude: draft.longitude,
        formattedAddress: draft.formattedAddress,
      });
    }
    onSave({ ...draft, placeName });
    close();
  };

  const searching = search.query.trim().length >= 3;
  const saved = draft ? findSavedPlace(savedPlaces, draft) : null;
  const isHere = draft && here ? distanceMeters(draft, here) <= SAVED_PLACE_RADIUS_M : false;
  const visits = draft ? (frequentQuery.data ?? []).find((f) => distanceMeters(f, draft) <= SAVED_PLACE_RADIUS_M)?.usageCount ?? 0 : 0;
  const spentHere = useMemo(() => {
    if (!draft) return [];
    const byCurrency = new Map<string, number>();
    for (const tx of monthQuery.data ?? []) {
      if (tx.latitude == null || tx.longitude == null) continue;
      if (distanceMeters({ latitude: tx.latitude, longitude: tx.longitude }, draft) > SAVED_PLACE_RADIUS_M) continue;
      byCurrency.set(tx.currency, (byCurrency.get(tx.currency) ?? 0) + tx.amount);
    }
    return [...byCurrency.entries()];
  }, [draft, monthQuery.data]);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date());
  const accuracyPoints = draft?.accuracy ? Math.min(90, Math.max(14, draft.accuracy / metersPerPoint(draft.latitude))) : 0;
  const snap = Math.round(((height - insets.top - PEEK) / height) * 100);

  return (
    <>
      <FintSheet open={open && !expanded} onClose={close} title={t("movementForm.location")} subtitle={context} disableDrag snapPoints={[snap]}>
        <YStack flex={1}>
          <YStack px={16} pt={12}>
            <SheetField>
              <Search size={18} color="$inkFaint" />
              <SheetTextInput
                value={search.query}
                onChangeText={(next) => {
                  search.setQuery(next);
                  search.setSearchFailed(false);
                }}
                onSubmitEditing={() => void runSearch()}
                placeholder={t("movementForm.locationSheet.search")}
                returnKeyType="search"
                accessibilityLabel={t("movementForm.locationSheet.search")}
              />
              {search.isSearching || search.isSuggesting ? (
                <FintSpinner size="small" color="$brand" />
              ) : search.query ? (
                <Pressable onPress={() => search.reset()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("movementForm.clearSearch")}>
                  <X size={16} color="$inkFaint" />
                </Pressable>
              ) : null}
            </SheetField>
          </YStack>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {searching ? (
              <YStack pt={6}>
                <SubTitle>{t("movementForm.locationSheet.nearby")}</SubTitle>
                {search.suggestions.map((s) => {
                  const d = here && s.latitude != null && s.longitude != null ? formatDistance(distanceMeters(here, { latitude: s.latitude, longitude: s.longitude })) : null;
                  return (
                    <PlaceRow
                      key={suggestionKey(s)}
                      icon={search.resolvingKey === suggestionKey(s) ? <FintSpinner size="small" color="$brand" /> : <PlaceCategoryIcon category={s.category} size={17} />}
                      title={s.primaryText || t("location.coordinatesOnly")}
                      query={search.query}
                      subtitle={s.secondaryText}
                      aside={d}
                      onPress={() => void pickSuggestion(s)}
                    />
                  );
                })}
                {!search.isSuggesting && (search.searchFailed || search.suggestions.length === 0) ? (
                  <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 12 }}>
                    {t("location.searchNotFound")}
                  </FText>
                ) : null}
                {draft ? (
                  <PlaceRow
                    icon={<MapPin size={17} color="$brand" />}
                    title={t("movementForm.locationSheet.mapPoint")}
                    subtitle={draft.parts?.primary ?? draft.formattedAddress}
                    onPress={() => {
                      Keyboard.dismiss();
                      search.reset();
                    }}
                  />
                ) : null}
              </YStack>
            ) : (
              <>
                <View mx={16} mt={12} height={MAP_HEIGHT} rounded={radius.lg} overflow="hidden" borderWidth={1} borderColor="$line" bg="$surfaceSunken">
                  {mapMounted ? (
                    <MapView
                      key={themeMode}
                      ref={mapRef}
                      // El estilo del mapa sigue la apariencia de la app, no la del sistema; Google solo lo lee al crearlo.
                      userInterfaceStyle={themeMode}
                      style={StyleSheet.absoluteFill}
                      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                      initialRegion={regionFor(initial.latitude, initial.longitude, MAP_ZOOM)}
                      onMapReady={handleMapReady}
                      onRegionChange={onRegionChange}
                      onRegionChangeComplete={onRegionChangeComplete}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      showsCompass={false}
                      toolbarEnabled={false}
                      showsMyLocationButton={false}
                      accessibilityLabel={t("location.mapAccessibility")}
                    />
                  ) : null}
                  {/* El círculo de precisión, del tamaño real (en metros) alrededor del centro. */}
                  {accuracyPoints ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        {
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          width: accuracyPoints * 2,
                          height: accuracyPoints * 2,
                          marginLeft: -accuracyPoints,
                          marginTop: -accuracyPoints,
                          borderRadius: accuracyPoints,
                          backgroundColor: withAlpha(theme.brand.val, 0.14),
                          borderWidth: 1,
                          borderColor: withAlpha(theme.brand.val, 0.45),
                        },
                        accuracyStyle,
                      ]}
                    />
                  ) : null}
                  {/* La punta del pin (la cara de la persona) cae en el centro del mapa, sobre su sombra. */}
                  <View position="absolute" l="50%" t="50%" ml={-PIN_SIZE / 2} mt={-(PIN_SIZE + USER_PIN_TIP)} width={PIN_SIZE} height={PIN_SIZE + USER_PIN_TIP} items="center" pointerEvents="none">
                    <Animated.View style={[{ position: "absolute", top: PIN_SIZE + USER_PIN_TIP - 2.5 }, shadowStyle]}>
                      <View width={14} height={5} rounded={999} bg="rgba(0,0,0,0.22)" />
                    </Animated.View>
                    <Animated.View style={pinStyle}>
                      <UserMapPin size={PIN_SIZE} />
                    </Animated.View>
                  </View>
                  <XStack position="absolute" b={10} l={12} height={28} px={12} items="center" rounded={999} bg="$glass" borderWidth={1} borderColor="$glassLine" pointerEvents="none">
                    <FText variant="caption" style={{ fontFamily: fontFace.sans[500] }}>
                      {t("movementForm.locationSheet.hint")}
                    </FText>
                  </XStack>
                  <GlassButton label={t("movementForm.locationSheet.expand")} onPress={() => setExpanded(true)} style={{ right: 10, top: 10 }}>
                    <Maximize2 size={15} color="$ink" />
                  </GlassButton>
                  <GlassButton label={t("movementForm.locationSheet.myLocation")} onPress={isLocating ? undefined : () => void useCurrent()} style={{ right: 10, bottom: 10 }}>
                    {isLocating ? <FintSpinner size="small" color="$brand" /> : <LocateFixed size={17} color="$brand" />}
                  </GlassButton>
                </View>

                {draft ? (
                  <YStack mx={16} mt={10} p={14} rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line">
                    <XStack gap={12}>
                      <View
                        width={44}
                        height={44}
                        rounded={radius.md}
                        items="center"
                        justify="center"
                        style={{ backgroundColor: withAlpha(draft.category ? theme.chart6.val : theme.brand.val, 0.14) }}
                      >
                        {draft.category ? <PlaceCategoryIcon category={draft.category} size={20} /> : <MapPin size={20} color="$brand" strokeWidth={2} />}
                      </View>
                      <YStack flex={1} minW={0}>
                        <Animated.View key={isResolving ? "resolving" : (draft.formattedAddress ?? "none")} entering={FadeIn.duration(motion.fade.duration)}>
                          <XStack items="center" gap={8}>
                            <FText numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontFace.sans[600], fontSize: 17, lineHeight: 22, letterSpacing: -0.3 }}>
                              {isResolving ? t("movementForm.locationSheet.resolving") : (draft.parts?.primary ?? draft.formattedAddress?.split(", ")[0] ?? t("location.coordinatesOnly"))}
                            </FText>
                            {saved && !isResolving ? (
                              <View px={8} py={2} rounded={999} bg="$brandWash">
                                <FText tone="brand" style={{ fontFamily: fontFace.sans[600], fontSize: 11, lineHeight: 14 }}>
                                  {saved.name}
                                </FText>
                              </View>
                            ) : null}
                          </XStack>
                          {!isResolving ? (
                            <>
                              {(draft.parts?.secondary ?? draft.formattedAddress?.split(", ").slice(1).join(", ")) ? (
                                <FText tone="inkMuted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, marginTop: 1 }}>
                                  {draft.parts?.secondary ?? draft.formattedAddress?.split(", ").slice(1).join(", ")}
                                </FText>
                              ) : null}
                              {draft.parts?.tertiary ? (
                                <FText tone="inkFaint" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
                                  {draft.parts.tertiary}
                                </FText>
                              ) : null}
                            </>
                          ) : null}
                        </Animated.View>
                      </YStack>
                    </XStack>

                    {draft.accuracy || isHere || visits ? (
                      <XStack mt={12} gap={6} flexWrap="wrap">
                        {draft.accuracy ? <MetaPill label={t("movementForm.locationSheet.accuracy")} value={`± ${Math.round(draft.accuracy)} m`} /> : null}
                        {isHere ? <MetaPill label={t("movementForm.locationSheet.here")} /> : null}
                        {visits ? <MetaPill label={t("movementForm.locationSheet.visits", { count: visits })} /> : null}
                      </XStack>
                    ) : null}

                    <View height={1} bg="$line" mx={-14} my={12} />
                    {saved || draft.category ? (
                      <XStack items="baseline" justify="space-between">
                        <FText tone="inkMuted" style={{ fontSize: 12.5, lineHeight: 17 }}>
                          {t("movementForm.locationSheet.spentHere", { month: locale.startsWith("en") ? monthName : monthName.toLocaleLowerCase(locale) })}
                        </FText>
                        <FText style={{ fontFamily: fontFace.mono[500], fontSize: 14, lineHeight: 18 }}>
                          {spentHere.length ? spentHere.map(([currency, amount]) => formatAmount(amount, currency)).join(" · ") : formatAmount(0, "PEN")}
                        </FText>
                      </XStack>
                    ) : (
                      <YStack>
                        <FText tone="inkMuted" style={{ fontSize: 12, lineHeight: 16, marginBottom: 8 }}>
                          {t("movementForm.locationSheet.nameIt")}
                        </FText>
                        <XStack gap={8} flexWrap="wrap">
                          {(["home", "work"] as const).map((kind) => (
                            <Chip
                              key={kind}
                              variant="choice"
                              label={t(`movementForm.locationSheet.${kind}`)}
                              icon={kind === "home" ? <Home size={14} color="$inkMuted" /> : <Briefcase size={14} color="$inkMuted" />}
                              selected={naming?.kind === kind}
                              onPress={() => {
                                setOtherOpen(false);
                                setNaming(naming?.kind === kind ? null : { kind, name: t(`movementForm.locationSheet.${kind}`) });
                              }}
                            />
                          ))}
                          <Chip
                            variant="choice"
                            dashed
                            label={naming?.kind === "other" && naming.name ? naming.name : t("movementForm.locationSheet.other")}
                            icon={<Plus size={14} color="$inkMuted" />}
                            selected={naming?.kind === "other"}
                            onPress={() => {
                              setOtherOpen(true);
                              setNaming({ kind: "other", name: naming?.kind === "other" ? naming.name : "" });
                            }}
                          />
                        </XStack>
                        {otherOpen ? (
                          <View mt={10}>
                            <SheetField>
                              <Star size={16} color="$inkFaint" />
                              <SheetTextInput
                                autoFocus
                                value={naming?.kind === "other" ? naming.name : ""}
                                onChangeText={(name) => setNaming({ kind: "other", name: name.slice(0, 30) })}
                                onSubmitEditing={() => setOtherOpen(false)}
                                placeholder={t("movementForm.locationSheet.otherName")}
                                returnKeyType="done"
                                accessibilityLabel={t("movementForm.locationSheet.otherName")}
                              />
                            </SheetField>
                          </View>
                        ) : null}
                      </YStack>
                    )}
                  </YStack>
                ) : null}

                {savedPlaces.length ? (
                  <>
                    <SubTitle>{t("movementForm.locationSheet.saved")}</SubTitle>
                    {savedPlaces.map((place) => (
                      <PlaceRow
                        key={place.id}
                        icon={<SavedIcon place={place} />}
                        title={place.name}
                        subtitle={place.formattedAddress}
                        aside={here ? formatDistance(distanceMeters(here, place)) : null}
                        longPressLabel={t("movementForm.locationSheet.removeAction")}
                        onPress={() => choose({ latitude: place.latitude, longitude: place.longitude, formattedAddress: place.formattedAddress })}
                        // Mantener presionado lo quita de los guardados, con "Deshacer" (para el lector, una acción de la fila).
                        onLongPress={() => {
                          haptics.tap();
                          void removePlace(place.id);
                          notify.success(t("movementForm.locationSheet.removed", { name: place.name }), {
                            action: { label: t("movementForm.undo"), onPress: () => void savePlace(place) },
                          });
                        }}
                      />
                    ))}
                  </>
                ) : null}

                {frequentQuery.data?.length ? (
                  <>
                    <SubTitle>{t("movementForm.locationSheet.recent")}</SubTitle>
                    {frequentQuery.data.slice(0, 4).map((place) => {
                      const [primary, ...rest] = (place.formattedAddress ?? "").split(", ");
                      const when = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(place.lastUsedAt));
                      return (
                        <PlaceRow
                          key={`${place.latitude}-${place.longitude}`}
                          icon={<MapPin size={17} color="$inkMuted" />}
                          title={primary || t("location.coordinatesOnly")}
                          subtitle={place.usageCount > 1 ? t("movementForm.locationSheet.recentVisits", { count: place.usageCount, when }) : rest.join(", ") || null}
                          aside={here ? formatDistance(distanceMeters(here, place)) : null}
                          onPress={() => choose({ latitude: place.latitude, longitude: place.longitude, formattedAddress: place.formattedAddress })}
                        />
                      );
                    })}
                  </>
                ) : null}
              </>
            )}
          </ScrollView>

          {/* El pie queda fijo; el contenido pasa por debajo de un degradado del fondo de la hoja. */}
          <View position="absolute" l={0} r={0} b={0} pointerEvents="box-none">
            <LinearGradient
              colors={[withAlpha(theme.surfaceOverlay.val, 0), theme.surfaceOverlay.val]}
              locations={[0, 0.3]}
              style={{ paddingTop: 22, paddingHorizontal: 16, paddingBottom: 4 }}
            >
              <XStack gap={10}>
                <FintButton
                  flex={1}
                  minH={52}
                  variant="outlined"
                  disabled={!value}
                  onPress={() => {
                    onSave(null);
                    close();
                  }}
                >
                  {t("movementForm.locationSheet.remove")}
                </FintButton>
                <FintButton flex={2} minH={52} disabled={!draft || isResolving} onPress={save}>
                  {t("movementForm.locationSheet.save")}
                </FintButton>
              </XStack>
            </LinearGradient>
          </View>
        </YStack>
      </FintSheet>

      {/* El mapa grande de siempre, para ajustar con más espacio. */}
      <LocationEditSheet
        open={expanded}
        onOpenChange={setExpanded}
        value={draft}
        onSave={(next) => {
          if (next) {
            setDraft(next);
            setInitial(next);
            jumpTo(next);
          }
        }}
      />
    </>
  );
}

function SubTitle({ children }: { children: string }) {
  return (
    <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[600], marginTop: 16, marginBottom: 2, marginHorizontal: 20 }}>
      {children}
    </FText>
  );
}

function GlassButton({ label, onPress, style, children }: { label: string; onPress?: () => void; style: object; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[{ position: "absolute" }, style]}>
      <View width={36} height={36} rounded={999} items="center" justify="center" bg="$glass" borderWidth={1} borderColor="$glassLine">
        {children}
      </View>
    </Pressable>
  );
}

/** Un dato de la tarjeta del lugar, en una píldora `surfaceSunken`; la cifra en `mono`. */
function MetaPill({ label, value }: { label: string; value?: string }) {
  return (
    <XStack height={26} px={9} gap={5} items="center" rounded={999} bg="$surfaceSunken" shrink={0}>
      <FText tone="inkMuted" numberOfLines={1} style={{ fontFamily: fontFace.sans[500], fontSize: 11.5, lineHeight: 15 }}>
        {label}
      </FText>
      {value ? <FText style={{ fontFamily: fontFace.mono[500], fontSize: 11.5, lineHeight: 15 }}>{value}</FText> : null}
    </XStack>
  );
}

function SavedIcon({ place }: { place: SavedPlace }) {
  if (place.kind === "home") return <Home size={17} color="$brand" />;
  if (place.kind === "work") return <Briefcase size={17} color="$brand" />;
  return <Star size={17} color="$brand" />;
}

function PlaceRow({
  icon,
  title,
  subtitle,
  aside,
  query,
  longPressLabel,
  onPress,
  onLongPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  aside?: string | null;
  /** Nombre de lo que hace mantener presionado, para ofrecerlo al lector de pantalla como acción. */
  longPressLabel?: string;
  onLongPress?: () => void;
  /** Resalta la coincidencia con la búsqueda en `brand` al 18 %. */
  query?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const wash = withAlpha(theme.brand.val, 0.18);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityActions={onLongPress && longPressLabel ? [{ name: "longpress", label: longPressLabel }] : undefined}
      onAccessibilityAction={() => onLongPress?.()}
    >
      {({ pressed }) => (
        <XStack items="center" gap={12} px={20} py={9} bg={pressed ? "$surfaceSunken" : "transparent"}>
          <View width={38} height={38} rounded={999} items="center" justify="center" bg="$surfaceSunken">
            {icon}
          </View>
          <YStack flex={1} minW={0}>
            <FText numberOfLines={1} style={{ ...(textStyles["body-strong"] as TextStyle), letterSpacing: -0.1 }}>
              {query
                ? highlightParts(title, query).map((part, i) =>
                    part.match ? (
                      <Text key={i} style={{ backgroundColor: wash }}>
                        {part.text}
                      </Text>
                    ) : (
                      part.text
                    ),
                  )
                : title}
            </FText>
            {subtitle ? (
              <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                {subtitle}
              </FText>
            ) : null}
          </YStack>
          {aside ? (
            <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[400], fontSize: 12, lineHeight: 16 }}>
              {aside}
            </FText>
          ) : null}
        </XStack>
      )}
    </Pressable>
  );
}
