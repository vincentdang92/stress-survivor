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
  // Uses BOTH touchstart (early, reliable in WebViews) + focusin (desktop fallback).
  useEffect(() => {
    const INPUT_SELECTOR = 'input, textarea, select, [contenteditable]';

    // Called as early as possible — on touchstart on an input (before focus event)
    const onTouchStart = (e) => {
      if (e.target.matches(INPUT_SELECTOR)) {
        pauseGame();
        document.body.classList.add('auth-open');
      }
    };

    // Fallback for desktop (no touch)
    const onFocusIn = (e) => {
      if (e.target.matches(INPUT_SELECTOR)) {
        pauseGame();
        document.body.classList.add('auth-open');
      }
    };

    const onFocusOut = (e) => {
      if (e.target.matches(INPUT_SELECTOR)) {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (!active || !active.matches(INPUT_SELECTOR)) {
            resumeGame();
            document.body.classList.remove('auth-open');
          }
        });
      }
    };

    // passive: true so we don't block scroll, but we get the event early
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
    };
  }, []);

  // showAuth effect: eagerly pause before user even taps input
  useEffect(() => {
    if (showAuth) { pauseGame(); document.body.classList.add('auth-open'); }
    else if (!document.activeElement?.matches('input, textarea')) {
      resumeGame(); document.body.classList.remove('auth-open');
    }
  }, [showAuth]);

  // Init auth + player on mount
  useEffect(() => {
    initAuth().then(async ({ user }) => {
      const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
      const name = p.displayName || 'Nhân viên ẩn danh';
      // 1. getOrCreatePlayer trước: link auth_user_id nếu đã login
      const pl = await getOrCreatePlayer(name, p.owned?.[0] || 'developer');
      setPlayer(pl);
      // 2. pullPlayerData sau: giờ mới tìm được player theo auth_user_id
      if (user) {
        await pullPlayerData();
        // Reload player từ cache sau khi merge remote data
        const refreshed = await getOrCreatePlayer(name, p.owned?.[0] || 'developer');
        setPlayer(refreshed);
      }
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
          const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
          const name = p.displayName || 'Nhân viên ẩn danh';
          if (u) {
            // Login: link auth_user_id trước, rồi pull remote data
            const pl = await getOrCreatePlayer(name, 'developer');
            setPlayer(pl);
            await pullPlayerData();
            // Reload sau khi merge remote upgrades về localStorage
            const refreshed = await getOrCreatePlayer(name, 'developer');
            setPlayer(refreshed);
          } else {
            // Logout: signOut đã xóa anon_id → tạo identity hoàn toàn mới
            setPlayer(null);
            const fresh = await getOrCreatePlayer(name, 'developer');
            setPlayer(fresh);
          }
        }}
      />
    )}
    </>
  );
}
