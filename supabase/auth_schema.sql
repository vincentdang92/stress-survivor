-- ============================================================
-- Stress Survivor — Auth Integration
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- 1. Thêm auth_user_id và player_data vào players
ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_data jsonb NOT NULL DEFAULT '{}';

-- Index cho auth_user_id
CREATE INDEX IF NOT EXISTS players_auth_user_id_idx ON players(auth_user_id);

-- 2. Update RLS policies để dùng auth.uid()
-- Xóa policies cũ (dùng anon_id string)
DROP POLICY IF EXISTS "players_insert" ON players;
DROP POLICY IF EXISTS "players_select" ON players;
DROP POLICY IF EXISTS "players_update" ON players;

-- Ai cũng đọc được (public leaderboard)
CREATE POLICY "players_select" ON players
  FOR SELECT USING (true);

-- Chỉ insert khi đang auth (anon hoặc email)
CREATE POLICY "players_insert" ON players
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = auth_user_id
  );

-- Chỉ update player của mình
CREATE POLICY "players_update" ON players
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND auth.uid() = auth_user_id
  );

-- 3. Scores: chỉ insert khi auth
DROP POLICY IF EXISTS "scores_insert" ON scores;
CREATE POLICY "scores_insert" ON scores
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "scores_select" ON scores;
CREATE POLICY "scores_select" ON scores
  FOR SELECT USING (true);

-- 4. Function tạo player tự động khi user sign up (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Chỉ tạo player nếu chưa có (tránh duplicate khi upgrade anon → email)
  INSERT INTO public.players (auth_user_id, anon_id, display_name, class, public_id)
  VALUES (
    NEW.id,
    NEW.id::text, -- dùng auth UUID làm anon_id mặc định
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Nhân viên ẩn danh'),
    'developer',
    'STRESS-' || UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex'), 1, 6))
  )
  ON CONFLICT (anon_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn trigger vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Function sync player khi upgrade anon → email
-- (merge player_data, giữ lại gold/upgrades cao hơn)
CREATE OR REPLACE FUNCTION public.merge_player_data(
  p_auth_user_id uuid,
  p_new_data jsonb
)
RETURNS jsonb AS $$
DECLARE
  existing jsonb;
  merged jsonb;
BEGIN
  SELECT player_data INTO existing FROM players WHERE auth_user_id = p_auth_user_id;
  IF existing IS NULL THEN existing := '{}'; END IF;

  -- Merge: take max of numeric fields
  merged := jsonb_build_object(
    'gold',         GREATEST(COALESCE((existing->>'gold')::int, 0), COALESCE((p_new_data->>'gold')::int, 0)),
    'hp',           GREATEST(COALESCE((existing->>'hp')::int, 0),   COALESCE((p_new_data->>'hp')::int, 0)),
    'atk',          GREATEST(COALESCE((existing->>'atk')::int, 0),  COALESCE((p_new_data->>'atk')::int, 0)),
    'spd',          GREATEST(COALESCE((existing->>'spd')::int, 0),  COALESCE((p_new_data->>'spd')::int, 0)),
    'crit',         GREATEST(COALESCE((existing->>'crit')::int, 0), COALESCE((p_new_data->>'crit')::int, 0)),
    'stressResist', GREATEST(COALESCE((existing->>'stressResist')::int, 0), COALESCE((p_new_data->>'stressResist')::int, 0))
  );

  UPDATE players SET player_data = merged WHERE auth_user_id = p_auth_user_id;
  RETURN merged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
