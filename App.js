import { useEffect, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function App() {
  const [status, setStatus] = useState("Menghubungkan ke backend...");

  useEffect(() => {
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .then(({ error }) => {
        setStatus(error ? `Gagal konek: ${error.message}` : "Terhubung ke backend ✅");
      });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text style={styles.title}>Sam Zone — Owner</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0f" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  status: { color: "#9a9aa5", fontSize: 14 }
});
