-- Bug reports and improvement suggestions sent from inside the app (top bar > support button).
-- One table with a clear `type` column ('bug' | 'feedback'); the sender's user id and email are filled in by the
-- database from the signed-in session (never trusted from the client). Screenshots go to a private storage bucket.
create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'feedback')),
  message text not null check (char_length(message) between 1 and 250),
  attachments text[] not null default '{}' check (cardinality(attachments) <= 5),   -- storage paths in the support-attachments bucket
  user_id uuid references auth.users (id) on delete set null,
  email text,
  context jsonb not null default '{}',                                               -- app language, screen, device info
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists support_reports_type_created_idx on public.support_reports (type, created_at desc);
create index if not exists support_reports_user_idx on public.support_reports (user_id);

-- who sent it: always the signed-in user, whatever the client says
create or replace function public.support_reports_set_sender() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.email := auth.jwt() ->> 'email';
  new.status := 'new';
  return new;
end $$;
drop trigger if exists support_reports_sender on public.support_reports;
create trigger support_reports_sender before insert on public.support_reports for each row execute function public.support_reports_set_sender();

alter table public.support_reports enable row level security;
revoke all on public.support_reports from anon, authenticated;
grant insert, select on public.support_reports to authenticated;
drop policy if exists support_reports_insert on public.support_reports;
create policy support_reports_insert on public.support_reports for insert to authenticated with check (auth.uid() is not null);
drop policy if exists support_reports_select_own on public.support_reports;
create policy support_reports_select_own on public.support_reports for select to authenticated using (user_id = auth.uid());

-- screenshots: private bucket, 1 MB per file, images only, each user can only write into and read from their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 1048576, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists support_attachments_insert on storage.objects;
create policy support_attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists support_attachments_select_own on storage.objects;
create policy support_attachments_select_own on storage.objects for select to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
