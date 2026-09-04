import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
  ScrollView,
  Alert
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "../lib/supabase";
import { useOwner } from "../lib/useOwner";
import { colors, spacing, radius } from "../lib/theme";

export default function ProfileScreen() {
  const { ownerId, profile, setProfile, loading, refresh } = useOwner();

  const [username, setUsername] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [statusOnline, setStatusOnline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
      setDeskripsi(profile.deskripsi || "");
      setStatusOnline(!!profile.status_online);
      setDirty(false);
    }
  }, [profile]);

  const pickAndUploadPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Izin dibutuhkan", "Beri izin akses galeri untuk mengganti foto profil.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${ownerId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, decode(base64), {
          contentType: asset.mimeType || `image/${ext}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const foto_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("public_profile")
        .update({ foto_url })
        .eq("owner_id", ownerId);

      if (updateError) throw updateError;

      setProfile((p) => ({ ...p, foto_url }));
    } catch (e) {
      Alert.alert("Gagal upload foto", e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async () => {
    if (!username.trim()) {
      Alert.alert("Username kosong", "Username tidak boleh kosong.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("public_profile")
      .update({
        username: username.trim(),
        deskripsi: deskripsi.trim() || null,
        status_online: statusOnline
      })
      .eq("owner_id", ownerId);
    setSaving(false);

    if (error) {
      Alert.alert("Gagal menyimpan", error.message);
    } else {
      setDirty(false);
      refresh();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarWrap}>
        <TouchableOpacity onPress={pickAndUploadPhoto} disabled={uploadingPhoto}>
          {profile?.foto_url ? (
            <Image source={{ uri: profile.foto_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {(username || "S").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.avatarEditText}>Ganti</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={(v) => {
            setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""));
            setDirty(true);
          }}
          placeholder="username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Link publik: your-app.vercel.app/{username || "username"}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Deskripsi</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={deskripsi}
          onChangeText={(v) => {
            setDeskripsi(v);
            setDirty(true);
          }}
          placeholder="Ceritakan sedikit tentang dirimu..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Status online</Text>
          <Text style={styles.hint}>Ditampilkan ke visitor di halaman publikmu</Text>
        </View>
        <Switch
          value={statusOnline}
          onValueChange={(v) => {
            setStatusOnline(v);
            setDirty(true);
          }}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
        onPress={save}
        disabled={!dirty || saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Simpan Perubahan</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  avatarWrap: { alignItems: "center", marginBottom: spacing.xl },
  avatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: colors.card },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { color: colors.muted, fontSize: 36, fontWeight: "700" },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.bg
  },
  avatarEditText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  field: { marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: 11, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 }
});
