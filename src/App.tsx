import { HashRouter, Route, Routes } from 'react-router-dom';
import { FlowLayout, TabLayout } from './components/Layouts';
import UpdatePrompt from './components/UpdatePrompt';
import { useEffect } from 'react';
import { useVisualViewport } from './hooks/useVisualViewport';
import Builder from './screens/Builder';
import Generate from './screens/Generate';
import History from './screens/History';
import HistoryDetail from './screens/HistoryDetail';
import Home from './screens/Home';
import Progress from './screens/Progress';
import Session from './screens/Session';
import Settings from './screens/Settings';
import Summary from './screens/Summary';
import { startSync } from './sync';

export default function App() {
  useVisualViewport();
  useEffect(() => void startSync(), []);
  return (
    <HashRouter>
      <Routes>
        <Route element={<TabLayout />}>
          <Route index element={<Home />} />
          <Route path="progress" element={<Progress />} />
        </Route>
        <Route element={<FlowLayout />}>
          <Route path="generate" element={<Generate />} />
          <Route path="builder/:id" element={<Builder />} />
          <Route path="session/:id" element={<Session />} />
          <Route path="summary/:id" element={<Summary />} />
          <Route path="history" element={<History />} />
          <Route path="history/:id" element={<HistoryDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <UpdatePrompt />
    </HashRouter>
  );
}
