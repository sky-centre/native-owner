import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig.extra;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Rekomendasi resmi Supabase untuk React Native: auto-refresh token hanya
// berjalan aktif kalau app di foreground. Tanpa ini, sesi bisa diam-diam
// kedaluwarsa saat app lama di-background, yang ujungnya bikin query & koneksi
// realtime gagal senyap ketika app dibuka lagi.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

