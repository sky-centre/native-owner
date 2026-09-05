import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useOwner } from "../lib/useOwner";
import { colors, spacing, radius } from "../lib/theme";

const STATUS_META = {
  PENDING: { label: "Menunggu", color: colors.warning },
  APPROVED: { label: "Aktif", color: colors.success },
  REJECTED: { label: "Ditolak", color: colors.danger },
  CLOSED: { label: "Ditutup", color: colors.muted }
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function dateKey(iso) {
  return new Date(iso).toDateString();
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateKey(iso) === dateKey(today.toISOString())) return "Hari ini";
  if (dateKey(iso) === dateKey(yesterday.toISOString())) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function initials(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

// Ceklis ala WhatsApp: 1 abu = terkirim, 2 abu = diterima, 2 biru-terang = dibaca.
function MessageTicks({ deliveredAt, readAt }) {
  if (readAt) {
    return <Ionicons name="checkmark-done" size={15} color="#8ad6ff" />;
  }
  if (deliveredAt) {
    return <Ionicons name="checkmark-done" size={15} color="rgba(255,255,255,0.55)" />;
  }
  return <Ionicons name="checkmark" size={15} color="rgba(255,255,255,0.55)" />;
}

export default function ChatScreen({ route, navigation }) {
  const { conversationId, visitorNama } = route.params;
  const { ownerId } = useOwner();
  const isFocused = useIsFocused();
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showKeperluan, setShowKeperluan] = useState(true);
  const listRef = useRef(null);

  const fetchConversation = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id, status, keperluan, access_code_used")
      .eq("id", conversationId)
      .maybeSingle();
    if (data) setConversation(data);
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, isi_pesan, status_baca, delivered_at, read_at, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchConversation();
    fetchMessages();
  }, [fetchConversation, fetchMessages]);

  // Header custom: nama visitor + status percakapan, plus aksi "Tutup" saat aktif.
  useEffect(() => {
    const status = conversation?.status;
    const meta = STATUS_META[status];

    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleWrap}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initials(visitorNama)}</Text>
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {visitorNama || "Percakapan"}
            </Text>
            {!!meta && (
              <View style={styles.headerStatusRow}>
                <View style={[styles.headerStatusDot, { backgroundColor: meta.color }]} />
                <Text style={[styles.headerStatusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            )}
          </View>
        </View>
      ),
      headerRight: () =>
        status === "APPROVED" ? (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Tutup percakapan?",
                `Percakapan dengan ${visitorNama || "visitor ini"} akan ditutup dan tidak bisa membalas lagi.`,
                [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Tutup",
                    style: "destructive",
                    onPress: async () => {
                      const { error } = await supabase
                        .from("conversations")
                        .update({ status: "CLOSED", updated_at: new Date().toISOString() })
                        .eq("id", conversationId);
                      if (error) Alert.alert("Gagal", error.message);
                      else setConversation((prev) => (prev ? { ...prev, status: "CLOSED" } : prev));
                    }
                  }
                ]
              );
            }}
            style={styles.headerAction}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
          </TouchableOpacity>
        ) : null
    });
  }, [navigation, visitorNama, conversation?.status, conversationId]);

  // Realtime: pesan baru, perubahan status kirim/baca, dan perubahan status percakapan.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => setConversation(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Tandai pesan visitor sebagai delivered begitu masuk ke device owner.
  useEffect(() => {
    if (!ownerId) return;
    const undelivered = messages.filter((m) => m.sender_id !== ownerId && !m.delivered_at);
    if (undelivered.length === 0) return;

    supabase
      .from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", undelivered.map((m) => m.id))
      .then(() => {});
  }, [messages, ownerId]);

  // Tandai read hanya saat layar ini benar-benar sedang dilihat.
  useEffect(() => {
    if (!ownerId || !isFocused) return;
    const unread = messages.filter((m) => m.sender_id !== ownerId && !m.read_at);
    if (unread.length === 0) return;

    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((m) => m.id))
      .then(() => {});
  }, [conversationId, ownerId, messages, isFocused]);

  // Susun ulang pesan jadi list campuran { type: 'date' } dan { type: 'message' }
  // supaya ada pemisah tanggal antar hari, seperti aplikasi chat pada umumnya.
  const listData = useMemo(() => {
    const out = [];
    let lastDateKey = null;
    for (const m of messages) {
      const dk = dateKey(m.created_at);
      if (dk !== lastDateKey) {
        out.push({ type: "date", id: `date-${dk}`, label: formatDateLabel(m.created_at) });
        lastDateKey = dk;
      }
      out.push({ type: "message", ...m });
    }
    return out;
  }, [messages]);

  const send = async () => {
    const isi = text.trim();
    if (!isi || !ownerId || sending) return;

    setSending(true);
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: ownerId, isi_pesan: isi })
      .select()
      .single();
    setSending(false);

    if (error) {
      setText(isi);
      Alert.alert("Gagal mengirim", "Pesan tidak terkirim. Coba lagi.");
      return;
    }

    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const closed = conversation?.status === "CLOSED" || conversation?.status === "REJECTED";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {!!conversation?.keperluan && showKeperluan && (
        <View style={styles.keperluanBanner}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.accent} />
          <Text style={styles.keperluanText} numberOfLines={2}>
            {conversation.keperluan}
          </Text>
          <TouchableOpacity onPress={() => setShowKeperluan(false)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>Belum ada pesan. Mulai percakapan.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          if (item.type === "date") {
            return (
              <View style={styles.dateSeparator}>
                <Text style={styles.dateSeparatorText}>{item.label}</Text>
              </View>
            );
          }

          const mine = item.sender_id === ownerId;
          const prevItem = listData[index - 1];
          const grouped = prevItem?.type === "message" && prevItem.sender_id === item.sender_id;

          return (
            <View
              style={[
                styles.bubbleRow,
                mine ? styles.rowRight : styles.rowLeft,
                { marginTop: grouped ? 2 : spacing.sm }
              ]}
            >
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.isi_pesan}</Text>
                <View style={styles.bubbleFooter}>
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {formatTime(item.created_at)}
                  </Text>
                  {mine && <MessageTicks deliveredAt={item.delivered_at} readAt={item.read_at} />}
                </View>
              </View>
            </View>
          );
        }}
      />

      {closed ? (
        <View style={styles.closedBanner}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
          <Text style={styles.closedBannerText}>
            {conversation?.status === "CLOSED" ? "Percakapan ini sudah ditutup." : "Percakapan ini ditolak."}
          </Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Tulis pesan..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <Ionicons name="send" size={18} color={colors.bg} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },

  headerTitleWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, maxWidth: 220 },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  headerAvatarText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  headerName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  headerStatusDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatusText: { fontSize: 11, fontWeight: "600" },
  headerAction: { paddingHorizontal: spacing.sm },

  keperluanBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  keperluanText: { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 17 },

  listContent: { padding: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1 },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingTop: 80 },
  emptyText: { color: colors.muted, fontSize: 13 },

  dateSeparator: { alignItems: "center", marginVertical: spacing.md },
  dateSeparatorText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden"
  },

  bubbleRow: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4
  },
  bubbleTextMine: { color: "#fff", fontSize: 15, lineHeight: 20 },
  bubbleTextTheirs: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
    gap: 4
  },
  bubbleTime: { color: colors.muted, fontSize: 10.5 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },

  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg
  },
  closedBannerText: { color: colors.muted, fontSize: 12.5 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    maxHeight: 120,
    fontSize: 15
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: { opacity: 0.4 }
});
