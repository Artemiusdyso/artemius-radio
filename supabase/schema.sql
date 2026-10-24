-- Artemius Radio: run this SQL in the NEW radio Supabase project only.
-- Do not run it in the existing Artemius shop project.
create extension if not exists pgcrypto;

create table if not exists public.radio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.radio_admins enable row level security;
revoke all on public.radio_admins from anon, authenticated;
grant select on public.radio_admins to authenticated;
create policy "Admins can read their own membership"
on public.radio_admins for select to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.radio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  artist text not null default 'Artemius',
  genre text,
  audio_path text not null,
  cover_path text,
  duration_seconds integer,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists radio_tracks_public_order_idx
on public.radio_tracks (is_published, sort_order, created_at desc);
alter table public.radio_tracks enable row level security;
grant select on public.radio_tracks to anon, authenticated;
grant insert, update, delete on public.radio_tracks to authenticated;

create policy "Public can read published radio tracks"
on public.radio_tracks for select to anon
using (is_published = true);

create policy "Admins can read all radio tracks"
on public.radio_tracks for select to authenticated
using (is_published = true or exists (
  select 1 from public.radio_admins a where a.user_id = (select auth.uid())
));
create policy "Radio admins can add tracks"
on public.radio_tracks for insert to authenticated
with check (exists (select 1 from public.radio_admins a where a.user_id = (select auth.uid())) and uploaded_by = (select auth.uid()));
create policy "Radio admins can update tracks"
on public.radio_tracks for update to authenticated
using (exists (select 1 from public.radio_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.radio_admins a where a.user_id = (select auth.uid())));
create policy "Radio admins can delete tracks"
on public.radio_tracks for delete to authenticated
using (exists (select 1 from public.radio_admins a where a.user_id = (select auth.uid())));

-- Public read is intentional for published music. Writes remain restricted to radio admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radio-audio', 'radio-audio', true, 52428800, array['audio/mpeg'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radio-covers', 'radio-covers', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Public can listen to radio audio"
on storage.objects for select to anon, authenticated
using (bucket_id = 'radio-audio');
create policy "Public can view radio covers"
on storage.objects for select to anon, authenticated
using (bucket_id = 'radio-covers');
create policy "Radio admins can upload audio"
on storage.objects for insert to authenticated
with check (bucket_id in ('radio-audio','radio-covers') and exists (select 1 from public.radio_admins a where a.user_id = (select auth.uid())) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Radio admins can delete their uploaded files"
on storage.objects for delete to authenticated
using (bucket_id in ('radio-audio','radio-covers') and exists (select 1 from public.radio_admins a where a.user_id = (select auth.uid())) and (storage.foldername(name))[1] = (select auth.uid())::text);

-- After running the SQL and creating your admin account, add your auth user UUID:
-- insert into public.radio_admins (user_id) values ('YOUR_AUTH_USER_UUID');
-- IMPORTANT: create the account in Supabase Auth first; only then run that insert.
