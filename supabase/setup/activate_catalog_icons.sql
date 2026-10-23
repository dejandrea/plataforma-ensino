-- Targeted activation for installations that have not received the full package.
-- Idempotent; does not install XP, Auth triggers, recurrence or Cron changes.
begin;
alter table public.technologies add column if not exists icon text not null default '💻';
alter table public.missions add column if not exists icon text not null default '🎯';
-- The editor saves these fields together with the icon.
grant update(name,bronze_title,silver_title,gold_title,icon) on public.technologies to authenticated;
grant update(title,description,icon) on public.achievement_definitions to authenticated;
drop policy if exists catalog_icon_achievement_admin on public.achievement_definitions;
create policy catalog_icon_achievement_admin on public.achievement_definitions for update to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
drop policy if exists catalog_icon_technology_admin on public.technologies;
create policy catalog_icon_technology_admin on public.technologies for update to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-icons','catalog-icons',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists catalog_icon_setup_upload on storage.objects;
create policy catalog_icon_setup_upload on storage.objects for insert to authenticated with check(
 bucket_id='catalog-icons' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
drop policy if exists catalog_icon_setup_read on storage.objects;
create policy catalog_icon_setup_read on storage.objects for select to anon,authenticated using(bucket_id='catalog-icons');
notify pgrst,'reload schema';
commit;
