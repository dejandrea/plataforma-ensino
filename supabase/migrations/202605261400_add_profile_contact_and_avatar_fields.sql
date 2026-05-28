alter table public.profiles
  add column if not exists avatar_mode text not null default 'preset'
    check (avatar_mode in ('preset', 'photo')),
  add column if not exists avatar_preset text not null default 'avatar-1',
  add column if not exists secondary_email text,
  add column if not exists address text,
  add column if not exists zip_code text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists instagram_url text,
  add column if not exists whatsapp text,
  add column if not exists phone text;
