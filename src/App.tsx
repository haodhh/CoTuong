import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { setSoundEnabled } from './core/sound';
import { useProfile } from './data/store';
import { Analysis } from './pages/Analysis';
import { Daily } from './pages/Daily';
import { Endgames } from './pages/Endgames';
import { Games } from './pages/Games';
import { Home } from './pages/Home';
import { Learn } from './pages/Learn';
import { PlayBot, PlayLocal } from './pages/Play';
import { RatedPuzzles } from './pages/RatedPuzzles';
import { Review } from './pages/Review';
import { Rush } from './pages/Rush';
import { SettingsPage } from './pages/Settings';
import { Stats } from './pages/Stats';
import { ThemePuzzles, Themes } from './pages/Themes';

export function App() {
  const profile = useProfile();
  useEffect(() => {
    if (profile) setSoundEnabled(profile.settings.sound);
  }, [profile]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="play" element={<PlayBot />} />
          <Route path="local" element={<PlayLocal />} />
          <Route path="games" element={<Games />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="puzzles" element={<RatedPuzzles />} />
          <Route path="themes" element={<Themes />} />
          <Route path="themes/:theme" element={<ThemePuzzles />} />
          <Route path="rush" element={<Rush />} />
          <Route path="review" element={<Review />} />
          <Route path="daily" element={<Daily />} />
          <Route path="endgames" element={<Endgames />} />
          <Route path="endgames/:id" element={<Endgames />} />
          <Route path="learn" element={<Learn />} />
          <Route path="learn/:id" element={<Learn />} />
          <Route path="stats" element={<Stats />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
