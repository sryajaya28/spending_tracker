-- Per-user display preferences, so language and light/dark mode follow the account across devices.
alter table public.profiles
  add column language text,
  add column theme text,
  add constraint profiles_theme_chk check (theme is null or theme in ('system', 'light', 'dark')),
  add constraint profiles_language_chk check (language is null or length(language) between 2 and 10);
