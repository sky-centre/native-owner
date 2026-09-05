import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useOwner } from "../lib/useOwner";
import { colors, spacing, radius } from "../lib/theme";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// Centang ala WhatsApp untuk pesan milik owner sendiri:
// belum terkirim -> 1 centang abu, delivered -> 2 centang abu, dibaca -> 2 centang biru.
function MessageTicks({ deliveredAt, readAt }) {
  if (readAt) {
    return <Text style={[styles.ticks, styles.ticksRead]}>✓✓</Text>;
  }
  if (deliveredAt) {
    return <Text style={styles.ticks}>✓✓</Text>;
  }
  return <Text style={styles.ticks}>✓</Text>;
}

export default function ChatScreen({ route, navigation }) {
  const { conversationId, visitorNama } = route.params;
  const { ownerId } = useOwner();
  const isFocused = useIsFocused();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: visitorNama || "Percakapan" });
  }, [navigation, visitorNama]);

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
    fetchMessages();
  }, [fetchMessages]);

  // Realtime: pesan baru masuk & perubahan status (delivered/read) di percakapan ini.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Tandai pesan visitor sebagai "delivered" begitu masuk ke device owner
  // (terlepas dari layar chat sedang dibuka atau tidak).
  useEffect(() => {
    if (!ownerId) return;
    const undelivered = messages.filter((m) => m.sender_id !== ownerId && !m.delivered_at);
    if (undelivered.length === 0) return;

    supabase
      .from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .in(
        "id",
        undelivered.map((m) => m.id)
      )
      .then(() => {});
  }, [messages, ownerId]);

  // Tandai pesan visitor sebagai "read" hanya saat layar chat ini sedang aktif dilihat.
  useEffect(() => {
    if (!ownerId || !isFocused) return;
    const unread = messages.filter((m) => m.sender_id !== ownerId && !m.read_at);
    if (unread.length === 0) return;

    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unread.map((m) => m.id)
      )
      .then(() => {});
  }, [conversationId, ownerId, messages, isFocused]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === ownerId;
          return (
            <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                  {item.isi_pesan}
                </Text>
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
            <Text style={styles.sendText}>Kirim</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm
  },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4
  },
  bubbleTextMine: { color: "#fff", fontSize: 14 },
  bubbleTextTheirs: { color: colors.text, fontSize: 14 },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
    gap: 4
  },
  bubbleTime: { color: colors.muted, fontSize: 10 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.7)" },
  ticks: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  ticksRead: { color: "#7fd7ff" },
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
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    maxHeight: 120,
    fontSize: 14
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 13 }
});
