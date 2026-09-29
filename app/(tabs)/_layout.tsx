import { Tabs, useIsFocused, useNavigation } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Easing } from "react-native";
import { useTranslation } from "react-i18next";
import { Freeze } from "react-freeze";
import { useTheme } from "tamagui";
import { ArrowLeftRight, ChartColumn, CreditCard, House } from "@tamagui/lucide-icons-2";
import { FintTabBar } from "../../src/components/FintTabBar";
import { RecordSheet } from "../../src/components/RecordSheet";
import { TabFirstMount } from "../../src/components/TabFirstMount";

/**
 * Cuatro tabs y un botón central que abre la hoja de registro. Registrar es lo
 * único que se hace varias veces al día, así que es lo único con botón propio.
 * Cuentas dejó de ser un tab: se abre desde el saldo del Inicio.
 */
/** Pantallas encima de los tabs que los dejan ver (el formulario crece sobre la pantalla anterior). */
const SEE_THROUGH_ROUTES = ["transaction-form"];

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const tabsFocused = useIsFocused();
  const navigation = useNavigation();
  // Tapados del todo por una pantalla opaca (Ajustes, un detalle…): cuando termina la transición del stack con los
  // tabs sin foco, la pantalla nueva ya entró y recién ahí se puede congelar hasta el tab activo. Un tiempo fijo no
  // sirve: si la pantalla nueva tarda en montar, se congelaba antes de que entrara y se veía el fondo vacío. Lo de
  // arriba se lee del estado del stack en ese momento: `usePathname` cambia con cada tab y redibujaba las cuatro.
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const offEnd = navigation.addListener("transitionEnd" as never, (() => {
      if (navigation.isFocused()) return;
      const stack = navigation.getState();
      const top = stack?.routes[stack.index]?.name;
      if (top && !SEE_THROUGH_ROUTES.includes(top)) setCovered(true);
    }) as never);
    const offFocus = navigation.addListener("focus", () => setCovered(false));
    return () => {
      offEnd();
      offFocus();
    };
  }, [navigation]);
  const [recordOpen, setRecordOpen] = useState(false);

  // Estable mientras no cambie el foco: si cambiara con cada render, cada cambio de tab volvería a renderizar las cuatro.
  const screenLayout = useCallback(
    ({
      children,
      navigation: tab,
      route,
      options,
    }: {
      children: ReactNode;
      navigation: { getState(): { index: number; routes: { key: string }[] } };
      route: { key: string; name: string };
      options: { title?: string };
    }) => {
      const state = tab.getState();
      const selected = state.routes[state.index]?.key === route.key;
      // El Inicio llega montado desde la pantalla de carga; los demás muestran su esqueleto en la primera visita.
      const content = route.name === "dashboard" ? children : <TabFirstMount name={route.name} title={options.title ?? ""}>{children}</TabFirstMount>;
      return <Freeze freeze={!tabsFocused && (!selected || covered)}>{content}</Freeze>;
    },
    [covered, tabsFocused],
  );

  return (
    <>
      <Tabs
        // Con una pantalla encima de los tabs se congelan los que no se ven, y no se vuelven a renderizar hasta
        // volver: cambiar tema o idioma en Ajustes redibujaba todos los tabs ya visitados (~2.000 vistas) y el
        // teléfono se quedaba pegado varios segundos. Los inactivos se congelan enseguida (están ocultos); el elegido, solo
        // cuando lo tapa del todo una pantalla opaca ya asentada: el formulario transparente lo deja ver.
        // "Elegido" se lee del estado de este navegador: `navigation.isFocused()` da falso con algo encima.
        screenLayout={screenLayout}
        tabBar={(props) => (
          <FintTabBar {...props} centerAction={{ label: t("home.record.fab"), onPress: () => setRecordOpen(true) }} />
        )}
        screenOptions={{
          tabBarActiveTintColor: theme.brand.val,
          tabBarInactiveTintColor: theme.inkFaint.val,
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.background.val,
            borderBottomColor: theme.borderColor.val,
          },
          headerTintColor: theme.color.val,
          // `fade` cruzado de 180 ms (20-movimiento, "Cambio de tab"); el de la librería dura 150 ms y es lineal.
          animation: "fade",
          transitionSpec: { animation: "timing", config: { duration: 180, easing: Easing.out(Easing.cubic) } },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t("tabs.dashboard"),
            // El hero dibuja su propia barra con avatar, buscador y campana.
            headerShown: false,
            // Mientras el Inicio monta (al salir de la pantalla de carga), detrás se ve la losa y no un destello claro.
            sceneStyle: { backgroundColor: theme.slab.val },
            tabBarIcon: ({ color, size }) => <House color={color as any} size={size} />,
          }}
        />
        <Tabs.Screen
          name="movements"
          options={{
            title: t("tabs.movements"),
            // La pantalla dibuja su propio título grande con Escanear.
            headerShown: false,
            tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color as any} size={size} />,
          }}
        />
        <Tabs.Screen
          name="debts"
          options={{
            title: t("tabs.payments"),
            // La pantalla dibuja su propio título grande con el botón para crear un pago.
            headerShown: false,
            tabBarIcon: ({ color, size }) => <CreditCard color={color as any} size={size} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t("tabs.reports"),
            // La pantalla dibuja su propio título grande con el botón de descargar.
            headerShown: false,
            tabBarIcon: ({ color, size }) => <ChartColumn color={color as any} size={size} />,
          }}
        />
      </Tabs>
      <RecordSheet open={recordOpen} onClose={() => setRecordOpen(false)} />
    </>
  );
}
