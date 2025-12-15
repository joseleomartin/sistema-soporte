-- Crear tabla para Novedades Profesionales
create table if not exists public.professional_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  image_url text,
  tags text[] default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.professional_news is 'Links y recursos externos de interés profesional (impuestos, contabilidad, etc.)';

-- Permisos básicos RLS
alter table public.professional_news enable row level security;

-- Todos los usuarios autenticados pueden ver las novedades
create policy "Users can view professional news"
  on public.professional_news
  for select
  using (auth.role() = 'authenticated');

-- Solo administradores pueden insertar/gestionar novedades
create policy "Only admins can insert professional news"
  on public.professional_news
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create policy "Only admins can update professional news"
  on public.professional_news
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create policy "Only admins can delete professional news"
  on public.professional_news
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );


