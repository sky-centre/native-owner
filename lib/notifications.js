import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

// Tampilkan notifikasi meski app sedang dibuka (foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

// Minta izin notifikasi, ambil Expo push token, lalu simpan ke tabel `devices`
// milik owner yang sedang login. Dipanggil sekali setiap kali ownerId berubah
// (mis. setelah login PIN berhasil).
export async function registerOwnerPushToken(ownerId) {
  if (!ownerId) return null;

  if (!Device.isDevice) {
    // Emulator/simulator tidak dapat menerima push token asli.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResponse?.data;
  if (!token) return null;

  const deviceInfo = `${Device.modelName || Device.deviceName || "unknown"} · ${Platform.OS} ${Platform.Version}`;

  const { error } = await supabase
    .from("devices")
    .upsert(
      { user_id: ownerId, notification_token: token, device_info: deviceInfo },
      { onConflict: "user_id,notification_token" }
    );

  if (error) {
    console.warn("Gagal menyimpan push token:", error.message);
    return null;
  }

  return token;
}

// Dipanggil saat owner mengetuk notifikasi (app di background/mati).
// Mengembalikan { conversationId } jika notifikasi itu terkait percakapan.
export function addNotificationTapListener(callback) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.conversation_id) {
      callback({ conversationId: data.conversation_id });
    }
  });

  return () => subscription.remove();
}
