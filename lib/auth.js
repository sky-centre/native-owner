import { supabase } from "./supabase";

export const PIN_LENGTH = 4;

// Cek apakah sesi yang aktif sekarang adalah sesi OWNER yang valid.
export async function getOwnerSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) return false;

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", session.user.id)
    .eq("role", "OWNER")
    .maybeSingle();

  return !error && !!data;
}

// Login pakai PIN. PIN diverifikasi di backend (Postgres function),
// tidak pernah disimpan atau dicocokkan di sisi app.
export async function loginWithPin(pin) {
  let {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      return { ok: false, message: "Tidak bisa terhubung ke server. Coba lagi." };
    }
  }

  const { data, error } = await supabase.rpc("verify_and_claim_owner", {
    input_pin: pin
  });

  if (error) {
    return { ok: false, message: "Terjadi kesalahan. Coba lagi." };
  }

  if (!data) {
    return { ok: false, message: "Kode akses salah." };
  }

  return { ok: true };
}

export async function logoutOwner() {
  await supabase.auth.signOut();
}