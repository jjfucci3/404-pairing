import { useState, useRef, useEffect } from 'react';

export default function CheckboxPersonList({ personA, allNames, knownPairs, selected, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    onChange(new Set());
    setQuery('');
  }, [personA]);

  const knownSet = new Set(
    knownPairs
      .filter(([a, b]) => a === personA || b === personA)
      .map(([a, b]) => (a === personA ? b : a))
  );

  const filtered = allNames.filter(
    name =>
      name !== personA &&
      (query === '' || name.toLowerCase().includes(query.toLowerCase()))
  );

  function toggle(name) {
    if (knownSet.has(name)) return;
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  }

  const count = selected.size;

  return (
    <div className="checkbox-person-list" ref={containerRef}>
      <div className="checkbox-person-input-wrap">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={personA ? 'Search people…' : 'Select Person A first…'}
          disabled={!personA}
          autoComplete="off"
        />
        {count > 0 && (
          <span className="checkbox-count-badge">{count} selected</span>
        )}
      </div>
      {open && personA && (
        <ul className="autocomplete-list checkbox-list">
          {filtered.length === 0 ? (
            <li className="autocomplete-item no-match">No matches</li>
          ) : (
            filtered.map(name => {
              const isKnown = knownSet.has(name);
              const isChecked = isKnown || selected.has(name);
              return (
                <li
                  key={name}
                  className={`autocomplete-item checkbox-item${isKnown ? ' already-known' : ''}`}
                  onMouseDown={e => { e.preventDefault(); toggle(name); }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isKnown}
                    onChange={() => toggle(name)}
                    className="person-checkbox"
                    onMouseDown={e => e.stopPropagation()}
                  />
                  <span className="checkbox-name">{name}</span>
                  {isKnown && <span className="already-known-badge">already known</span>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
