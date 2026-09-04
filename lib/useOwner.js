import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

// Hook bersama: ambil baris `users` (role OWNER) milik sesi yang sedang login,
// beserta baris `public_profile` miliknya. Dipakai di semua layar owner supaya
// tidak berulang-ulang query auth_id -> users.id.
export function useOwner() {
  const [ownerId, setOwnerId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      setOwnerId(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id, nama")
      .eq("auth_id", session.user.id)
      .eq("role", "OWNER")
      .maybeSingle();

    if (userErr || !userRow) {
      setError(userErr?.message || "Sesi owner tidak ditemukan.");
      setLoading(false);
      return;
    }

    setOwnerId(userRow.id);

    const { data: profileRow, error: profileErr } = await supabase
      .from("public_profile")
      .select("*")
      .eq("owner_id", userRow.id)
      .maybeSingle();

    if (profileErr) {
      setError(profileErr.message);
    } else {
      setProfile(profileRow);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ownerId, profile, setProfile, loading, error, refresh: load };
}
