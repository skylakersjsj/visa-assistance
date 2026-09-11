-- Prepared schema for a future authenticated Supabase integration.
-- The current local demo does not connect to these tables.
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  visa_type text not null check (visa_type = 'O1B'),
  occupation text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id),
  criterion text not null check (criterion in ('Critical Role','Media Coverage','Key Position','Commercial Success','Recommendation Letters','High Salary')),
  image_path text not null,
  file_name text not null,
  description text not null,
  context text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.applicants enable row level security;
alter table public.evidence enable row level security;
create policy "Applicants belong to signed-in owner" on public.applicants
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Evidence belongs to applicant owner" on public.evidence
  for all to authenticated using (exists (select 1 from public.applicants a where a.id = applicant_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.applicants a where a.id = applicant_id and a.owner_id = auth.uid()));
-- Store images in a private Storage bucket; image_path is the object key.
-- Add bucket policies scoped to the authenticated applicant owner before connecting.
