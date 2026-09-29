-- ============================================================
-- Stress Survivor — Schema bổ sung (chạy sau schema.sql)
-- Fix: Chỉ cần bảng scores + players, không cần player_bests view
-- ============================================================

-- 1. Đảm bảo bảng scores có RLS policy cho anon insert
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Policy: ai cũng INSERT được (anon player)
DROP POLICY IF EXISTS "scores_insert" ON scores;
CREATE POLICY "scores_insert" ON scores FOR INSERT WITH CHECK (true);

-- Policy: ai cũng SELECT được (public leaderboard)
DROP POLICY IF EXISTS "scores_select" ON scores;
CREATE POLICY "scores_select" ON scores FOR SELECT USING (true);

-- 2. Bảng players RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_insert" ON players;
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "players_select" ON players;
CREATE POLICY "players_select" ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS "players_update" ON players;
CREATE POLICY "players_update" ON players FOR UPDATE USING (true);

-- 3. Trigger cập nhật public_id tự động khi insert player
DROP FUNCTION IF EXISTS generate_public_id() CASCADE;
CREATE OR REPLACE FUNCTION generate_public_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_id IS NULL OR NEW.public_id = '' THEN
    NEW.public_id := 'STRESS-' || UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex'), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS players_public_id_trigger ON players;
CREATE TRIGGER players_public_id_trigger
  BEFORE INSERT ON players
  FOR EACH ROW EXECUTE FUNCTION generate_public_id();

-- 4. Trigger updated_at
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS players_updated_at ON players;
CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Seed dữ liệu mẫu để leaderboard không trống
-- (Xóa seed cũ nếu có, thêm mới)
DELETE FROM scores WHERE anon_id LIKE 'seed-%';
DELETE FROM players WHERE anon_id LIKE 'seed-%';

INSERT INTO players (anon_id, display_name, public_id, class, level, total_wins, total_kills)
VALUES
  ('seed-001', 'Nguyễn Dev Siêu Cấp', 'STRESS-A1B2C3', 'developer', 5, 12, 847),
  ('seed-002', 'Trần Manager Vĩ Đại', 'STRESS-D4E5F6', 'manager',   4, 8,  623),
  ('seed-003', 'Lê Sales Chốt Đơn',   'STRESS-G7H8I9', 'designer',  3, 5,  412),
  ('seed-004', 'Phạm Chef Pro Max',    'STRESS-J0K1L2', 'developer', 2, 3,  289),
  ('seed-005', 'Hoàng Driver Tốc Độ', 'STRESS-M3N4O5', 'manager',   2, 2,  198)
ON CONFLICT (anon_id) DO NOTHING;

INSERT INTO scores (player_id, anon_id, display_name, class, score, kills, max_combo, taps, dmg_dealt, duration_s, player_lvl, won, created_at)
SELECT p.id, p.anon_id, p.display_name, p.class,
  s.score, s.kills, s.max_combo, s.taps, s.dmg, s.dur, s.lvl, true, NOW() - (s.ago * interval '1 minute')
FROM players p
JOIN (VALUES
  ('seed-001', 8420, 312, 47, 890, 124800, 118, 6, 15),
  ('seed-002', 6830, 241, 38, 720, 95200,  98,  5, 32),
  ('seed-003', 5210, 185, 29, 560, 71400,  87,  4, 48),
  ('seed-004', 3890, 134, 22, 412, 52100,  74,  3, 65),
  ('seed-005', 2740, 98,  15, 290, 38600,  62,  2, 90)
) AS s(anon_id, score, kills, max_combo, taps, dmg, dur, lvl, ago)
ON p.anon_id = s.anon_id
WHERE NOT EXISTS (
  SELECT 1 FROM scores sc WHERE sc.anon_id = p.anon_id
);
