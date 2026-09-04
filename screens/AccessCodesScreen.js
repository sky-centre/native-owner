import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { supabase } from "../lib/supabase";
import { useOwner } from "../lib/useOwner";
import { colors, spacing, radius } from "../lib/theme";

const EXPIRY_OPTIONS = [
  { label: "Tanpa batas waktu", hours: null },
  { label: "24 jam", hours: 24 },
  { label: "7 hari", hours: 24 * 7 },
  { label: "30 hari", hours: 24 * 30 }
];

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function formatExpiry(iso) {
  if (!iso) return "Tanpa batas waktu";
  const d = new Date(iso);
  const expired = d.getTime() < Date.now();
  const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  return expired ? `Kedaluwarsa (${dateStr})` : `Sampai ${dateStr}`;
}

export default function AccessCodesScreen() {
  const { ownerId } = useOwner();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const [label, setLabel] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(0);

  const fetchCodes = useCallback(async () => {
    if (!ownerId) return;
    const { data, error } = await supabase
      .from("access_codes")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (!error && data) setCodes(data);
    setLoading(false);
    setRefreshing(false);
  }, [ownerId]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const resetForm = () => {
    setLabel("");
    setCustomCode("");
    setMaxUses("");
    setExpiryIdx(0);
  };

  const createCode = async () => {
    if (!ownerId) return;
    setCreating(true);

    const code = (customCode.trim() || randomCode()).toUpperCase();
    const hours = EXPIRY_OPTIONS[expiryIdx].hours;
    const expires_at = hours ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null;
    const parsedMax = maxUses.trim() ? parseInt(maxUses.trim(), 10) : null;

    const { error } = await supabase.from("access_codes").insert({
      owner_id: ownerId,
      code,
      label: label.trim() || null,
      max_uses: Number.isFinite(parsedMax) ? parsedMax : null,
      expires_at
    });

    setCreating(false);

    if (error) {
      Alert.alert("Gagal membuat kode", error.message);
      return;
    }

    resetForm();
    setModalVisible(false);
    fetchCodes();
  };

  const toggleActive = async (item) => {
    const { error } = await supabase
      .from("access_codes")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      Alert.alert("Gagal", error.message);
    } else {
      setCodes((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, is_active: !c.is_active } : c))
      );
    }
  };

  const deleteCode = (item) => {
    Alert.alert("Hapus kode akses?", `Kode "${item.code}" akan dihapus permanen.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("access_codes").delete().eq("id", item.id);
          if (error) {
            Alert.alert("Gagal", error.message);
          } else {
            setCodes((prev) => prev.filter((c) => c.id !== item.id));
          }
        }
      }
    ]);
  };

  const copyCode = async (code) => {
    await Clipboard.setStringAsync(code);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={codes}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCodes();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada kode akses. Buat satu untuk visitor.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const expired = item.expires_at && new Date(item.expires_at).getTime() < Date.now();
          const usedUp = item.max_uses != null && item.used_count >= item.max_uses;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <TouchableOpacity onPress={() => copyCode(item.code)} style={styles.codeWrap}>
                  <Text style={styles.code}>{item.code}</Text>
                  <Text style={styles.copyHint}>salin</Text>
                </TouchableOpacity>
                <Switch
                  value={item.is_active}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              {!!item.label && <Text style={styles.label}>{item.label}</Text>}

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, (expired || usedUp) && styles.metaWarn]}>
                  {formatExpiry(item.expires_at)}
                </Text>
                <Text style={[styles.metaText, usedUp && styles.metaWarn]}>
                  Dipakai {item.used_count}
                  {item.max_uses != null ? ` / ${item.max_uses}` : ""}
                </Text>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCode(item)}>
                <Text style={styles.deleteText}>Hapus</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ Kode Baru</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Buat Kode Akses</Text>

            <Text style={styles.fieldLabel}>Label (opsional)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="mis. untuk teman kampus"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.fieldLabel}>Kode kustom (opsional)</Text>
            <TextInput
              style={styles.input}
              value={customCode}
              onChangeText={(v) => setCustomCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="kosongkan untuk acak"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              maxLength={12}
            />

            <Text style={styles.fieldLabel}>Batas pemakaian (opsional)</Text>
            <TextInput
              style={styles.input}
              value={maxUses}
              onChangeText={(v) => setMaxUses(v.replace(/[^0-9]/g, ""))}
              placeholder="kosongkan untuk tanpa batas"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Masa berlaku</Text>
            <View style={styles.expiryRow}>
              {EXPIRY_OPTIONS.map((opt, idx) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.expiryChip, expiryIdx === idx && styles.expiryChipActive]}
                  onPress={() => setExpiryIdx(idx)}
                >
                  <Text
                    style={[
                      styles.expiryChipText,
                      expiryIdx === idx && styles.expiryChipTextActive
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  resetForm();
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreate} onPress={createCode} disabled={creating}>
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalCreateText}>Buat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, paddingBottom: 100 },
  emptyBox: { alignItems: "center", marginTop: spacing.xxl },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  codeWrap: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  code: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  copyHint: { color: colors.accent, fontSize: 11, fontWeight: "600" },
  label: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md
  },
  metaText: { color: colors.muted, fontSize: 12 },
  metaWarn: { color: colors.warning },
  deleteBtn: { alignSelf: "flex-start", marginTop: spacing.md },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.lg,
    left: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14
  },
  expiryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  expiryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  expiryChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  expiryChipText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  expiryChipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  modalCancelText: { color: colors.muted, fontWeight: "600" },
  modalCreate: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.accent
  },
  modalCreateText: { color: "#fff", fontWeight: "700" }
});
