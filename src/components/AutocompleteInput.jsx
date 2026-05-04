import { useState, useRef, useEffect } from 'react';

export default function AutocompleteInput({ value, onChange, options, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const matches = query.length === 0
    ? options
    : options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  function select(name) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (!val) onChange('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' && matches.length === 1) select(matches[0]);
  }

  return (
    <div className="autocomplete" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="autocomplete-list">
          {matches.map(name => (
            <li
              key={name}
              className={`autocomplete-item${name === value ? ' selected' : ''}`}
              onMouseDown={() => select(name)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
