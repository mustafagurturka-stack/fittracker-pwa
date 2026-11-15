-- 2026-11-15: Supabase'e uygulandı (fittracker projesi).
-- Anonim (giriş yapmamış) erişimi kapat
drop policy if exists allow_select_measurements on public.measurements;
drop policy if exists allow_insert_measurements on public.measurements;
drop policy if exists allow_delete_measurements on public.measurements;
-- Kullanılmayan demo-user kuralları
drop policy if exists "allow demo notes read" on public.notes;
drop policy if exists "allow demo notes insert" on public.notes;
drop policy if exists "allow demo notes delete" on public.notes;
drop policy if exists "allow demo sleep read" on public.sleep_logs;
drop policy if exists "allow demo sleep insert" on public.sleep_logs;
drop policy if exists "allow demo sleep update" on public.sleep_logs;
drop policy if exists "allow demo sleep delete" on public.sleep_logs;
drop policy if exists "allow demo workout read" on public.workout_logs;
drop policy if exists "allow demo workout insert" on public.workout_logs;
drop policy if exists "allow demo workout delete" on public.workout_logs;
-- Günde tek ölçüm (senkron upsert hedefi)
alter table public.measurements add constraint measurements_user_id_date_key unique (user_id, date);
