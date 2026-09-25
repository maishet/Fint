import { Check, LocateFixed, MapPin, Maximize2, Search, X } from "@tamagui/lucide-icons-2";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, Pressable, StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Details, type Region } from "react-native-maps";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../api/finance";
import { LocationEditSheet } from "../components/LocationEditSheet";
import { regionFor } from "../components/MiniMap";
import { PlaceCategoryIcon } from "../components/PlaceCategoryIcon";
import { USER_PIN_TIP, UserMapPin } from "../components/UserMapPin";
import {
  describeLocation,
  getLastKnownPosition,
  requestAndCaptureLocation,
  type CapturedLocation,
} from "../location/captureLocation";
import { suggestionKey, useLocationSearch } from "../location/useLocationSearch";
import { motion, opacity, radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintButton, FintSheet, FintSpinner, FText, SheetField, SheetTextInput } from "../ui";
import { haptics } from "../ui/haptics";
import { splitAddress } from "./logic";

const MAP_ZOOM = 16;
const MAP_HEIGHT = 170;
const PIN_SIZE = 38;
/** Lima, para no abrir en medio del océano si todavía no hay ubicación. */
const FALLBACK_CENTER = { latitude: -12.0464, longitude: -77.0428 };

export interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  value: CapturedLocation | null;
  /** El lugar detectado para sugerir (nunca se guarda solo). */
  suggestion: CapturedLocation | null;
  onSave: (next: CapturedLocation | null) => void;
}

/**
 * Hoja de ubicación: buscador de lugares, el mapa con el pin fijo al centro (se
 * arrastra el mapa, no el pin), el lugar elegido sobre `brandWash`, "Usar mi
 * ubicación" y los recientes. Al pie, "Quitar" y "Guardar ubicación". Mientras
 * se busca, las sugerencias reemplazan al mapa y a los recientes.
 *
 * La hoja no se cierra arrastrando porque el mapa se arrastra; se cierra con el
 * velo, la X o "atrás". El mapa grande sigue disponible en "Ampliar".
 */
export function LocationSheet({ open, onClose, value, suggestion, onSave }: LocationSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const [draft, setDraft] = useState<CapturedLocation | null>(value ?? suggestion);
  const [initial, setInitial] = useState(() => value ?? suggestion ?? FALLBACK_CENTER);
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const search = useLocationSearch(open);
  const frequentQuery = useQuery({
    queryKey: ["frequent-locations"],
    queryFn: financeApi.getFrequentLocations,
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const jumpTo = useCallback((next: { latitude: number; longitude: number }) => {
    mapRef.current?.animateToRegion(regionFor(next.latitude, next.longitude, MAP_ZOOM), 400);
  }, []);

  const resolve = useCallback(async (next: { latitude: number; longitude: number }) => {
    setDraft({ latitude: next.latitude, longitude: next.longitude, formattedAddress: null });
    setIsResolving(true);
    const address = await describeLocation(next.latitude, next.longitude);
    setIsResolving(false);
    setDraft((prev) =>
      prev && prev.latitude === next.latitude && prev.longitude === next.longitude ? { ...prev, formattedAddress: address } : prev,
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    search.reset();
    const start = value ?? suggestion;
    setDraft(start);
    if (start) {
      setInitial(start);
      jumpTo(start);
      return;
    }
    let cancelled = false;
    void getLastKnownPosition().then((position) => {
      if (cancelled || !position) return;
      setInitial(position);
      jumpTo(position);
      void resolve(position);
    });
    return () => {
      cancelled = true;
    };
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mientras se arrastra el mapa, el pin sube 6px y su sombra se achica; al soltar baja con `spring-gesture`.
  const lift = useSharedValue(0);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * lift.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.35 * lift.value }], opacity: 1 - 0.4 * lift.value }));

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
    // Si el mapa está desmontado (se estaba buscando), vuelve a montarse ya centrado aquí.
    setInitial(next);
    jumpTo(next);
  };

  const pickSuggestion = async (s: Parameters<typeof search.select>[0]) => {
    Keyboard.dismiss();
    const resolved = await search.select(s);
    if (resolved) choose(resolved);
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
    if (result) choose(result);
  };

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const searching = search.query.trim().length >= 3;
  const { primary, secondary } = splitAddress(draft?.formattedAddress);

  return (
    <>
      <FintSheet open={open && !expanded} onClose={close} title={t("movementForm.location")} disableDrag>
        <YStack px={16} pt={14}>
          <SheetField>
            <Search size={18} color="$inkFaint" />
            <SheetTextInput
              value={search.query}
              onChangeText={(next) => {
                search.setQuery(next);
                search.setSearchFailed(false);
              }}
              onSubmitEditing={() => void runSearch()}
              placeholder={t("location.searchPlaceholder")}
              returnKeyType="search"
              accessibilityLabel={t("location.searchPlaceholder")}
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

        {searching ? (
          <YStack pt={8}>
            {search.suggestions.map((s) => (
              <PlaceRow
                key={suggestionKey(s)}
                icon={search.resolvingKey === suggestionKey(s) ? <FintSpinner size="small" color="$brand" /> : <PlaceCategoryIcon category={s.category} size={17} />}
                title={s.primaryText || t("location.coordinatesOnly")}
                subtitle={s.secondaryText}
                onPress={() => void pickSuggestion(s)}
              />
            ))}
            {!search.isSuggesting && (search.searchFailed || search.suggestions.length === 0) ? (
              <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 12 }}>
                {t("location.searchNotFound")}
              </FText>
            ) : null}
          </YStack>
        ) : (
          <>
            <View mx={16} mt={14} height={MAP_HEIGHT} rounded={radius.lg} overflow="hidden" borderWidth={1} borderColor="$line" bg="$surfaceSunken">
              {open ? (
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFill}
                  provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                  initialRegion={regionFor(initial.latitude, initial.longitude, MAP_ZOOM)}
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
              {/* La punta del pin (la cara de la persona) cae en el centro del mapa, sobre su sombra. */}
              <View position="absolute" l="50%" t="50%" ml={-PIN_SIZE / 2} mt={-(PIN_SIZE + USER_PIN_TIP)} width={PIN_SIZE} height={PIN_SIZE + USER_PIN_TIP} items="center" pointerEvents="none">
                <Animated.View style={[{ position: "absolute", top: PIN_SIZE + USER_PIN_TIP - 2.5 }, shadowStyle]}>
                  <View width={14} height={5} rounded={999} bg="rgba(0,0,0,0.22)" />
                </Animated.View>
                <Animated.View style={pinStyle}>
                  <UserMapPin size={PIN_SIZE} />
                </Animated.View>
              </View>
              <XStack position="absolute" b={10} self="center" height={28} px={12} items="center" rounded={999} bg="$glass" borderWidth={1} borderColor="$glassLine" pointerEvents="none">
                <FText variant="caption" style={{ fontFamily: fontFace.sans[500] }}>
                  {t("location.dragHint")}
                </FText>
              </XStack>
              <Pressable
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel={t("movementForm.locationSheet.expand")}
                style={{ position: "absolute", right: 10, top: 10 }}
              >
                <View width={32} height={32} rounded={999} items="center" justify="center" bg="$glass" borderWidth={1} borderColor="$glassLine">
                  <Maximize2 size={15} color="$ink" />
                </View>
              </Pressable>
            </View>

            {draft ? (
              <XStack mx={16} mt={12} px={14} py={11} gap={12} items="center" rounded={radius.lg} bg="$brandWash">
                <View width={38} height={38} rounded={999} bg="$surface" items="center" justify="center">
                  <MapPin size={18} color="$brand" />
                </View>
                <YStack flex={1} minW={0}>
                  <FText variant="body-strong" numberOfLines={1}>
                    {isResolving ? t("location.detecting") : (primary ?? t("location.coordinatesOnly"))}
                  </FText>
                  {secondary && !isResolving ? (
                    <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                      {secondary}
                    </FText>
                  ) : null}
                </YStack>
                <Check size={18} color="$brand" strokeWidth={2.4} />
              </XStack>
            ) : null}

            <PlaceRow
              brand
              icon={isLocating ? <FintSpinner size="small" color="$brand" /> : <LocateFixed size={18} color="$brand" />}
              title={t("location.useCurrent")}
              onPress={isLocating ? undefined : () => void useCurrent()}
            />

            {frequentQuery.data?.length ? (
              <>
                <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[600], marginTop: 12, marginBottom: 2, marginHorizontal: 20 }}>
                  {t("location.recent")}
                </FText>
                {frequentQuery.data.slice(0, 4).map((place) => {
                  const parts = splitAddress(place.formattedAddress);
                  return (
                    <PlaceRow
                      key={`${place.latitude}-${place.longitude}`}
                      icon={<MapPin size={17} color="$inkMuted" />}
                      title={parts.primary ?? t("location.coordinatesOnly")}
                      subtitle={parts.secondary}
                      onPress={() => choose({ latitude: place.latitude, longitude: place.longitude, formattedAddress: place.formattedAddress })}
                    />
                  );
                })}
              </>
            ) : null}
          </>
        )}

        <XStack gap={10} mx={16} mt={16} mb={4}>
          <FintButton
            flex={1}
            minH={52}
            variant="outlined"
            disabled={!value}
            opacity={value ? 1 : opacity.disabled}
            onPress={() => {
              onSave(null);
              close();
            }}
          >
            {t("movementForm.locationSheet.remove")}
          </FintButton>
          <FintButton
            flex={2}
            minH={52}
            disabled={!draft || isResolving}
            opacity={draft && !isResolving ? 1 : opacity.disabled}
            onPress={() => {
              if (draft) onSave(draft);
              close();
            }}
          >
            {t("movementForm.locationSheet.save")}
          </FintButton>
        </XStack>
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

function PlaceRow({
  icon,
  title,
  subtitle,
  brand = false,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  brand?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
      {({ pressed }) => (
        <XStack items="center" gap={12} px={20} py={11} bg={pressed ? "$surfaceSunken" : "transparent"}>
          <View width={38} height={38} rounded={999} items="center" justify="center" bg={brand ? "$brandWash" : "$surfaceSunken"}>
            {icon}
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" tone={brand ? "brand" : "ink"} numberOfLines={1} style={{ letterSpacing: -0.1 }}>
              {title}
            </FText>
            {subtitle ? (
              <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                {subtitle}
              </FText>
            ) : null}
          </YStack>
        </XStack>
      )}
    </Pressable>
  );
}
