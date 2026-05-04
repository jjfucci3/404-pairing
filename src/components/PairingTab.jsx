import { useState, useEffect } from 'react';
import SuggestionCard from './SuggestionCard.jsx';

export default function PairingTab() {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [context, setContext] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pairings, setPairings] = useState([]);
  const [error, setError] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch('/api/relationships')
      .then(r => r.json())
      .then(data => setNotes(data.notes?.[selected] || ''));
  }, [selected]);

  async function loadProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      setProfiles(data.filter(p => p.name !== 'Jake Fucci'));
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  }

  async function refreshProfiles() {
    setRefreshing(true);
    setError('');
    try {
      const res = await fetch('/api/reload');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfiles((data.profiles || []).filter(p => p.name !== 'Jake Fucci'));
    } catch (err) {
      setError('Could not refresh from Sheet: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function saveNote() {
    if (!selected) return;
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selected, note: notes }),
    });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  async function generatePairings() {
    if (!selected) return;
    setLoading(true);
    setError('');
    setPairings([]);
    try {
      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName: selected, context, notes }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPairings(data.pairings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function markKnown(otherName) {
    await fetch('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personA: selected, personB: otherName }),
    });
    setPairings(prev => prev.filter(p => p.name !== otherName));
  }

  const selectedProfile = profiles.find(p => p.name === selected);

  return (
    <div className="pairing-tab">
      <div className="pairing-controls">
        <div className="field">
          <label>Person</label>
          <div className="select-row">
            <select
              value={selected}
              onChange={e => {
                setSelected(e.target.value);
                setPairings([]);
                setError('');
                setContext('');
              }}
            >
              <option value="">Select a person...</option>
              {profiles.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <button
              className="btn-ghost refresh-btn"
              onClick={refreshProfiles}
              disabled={refreshing}
              title="Refresh profiles from Google Sheet"
            >
              {refreshing ? '…' : '↻'}
            </button>
          </div>
        </div>

        {selectedProfile && (
          <div className="profile-summary">
            {selectedProfile.age && <span>{selectedProfile.age} yrs</span>}
            {selectedProfile.city && <span>{selectedProfile.city}</span>}
            {selectedProfile.industries && <span>{selectedProfile.industries}</span>}
            {selectedProfile.lookingFor?.length > 0 && (
              <span>Looking for: {selectedProfile.lookingFor.join(', ')}</span>
            )}
            {selectedProfile.openness != null && (
              <span>Openness {selectedProfile.openness}/5</span>
            )}
          </div>
        )}

        <div className="field">
          <label>
            Context
            <span className="optional">optional</span>
          </label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder='e.g. "paying $10 for a pairing" or "specifically wants a creative collab"'
            rows={2}
          />
        </div>

        <div className="field">
          <label>
            Operator notes
            <span className="optional">persisted per person</span>
          </label>
          <div className="notes-row">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Low openness (1/5) — needs someone with strong shared surface area..."
              rows={2}
            />
            <button
              className={`btn-ghost save-note-btn${noteSaved ? ' saved' : ''}`}
              onClick={saveNote}
              disabled={!selected}
            >
              {noteSaved ? '✓ saved' : 'Save'}
            </button>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={generatePairings}
          disabled={!selected || loading}
        >
          {loading ? 'Generating…' : 'Generate pairings'}
        </button>

        {error && <div className="error">{error}</div>}
      </div>

      {pairings.length > 0 && (
        <div className="pairings-results">
          <div className="results-header">
            {pairings.length} pairing{pairings.length !== 1 ? 's' : ''} for {selected}
          </div>
          {pairings.map(pairing => (
            <SuggestionCard
              key={pairing.name}
              pairing={pairing}
              profiles={profiles}
              onMarkKnown={() => markKnown(pairing.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
