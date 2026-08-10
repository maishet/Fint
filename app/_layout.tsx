import "../tamagui.generated.css";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { SplashScreen, Stack, useRouter } from "expo-router";
import * as Sentry from "@sentry/react-native";
import { AppProviders } from "../src/providers/AppProviders";
import { useAuth } from "../src/auth/AuthProvider";
import { useThemeMode } from "../src/theme/ThemeMode";
import { useTheme } from "tamagui";
import { attachNotificationResponseListener } from "../src/notifications/pushNotifications";
import { financeApi } from "../src/api/finance";
import {
  sanitizeSentryValue,
  stripUrlQuery,
} from "../src/monitoring/sentryPrivacy";
import { fintPalette } from "../src/theme/palette";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    delete event.user;
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.headers;
      if (event.request.url)
        event.request.url = stripUrlQuery(event.request.url);
    }
    event.extra = sanitizeSentryValue(event.extra) as typeof event.extra;
    event.contexts = sanitizeSentryValue(
      event.contexts,
    ) as typeof event.contexts;
    event.breadcrumbs = event.breadcrumbs?.map(
      (breadcrumb) => sanitizeSentryValue(breadcrumb) as typeof breadcrumb,
    );
    event.exception = sanitizeSentryValue(
      event.exception,
    ) as typeof event.exception;
    event.threads = sanitizeSentryValue(event.threads) as typeof event.threads;
    return event;
  },
});

const navigationFonts = {
  regular: { fontFamily: "InterRegular", fontWeight: "400" as const },
  medium: { fontFamily: "InterMedium", fontWeight: "500" as const },
  bold: { fontFamily: "InterBold", fontWeight: "700" as const },
  heavy: { fontFamily: "InterBold", fontWeight: "700" as const },
};

const lightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    primary: fintPalette.light.primary,
    background: fintPalette.light.background,
    card: fintPalette.light.headerBackground,
    text: fintPalette.light.headerText,
    border: fintPalette.light.headerBorder,
    notification: fintPalette.light.danger,
  },
  fonts: navigationFonts,
};

const darkNavigationTheme = {
  ...DarkTheme,
  colors: {
    primary: fintPalette.dark.primary,
    background: fintPalette.dark.background,
    card: fintPalette.dark.headerBackground,
    text: fintPalette.dark.headerText,
    border: fintPalette.dark.headerBorder,
    notification: fintPalette.dark.danger,
  },
  fonts: navigationFonts,
};

function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    InterRegular: require("../assets/fonts/Inter_18pt-Regular.ttf"),
    InterMedium: require("../assets/fonts/Inter_18pt-Medium.ttf"),
    InterSemiBold: require("../assets/fonts/Inter_24pt-SemiBold.ttf"),
    InterBold: require("../assets/fonts/Inter_28pt-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned) and the UI is ready.
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <Providers>
      <RootLayoutNav />
    </Providers>
  );
}

const Providers = ({ children }: { children: React.ReactNode }) => {
  return <AppProviders>{children}</AppProviders>;
};

export default Sentry.wrap(RootLayout);

function RootLayoutNav() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: financeApi.getMe,
    enabled: !!session,
    retry: false,
  });
  const { themeMode } = useThemeMode();
  const theme = useTheme();
  const router = useRouter();
  const setupComplete = meQuery.data?.setupComplete;

  useEffect(() => {
    if (setupComplete !== true) return;
    return attachNotificationResponseListener(router);
  }, [router, setupComplete]);

  return (
    <ThemeProvider
      value={themeMode === "dark" ? darkNavigationTheme : lightNavigationTheme}
    >
      <StatusBar
        style={themeMode === "dark" ? "light" : "dark"}
        backgroundColor={
          themeMode === "dark"
            ? fintPalette.dark.headerBackground
            : fintPalette.light.headerBackground
        }
      />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && setupComplete === false}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && setupComplete === true}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="transaction-form"
            options={{
              title: t("forms.newMovement"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="pending-movements"
            options={{
              title: t("movementUx.pendingTitle"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="pending-review"
            options={{
              title: t("movementUx.reviewPendingTitle"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="account-form"
            options={{
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="debt-form"
            options={{
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: t("header.menuTitle"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              title: t("profile.title"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="gmail-settings"
            options={{
              title: t("gmail.title"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="support"
            options={{
              title: t("support.title"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="improvements"
            options={{
              title: t("improvements.title"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="web-content"
            options={{
              title: t("webContent.title"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
          <Stack.Screen
            name="categories"
            options={{
              title: t("categories.routeTitle"),
              contentStyle: { backgroundColor: theme.background.val },
            }}
          />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
