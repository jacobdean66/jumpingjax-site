import Constants from "expo-constants";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const LOCATION_TASK = "jumpingjax-driver-location-task";
const TOKEN_KEY = "jumpingjax.driver.sessionToken";
const DRIVER_NAME_KEY = "jumpingjax.driver.name";
const API_BASE_URL_KEY = "jumpingjax.driver.apiBaseUrl";
const TRIP_CONTEXT_KEY = "jumpingjax.driver.tripContexts";
type TripContext = { vehicle: "dodge" | "ford"; trailer: "truck-1" | "truck-2"; effectiveAt: number };

type LoginResponse =
  | {
      ok: true;
      sessionToken: string;
      driver: { id: string; name: string };
    }
  | { ok: false; error?: string };

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

type LocationPostResult =
  | { ok: true; receivedAt: string }
  | { ok: false; error: string };

function defaultApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  return typeof configured === "string" && configured.trim()
    ? configured.trim().replace(/\/+$/, "")
    : "https://jumpingjax-site.vercel.app";
}

async function storedApiBaseUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(API_BASE_URL_KEY);
  return stored?.trim().replace(/\/+$/, "") || defaultApiBaseUrl();
}

async function postLocation(location: Location.LocationObject): Promise<LocationPostResult> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return { ok: false, error: "No active driver session." };

  const batteryLevel = await Battery.getBatteryLevelAsync().catch(() => null);
  const contexts = JSON.parse(await SecureStore.getItemAsync(TRIP_CONTEXT_KEY) ?? "[]") as TripContext[];
  const equipment = contexts.filter((context) => context.effectiveAt <= location.timestamp).at(-1);
  const apiBaseUrl = await storedApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/driver/mobile/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy,
      altitudeMeters: location.coords.altitude,
      headingDegrees: location.coords.heading,
      speedMetersPerSecond: location.coords.speed,
      batteryLevel,
      capturedAt: new Date(location.timestamp).toISOString(),
      vehicle: equipment?.vehicle ?? null,
      trailer: equipment?.trailer ?? null,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; receivedAt?: string }
    | null;
  if (!response.ok || body?.ok !== true) {
    return {
      ok: false,
      error: body?.error || "Unable to send location.",
    };
  }

  return {
    ok: true,
    receivedAt: body.receivedAt || new Date().toISOString(),
  };
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const taskData = data as LocationTaskData | undefined;
  // Preserve every supplied sample rather than discarding the route between check-ins.
  for (const location of [...(taskData?.locations ?? [])].sort((a, b) => a.timestamp - b.timestamp)) {
    await postLocation(location);
  }
});

async function ensureLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === Location.PermissionStatus.GRANTED;
}

async function startTracking() {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 10,
    timeInterval: 30000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Jumping Jax Driver",
      notificationBody: "Location is active while you are signed in.",
      notificationColor: "#0f172a",
    },
  });
}

async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DriverTrackerApp />
    </SafeAreaProvider>
  );
}

function DriverTrackerApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [driverName, setDriverName] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking session...");
  const [busy, setBusy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [trackingOk, setTrackingOk] = useState(false);
  const [equipmentLabel, setEquipmentLabel] = useState<string | null>(null);

  const deviceLabel = useMemo(() => {
    const model = Device.modelName || Device.deviceName || "Driver phone";
    return `${model} (${Platform.OS})`;
  }, []);

  const sendCurrentCheckIn = useCallback(async () => {
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setTrackingOk(false);
        setStatus("Device location is off. Turn it on in phone settings to resume tracking.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: false,
      });
      const result = await postLocation(current);
      if (result.ok) {
        setLastSentAt(new Date(result.receivedAt).toLocaleTimeString());
        setTrackingOk(true);
        setStatus("Signed in. Location tracking is active.");
      } else {
        setTrackingOk(false);
        setStatus(result.error);
      }
    } catch (error) {
      setTrackingOk(false);
      setStatus(error instanceof Error ? error.message : "Unable to get a location check-in.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      const [storedUrl, storedName, token, contexts] = await Promise.all([
        SecureStore.getItemAsync(API_BASE_URL_KEY),
        SecureStore.getItemAsync(DRIVER_NAME_KEY),
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(TRIP_CONTEXT_KEY),
      ]);

      if (!mounted) return;
      if (storedUrl) setApiBaseUrl(storedUrl);
      if (storedName && token) {
        try {
          const latest = (JSON.parse(contexts ?? "[]") as TripContext[]).at(-1);
          if (latest) setEquipmentLabel(`${latest.vehicle === "dodge" ? "Dodge" : "Ford"} · ${latest.trailer === "truck-1" ? "Short Trailer" : "Long Trailer"}`);
        } catch { /* Require a fresh truck selection if the saved selection is invalid. */ }
        setDriverName(storedName);
        setSessionToken(token);
        try {
          await startTracking();
          await sendCurrentCheckIn();
        } catch {
          setTrackingOk(false);
          setStatus("Signed in, but location tracking needs permission.");
        }
      } else {
        setStatus("Sign in to start tracking.");
      }
    }

    restore();
    return () => {
      mounted = false;
    };
  }, [sendCurrentCheckIn]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active" && (await SecureStore.getItemAsync(TOKEN_KEY))) {
        await sendCurrentCheckIn();
      }
    });

    return () => sub.remove();
  }, [sendCurrentCheckIn]);

  async function handleSignIn() {
    setBusy(true);
    setStatus("Signing in...");

    try {
      const allowed = await ensureLocationPermissions();
      if (!allowed) {
        setStatus("Location permission is required before signing in.");
        Alert.alert(
          "Location required",
          "Allow background location so Jumping Jax can track deliveries while you are signed in.",
        );
        return;
      }

      const cleanApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, "");
      const response = await fetch(`${cleanApiBaseUrl}/api/driver/mobile/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          deviceId: Device.osInternalBuildId || Device.deviceName || deviceLabel,
          deviceLabel,
        }),
      });
      const result = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setStatus("Driver sign in failed.");
        return;
      }
      if (!result.ok) {
        setStatus(result.error || "Driver sign in failed.");
        return;
      }

      await Promise.all([
        SecureStore.setItemAsync(API_BASE_URL_KEY, cleanApiBaseUrl),
        SecureStore.setItemAsync(TOKEN_KEY, result.sessionToken),
        SecureStore.setItemAsync(DRIVER_NAME_KEY, result.driver.name),
        SecureStore.setItemAsync(TRIP_CONTEXT_KEY, "[]"),
      ]);

      setDriverName(result.driver.name);
      setSessionToken(result.sessionToken);
      setPassword("");
      setEquipmentLabel(null);
      await startTracking();
      await sendCurrentCheckIn();
    } catch (error) {
      setTrackingOk(false);
      setStatus(error instanceof Error ? error.message : "Unable to start tracking.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setStatus("Signing out...");
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const cleanApiBaseUrl = await storedApiBaseUrl();
      if (token) {
        await fetch(`${cleanApiBaseUrl}/api/driver/mobile/session`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
      }

      await stopTracking();
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(DRIVER_NAME_KEY),
        SecureStore.deleteItemAsync(TRIP_CONTEXT_KEY),
      ]);

      setDriverName(null);
      setSessionToken(null);
      setEquipmentLabel(null);
      setLastSentAt(null);
      setTrackingOk(false);
      setStatus("Signed out. Location tracking is off.");
    } finally {
      setBusy(false);
    }
  }

  if (driverName && sessionToken) {
    const driverUrl = `${apiBaseUrl.replace(/\/+$/, "")}/api/driver/mobile/session?sessionToken=${encodeURIComponent(sessionToken)}`;

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.appHeader}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.appHeaderTitle}>Jumping Jax Driver</Text>
            <Text style={styles.appHeaderMeta}>
              {driverName} · {trackingOk ? "tracking active" : "tracking needs attention"}
              {lastSentAt ? ` · ${lastSentAt}` : ""}
            </Text>
            <Text style={styles.appHeaderMeta}>{equipmentLabel ?? "Choose your truck and trailer below"}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.headerSignOut,
              pressed && styles.buttonPressed,
            ]}
            disabled={busy}
            onPress={handleSignOut}
          >
            <Text style={styles.headerSignOutText}>Sign Out</Text>
          </Pressable>
        </View>
        {!trackingOk ? (
          <View style={styles.trackingWarning}>
            <Text style={styles.trackingWarningText}>{status}</Text>
          </View>
        ) : null}
        <WebView
          onMessage={async (event) => {
            try {
              if (new URL(event.nativeEvent.url).origin !== new URL(apiBaseUrl).origin) return;
              const body = JSON.parse(event.nativeEvent.data);
              if (body.type === "JAX_SIGN_OUT") { await handleSignOut(); return; }
              if (body.type !== "JAX_TRIP_CONTEXT" || !["dodge", "ford"].includes(body.vehicle) || !["truck-1", "truck-2"].includes(body.trailer)) return;
              const contexts = JSON.parse(await SecureStore.getItemAsync(TRIP_CONTEXT_KEY) ?? "[]") as TripContext[];
              const next: TripContext = { vehicle: body.vehicle, trailer: body.trailer, effectiveAt: Date.now() };
              await SecureStore.setItemAsync(TRIP_CONTEXT_KEY, JSON.stringify([...contexts, next].slice(-16)));
              setEquipmentLabel(`${next.vehicle === "dodge" ? "Dodge" : "Ford"} · ${next.trailer === "truck-1" ? "Short Trailer" : "Long Trailer"}`);
              await sendCurrentCheckIn();
            } catch { setStatus("Truck selection could not sync. Save it again."); }
          }}
          source={{ uri: driverUrl }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webLoading}>
              <ActivityIndicator color="#0284c7" size="large" />
              <Text style={styles.webLoadingText}>Opening driver app...</Text>
            </View>
          )}
          style={styles.webview}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Jumping Jax</Text>
            <Text style={styles.title}>Driver Tracker</Text>
            <Text style={styles.status}>{status}</Text>
          </View>

          {driverName ? (
            <View style={styles.panel}>
              <Text style={styles.label}>Signed in as</Text>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.pill}>
                <View style={styles.dot} />
                <Text style={styles.pillText}>Location active</Text>
              </View>
              <Text style={styles.meta}>
                {lastSentAt ? `Last app check-in ${lastSentAt}` : "Waiting for first check-in"}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.signOutButton,
                  pressed && styles.buttonPressed,
                ]}
                disabled={busy}
                onPress={handleSignOut}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Out</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.label}>Website</Text>
              <TextInput
                value={apiBaseUrl}
                onChangeText={setApiBaseUrl}
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                style={styles.input}
              />
              <Text style={styles.label}>Driver name</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Blake"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Driver password"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  busy && styles.buttonDisabled,
                ]}
                disabled={busy}
                onPress={handleSignIn}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  appHeader: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderBottomColor: "#1e293b",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerTextGroup: {
    flex: 1,
  },
  appHeaderTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  appHeaderMeta: {
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  headerSignOut: {
    backgroundColor: "#e11d48",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerSignOutText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  trackingWarning: {
    backgroundColor: "#fef3c7",
    borderBottomColor: "#f59e0b",
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  trackingWarningText: {
    color: "#78350f",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  webview: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  webLoading: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  webLoadingText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },
  status: {
    color: "#cbd5e1",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 10,
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  label: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 4,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 52,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 14,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#0284c7",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 54,
    marginTop: 8,
  },
  signOutButton: {
    backgroundColor: "#e11d48",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  driverName: {
    color: "#0f172a",
    fontSize: 32,
    fontWeight: "900",
  },
  pill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: {
    backgroundColor: "#16a34a",
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  pillText: {
    color: "#14532d",
    fontSize: 13,
    fontWeight: "900",
  },
  meta: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
});
