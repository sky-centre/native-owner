import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";
import { logoutOwner } from "../lib/auth";

export default function OwnerHome({ onLoggedOut }) {
  const [status, setStatus] = useState("Menghubungkan ke backend...");

  useEffect(() => {
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .then(({ error }) => {
        setStatus(error ? `Gagal konek: ${error.message}` : "Terhubung ke backend ✅");
      });
  }, []);

  const handleLogout = async () => {
    await logoutOwner();
    onLoggedOut();
  };

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Sam Zone — Owner</Text>
      <Text style={styles.status}>{status}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  status: { color: "#9a9aa5", fontSize: 14 },
  logoutButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f7de1"
  },
  logoutText: { color: "#2f7de1", fontSize: 14, fontWeight: "600" }
});