-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique not null,
  email text,
  role text default 'user' check (role in ('admin', 'user'))
);

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  location text not null,
  task text not null,
  status text default 'Open' check (status in ('Open', 'In Progress', 'Completed')),
  comments jsonb default '[]'::jsonb
);

-- Blockers table
create table if not exists public.blockers (
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
  insert into public.profiles (id, username, email, role)
  values (new.id, new.raw_user_meta_data->>'username', new.email, coalesce(new.raw_user_meta_data->>'role', 'user'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Admin: Delete User RPC (Security Definer to bypass RLS and delete from auth.users)
create or replace function public.admin_delete_user(user_id uuid)
returns void as $$
begin
  -- Only allow if the calling user is an admin
  if (select role from public.profiles where id = auth.uid()) != 'admin' then
    raise exception 'Unauthorized';
  end if;
  
  -- Delete from auth.users (cascade deletes profile)
  delete from auth.users where id = user_id;
end;
$$ language plpgsql security definer;

-- Admin: Update User RPC
create or replace function public.admin_update_user(user_id uuid, new_username text, new_role text)
returns void as $$
begin
  if (select role from public.profiles where id = auth.uid()) != 'admin' then
    raise exception 'Unauthorized';
  end if;
  
  -- Update profile (Email updates must be done via Supabase API directly by the user)
  update public.profiles 
  set username = new_username, role = new_role 
  where id = user_id;
end;
$$ language plpgsql security definer;


