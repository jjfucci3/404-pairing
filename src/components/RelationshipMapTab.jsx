import { useState, useEffect } from 'react';
import AutocompleteInput from './AutocompleteInput.jsx';

export default function RelationshipMapTab() {
  const [relationships, setRelationships] = useState({ knownPairs: [], notes: {} });
  const [allNames, setAllNames] = useState([]);
  const [personA, setPersonA] = useState('');
  const [personB, setPersonB] = useState('');
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [relRes, profilesRes] = await Promise.all([
      fetch('/api/relationships'),
      fetch('/api/profiles'),
    ]);
    const rel = await relRes.json();
    const profiles = await profilesRes.json();
    setRelationships(rel);
    setAllNames([...new Set(profiles.map(p => p.name))].sort());
  }

  async function addPair() {
    if (!personA || !personB || personA === personB) return;
    setAdding(true);
    const res = await fetch('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personA, personB }),
    });
    setRelationships(await res.json());
    setPersonA('');
    setPersonB('');
    setAdding(false);
  }

  async function removePair(a, b) {
    const res = await fetch('/api/relationships', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personA: a, personB: b }),
    });
    setRelationships(await res.json());
  }

  const filteredPairs = filter
    ? relationships.knownPairs.filter(([a, b]) =>
        a.toLowerCase().includes(filter.toLowerCase()) ||
        b.toLowerCase().includes(filter.toLowerCase())
      )
    : relationships.knownPairs;

  return (
    <div className="relationship-tab">
      <div className="rel-controls">
        <div className="add-pair-row">
          <AutocompleteInput
            value={personA}
            onChange={setPersonA}
            options={allNames}
            placeholder="Person A…"
          />
          <span className="knows-label">knows</span>
          <AutocompleteInput
            value={personB}
            onChange={setPersonB}
            options={allNames}
            placeholder="Person B…"
          />
          <button
            className="btn-primary"
            onClick={addPair}
            disabled={!personA || !personB || personA === personB || adding}
          >
            Mark as known
          </button>
        </div>
      </div>

      <div className="rel-list-header">
        <span className="pair-count">{relationships.knownPairs.length} known pairs</span>
        <input
          className="filter-input"
          type="text"
          placeholder="Filter by name…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="rel-list">
        {filteredPairs.length === 0 ? (
          <div className="rel-empty">
            {filter ? 'No pairs match that name.' : 'No known pairs yet.'}
          </div>
        ) : (
          filteredPairs.map(([a, b]) => (
            <div key={`${a}|||${b}`} className="pair-row">
              <span className="pair-names">
                {a}
                <span className="pair-sep">↔</span>
                {b}
              </span>
              <button className="btn-ghost remove-btn" onClick={() => removePair(a, b)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
