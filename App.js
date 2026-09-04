import { useEffect, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View, ActivityIndicator } from "react-native";
import { supabase } from "./lib/supabase";
import { getOwnerSession } from "./lib/auth";
import PinLogin from "./components/PinLogin";
import OwnerHome from "./components/OwnerHome";

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {checking ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2f7de1" />
        </View>
      ) : isOwner ? (
        <OwnerHome onLoggedOut={() => setIsOwner(false)} />
      ) : (
        <PinLogin onSuccess={() => setIsOwner(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0f" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" }
});