import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Loading, PageError } from './components/Bits.jsx';
import { Brand, Icon } from './components/Icon.jsx';
import { api } from './lib/api.js';
import { Coach } from './pages/Coach.jsx';
import { LogFood } from './pages/LogFood.jsx';
import { Profile, ProfileSetup } from './pages/Profile.jsx';
import { Progress } from './pages/Progress.jsx';
import { Help } from './pages/Help.jsx';
import { Tour } from './components/Tour.jsx';
import { SupportWidget } from './components/SupportWidget.jsx';
import { Today } from './pages/Today.jsx';
import { Training } from './pages/Training.jsx';
import { Welcome } from './pages/Welcome.jsx';

const NAV = [
  ['/', 'Today', 'home'],
  ['/log', 'Log meal', 'food'],
  ['/training', 'Training', 'training'],
  ['/progress', 'Progress', 'chart'],
  ['/coach', 'Coach', 'chat'],
];

function Shell({ user, setUser, ai }) {
  const [logoutError, setLogoutError] = useState('');
  const logOut = async () => {
    try { await api.post('/auth/logout'); setUser(null); } catch { setLogoutError('Couldn’t log out. Try again.'); }
  };
  const initial = user.name.slice(0, 1).toUpperCase();
  return (
    <div className="shell">
      <div className="shell-aura" aria-hidden="true" />
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar">
        <Link to="/" aria-label="FitMentor home" style={{ textDecoration: 'none' }}><Brand /></Link>
        <nav className="nav" aria-label="Main">
          <p className="nav-label">Menu</p>
          {NAV.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} data-tour={to}>{({ isActive }) => <><Icon name={icon} size={20} weight={isActive ? 'fill' : 'regular'} />{label}</>}</NavLink>)}
        </nav>
        <nav className="nav nav-support" aria-label="Support">
          <p className="nav-label">Support</p>
          <NavLink to="/help" data-tour="/help">{({ isActive }) => <><Icon name="help" size={20} weight={isActive ? 'fill' : 'regular'} />Help &amp; FAQ</>}</NavLink>
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/profile" className="user-chip"><span className="avatar">{initial}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></NavLink>
          <button type="button" className="logout" onClick={logOut}><Icon name="logout" size={16} />Log out</button>
          {logoutError && <p className="notice notice-error" role="alert">{logoutError}</p>}
        </div>
      </aside>
      <header className="topbar">
        <Link to="/" aria-label="FitMentor home" style={{ textDecoration: 'none' }}><Brand /></Link>
        <Link to="/help" data-tour="/help" className="icon-btn topbar-help" aria-label="Help"><Icon name="help" size={18} /></Link>
        <Link to="/profile" className="avatar" aria-label="Your profile">{initial}</Link>
      </header>
      <main id="main" className="main">
        <Routes>
          <Route path="/" element={<Today user={user} />} />
          <Route path="/log" element={<LogFood ai={ai} />} />
          <Route path="/training" element={<Training />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/coach" element={<Coach ai={ai} />} />
          <Route path="/help" element={<Help />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} data-tour={to}>{({ isActive }) => <><Icon name={icon} size={22} weight={isActive ? 'fill' : 'regular'} />{label.replace('Log meal', 'Log')}</>}</NavLink>)}
      </nav>
      <Tour name={user.name.split(' ')[0]} />
      <SupportWidget name={user.name.split(' ')[0]} />
    </div>
  );
}

export function App() {
  const [user, setUser] = useState(undefined);
  const [ai, setAi] = useState({ text: null, vision: null });
  const [failure, setFailure] = useState(null);

  const load = async () => {
    setFailure(null);
    try {
      const status = await api.get('/status');
      setAi(status.ai);
      const me = await api.get('/auth/me').catch((err) => {
        if (err.status === 401) return { user: null };
        throw err;
      });
      setUser(me.user);
    } catch (err) {
      setFailure(err);
    }
  };
  useEffect(() => { load(); }, []);

  if (failure) return <main className="center"><PageError error={failure} onRetry={load} /></main>;
  if (user === undefined) return <main className="center"><div style={{ width: 'min(480px, 100%)' }}><Loading what="FitMentor" /></div></main>;
  if (!user) return <Welcome onAuth={setUser} />;
  if (!user.profile) return <ProfileSetup user={user} setUser={setUser} />;
  return <Shell user={user} setUser={setUser} ai={ai} />;
}
