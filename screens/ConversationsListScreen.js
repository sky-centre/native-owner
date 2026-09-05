import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from "react-native";
import { supabase } from "../lib/supabase";
import { useOwner } from "../lib/useOwner";
import { colors, spacing, radius } from "../lib/theme";

const STATUS_LABEL = {
  PENDING: "Menunggu",
  APPROVED: "Aktif",
  REJECTED: "Ditolak",
  CLOSED: "Selesai"
};

const STATUS_COLOR = {
  PENDING: colors.warning,
  APPROVED: colors.success,
  REJECTED: colors.danger,
  CLOSED: colors.muted
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  return `${Math.floor(hr / 24)}h lalu`;
}

export default function ConversationsListScreen({ navigation }) {
  const { ownerId } = useOwner();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState(null);

  const fetchConversations = useCallback(async () => {
    if (!ownerId) return;
    const { data, error } = await supabase
      .from("conversations")
      .select(
        "id, status, keperluan, access_code_used, created_at, updated_at, visitor:users!conversations_visitor_id_fkey(id, nama, avatar_url)"
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setConversations(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [ownerId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!ownerId) return;
    const channel = supabase
      .channel(`owner-conversations-${ownerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `owner_id=eq.${ownerId}`
        },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId, fetchConversations]);

  const respond = async (conversationId, status) => {
    setActingOn(conversationId);

    // Optimistic update: UI langsung pindah kartu ke section yang benar tanpa
    // menunggu round-trip network. Realtime subscription tetap jalan sebagai
    // pengaman konsistensi (mis. kalau ada perubahan dari device lain).
    const previous = conversations;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, status, updated_at: new Date().toISOString() } : c
      )
    );

    const { error } = await supabase
      .from("conversations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    setActingOn(null);

    if (error) {
      // Gagal -> rollback ke state sebelumnya dan kasih tahu.
      setConversations(previous);
      Alert.alert("Gagal", error.message);
    }
  };

  const confirmReject = (conversationId, nama) => {
    Alert.alert("Tolak percakapan?", `Ketukan pintu dari ${nama} akan ditolak.`, [
      { text: "Batal", style: "cancel" },
      { text: "Tolak", style: "destructive", onPress: () => respond(conversationId, "REJECTED") }
    ]);
  };

  // --- RESET CHAT: hapus semua pesan, conversation tetap ada, di kedua sisi ---
  const resetChat = async (conversationId) => {
    setActingOn(conversationId);
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);
    setActingOn(null);

    if (error) {
      Alert.alert("Gagal", error.message);
      return;
    }
    fetchConversations();
  };

  // --- HAPUS PERMANEN: hapus conversation, messages ikut terhapus (FK cascade), di kedua sisi ---
  const deleteConversation = async (conversationId) => {
    setActingOn(conversationId);
    const previous = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    setActingOn(null);

    if (error) {
      setConversations(previous);
      Alert.alert("Gagal", error.message);
    }
  };

  const handleLongPressCard = (conv, nama) => {
    Alert.alert(
      nama,
      "Pilih tindakan untuk percakapan ini",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset Chat",
          onPress: () =>
            Alert.alert(
              "Reset chat?",
              `Semua pesan dengan ${nama} akan dihapus di kedua sisi, tapi percakapan tetap ada.`,
              [
                { text: "Batal", style: "cancel" },
                { text: "Reset", onPress: () => resetChat(conv.id) }
              ]
            ),
        },
        {
          text: "Hapus Permanen",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Hapus percakapan?",
              `Percakapan dan seluruh riwayat chat dengan ${nama} akan dihapus permanen di kedua sisi. Tindakan ini tidak bisa dibatalkan.`,
              [
                { text: "Batal", style: "cancel" },
                {
                  text: "Hapus",
                  style: "destructive",
                  onPress: () => deleteConversation(conv.id)
                }
              ]
            ),
        }
      ],
      { cancelable: true }
    );
  };

  const pending = conversations.filter((c) => c.status === "PENDING");
  const active = conversations.filter((c) => c.status === "APPROVED");
  const history = conversations.filter((c) => c.status === "REJECTED" || c.status === "CLOSED");

  const sections = [
    { key: "PENDING", title: "Mengetuk pintu", data: pending },
    { key: "APPROVED", title: "Percakapan aktif", data: active },
    { key: "HISTORY", title: "Riwayat", data: history }
  ].filter((s) => s.data.length > 0);

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
        data={sections}
        keyExtractor={(s) => s.key}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchConversations();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada visitor yang mengetuk pintu.</Text>
          </View>
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((conv) => {
              const nama = conv.visitor?.nama || "Visitor";
              const isPending = conv.status === "PENDING";
              return (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.card}
                  activeOpacity={isPending ? 1 : 0.7}
                  onPress={() => {
                    if (conv.status === "APPROVED") {
                      navigation.navigate("Chat", { conversationId: conv.id, visitorNama: nama });
                    }
                  }}
                  onLongPress={() => handleLongPressCard(conv, nama)}
                  delayLongPress={350}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.visitorName}>{nama}</Text>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: `${STATUS_COLOR[conv.status]}22` }
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: STATUS_COLOR[conv.status] }]}>
                        {STATUS_LABEL[conv.status]}
                      </Text>
                    </View>
                  </View>

                  {!!conv.keperluan && (
                    <Text style={styles.keperluan} numberOfLines={2}>
                      {conv.keperluan}
                    </Text>
                  )}

                  <View style={styles.cardBottom}>
                    <Text style={styles.timeText}>{timeAgo(conv.created_at)}</Text>
                    {!!conv.access_code_used && (
                      <Text style={styles.codeText}>kode: {conv.access_code_used}</Text>
                    )}
                  </View>

                  {actingOn === conv.id && (
                    <View style={styles.actingOverlay}>
                      <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                  )}

                  {isPending && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        disabled={actingOn === conv.id}
                        onPress={() => confirmReject(conv.id, nama)}
                      >
                        <Text style={styles.rejectText}>Tolak</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        disabled={actingOn === conv.id}
                        onPress={() => respond(conv.id, "APPROVED")}
                      >
                        {actingOn === conv.id ? (
                          <ActivityIndicator size="small" color={colors.bg} />
                        ) : (
                          <Text style={styles.approveText}>Terima</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  emptyBox: { alignItems: "center", marginTop: spacing.xxl },
  emptyText: { color: colors.muted, fontSize: 14 },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  visitorName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  keperluan: { color: colors.muted, fontSize: 13, marginTop: spacing.xs, lineHeight: 18 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  timeText: { color: colors.muted, fontSize: 11 },
  codeText: { color: colors.accent, fontSize: 11, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  rejectBtn: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  approveBtn: { backgroundColor: colors.accent },
  rejectText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  approveText: { color: colors.bg, fontWeight: "700", fontSize: 13 },
  actingOverlay: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg
  }
});