import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView
} from "react-native";
import { supabase } from "../lib/supabase";
import { logoutOwner, PIN_LENGTH } from "../lib/auth";
import { colors, spacing, radius } from "../lib/theme";

export default function SettingsScreen({ onLoggedOut }) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const savePin = async () => {
    if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      Alert.alert("PIN tidak lengkap", `PIN harus ${PIN_LENGTH} digit angka.`);
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("PIN tidak cocok", "PIN baru dan konfirmasi harus sama.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("change_owner_pin", { new_pin: newPin });
    setSaving(false);

    if (error || !data) {
      Alert.alert("Gagal mengganti PIN", error?.message || "Coba lagi.");
      return;
    }

    setNewPin("");
    setConfirmPin("");
    Alert.alert("Berhasil", "PIN akses berhasil diganti.");
  };

  const confirmLogout = () => {
    Alert.alert("Keluar?", "Kamu perlu memasukkan PIN lagi untuk masuk.", [
      { text: "Batal", style: "cancel" },
      { text: "Keluar", style: "destructive", onPress: doLogout }
    ]);
  };

  const doLogout = async () => {
    setLoggingOut(true);
    await logoutOwner();
    setLoggingOut(false);
    onLoggedOut?.();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Ganti PIN Akses</Text>
      <View style={styles.card}>
        <Text style={styles.label}>PIN baru</Text>
        <TextInput
          style={styles.input}
          value={newPin}
          onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH))}
          placeholder={"•".repeat(PIN_LENGTH)}
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={PIN_LENGTH}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Konfirmasi PIN baru</Text>
        <TextInput
          style={styles.input}
          value={confirmPin}
          onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH))}
          placeholder={"•".repeat(PIN_LENGTH)}
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={PIN_LENGTH}
        />

        <TouchableOpacity
          style={[
            styles.saveBtn,
            (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) &&
              styles.saveBtnDisabled
          ]}
          onPress={savePin}
          disabled={newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Simpan PIN Baru</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Akun</Text>
      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} disabled={loggingOut}>
        {loggingOut ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={styles.logoutText}>Keluar</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginTop: spacing.lg
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  label: { color: colors.text, fontSize: 13, fontWeight: "600", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    letterSpacing: 6
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  logoutBtn: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 14 }
});
