/** Game data: enemies, waves, cards, synergies, classes */

// ── Enemies ───────────────────────────────────────────────────────────────
export const ENEMIES = {
  // Stats per GDD: HP/spd/dmg/xp aligned to design doc
  email:    { r: 13, hp: 10,   spd: 90,  dmg: 5,  xp: 1, kb: 1,    color: '#9FB4FF', bug: false, charge: false, boss: false },
  notif:    { r: 11, hp: 6,    spd: 160, dmg: 3,  xp: 1, kb: 1.2,  color: '#FFD447', bug: false, charge: false, boss: false },
  meeting:  { r: 22, hp: 68,   spd: 70,  dmg: 8,  xp: 3, kb: 0.45, color: '#E8E4F2', bug: false, charge: false, boss: false },
  bug:      { r: 15, hp: 25,   spd: 110, dmg: 6,  xp: 2, kb: 0.8,  color: '#7FD66B', bug: true,  charge: false, boss: false },
  customer: { r: 18, hp: 120,  spd: 68,  dmg: 18, xp: 6, kb: 0.6,  color: '#FF7A45', bug: false, charge: true,  boss: false },
  elite: { r: 26, hp: 400, spd: 72, dmg: 10, xp: 25, kb: 0.2, color: '#CE93D8', bug: false, charge: false, boss: false },
  boss:     { r: 46, hp: 6000, spd: 46,  dmg: 24, xp: 0, kb: 0.04, color: '#FF4D6D', bug: false, charge: false, boss: true  },
};

// GDD: HP +8% per 10 game minutes = per 75 real seconds
export function scaledHp(base, elapsed) {
  return Math.round(base * Math.pow(1.08, Math.floor(elapsed / 75)));
}

// ── Waves (1 real second = 1 game minute) ────────────────────────────────
export const WAVES = [
  { t: 0,   name: 'Khởi động',         sub: '08:00 · Email thứ Hai sáng — gem dày để lên cấp nhanh', rate: 0.7,  mix: { email: 7, notif: 3 } },
  { t: 150, name: 'Hộp thư đầy',       sub: '08:20 · Email theo đàn — Elite đầu tiên xuất hiện',      rate: 1.3,  mix: { email: 5, notif: 3, bug: 1 } },
  { t: 300, name: 'Họp liên miên',      sub: '08:40 · Họp, bug và lời mời kéo nhau tới',               rate: 1.8,  mix: { email: 3, notif: 2, meeting: 3, bug: 3 } },
  { t: 600, name: 'Khách nổi giận',    sub: '09:20 · Coi chừng cú lao thẳng!',                         rate: 2.6,  mix: { email: 2, meeting: 2, bug: 3, customer: 4 } },
  { t: 900, name: 'Deadline',           sub: '10:00 · Boss Deadline xuất hiện!',                         rate: 1.2,  mix: { email: 3, notif: 3, bug: 2 }, boss: true },
];

// ── Cards ─────────────────────────────────────────────────────────────────
const dv = (base, lv) => Math.round(base * (1 + 0.25 * (lv - 1)));

export const CARDS = [
  {
    // GDD name: Syntax Shot (starting weapon)
    id: 'stapler', icon: '⌨️', name: 'Syntax Shot',
    type: 'weapon', rarity: 'common', tags: ['developer', 'speed'],
    cd: l => 0.8 - l * 0.07,
    desc: l => `Tự bắn ${l >= 5 ? 2 : 1} ký tự code ({} ; </> =>) vào địch gần nhất, ${dv(12, l)} sát thương.${l >= 5 ? ' Xuyên 2.' : ''}`,
  },
  {
    // GDD name: Git Push (pierce beam in facing direction)
    id: 'plane', icon: '📤', name: 'Git Push',
    type: 'weapon', rarity: 'common', tags: ['developer', 'pierce'],
    cd: l => 1.15 - l * 0.05,
    desc: l => `Bắn luồng code theo hướng chạy, xuyên ${2 + l} địch, ${dv(18, l)} sát thương.`,
  },
  {
    id: 'coffee', icon: '💣', name: 'Bom Cà Phê',
    type: 'weapon', rarity: 'rare', tags: ['coffee', 'aoe', 'fire'],
    cd: l => 2.3 - l * 0.1,
    desc: l => `Ném ly cà phê nổ bán kính ${70 + 10 * l}, ${dv(28, l)} sát thương, để lại vũng bỏng.${l >= 4 ? ' Ném 2 ly.' : ''}`,
  },
  {
    // GDD name: Bàn phím cơ (AOE cone in facing direction)
    id: 'keyboard', icon: '⌨️', name: 'Bàn Phím Cơ',
    type: 'weapon', rarity: 'common', tags: ['developer', 'aoe'],
    cd: l => 2.9 - l * 0.12,
    desc: l => `Sóng âm bán kính ${100 + 15 * l}, ${dv(22, l)} sát thương, đẩy lùi và xoá đạn địch.`,
  },
  {
    // GDD name: Rubber Duck (orbit weapon)
    id: 'mouse', icon: '🦆', name: 'Rubber Duck',
    type: 'weapon', rarity: 'rare', tags: ['developer', 'orbit'],
    cd: null,
    desc: l => `${l >= 5 ? 4 : l >= 3 ? 3 : 2} vịt gỗ bay quanh người, ${dv(10, l)} sát thương/chạm. Debug Mode x3 trên BUG.`,
  },
  {
    id: 'hotfix', icon: '🩹', name: 'Hotfix Lúc 2 Giờ Sáng',
    type: 'weapon', rarity: 'epic', tags: ['developer', 'zap'],
    cd: l => 2.3 - l * 0.1,
    desc: l => `Tia sét nhảy qua ${3 + l} địch, ${dv(24, l)} sát thương, gấp đôi lên BUG.`,
  },
  {
    id: 'terminal',
    icon: '🖥️', name: 'Terminal Lệnh',
    type: 'weapon', rarity: 'rare', tags: ['developer', 'aoe'],
    cd: l => 2.6 - l * 0.1,
    desc: l => `Sau 0.6s, phóng ${4 + l} lệnh code ra mọi hướng, ${Math.round(14 * (1 + 0.25 * (l-1)))} sát thương mỗi lệnh.`,
  },
  {
    id: 'rubber_duck',
    icon: '🦆', name: 'Debug Vịt Gỗ',
    type: 'passive', rarity: 'rare', tags: ['developer', 'crit'],
    stat: (s, l) => { s.crit += 0.07 * l; s.atkSpd += 0.06 * l; },
    desc: l => `Chí mạng +${7*l}%, tốc đánh +${6*l}%. (Vịt không phán xét.)`,
  },
  {
    id: 'deploy',
    icon: '🚀', name: 'Deploy Production',
    type: 'weapon', rarity: 'epic', tags: ['developer', 'aoe', 'fire'],
    cd: l => 3.5 - l * 0.15,
    desc: l => `Phóng ${l >= 3 ? 2 : 1} tên lửa vào nhóm địch đông nhất, ${Math.round(45 * (1 + 0.25 * (l-1)))} sát thương, gây bỏng.`,
  },
  {
    id: 'espresso', icon: '☕', name: 'Espresso Double Shot',
    type: 'passive', rarity: 'common', tags: ['coffee', 'speed'],
    stat: (s, l) => { s.atkSpd += 0.14 * l; },
    desc: l => `Tốc đánh +${14 * l}%.`,
  },
  {
    id: 'shoes', icon: '👟', name: 'Giày Chạy Deadline',
    type: 'passive', rarity: 'common', tags: ['speed'],
    stat: (s, l) => { s.moveMul += 0.1 * l; },
    desc: l => `Tốc chạy +${10 * l}%.`,
  },
  {
    id: 'breath', icon: '🌿', name: 'Hít Thở Sâu',
    type: 'passive', rarity: 'common', tags: ['calm'],
    stat: (s, l) => { s.maxHp += 20 * l; },
    desc: l => `Máu tối đa +${20 * l}, hồi 20 máu ngay.`,
  },
  {
    id: 'magnet', icon: '🧲', name: 'Nam Châm Lương',
    type: 'passive', rarity: 'common', tags: ['office'],
    stat: (s, l) => { s.pickup += 35 * l; },
    desc: l => `Hút EXP từ xa hơn (+${35 * l}).`,
  },
  {
    id: 'glasses', icon: '👓', name: 'Kính Soi Lỗi',
    type: 'passive', rarity: 'rare', tags: ['crit', 'developer'],
    stat: (s, l) => { s.crit += 0.07 * l; },
    desc: l => `Tỉ lệ chí mạng +${7 * l}%.`,
  },
  {
    id: 'angry', icon: '😤', name: 'Nổi Nóng Có Kiểm Soát',
    type: 'passive', rarity: 'rare', tags: ['rage'],
    stat: (s, l) => { s.dmgMul += 0.12 * l; s.stressGain += 0.15 * l; },
    desc: l => `Sát thương +${12 * l}%, Stress tăng nhanh hơn.`,
  },
  {
    id: 'headphones', icon: '🎧', name: 'Tai Nghe Chống Ồn',
    type: 'passive', rarity: 'rare', tags: ['calm'],
    stat: (s, l) => { s.dr += 0.07 * l; s.stressGain -= 0.1 * l; },
    desc: l => `Giảm ${7 * l}% sát thương nhận, Stress tăng chậm hơn.`,
  },
  {
    id: 'burnout', icon: '🔥', name: 'Cháy Hết Mình',
    type: 'passive', rarity: 'epic', tags: ['fire', 'rage'],
    stat: (s, l) => { s.burnAll += 7 * l; },
    desc: l => `Mọi đòn gây bỏng ${7 * l}/giây.`,
  },
  {
    id: 'overtime', icon: '🌙', name: 'OT Không Lương',
    type: 'passive', rarity: 'epic', tags: ['rage', 'speed'],
    stat: (s, l) => { s.atkSpd += 0.12 * l; s.dmgMul += 0.1 * l; s.maxHp -= 10 * l; },
    desc: l => `Tốc đánh +${12 * l}%, sát thương +${10 * l}%, máu tối đa −${10 * l}.`,
  },
  {
    id: 'unit_test', icon: '🧪', name: 'Unit Test',
    type: 'passive', rarity: 'rare', tags: ['developer', 'defense'],
    stat: (s, l) => { s.shieldInterval = Math.max(8, 20 - l * 2); },
    desc: l => `Khiên chặn 1 đòn mỗi ${20 - l * 2}s. Dùng để tiến hóa Git Push → Force Push.`,
  },
  {
    id: 'second_monitor', icon: '🖥️', name: 'Màn hình thứ hai',
    type: 'passive', rarity: 'rare', tags: ['developer'],
    stat: (s, l) => { s.pickup += 20 * l; s.aoeBonus = (s.aoeBonus || 0) + 0.1 * l; },
    desc: l => `Hút gem xa hơn (+${20*l}px), AoE/Tầm +${10*l}%. Dùng tiến hóa Rubber Duck.`,
  },
  {
    id: 'stack_overflow', icon: '📚', name: 'Stack Overflow',
    type: 'weapon', rarity: 'rare', tags: ['developer', 'aoe'],
    cd: l => 3.2 - l * 0.2,
    desc: l => `Thả ${l >= 4 ? 2 : 1} chồng sách vào nhóm địch đông nhất sau 0.4s, ${Math.round(30 * (1 + 0.25*(l-1)))} sát thương AoE ${80 + 10*l}px.`,
  },
  {
    id: 'console_log', icon: '🔍', name: 'Console.log',
    type: 'weapon', rarity: 'rare', tags: ['developer', 'debuff'],
    cd: l => 2.8 - l * 0.1,
    desc: l => `Đánh dấu ${1 + Math.floor(l/2)} địch gần nhất — chúng nhận thêm +${20 + l*4}% sát thương trong 4s.`,
  },
  {
    id: 'cron_job', icon: '⏱️', name: 'Cron Job',
    type: 'weapon', rarity: 'epic', tags: ['developer', 'aoe'],
    cd: l => 10 - l * 0.8,
    desc: l => `Mỗi ${(10 - l*0.8).toFixed(1)}s: đánh TẤT CẢ địch trong màn, ${Math.round(15 * (1 + 0.25*(l-1)))} sát thương.`,
  },
  {
    id: 'ctrl_c', icon: '📋', name: 'Ctrl+C / Ctrl+V',
    type: 'passive', rarity: 'rare', tags: ['developer', 'pierce'],
    stat: (s, l) => { s.extraProj += (l >= 2 ? 1 : 0) + (l >= 4 ? 1 : 0); s.pierce = (s.pierce || 0) + l; },
    desc: l => `+${l >= 4 ? 2 : l >= 2 ? 1 : 0} đạn phụ, xuyên +${l}. Dùng để tiến hóa Stack Overflow.`,
  },
  {
    id: 'standup', icon: '🕐', name: 'Stand-up 15 phút',
    type: 'passive', rarity: 'rare', tags: ['developer', 'heal'],
    stat: (s, l) => { s.regen += 0.3 * l; },
    desc: l => `Hồi máu +${(0.3*l).toFixed(1)}/s, gây stun 0.5s cho địch gần nhất mỗi 60s. Dùng để tiến hóa Cron Job.`,
  },
  // ── Evolved weapons (result of evolution — NOT in offer pool) ────────
  {
    id: 'code_2am', icon: '🌙', name: 'Code lúc 2h Sáng',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'speed'],
    cd: () => 0.22,
    desc: () => '3 tia code liên tục, 30 sát thương mỗi tia; Stress +1 mỗi 3 giây.',
  },
  {
    id: 'deep_work', icon: '🧘', name: 'Deep Work',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'aoe'],
    cd: () => 0.5,
    desc: () => 'Đứng yên → sóng 360°, 60 sát thương mỗi 0.5s, miễn đẩy lùi.',
  },
  {
    id: 'deploy_friday', icon: '🔥', name: 'Deploy Ngày Thứ Sáu',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'aoe', 'fire'],
    cd: () => 2.5,
    desc: () => 'Nổ AoE 250px, 120 sát thương. 15% tự gây 10 sát thương.',
  },
  {
    id: 'force_push', icon: '⚡', name: 'Force Push',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'pierce'],
    cd: () => 1.0,
    desc: () => 'Luồng code siêu rộng xuyên vô hạn, hủy đạn địch trên đường đi.',
  },
  {
    id: 'rubber_debug', icon: '🦆', name: 'Rubber Duck Debugging',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'orbit'],
    cd: null,
    desc: () => '6 vịt bay quanh người; Trúng BUG: x3 sát thương (cộng dồn Debug Mode).',
  },
  {
    id: 'stack_paste', icon: '📋', name: 'Copy-Paste from Stack Overflow',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'aoe'],
    cd: () => 2.5,
    desc: () => '2 chồng sách rơi cùng lúc vào 2 nhóm địch đông nhất, mỗi chồng AoE 130px, 80 sát thương.',
  },
  {
    id: 'breakpoint', icon: '🔴', name: 'Breakpoint',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'debuff'],
    cd: () => 2.0,
    desc: () => 'Đánh dấu 4 địch gần nhất (+40% dmg 6s). Địch đang bị đánh dấu có <20% HP → chết ngay.',
  },
  {
    id: 'cicd_pipeline', icon: '🔄', name: 'CI/CD Pipeline',
    type: 'weapon', rarity: 'evolved', tags: ['developer', 'aoe'],
    cd: () => 7.0,
    desc: () => 'Đánh TẤT CẢ địch trong màn, 50 sát thương. Mỗi kill hồi 1 HP.',
  },
];
export const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));

// ── Weapon evolutions (weapon lv5 + passive → evolved weapon) ────────────
export const EVOLUTIONS = [
  { weapon: 'stapler',  passive: 'espresso',       result: 'code_2am',      name: 'Code lúc 2h Sáng',        desc: '3 tia liên tục · Stress +1/3s' },
  { weapon: 'keyboard', passive: 'headphones',      result: 'deep_work',     name: 'Deep Work',                desc: 'Đứng yên → sóng 360° liên tục' },
  { weapon: 'hotfix',   passive: 'shoes',           result: 'deploy_friday', name: 'Deploy Ngày Thứ Sáu',      desc: 'AoE 250px · 15% tự gây dmg' },
  { weapon: 'plane',    passive: 'unit_test',       result: 'force_push',    name: 'Force Push',               desc: 'Luồng siêu rộng · hủy đạn địch' },
  { weapon: 'mouse',    passive: 'second_monitor',  result: 'rubber_debug',  name: 'Rubber Duck Debugging',    desc: '6 vịt · x3 sát thương lên BUG' },
  { weapon: 'stack_overflow', passive: 'ctrl_c',    result: 'stack_paste',   name: 'Copy-Paste from Stack Overflow', desc: '2 bom sách · 2 vị trí đồng thời' },
  { weapon: 'console_log',   passive: 'glasses',   result: 'breakpoint',    name: 'Breakpoint',                    desc: 'Đánh dấu + instant-kill <20% HP' },
  { weapon: 'cron_job',      passive: 'standup',   result: 'cicd_pipeline', name: 'CI/CD Pipeline',                desc: 'Đánh toàn màn + +1HP mỗi kill' },
];

// ── Synergies ─────────────────────────────────────────────────────────────
export const SYNERGIES = [
  { id: 'rage_coffee', name: 'RAGE COFFEE',    need: { coffee: 2, rage: 1, speed: 1 }, desc: 'Tốc đánh +50%',                        apply: s => { s.atkSpd += 0.5; } },
  { id: 'fullstack',   name: 'FULL-STACK',     need: { developer: 2 },                 desc: 'Chí mạng +15%, sát thương lên BUG +50%', apply: s => { s.crit += 0.15; s.bugMul += 0.5; } },
  { id: 'burn',        name: 'CHÁY DEADLINE',  need: { fire: 2 },                      desc: 'Sát thương bỏng x2',                    apply: s => { s.burnMul *= 2; } },
  { id: 'zen',         name: 'ZEN OFFICE',     need: { calm: 2 },                      desc: 'Hồi 2 máu mỗi giây',                    apply: s => { s.regen += 2; } },
  { id: 'supply',      name: 'VĂN PHÒNG PHẨM', need: { office: 3 },                   desc: 'Mọi vũ khí bắn thêm 1 viên',            apply: s => { s.extraProj += 1; } },
  { id: 'dev_stack', name: 'DEV STACK', need: { developer: 3 }, desc: 'Sát thương +30%, CD vũ khí developer -20%', apply: s => { s.dmgMul += 0.3; s.atkSpd += 0.2; } },
];
export const SYN = Object.fromEntries(SYNERGIES.map(s => [s.id, s]));

// ── Classes ────────────────────────────────────────────────────────────────
export const CLASSES = {
  developer: {
    name: 'Developer', line: 'Sống bằng cà phê và Stack Overflow.',
    start: 'stapler', bias: 'developer',
    passive: 'Debug Mode', pdesc: '+30% sát thương lên địch BUG. Rubber Duck gây x3 lên BUG.',
    tap: 'Tap trúng địch: 8 sát thương + cộng 1 ô COMPILE (20 ô). Đủ 20 ô → COMPILE: bắn 16 ký tự tỏa tròn, 20 sát thương + đẩy lùi 60px. Ở Overload (90%+): 10% Build failed!',
    lore: 'Một developer full-stack thứ thiệt. Uống cà phê thay nước, ngủ cùng bug, và tự hào về commit "fix typo" lúc 3 giờ sáng.',
    weapons: ['stapler', 'mouse', 'hotfix', 'terminal', 'deploy', 'keyboard', 'plane', 'stack_overflow', 'console_log', 'cron_job'],
    passives: ['rubber_duck', 'glasses', 'espresso'],
    soon: false,
  },
  // ── Sắp ra — đang phát triển ───────────────────────────────────────────
  manager: {
    name: 'Manager', line: 'Một con dấu, trăm việc xong.',
    passive: 'Phê Duyệt', pdesc: 'Địch mang dấu nhận +15% sát thương.',
    lore: 'Unlock: Thắng 3 ván liên tiếp.',
    soon: true,
  },
  designer: {
    name: 'Designer', line: 'Dời logo sang trái 1px nữa thôi.',
    lore: 'Unlock: Đạt combo × 30 trong 1 ván.',
    soon: true,
  },
  sales: {
    name: 'Sales', line: 'Chốt đơn cả trong mơ.',
    lore: 'Unlock: Tích lũy 2000 vàng.',
    soon: true,
  },
  chef: {
    name: 'Chef', line: 'Nóng hơn cả bếp là deadline.',
    lore: 'Unlock: Giết 500 địch tổng cộng.',
    soon: true,
  },
  driver: {
    name: 'Driver', line: 'Còi to hơn mọi cuộc gọi.',
    lore: 'Unlock: Né thành công 300 lần.',
    soon: true,
  },
};

// GDD XP formula: 5+4*(l-1) to level 20, then +8 per level after
export const nextXp = l => l <= 20 ? (5 + 4 * (l - 1)) : (81 + 8 * (l - 20));

// ── Card rarity weights ──────────────────────────────────────────────────
export const RARITY_WEIGHT = { common: 6, rare: 3.2, epic: 1.6 };

// ── Death puns ───────────────────────────────────────────────────────────
export const PUNS = {
  email:    ['Đã xem', 'Seen', 'Chuyển tiếp', 'Spam!'],
  notif:    ['Tắt thông báo', 'Im!', 'Mute'],
  meeting:  ['Họp xong!', 'Lẽ ra là email', 'Hủy họp'],
  bug:      ['Fixed', 'Không tái hiện được', 'Works on my machine'],
  customer: ['Đã xử lý', 'Ticket đóng', 'Hoàn tiền'],
};
