-- Finance Tracker Schema

-- Accounts (credit cards, debit accounts)
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('credit', 'debit')),
  last_four text,
  color text default '#6366f1',
  created_at timestamptz default now()
);

-- Transactions extracted from screenshots
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  date date not null,
  description text not null,
  merchant text,
  amount numeric(10,2) not null, -- positive = expense, negative = credit/payment
  category text,
  is_income boolean default false,
  statement_upload_id uuid,
  created_at timestamptz default now()
);

-- Statement uploads (for reference / re-processing)
create table if not exists statement_uploads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  month int not null,
  year int not null,
  image_url text,
  created_at timestamptz default now()
);

-- AI recommendations
create table if not exists ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  month int not null,
  year int not null,
  income numeric(10,2),
  total_expenses numeric(10,2),
  content text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists transactions_account_id_idx on transactions(account_id);
create index if not exists transactions_date_idx on transactions(date);
create index if not exists transactions_statement_upload_id_idx on transactions(statement_upload_id);

-- Storage bucket for statement screenshots
insert into storage.buckets (id, name, public) values ('statements', 'statements', false) on conflict do nothing;
