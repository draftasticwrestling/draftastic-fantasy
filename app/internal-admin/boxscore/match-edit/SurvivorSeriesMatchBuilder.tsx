// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
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

export default function SurvivorSeriesMatchBuilder({ 
  wrestlers = [], 
  value, 
  onChange, 
  onResultChange 
}) {
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  
  // Two teams of 5 wrestlers each
  const [team1, setTeam1] = useState(Array(5).fill(''));
  const [team2, setTeam2] = useState(Array(5).fill(''));
  
  // Eliminations: array of { eliminated: slug, eliminatedBy: slug, method: string, order: number }
  const [eliminations, setEliminations] = useState([]);
  
  // Match result
  const [survivor, setSurvivor] = useState('');
  const [time, setTime] = useState('');

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
        onChange(participantString, 'Survivor Series-style 10-man Tag Team Elimination match');
      }
    }
  }, [team1, team2, value, safeWrestlers, onChange]);

  // Update parent when result changes
  useEffect(() => {
    if (survivor) {
      const validTeam1 = team1.filter(t => t.trim());
      const validTeam2 = team2.filter(t => t.trim());
      
      const team1Names = validTeam1.map(slug => {
        const wrestler = safeWrestlers.find(w => w.id === slug);
        return wrestler ? wrestler.name : slug;
      });
      
      const team2Names = validTeam2.map(slug => {
        const wrestler = safeWrestlers.find(w => w.id === slug);
        return wrestler ? wrestler.name : slug;
      });
      
      const survivorName = safeWrestlers.find(w => w.id === survivor)?.name || survivor;
      
      // Determine winning team based on survivor
      const winningTeam = team1.includes(survivor) ? 1 : (team2.includes(survivor) ? 2 : null);
      
      const resultData = {
        team1: validTeam1,
        team2: validTeam2,
        eliminations: eliminations,
        survivor: survivor,
        survivorName: survivorName,
        winningTeam: winningTeam,
        team1Names: team1Names,
        team2Names: team2Names,
        time: time
      };
      
      onResultChange(resultData);
    }
  }, [survivor, eliminations, team1, team2, time, safeWrestlers, onResultChange]);

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
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
          Team 1 (5 wrestlers)
        </div>
        {team1.map((wrestler, index) => {
          const isEliminated = getEliminatedParticipants().includes(wrestler);
          return (
            <div key={index} style={{ marginBottom: '8px' }}>
              <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block', ...(isEliminated ? eliminatedStyle : {}) }}>
                Wrestler {index + 1}: {isEliminated && '(Eliminated)'}
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
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
          Team 2 (5 wrestlers)
        </div>
        {team2.map((wrestler, index) => {
          const isEliminated = getEliminatedParticipants().includes(wrestler);
          return (
            <div key={index} style={{ marginBottom: '8px' }}>
              <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block', ...(isEliminated ? eliminatedStyle : {}) }}>
                Wrestler {index + 1}: {isEliminated && '(Eliminated)'}
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
            Track each elimination in order. The last remaining wrestler is the survivor.
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
                  {getAllParticipants().filter(p => p !== elimination.eliminated).map(slug => (
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
            Survivor (Last remaining wrestler): *
          </label>
          <select
            value={survivor}
            onChange={(e) => setSurvivor(e.target.value)}
            style={inputStyle}
            required
          >
            <option value="">Select survivor...</option>
            {getRemainingParticipants().map(slug => (
              <option key={slug} value={slug}>{getWrestlerName(slug)}</option>
            ))}
          </select>
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

        {survivor && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#333', borderRadius: '4px' }}>
            <div style={{ color: gold, fontWeight: 'bold', marginBottom: '4px' }}>
              Winning Team:
            </div>
            <div style={{ color: '#fff' }}>
              {team1.includes(survivor) ? 'Team 1' : 'Team 2'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

