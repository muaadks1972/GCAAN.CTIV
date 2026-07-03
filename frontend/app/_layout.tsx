import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, I18nManager, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/auth";

// Force RTL for Arabic app
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user && segments[0] !== "login") {
      router.replace("/login");
    } else if (user && (segments[0] === "login" || !segments[0])) {
      router.replace("/(tabs)/home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: Platform.OS === "web" ? "none" : "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="activity-new" options={{ presentation: "modal" }} />
      <Stack.Screen name="user-new" options={{ presentation: "modal" }} />
      <Stack.Screen name="departments" />
      <Stack.Screen name="divisions" />
      <Stack.Screen name="users" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="kpi" />
      <Stack.Screen name="dept-report" />
      <Stack.Screen name="range-report" />
      <Stack.Screen name="system" />
      <Stack.Screen name="audit-log" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
