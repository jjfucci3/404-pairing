const TYPE_COLORS = {
  'friend': { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  'collaborator': { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  'romantic': { bg: 'rgba(236,72,153,0.1)', text: '#f472b6', border: 'rgba(236,72,153,0.25)' },
  'friend + collaborator': { bg: 'rgba(139,92,246,0.1)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
};

export default function SuggestionCard({ pairing, profiles, onMarkKnown }) {
  const profile = profiles.find(p => p.name === pairing.name);
  const colors = TYPE_COLORS[pairing.type] || { bg: 'rgba(120,120,120,0.1)', text: '#888', border: 'rgba(120,120,120,0.25)' };

  return (
    <div className="suggestion-card">
      <div className="card-header">
        <span className="rank">#{pairing.rank}</span>
        <div className="card-title">
          {profile?.instagram ? (
            <a
              href={`https://instagram.com/${profile.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="person-name"
            >
              {pairing.name}
            </a>
          ) : (
            <span className="person-name">{pairing.name}</span>
          )}
          <span
            className="type-badge"
            style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
          >
            {pairing.type}
          </span>
        </div>
        <button className="btn-ghost mark-known-btn" onClick={onMarkKnown}>
          Mark as already known
        </button>
      </div>

      {profile && (
        <div className="card-meta">
          {profile.age && <span>{profile.age}</span>}
          {profile.city && <span>{profile.city}</span>}
          {profile.industries && <span>{profile.industries}</span>}
          {profile.openness != null && <span>Openness {profile.openness}/5</span>}
          {profile.availability && <span>{profile.availability}</span>}
          {profile.lookingFor?.length > 0 && (
            <span>Looking for: {profile.lookingFor.join(', ')}</span>
          )}
        </div>
      )}

      <p className="reasoning">{pairing.reasoning}</p>

      {pairing.flag && (
        <div className="flag">
          <span className="flag-icon">⚠</span>
          {pairing.flag}
        </div>
      )}
    </div>
  );
}
