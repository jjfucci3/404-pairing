import { useState, useEffect } from 'react';
import AutocompleteInput from './AutocompleteInput.jsx';
import CheckboxPersonList from './CheckboxPersonList.jsx';
import GraphView from './GraphView.jsx';

export default function RelationshipMapTab() {
  const [relationships, setRelationships] = useState({ knownPairs: [], notes: {} });
  const [allNames, setAllNames] = useState([]);
  const [personA, setPersonA] = useState('');
  const [selectedPeople, setSelectedPeople] = useState(new Set());
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState('list');

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

  async function addPairs() {
    if (!personA || selectedPeople.size === 0) return;
    setAdding(true);
    const res = await fetch('/api/relationships/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personA, people: [...selectedPeople] }),
    });
    setRelationships(await res.json());
    setPersonA('');
    setSelectedPeople(new Set());
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
          <CheckboxPersonList
            personA={personA}
            allNames={allNames}
            knownPairs={relationships.knownPairs}
            selected={selectedPeople}
            onChange={setSelectedPeople}
          />
          <button
            className="btn-primary"
            onClick={addPairs}
            disabled={!personA || selectedPeople.size === 0 || adding}
          >
            {selectedPeople.size > 1
              ? `Mark as known (${selectedPeople.size})`
              : 'Mark as known'}
          </button>
        </div>
      </div>

      <div className="rel-list-header">
        <span className="pair-count">{relationships.knownPairs.length} known pairs</span>
        <div className="view-toggle">
          <button
            className={`view-toggle-btn${view === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
          >List</button>
          <button
            className={`view-toggle-btn${view === 'graph' ? ' active' : ''}`}
            onClick={() => setView('graph')}
          >Graph</button>
        </div>
        {view === 'list' && (
          <input
            className="filter-input"
            type="text"
            placeholder="Filter by name…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        )}
      </div>

      {view === 'list' ? (
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
      ) : (
        <GraphView
          knownPairs={relationships.knownPairs}
          allNames={allNames}
        />
      )}
    </div>
  );
}
