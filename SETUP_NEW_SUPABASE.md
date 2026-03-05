# Setup Supabase Baru untuk Samara ATS

**Account:** `wowilingrivo@gmail.com`

---

## Step 1: Buat Project Baru di Supabase

1. Login ke [supabase.com/dashboard](https://supabase.com/dashboard) dengan `wowilingrivo@gmail.com`
2. Klik **New Project**
3. Isi:
   - **Name:** `samara-ats` (atau nama lain)
   - **Database Password:** catat password-nya
   - **Region:** Southeast Asia (Singapore) — terdekat ke Lombok
4. Tunggu project selesai provisioning (~2 menit)

---

## Step 2: Jalankan Skeleton SQL

1. Di dashboard Supabase project baru → **SQL Editor** → **New query**
2. Buka file `skeleton_fresh_supabase.sql` dari repo
3. Copy-paste **seluruh isi** file ke SQL Editor
4. Klik **Run** (atau Ctrl+Enter)
5. Pastikan tidak ada error (semua `IF NOT EXISTS` jadi safe to re-run)

---

## Step 3: Buat Storage Bucket untuk CV

1. Dashboard → **Storage** → **New Bucket**
2. Settings:
   - **Name:** `cvs`
   - **Public:** NO (private)
   - **Allowed MIME types:**
     ```
     application/pdf
     application/msword
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     ```
   - **Max file size:** `10485760` (10MB)

---

## Step 4: Ambil API Keys

Di dashboard → **Settings** → **API**, catat:

| Key | Untuk |
|-----|-------|
| **Project URL** | `https://xxxxx.supabase.co` |
| **anon (public)** | `eyJ...` |
| **service_role** | `eyJ...` (RAHASIA — jangan expose ke frontend) |

---

## Step 5: Update `.env` / `notepad.env`

Buka file `notepad.env` di repo dan ganti dengan key baru:

```env
VITE_SUPABASE_URL=https://YOUR-NEW-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...YOUR_NEW_ANON_KEY...

# OAuth (opsional, isi kalau sudah punya)
VITE_MS_CLIENT_ID=
VITE_ZOOM_CLIENT_ID=

# ANTHROPIC_KEY hanya di Supabase secrets, BUKAN di sini
```

Lalu copy ke `.env`:

```powershell
copy notepad.env .env
```

---

## Step 6: Set Supabase Edge Function Secrets

```bash
# Login ke Supabase CLI (kalau belum)
npx supabase login

# Link ke project baru
npx supabase link --project-ref YOUR-NEW-PROJECT-REF

# Set secrets
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
npx supabase secrets set SUPABASE_URL=https://YOUR-NEW-PROJECT-REF.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...YOUR_SERVICE_ROLE_KEY
npx supabase secrets set SUPABASE_ANON_KEY=eyJ...YOUR_NEW_ANON_KEY
```

Opsional (kalau pakai Zoom/Microsoft):
```bash
npx supabase secrets set ZOOM_CLIENT_ID=...
npx supabase secrets set ZOOM_CLIENT_SECRET=...
npx supabase secrets set MS_CLIENT_ID=...
npx supabase secrets set MS_CLIENT_SECRET=...
```

---

## Step 7: Deploy Edge Functions

```bash
npx supabase functions deploy claude-proxy
npx supabase functions deploy score-candidate
npx supabase functions deploy form-submit
npx supabase functions deploy careers-submit
npx supabase functions deploy prescreening-submit
npx supabase functions deploy schedule-interview
npx supabase functions deploy oauth-callback
```

---

## Step 8: Update Webhook URL (di SQL)

Setelah deploy, update fungsi webhook supaya mengarah ke project baru:

```sql
CREATE OR REPLACE FUNCTION public.trigger_ai_scoring()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- GANTI dengan URL project baru
  edge_function_url := 'https://YOUR-NEW-PROJECT-REF.supabase.co/functions/v1/score-candidate';
  service_role_key := 'YOUR_NEW_ANON_KEY';

  PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA,
          'record', row_to_json(NEW),
          'old_record', row_to_json(OLD)
      )
  );
  RETURN NEW;
END;
$$;
```

---

## Step 9: Setup Auth (Google Login)

1. Dashboard → **Authentication** → **Providers**
2. Enable **Google**
3. Masukkan Google OAuth Client ID & Secret
4. Set redirect URL: `https://your-app-domain.com/auth/callback`

---

## Step 10: Vercel / Deploy Frontend

Update di Vercel environment variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | URL project baru |
| `VITE_SUPABASE_ANON_KEY` | Anon key baru |

---

## Done!

Setelah semua step selesai:
- Database skeleton sudah terinstall (tables, RLS, triggers, functions)
- Edge functions sudah deployed
- Frontend terkoneksi ke Supabase baru
- Tinggal buat user pertama via login, lalu promote ke Admin via SQL:

```sql
UPDATE public.profiles SET role = 'Admin' WHERE email = 'wowilingrivo@gmail.com';
```
