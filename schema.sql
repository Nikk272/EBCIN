-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique not null,
  role text default 'user' check (role in ('admin', 'user'))
);

-- Tasks table
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  location text not null,
  task text not null,
  status text default 'Open' check (status in ('Open', 'In Progress', 'Completed')),
  comments jsonb default '[]'::jsonb
);

-- Blockers table
create table public.blockers (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  location text not null,
  blocker_desc text not null,
  dependency_person text not null,
  status text default 'Open' check (status in ('Open', 'In Progress', 'Resolved')),
  comments jsonb default '[]'::jsonb
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.blockers enable row level security;

-- Policies for Profiles
-- Anyone can view profiles (needed for check-in dropdown)
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Policies for Tasks
-- Anyone can insert tasks (public check-in)
create policy "Tasks can be created by anyone" on public.tasks for insert with check (true);
-- Authenticated users can view tasks
create policy "Tasks are viewable by authenticated users" on public.tasks for select using (auth.role() = 'authenticated');
-- Authenticated users can update tasks
create policy "Tasks can be updated by authenticated users" on public.tasks for update using (auth.role() = 'authenticated');

-- Policies for Blockers
create policy "Blockers can be created by anyone" on public.blockers for insert with check (true);
create policy "Blockers are viewable by authenticated users" on public.blockers for select using (auth.role() = 'authenticated');
create policy "Blockers can be updated by authenticated users" on public.blockers for update using (auth.role() = 'authenticated');

-- Function to handle new user signup and insert into profiles
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, new.raw_user_meta_data->>'username', coalesce(new.raw_user_meta_data->>'role', 'user'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- INITIAL ADMIN USER SETUP
-- (Run this snippet to create the default admin user)
-- ==========================================

-- 1. Create the user in auth.users
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data
)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
  '00000000-0000-0000-0000-000000000000', 
  'authenticated', 
  'authenticated',
  'admin@dailycheckin.local', 
  crypt('password123', gen_salt('bf')), 
  now(), 
  '{"username":"admin","role":"admin"}'::jsonb
)
on conflict (id) do nothing;

-- 2. Create the matching identity for email/password sign-in
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- can match user id or be a new uuid
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- must match auth.users.id
  'admin@dailycheckin.local',             -- provider_id usually maps to email for email provider
  jsonb_build_object('sub', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'email', 'admin@dailycheckin.local'),
  'email',
  now(),
  now(),
  now()
)
on conflict do nothing;
