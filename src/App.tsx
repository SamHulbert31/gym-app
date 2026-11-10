import { HashRouter, Route, Routes } from 'react-router-dom';
import { FlowLayout, TabLayout } from './components/Layouts';
import UpdatePrompt from './components/UpdatePrompt';
import Generate from './screens/Generate';
import Home from './screens/Home';
import Progress from './screens/Progress';
import Session from './screens/Session';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<TabLayout />}>
          <Route index element={<Home />} />
          <Route path="progress" element={<Progress />} />
        </Route>
        <Route element={<FlowLayout />}>
          <Route path="generate" element={<Generate />} />
          <Route path="session" element={<Session />} />
        </Route>
      </Routes>
      <UpdatePrompt />
    </HashRouter>
  );
}
