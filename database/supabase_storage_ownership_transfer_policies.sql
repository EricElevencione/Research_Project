-- Supabase Storage policies for ownership transfer proof uploads
-- Run this in Supabase SQL Editor.
--
-- This project currently uploads proofs directly from frontend without Supabase Auth session.
-- So policies include BOTH anon + authenticated roles.

-- 1) Ensure bucket exists with sane image limits
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ownership-transfer-proofs',
  'ownership-transfer-proofs',
  false,
  10485760,
  array['image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Drop old policies with the same names (safe re-run)
drop policy if exists "ownership transfer proofs insert" on storage.objects;
drop policy if exists "ownership transfer proofs read" on storage.objects;
drop policy if exists "ownership transfer proofs delete" on storage.objects;

-- 3) Allow upload into this bucket
create policy "ownership transfer proofs insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'ownership-transfer-proofs');

-- 4) Allow reading files in this bucket (needed for previews/access)
create policy "ownership transfer proofs read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'ownership-transfer-proofs');

-- 5) Allow cleanup/delete from this bucket
create policy "ownership transfer proofs delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'ownership-transfer-proofs');
