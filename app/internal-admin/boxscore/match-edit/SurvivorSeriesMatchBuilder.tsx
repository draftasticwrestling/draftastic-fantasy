// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import WrestlerAutocomplete from './WrestlerAutocomplete';

const gold = '#C6A04F';
const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid #444',
  background: '#222',
  color: '#fff',
  marginBottom: '12px',
};

const teamSectionStyle = {
  background: '#1a1a1a',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #555',
  marginBottom: '16px',
};

const eliminationSectionStyle = {
  background: '#2a2a2a',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #444',
  marginBottom: '16px',
};

const eliminationRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px',
  background: '#333',
  borderRadius: '4px',
  marginBottom: '8px',
  border: '1px solid #555',
};

const resultSectionStyle = {
  background: '#1a1a1a',
  padding: '16px',
  borderRadius: '8px',
  border: `2px solid ${gold}`,
  marginTop: '16px',
};

const eliminatedStyle = {
  textDecoration: 'line-through',
  opacity: 0.6,
  color: '#888',
};

function padTeam(team) {
  const next = Array.isArray(team) ? team.slice(0, 5).map((slug) => slug || '') : [];
  while (next.length < 5) next.push('');
  return next;
}

export default function SurvivorSeriesMatchBuilder({ 
  wrestlers = [], 
  value, 
  onChange, 
  onResultChange,
  /** Saved survivorSeriesData when reopening a match. */
  initialData = null,
}) {
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  
  // Two teams of 5. Order is who enters next — it is not scored.
  const [team1, setTeam1] = useState(() => padTeam(initialData?.team1));
  const [team2, setTeam2] = useState(() => padTeam(initialData?.team2));
  
  // Eliminations: array of { eliminated: slug, eliminatedBy: slug, method: string, order: number }
  const [eliminations, setEliminations] = useState(() =>
    Array.isArray(initialData?.eliminations) ? initialData.eliminations.map((elim) => ({ ...elim })) : []
  );
  
  // '1' or '2'. The whole team wins, including members who were eliminated.
  const [winningTeam, setWinningTeam] = useState(() => {
    const stored = Number(initialData?.winningTeam);
    return stored === 1 || stored === 2 ? String(stored) : '';
  });
  const [time, setTime] = useState(initialData?.time || '');
  const onChangeRef = useRef(onChange);
  const onResultChangeRef = useRef(onResultChange);
  const lastResultKey = useRef('');
  onChangeRef.current = onChange;
  onResultChangeRef.current = onResultChange;

  // Update parent when participants change
  useEffect(() => {
    const validTeam1 = team1.filter(t => t.trim());
    const validTeam2 = team2.filter(t => t.trim());
    
    if (validTeam1.length > 0 || validTeam2.length > 0) {
      // Format as "Team 1 vs Team 2" for display
      const team1Str = validTeam1.map(slug => {
        const wrestler = safeWrestlers.find(w => w.id === slug);
        return wrestler ? wrestler.name : slug;
      }).join(' & ');
      
      const team2Str = validTeam2.map(slug => {
        const wrestler = safeWrestlers.find(w => w.id === slug);
        return wrestler ? wrestler.name : slug;
      }).join(' & ');
      
      const participantString = `${team1Str} vs ${team2Str}`;
      
      if (participantString !== value && participantString.trim() !== '') {
        onChangeRef.current(participantString, 'Survivor Series-style 10-man Tag Team Elimination match');
      }
    }
  }, [team1, team2, value, safeWrestlers]);

  // The team that scores 5 eliminations wins.
  useEffect(() => {
    const team1Out = eliminations.filter((e) => e.eliminated && team1.includes(e.eliminated)).length;
    const team2Out = eliminations.filter((e) => e.eliminated && team2.includes(e.eliminated)).length;
    if (team2Out >= 5 && team1Out < 5) setWinningTeam('1');
    else if (team1Out >= 5 && team2Out < 5) setWinningTeam('2');
  }, [eliminations, team1, team2]);

  // Update parent when result changes
  useEffect(() => {
    if (winningTeam !== '1' && winningTeam !== '2') return;
    const validTeam1 = team1.filter(t => t.trim());
    const validTeam2 = team2.filter(t => t.trim());
    if (validTeam1.length === 0 || validTeam2.length === 0) return;

    const nameFor = (slug) => safeWrestlers.find(w => w.id === slug)?.name || slug;
    const team1Names = validTeam1.map(nameFor);
    const team2Names = validTeam2.map(nameFor);
    const winningSide = winningTeam === '1' ? validTeam1 : validTeam2;
    const eliminated = new Set(eliminations.map((e) => e.eliminated).filter(Boolean));
    const survivors = winningSide.filter((slug) => !eliminated.has(slug));
    const survivorNames = survivors.map(nameFor);

    const resultData = {
      team1: validTeam1,
      team2: validTeam2,
      eliminations: eliminations,
      survivor: survivors[0] || '',
      survivorName: survivorNames.join(', '),
      survivors,
      survivorNames,
      winningTeam: Number(winningTeam),
      team1Names: team1Names,
      team2Names: team2Names,
      time: time
    };

    const resultKey = JSON.stringify(resultData);
    if (resultKey === lastResultKey.current) return;
    lastResultKey.current = resultKey;
    onResultChangeRef.current(resultData);
  }, [winningTeam, eliminations, team1, team2, time, safeWrestlers]);

  const updateTeamMember = (teamNum, index, value) => {
    if (teamNum === 1) {
      const newTeam1 = [...team1];
      newTeam1[index] = value;
      setTeam1(newTeam1);
    } else {
      const newTeam2 = [...team2];
      newTeam2[index] = value;
      setTeam2(newTeam2);
    }
  };

  const addElimination = () => {
    setEliminations([...eliminations, { eliminated: '', eliminatedBy: '', method: 'Pinfall', order: eliminations.length + 1, time: '' }]);
  };

  const updateElimination = (index, field, value) => {
    const newEliminations = [...eliminations];
    newEliminations[index] = { ...newEliminations[index], [field]: value };
    setEliminations(newEliminations);
  };

  const removeElimination = (index) => {
    const newEliminations = eliminations.filter((_, i) => i !== index);
    // Reorder remaining eliminations
    const reordered = newEliminations.map((elim, i) => ({ ...elim, order: i + 1 }));
    setEliminations(reordered);
  };

  const getWrestlerName = (slug) => {
    const wrestler = safeWrestlers.find(w => w.id === slug);
    return wrestler ? wrestler.name : slug;
  };

  // Get all participants (both teams)
  const getAllParticipants = () => {
    return [...team1.filter(t => t.trim()), ...team2.filter(t => t.trim())];
  };

  // Get remaining participants (not eliminated)
  const getRemainingParticipants = () => {
    const allParticipants = getAllParticipants();
    const eliminated = eliminations.map(e => e.eliminated).filter(Boolean);
    return allParticipants.filter(p => !eliminated.includes(p));
  };

  // Get eliminated participants
  const getEliminatedParticipants = () => {
    return eliminations.map(e => e.eliminated).filter(Boolean);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Team 1 */}
      <div style={teamSectionStyle}>
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '4px' }}>
          Team 1
        </div>
        <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '12px' }}>
          List them in the order they enter. One wrestler is legal at a time. Entry order is not scored.
        </div>
        {team1.map((wrestler, index) => {
          const isEliminated = getEliminatedParticipants().includes(wrestler);
          return (
            <div key={index} style={{ marginBottom: '8px' }}>
              <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block', ...(isEliminated ? eliminatedStyle : {}) }}>
                Enters {index + 1}: {isEliminated && '(Eliminated)'}
              </label>
              <WrestlerAutocomplete
                wrestlers={safeWrestlers}
                value={wrestler}
                onChange={(value) => updateTeamMember(1, index, value)}
                placeholder={`Team 1 Wrestler ${index + 1}`}
              />
            </div>
          );
        })}
      </div>

      {/* Team 2 */}
      <div style={teamSectionStyle}>
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '4px' }}>
          Team 2
        </div>
        <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '12px' }}>
          List them in the order they enter. One wrestler is legal at a time. Entry order is not scored.
        </div>
        {team2.map((wrestler, index) => {
          const isEliminated = getEliminatedParticipants().includes(wrestler);
          return (
            <div key={index} style={{ marginBottom: '8px' }}>
              <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block', ...(isEliminated ? eliminatedStyle : {}) }}>
                Enters {index + 1}: {isEliminated && '(Eliminated)'}
              </label>
              <WrestlerAutocomplete
                wrestlers={safeWrestlers}
                value={wrestler}
                onChange={(value) => updateTeamMember(2, index, value)}
                placeholder={`Team 2 Wrestler ${index + 1}`}
              />
            </div>
          );
        })}
      </div>

      {/* Eliminations */}
      {(team1.some(t => t.trim()) || team2.some(t => t.trim())) && (
        <div style={eliminationSectionStyle}>
          <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
            Eliminations
          </div>
          <div style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
            One person per team is in the ring. When someone is eliminated, the next teammate comes in. The team that scores 5 eliminations wins. Everyone on the winning team gets the win, even teammates who were eliminated. Each elimination is +3 for the wrestler who scores it.
          </div>
          
          {eliminations.map((elimination, index) => (
            <div key={index} style={eliminationRowStyle}>
              <span style={{ color: '#fff', minWidth: '80px' }}>Elimination #{elimination.order}:</span>
              
              <div style={{ flex: 1 }}>
                <label style={{ color: '#fff', fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                  Eliminated:
                </label>
                <select
                  value={elimination.eliminated}
                  onChange={(e) => updateElimination(index, 'eliminated', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select wrestler...</option>
                  {getAllParticipants().filter(p => {
                    // Don't show already eliminated wrestlers (except in this current elimination)
                    const alreadyEliminated = eliminations
                      .filter((_, i) => i !== index)
                      .map(e => e.eliminated)
                      .includes(p);
                    return !alreadyEliminated;
                  }).map(slug => (
                    <option key={slug} value={slug}>{getWrestlerName(slug)}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ color: '#fff', fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                  Eliminated by:
                </label>
                <select
                  value={elimination.eliminatedBy}
                  onChange={(e) => updateElimination(index, 'eliminatedBy', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select wrestler...</option>
                  {(elimination.eliminated && team1.includes(elimination.eliminated)
                    ? team2.filter((slug) => slug.trim())
                    : elimination.eliminated && team2.includes(elimination.eliminated)
                      ? team1.filter((slug) => slug.trim())
                      : getAllParticipants().filter((slug) => slug !== elimination.eliminated)
                  ).map(slug => (
                    <option key={slug} value={slug}>{getWrestlerName(slug)}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ color: '#fff', fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                  Method:
                </label>
                <select
                  value={elimination.method}
                  onChange={(e) => updateElimination(index, 'method', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Pinfall">Pinfall</option>
                  <option value="Submission">Submission</option>
                  <option value="DQ">DQ</option>
                  <option value="Count out">Count out</option>
                </select>
              </div>

              <div style={{ flex: 0.8 }}>
                <label style={{ color: '#fff', fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                  Time:
                </label>
                <input
                  type="text"
                  value={elimination.time || ''}
                  onChange={(e) => updateElimination(index, 'time', e.target.value)}
                  placeholder="e.g. 6:52"
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={() => removeElimination(index)}
                style={{
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  height: 'fit-content',
                  marginTop: '20px'
                }}
              >
                Remove
              </button>
            </div>
          ))}

          {eliminations.length < 9 && (
            <button
              type="button"
              onClick={addElimination}
              style={{
                background: gold,
                color: '#232323',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '8px'
              }}
            >
              + Add Elimination
            </button>
          )}

          {/* Show remaining participants */}
          {getRemainingParticipants().length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#333', borderRadius: '4px' }}>
              <div style={{ color: gold, fontWeight: 'bold', marginBottom: '8px' }}>
                Remaining: {getRemainingParticipants().length} wrestler{getRemainingParticipants().length !== 1 ? 's' : ''}
              </div>
              <div style={{ color: '#fff', fontSize: '12px' }}>
                {getRemainingParticipants().map(slug => getWrestlerName(slug)).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Result */}
      <div style={resultSectionStyle}>
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
          Match Result
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
            Winning team: *
          </label>
          <select
            value={winningTeam}
            onChange={(e) => setWinningTeam(e.target.value)}
            style={inputStyle}
            required
          >
            <option value="">Select winning team...</option>
            <option value="1">Team 1</option>
            <option value="2">Team 2</option>
          </select>
          <div style={{ color: '#aaa', fontSize: '11px' }}>
            Fills in automatically once one team has eliminated all 5 opponents.
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
            Time (optional):
          </label>
          <input
            type="text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 39:25"
            style={inputStyle}
          />
        </div>

        {winningTeam && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#333', borderRadius: '4px' }}>
            <div style={{ color: gold, fontWeight: 'bold', marginBottom: '4px' }}>
              Winning team: Team {winningTeam}
            </div>
            <div style={{ color: '#fff', fontSize: '13px' }}>
              Still in: {(() => {
                const side = winningTeam === '1' ? team1 : team2;
                const eliminated = getEliminatedParticipants();
                const left = side.filter((slug) => slug.trim() && !eliminated.includes(slug));
                return left.length ? left.map(getWrestlerName).join(', ') : 'None — every winner was eliminated';
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

