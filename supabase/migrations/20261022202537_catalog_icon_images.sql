begin;
alter table public.technologies drop constraint technologies_icon_check;
alter table public.missions drop constraint missions_icon_check;
create function private.valid_catalog_icon(value text) returns boolean language sql immutable set search_path='' as $$
 select length(trim(value)) between 1 and 2048 and case when value ~* '^[a-z][a-z0-9+.-]*:' then value ~* '^https://[^[:space:]]+$' else length(value)<=128 end;
$$;
alter table public.technologies add constraint technologies_icon_check check(private.valid_catalog_icon(icon));
alter table public.missions add constraint missions_icon_check check(private.valid_catalog_icon(icon));
-- Existing artwork is retained; the constraint is enforced for future writes.
alter table public.achievement_definitions add constraint achievements_icon_format check(private.valid_catalog_icon(icon)) not valid;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-icons','catalog-icons',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy catalog_icons_admin_upload on storage.objects for insert to authenticated with check(
 bucket_id='catalog-icons' and private.learning_role()='admin' and (storage.foldername(name))[1]=auth.uid()::text);
create policy catalog_icons_public_read on storage.objects for select to anon,authenticated using(bucket_id='catalog-icons');
commit;
