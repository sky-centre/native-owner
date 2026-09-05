import { useEffect, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "./lib/supabase";
import { getOwnerSession } from "./lib/auth";
import { registerOwnerPushToken, addNotificationTapListener } from "./lib/notifications";
import PinLogin from "./components/PinLogin";
import RootNavigator, { navigateToConversation } from "./navigation/RootNavigator";
import { colors } from "./lib/theme";

export default function App() {
  const [checking, setChecking] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let mounted = true;

    getOwnerSession().then((ok) => {
      if (mounted) {
        setIsOwner(ok);
        setChecking(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      getOwnerSession().then((ok) => {
        if (mounted) setIsOwner(ok);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Setelah owner terverifikasi, daftarkan push token perangkat ini ke tabel
  // `devices` supaya backend bisa mengirim notif saat ada ketukan pintu / pesan baru.
  useEffect(() => {
    if (!isOwner) return;
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || !mounted) return;
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", session.user.id)
        .eq("role", "OWNER")
        .maybeSingle();

      if (mounted && userRow?.id) {
        registerOwnerPushToken(userRow.id);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOwner]);

  // Saat owner mengetuk notifikasi (app di background/mati), langsung buka
  // percakapan terkait.
  useEffect(() => {
    const unsubscribe = addNotificationTapListener(({ conversationId }) => {
      navigateToConversation(conversationId);
    });
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        {checking ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : isOwner ? (
          <RootNavigator onLoggedOut={() => setIsOwner(false)} />
        ) : (
          <PinLogin onSuccess={() => setIsOwner(true)} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" }
});