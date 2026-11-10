import { HashRouter, Route, Routes } from 'react-router-dom';
import { FlowLayout, TabLayout } from './components/Layouts';
import UpdatePrompt from './components/UpdatePrompt';
import { useVisualViewport } from './hooks/useVisualViewport';
import Builder from './screens/Builder';
import Generate from './screens/Generate';
import Home from './screens/Home';
import Progress from './screens/Progress';
import Session from './screens/Session';
import Summary from './screens/Summary';

export default function App() {
  useVisualViewport();
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
        </Route>
      </Routes>
      <UpdatePrompt />
    </HashRouter>
  );
}
