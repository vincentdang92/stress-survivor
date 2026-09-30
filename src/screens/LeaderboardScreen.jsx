/** LeaderboardScreen.jsx — Bảng xếp hạng toàn cầu */
import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  fetchLeaderboard, fetchMyRank, LEADERBOARD_MODES,
  getAnonId, searchPlayerByPublicId, fetchPlayerHistory
} from '../supabase.js';

const CLASS_ICON = { developer: '💻', manager: '📋', designer: '🎨', sales: '💼', chef: '🍳', driver: '🚗' };
const CLASS_COLOR = { developer: '#2EC4B6', manager: '#7B5CFF', designer: '#FFD447', sales: '#2F4FA8', chef: '#FFFFFF', driver: '#FF8A3D' };

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function RankRow({ entry, rank }) {
  const rankLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank;
  return (
    <div class={`lb-row${entry.isMe ? ' lb-me' : ''}`}>
      <span class="lb-rank">{rankLabel}</span>
      <span class="lb-cls" title={entry.class} style={{ color: CLASS_COLOR[entry.class] || '#fff' }}>
        {CLASS_ICON[entry.class] || '👤'}
      </span>
      <span class="lb-name">
        {entry.displayName}
        {entry.isMe && <span class="lb-you">Bạn</span>}
      </span>
      <span class="lb-id">{entry.publicId}</span>
      <span class="lb-val">{entry.displayValue}</span>
    </div>
  );
}

function PlayerCard({ player, history }) {
  if (!player) return null;
  return (
    <div class="player-card">
      <div class="pc-head">
        <span class="pc-icon">{CLASS_ICON[player.class] || '👤'}</span>
        <div>
          <b>{player.display_name}</b>
          <span class="pc-id">{player.public_id}</span>
        </div>
      </div>
      <div class="pc-stats">
        <div class="pc-stat"><small>Class</small><b>{player.class}</b></div>
        <div class="pc-stat"><small>Level</small><b>{player.level}</b></div>
        <div class="pc-stat"><small>Thắng</small><b>{player.total_wins}</b></div>
        <div class="pc-stat"><small>Hạ địch</small><b>{(player.total_kills || 0).toLocaleString()}</b></div>
      </div>
      {history?.length > 0 && (
        <>
          <div class="pc-label">10 trận gần nhất</div>
          <div class="pc-history">
            {history.map((h, i) => (
              <div key={i} class={`ph-row${h.won ? ' won' : ' lose'}`}>
                <span>{h.won ? '✅' : '❌'}</span>
                <span>{h.class}</span>
                <span>{(h.score || 0).toLocaleString()}</span>
                <span>x{h.max_combo}</span>
                <span>{fmtTime(h.duration_s)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function LeaderboardScreen({ onClose }) {
  const [mode, setMode] = useState('score');
  const [rows, setRows] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchErr, setSearchErr] = useState('');
  const [tab, setTab] = useState('leaderboard'); // 'leaderboard' | 'profile'

  const myAnonId = getAnonId();

  const load = useCallback(async (m) => {
    setLoading(true); setRows([]);
    const { data, offline: off } = await fetchLeaderboard(m, 20, myAnonId);
    setRows(data || []); setOffline(!!off);
    const rank = await fetchMyRank(m, myAnonId);
    setMyRank(rank);
    setLoading(false);
  }, [myAnonId]);

  useEffect(() => { load(mode); }, [mode]);

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearchErr(''); setSearchResult(null);
    const q = search.trim().toUpperCase().startsWith('STRESS-') ? search.trim() : 'STRESS-' + search.trim().toUpperCase();
    const player = await searchPlayerByPublicId(q);
    if (!player) { setSearchErr('Không tìm thấy player với ID: ' + q); return; }
    const history = await fetchPlayerHistory(player.anon_id, 10);
    setSearchResult(player); setSearchHistory(history);
    setTab('profile');
  }, [search]);

  return (
    <div class="ov" style={{ zIndex: 180, alignItems: 'flex-start', paddingTop: 0, overflowY: 'auto' }}>
      <div class="lb-screen">
        {/* Header */}
        <div class="lb-header">
          <div>
            <div class="eyebrow">Stress Survivor</div>
            <h2 class="lb-title">🏆 Bảng xếp hạng</h2>
          </div>
          <button class="btn" onClick={onClose}>✕ Đóng</button>
        </div>

        {/* Tabs */}
        <div class="lb-tabs">
          <button class={`lb-tab${tab === 'leaderboard' ? ' active' : ''}`} onClick={() => setTab('leaderboard')}>Xếp hạng</button>
          <button class={`lb-tab${tab === 'profile' ? ' active' : ''}`} onClick={() => setTab('profile')}>Hồ sơ</button>
        </div>

        {tab === 'leaderboard' && (
          <>
            {/* Mode selector */}
            <div class="lb-modes">
              {LEADERBOARD_MODES.map(m => (
                <button key={m.id} class={`lb-mode-btn${mode === m.id ? ' active' : ''}`} onClick={() => setMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>

            {offline && <div class="lb-offline">⚠️ Offline — đang hiện dữ liệu mẫu</div>}

            {myRank && (
              <div class="lb-myrank">Xếp hạng của bạn: <b>#{myRank}</b></div>
            )}

            {/* Table */}
            <div class="lb-table">
              <div class="lb-thead">
                <span>#</span><span></span><span>Tên</span><span>ID</span><span>Điểm</span>
              </div>
              {loading && <div class="lb-loading">Đang tải...</div>}
              {!loading && rows.length === 0 && <div class="lb-loading">Chưa có dữ liệu</div>}
              {rows.map((row, i) => <RankRow key={i} entry={row} rank={row.rank} />)}
            </div>
          </>
        )}

        {tab === 'profile' && (
          <div class="lb-profile-tab">
            {/* Search */}
            <div class="lb-search">
              <input
                class="lb-input"
                placeholder="Nhập Player ID (STRESS-XXXXXX)"
                value={search}
                inputmode="text"
                autocorrect="off"
                autocapitalize="none"
                spellcheck={false}
                onInput={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button class="btn primary" onClick={handleSearch}>Tìm</button>
            </div>
            {searchErr && <div class="lb-err">{searchErr}</div>}
            {searchResult && <PlayerCard player={searchResult} history={searchHistory} />}
            {!searchResult && !searchErr && (
              <div class="lb-hint">
                Nhập <b>STRESS-XXXXXX</b> để tìm hồ sơ người chơi khác.
                <br />ID của bạn: <b>{getCachedPublicId()}</b>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getCachedPublicId() {
  try { return JSON.parse(localStorage.getItem('ss_player_v1'))?.public_id || '(chưa đồng bộ)'; } catch { return '—'; }
}
