/** App.jsx — main Preact app with state machine + Supabase integration */
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { bus } from './bus.js';
import { PhaserGame, startBattle, stopBattle, pauseGame, resumeGame } from './game/PhaserGame.jsx';
import { HUD, Banner, MashOverlay } from './hud/HUD.jsx';
import { LevelUpOverlay } from './hud/LevelUpOverlay.jsx';
import { PauseOverlay } from './hud/PauseOverlay.jsx';
import { MenuScreen } from './screens/MenuScreen.jsx';
import { ResultScreen } from './screens/ResultScreen.jsx';
import { BookScreen } from './screens/BookScreen.jsx';
import { LeaderboardScreen } from './screens/LeaderboardScreen.jsx';
import { LoadingScreen } from './screens/LoadingScreen.jsx';
import { UpgradeScreen } from './screens/UpgradeScreen.jsx';
import { AuthModal } from './screens/AuthModal.jsx';
import { randomSeed } from './game/rng.js';
import { initAudio } from './game/audio/SFX.js';
import { getOrCreatePlayer, submitScore, initAuth, pullPlayerData } from './supabase.js';

export function App() {
  const [screen, setScreen] = useState('menu'); // menu | battle | book | leaderboard | upgrade
  const [battleConfig, setBattleConfig] = useState(null);
  const [player, setPlayer] = useState(null);
  const [phaserReady, setPhaserReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const phaserReadyRef = useRef(false);
  const pendingBattle = useRef(null);

  // ── GLOBAL INPUT FOCUS HANDLER ────────────────────────────────────────────
  // Pause Phaser + unlock touch/select whenever ANY input in the app has focus.
  // Covers: auth modal, name edit, leaderboard search — không cần biết screen nào.
  useEffect(() => {
    const onFocusIn = (e) => {
      if (e.target.matches('input, textarea, select, [contenteditable]')) {
        pauseGame();
        document.body.classList.add('auth-open');
      }
    };
    const onFocusOut = (e) => {
      if (e.target.matches('input, textarea, select, [contenteditable]')) {
        // Dùng requestAnimationFrame để check sau khi focus chuyển sang element mới
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (!active || !active.matches('input, textarea, select, [contenteditable]')) {
            resumeGame();
            document.body.classList.remove('auth-open');
          }
        });
      }
    };
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
    };
  }, []);

  // showAuth effect: vẫn giữ để pause Phaser khi modal mở (trước khi user tap input)
  useEffect(() => {
    if (showAuth) { pauseGame(); document.body.classList.add('auth-open'); }
    else if (!document.activeElement?.matches('input, textarea')) {
      resumeGame(); document.body.classList.remove('auth-open');
    }
  }, [showAuth]);

  // Init auth + player on mount
  useEffect(() => {
    initAuth().then(async ({ user }) => {
      if (user) await pullPlayerData();
      const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
      const name = p.displayName || 'Nhân viên ẩn danh';
      getOrCreatePlayer(name, p.owned?.[0] || 'developer').then(setPlayer);
    });
  }, []);

  const onPhaserReady = useCallback(() => {
    phaserReadyRef.current = true;
    setPhaserReady(true);
    if (pendingBattle.current) {
      const { cls, seed, trial } = pendingBattle.current;
      pendingBattle.current = null;
      startBattle(cls, seed, trial);
    }
  }, []);

  const goToBattle = useCallback((cls, trial = false) => {
    initAudio();
    const seed = randomSeed();
    setBattleConfig({ cls, seed, trial });
    setScreen('battle');
    if (phaserReadyRef.current) {
      startBattle(cls, seed, trial);
    } else {
      pendingBattle.current = { cls, seed, trial };
    }
  }, []);

  const goToMenu = useCallback(() => {
    bus.emit('RESUME');   // Unpause Phaser scene nếu đang pause
    stopBattle();         // Dừng scene
    setScreen('menu');
  }, []);

  // Bus listeners
  useEffect(() => {
    const offs = [
      bus.on('RESTART', () => {
        if (battleConfig) goToBattle(battleConfig.cls, battleConfig.trial);
      }),
      bus.on('QUIT_TO_MENU', () => {
        goToMenu();
      }),
      // Submit score to Supabase when battle ends
      bus.on('BATTLE_COMPLETED', async (data) => {
        if (data.trial) {
          setTimeout(() => setScreen('menu'), 600);
          return;
        }
        if (!data.won && !data.stats) return;

        // Submit score (fire & forget, doesn't block UI)
        submitScore({
          player,
          stats: data.stats,
          cards: data.cards,
          synActive: data.synActive,
          won: data.won,
          cls: battleConfig?.cls || 'developer',
        }).catch(console.warn);
      }),
    ];
    return () => offs.forEach(o => o());
  }, [battleConfig, player, goToBattle, goToMenu]);

  return (
    <>
    <div class="game-root">
      {/* Phaser always mounted for instant startup, but hidden until battle */}
      <PhaserGame onReady={onPhaserReady} visible={screen === 'battle'} />

      {/* Loading screen while Phaser boots */}
      {!phaserReady && <LoadingScreen />}

      {/* Preact overlays */}
      {screen === 'battle' && (
        <>
          <HUD />
          <Banner />
          <MashOverlay />
          <LevelUpOverlay />
          <PauseOverlay />
          <ResultScreen
            player={player}
            onRestart={() => battleConfig && goToBattle(battleConfig.cls, battleConfig.trial)}
            onMenu={goToMenu}
            onLeaderboard={() => setScreen('leaderboard')}
          />
        </>
      )}

      {screen === 'menu' && phaserReady && (
        <MenuScreen
          player={player}
          onStart={cls => goToBattle(cls, false)}
          onTrial={cls => goToBattle(cls, true)}
          onBook={() => setScreen('book')}
          onLeaderboard={() => setScreen('leaderboard')}
          onUpgrade={() => setScreen('upgrade')}
          onAuth={() => setShowAuth(true)}
          onPlayerUpdate={setPlayer}
        />
      )}

      {screen === 'book' && (
        <BookScreen onClose={() => setScreen('menu')} />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen onClose={() => setScreen(screen === 'battle' ? 'battle' : 'menu')} />
      )}

      {screen === 'upgrade' && (
        <UpgradeScreen onClose={() => setScreen('menu')} />
      )}
    </div>

    {/* Auth modal — rendered OUTSIDE game-root to escape stacking context */}
    {showAuth && (
      <AuthModal
        onClose={() => setShowAuth(false)}
        onAuthSuccess={async (u) => {
          if (u) await pullPlayerData();
          const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
          getOrCreatePlayer(p.displayName || 'Nhân viên ẩn danh', 'developer').then(setPlayer);
        }}
      />
    )}
    </>
  );
}
