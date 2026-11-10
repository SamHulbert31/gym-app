import { NavLink } from 'react-router-dom';
import { Dumbbell, HomeIcon, Trend } from './Icons';

// Train opens the generator, which is a full screen flow without the tab bar,
// so it never shows as the active tab.
const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/generate', label: 'Train', Icon: Dumbbell, end: false },
  { to: '/progress', label: 'Progress', Icon: Trend, end: false },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
