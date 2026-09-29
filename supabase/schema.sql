-- ============================================================
-- Stress Survivor — Supabase Schema
-- Chạy toàn bộ file này trong Supabase > SQL Editor
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Table: players ──────────────────────────────────────
-- Mỗi player có một anon_id sinh từ client (UUID v4), lưu localStorage.
-- Không cần auth thật ở MVP; chỉ cần anon_id để định danh.
create table if not exists players (
  id           uuid primary key default gen_random_uuid(),
  anon_id      text unique not null,          -- UUID v4 từ localStorage
  display_name text not null default 'Nhân viên ẩn danh',
  public_id    text unique not null,           -- STRESS-XXXXXX hiển thị
  class        text not null default 'developer',
  level        int  not null default 1,
  total_wins   int  not null default 0,
  total_kills  int  not null default 0,
  total_taps   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Table: scores ────────────────────────────────────────
-- Mỗi trận thắng ghi 1 record
create table if not exists scores (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  anon_id      text not null,
  display_name text not null,
  class        text not null,
  score        int  not null default 0,        -- kills × 10 + dmg ÷ 100 + combo × 5
  kills        int  not null default 0,
  max_combo    int  not null default 0,
  taps         int  not null default 0,
  dmg_dealt    int  not null default 0,
  duration_s   int  not null default 0,        -- giây
  player_lvl   int  not null default 1,
  cards        jsonb,                           -- { cardId: level }
  syn_active   text[],                          -- ['rage_coffee', ...]
  won          boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ─── Table: daily_scores ──────────────────────────────────
-- View-like: best score per player per day (dùng cho daily leaderboard)
-- Cập nhật bằng trigger
create table if not exists daily_best (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  anon_id      text not null,
  display_name text not null,
  class        text not null,
  score        int  not null default 0,
  max_combo    int  not null default 0,
  kills        int  not null default 0,
  date         date not null default current_date,
  unique(player_id, date)
);

-- ─── Table: player_bests ──────────────────────────────────
-- All-time best per player per metric (upserted on each game end)
create table if not exists player_bests (
  player_id    uuid primary key references players(id) on delete cascade,
  anon_id      text not null,
  display_name text not null,
  class        text not null,
  best_score   int  not null default 0,
  best_combo   int  not null default 0,
  best_kills   int  not null default 0,
  updated_at   timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────
create index if not exists scores_player_id_idx   on scores(player_id);
create index if not exists scores_score_idx       on scores(score desc);
create index if not exists scores_combo_idx       on scores(max_combo desc);
create index if not exists scores_kills_idx       on scores(kills desc);
create index if not exists scores_created_at_idx  on scores(created_at desc);
create index if not exists daily_best_date_score  on daily_best(date, score desc);
create index if not exists player_bests_score_idx on player_bests(best_score desc);
create index if not exists player_bests_combo_idx on player_bests(best_combo desc);

-- ─── Function: generate_public_id ────────────────────────
-- Tạo STRESS-XXXXXX (6 ký tự hex ngẫu nhiên)
create or replace function generate_public_id()
returns text language plpgsql as $$
declare
  v_id text;
  v_exists boolean;
begin
  loop
    v_id := 'STRESS-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
    select exists(select 1 from players where public_id = v_id) into v_exists;
    exit when not v_exists;
  end loop;
  return v_id;
end;
$$;

-- ─── Trigger: auto-set public_id before insert ───────────
create or replace function set_public_id()
returns trigger language plpgsql as $$
begin
  if new.public_id is null or new.public_id = '' then
    new.public_id := generate_public_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_public_id on players;
create trigger trg_set_public_id
  before insert on players
  for each row execute function set_public_id();

-- ─── Trigger: upsert daily_best after score insert ───────
create or replace function upsert_daily_best()
returns trigger language plpgsql as $$
begin
  insert into daily_best (player_id, anon_id, display_name, class, score, max_combo, kills, date)
  values (new.player_id, new.anon_id, new.display_name, new.class, new.score, new.max_combo, new.kills, current_date)
  on conflict (player_id, date) do update
    set score        = greatest(daily_best.score, excluded.score),
        max_combo    = greatest(daily_best.max_combo, excluded.max_combo),
        kills        = greatest(daily_best.kills, excluded.kills),
        display_name = excluded.display_name,
        class        = excluded.class;
  return new;
end;
$$;

drop trigger if exists trg_upsert_daily on scores;
create trigger trg_upsert_daily
  after insert on scores
  for each row when (new.won = true)
  execute function upsert_daily_best();

-- ─── Trigger: upsert player_bests after score insert ─────
create or replace function upsert_player_bests()
returns trigger language plpgsql as $$
begin
  insert into player_bests (player_id, anon_id, display_name, class, best_score, best_combo, best_kills, updated_at)
  values (new.player_id, new.anon_id, new.display_name, new.class, new.score, new.max_combo, new.kills, now())
  on conflict (player_id) do update
    set best_score   = greatest(player_bests.best_score, excluded.best_score),
        best_combo   = greatest(player_bests.best_combo, excluded.best_combo),
        best_kills   = greatest(player_bests.best_kills, excluded.best_kills),
        display_name = excluded.display_name,
        class        = excluded.class,
        updated_at   = now();
  return new;
end;
$$;

drop trigger if exists trg_upsert_bests on scores;
create trigger trg_upsert_bests
  after insert on scores
  for each row
  execute function upsert_player_bests();

-- ─── Trigger: update players stats after score insert ────
create or replace function update_player_stats()
returns trigger language plpgsql as $$
begin
  update players set
    total_wins  = total_wins  + (case when new.won then 1 else 0 end),
    total_kills = total_kills + new.kills,
    total_taps  = total_taps  + new.taps,
    level       = greatest(level, new.player_lvl),
    class       = new.class,
    updated_at  = now()
  where id = new.player_id;
  return new;
end;
$$;

drop trigger if exists trg_update_player on scores;
create trigger trg_update_player
  after insert on scores
  for each row
  execute function update_player_stats();

-- ─── RLS: Row Level Security ──────────────────────────────
-- Players: ai cũng đọc được, chỉ owner (anon_id match) mới sửa được
alter table players enable row level security;
alter table scores enable row level security;
alter table daily_best enable row level security;
alter table player_bests enable row level security;

-- Đọc public (leaderboard)
create policy "public read players"     on players     for select using (true);
create policy "public read scores"      on scores      for select using (true);
create policy "public read daily_best"  on daily_best  for select using (true);
create policy "public read player_bests" on player_bests for select using (true);

-- Insert: anon user có thể tạo player với anon_id của mình
create policy "insert own player"  on players for insert with check (true);
create policy "insert own score"   on scores  for insert with check (true);

-- Update: chỉ update display_name của chính mình
create policy "update own player" on players for update
  using (anon_id = current_setting('request.headers', true)::json->>'x-anon-id');

-- ─── Sanity-check function ────────────────────────────────
-- Server-side check: kills/time không vượt ngưỡng vật lý
create or replace function validate_score(
  p_kills int, p_duration_s int, p_score int, p_max_combo int
) returns boolean language plpgsql as $$
declare
  max_kills_per_sec constant numeric := 2.5;  -- 170 enemy limit
  max_dps constant numeric := 50000;
begin
  -- Tối đa ~150 kills/phút với 170 enemy
  if p_kills > max_kills_per_sec * p_duration_s then return false; end if;
  -- Score không thể âm
  if p_score < 0 then return false; end if;
  -- Combo không vượt kills
  if p_max_combo > p_kills then return false; end if;
  return true;
end;
$$;
