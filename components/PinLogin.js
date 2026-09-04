import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from "react-native";
import { loginWithPin, PIN_LENGTH } from "../lib/auth";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"]
];

export default function PinLogin({ onSuccess }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (fullPin) => {
    setLoading(true);
    setError("");
    const result = await loginWithPin(fullPin);
    setLoading(false);

    if (result.ok) {
      onSuccess();
    } else {
      setError(result.message);
      setPin("");
    }
  };

  const onKeyPress = (key) => {
    if (loading) return;

    if (key === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "") return;

    setError("");
    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      submit(next);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require("../assets/icon.png")} style={styles.logo} />
      <Text style={styles.title}>Sam Zone — Owner</Text>
      <Text style={styles.subtitle}>Masukkan kode akses</Text>

      <View style={styles.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled]}
          />
        ))}
      </View>

      <View style={styles.messageBox}>
        {loading ? (
          <ActivityIndicator color="#2f7de1" />
        ) : (
          !!error && <Text style={styles.error}>{error}</Text>
        )}
      </View>

      <View style={styles.keypad}>
        {KEYS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyRow}>
            {row.map((key, keyIndex) => {
              if (key === "") {
                return <View key={keyIndex} style={styles.keySpacer} />;
              }
              return (
                <TouchableOpacity
                  key={keyIndex}
                  style={styles.key}
                  activeOpacity={0.6}
                  disabled={loading}
                  onPress={() => onKeyPress(key)}
                >
                  {key === "back" ? (
                    <Text style={styles.keyTextBack}>⌫</Text>
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 20,
    marginBottom: 4
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700"
  },
  subtitle: {
    color: "#9a9aa5",
    fontSize: 14,
    marginBottom: 12
  },
  dotsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#2f7de1"
  },
  dotFilled: {
    backgroundColor: "#2f7de1"
  },
  messageBox: {
    height: 28,
    justifyContent: "center",
    marginBottom: 8
  },
  error: {
    color: "#ff6b6b",
    fontSize: 13
  },
  keypad: {
    gap: 14
  },
  keyRow: {
    flexDirection: "row",
    gap: 22
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16161d",
    borderWidth: 1,
    borderColor: "#22222c"
  },
  keySpacer: {
    width: 72,
    height: 72
  },
  keyText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "600"
  },
  keyTextBack: {
    color: "#9a9aa5",
    fontSize: 22
  }
});