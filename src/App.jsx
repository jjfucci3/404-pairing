import { useState } from 'react';
import PairingTab from './components/PairingTab.jsx';
import RelationshipMapTab from './components/RelationshipMapTab.jsx';
import './index.css';

export default function App() {
  const [tab, setTab] = useState('pairing');

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">404 — pairing engine</span>
          <nav className="tabs">
            <button
              className={`tab${tab === 'pairing' ? ' active' : ''}`}
              onClick={() => setTab('pairing')}
            >
              Pairing
            </button>
            <button
              className={`tab${tab === 'relationships' ? ' active' : ''}`}
              onClick={() => setTab('relationships')}
            >
              Relationship map
            </button>
          </nav>
        </div>
      </header>
      <main className="main">
        {tab === 'pairing' ? <PairingTab /> : <RelationshipMapTab />}
      </main>
    </div>
  );
}
