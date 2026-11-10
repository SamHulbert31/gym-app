import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';

// Main screens: scrolling content with the tab bar pinned underneath.
export function TabLayout() {
  return (
    <div className="shell">
      <main className="scroll">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

// Full screen flows: no tab bar. A screen pins its own footer if it needs one.
export function FlowLayout() {
  return (
    <div className="shell">
      <Outlet />
    </div>
  );
}
