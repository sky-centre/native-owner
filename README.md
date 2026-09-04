# Sam Zone — Owner App

Native app (Expo) untuk role OWNER, terhubung ke backend Supabase yang sama dengan `sky-zone-pwa` (project `sky-centre`).

## Sebelum build pertama kali

1. **`google-services.json`**
   Ambil dari Firebase project `sam-zone-393aa`, taruh di root repo ini (sejajar dengan `package.json`).
   File ini aman untuk di-commit.

2. **Isi anon key Supabase**
   Buka `app.config.js` → ganti `ISI_DENGAN_ANON_KEY_SUPABASE` dengan anon key asli
   (Supabase Dashboard → Project Settings → API → `anon` `public` key).

3. **GitHub Secrets** (repo → Settings → Secrets and variables → Actions)
   - `EXPO_TOKEN` — dari expo.dev → Account Settings → Access Tokens

4. **FCM V1 Service Account Key**
   Upload file `sam-zone-393aa-firebase-adminsdk-...json` ke **expo.dev** (project `sam-chat`
   → Credentials → Android → FCM V1 Service Account Key).
   **Jangan** commit file ini ke repo — sudah diblokir lewat `.gitignore`.

5. **Assets**
   Siapkan folder `assets/` berisi `icon.png`, `splash.png`, `adaptive-icon.png`,
   `notification-icon.png` (bisa reuse dari branding PWA).

## Menjalankan build

Repo ini tidak butuh terminal lokal sama sekali:

- Buka tab **Actions** di GitHub → workflow **"EAS Build (Android)"** → **Run workflow**
- Pilih profile: `development` / `preview` / `production`
- Progress build bisa dipantau di tab Actions atau di expo.dev
- Hasil `.apk` / `.aab` bisa didownload dari expo.dev setelah build selesai

## EAS Update (OTA) — hemat limit build

Setelah build native pertama berhasil terinstall di device, perubahan **JS/logic/asset** (bukan native config)
tidak perlu build ulang lagi. Cukup pakai **EAS Update**:

- **Otomatis**: setiap push ke branch `main` akan trigger workflow `eas-update.yml` → publish ke channel `preview`
- **Manual**: tab Actions → workflow **"EAS Update (OTA)"** → Run workflow → pilih channel

App yang sudah terinstall akan otomatis mengambil update ini saat dibuka ulang — **tanpa perlu install ulang APK**.

**Kapan tetap butuh build native ulang (bukan cukup update):**
- Menambah/mengganti native module (misal package baru yang punya kode native)
- Mengubah `app.config.js` bagian native (package name, permissions, icon, splash)
- Upgrade versi Expo SDK

Selama cuma ubah tampilan, logic, atau teks — cukup `eas update`, tidak perlu buang limit build.

## Struktur

- `app.config.js` — konfigurasi Expo (package name, plugin, EAS project id)
- `eas.json` — profile build (development/preview/production)
- `lib/supabase.js` — client Supabase, baca URL & anon key dari `app.config.js`
- `App.js` — entry point, sementara hanya cek koneksi ke backend
