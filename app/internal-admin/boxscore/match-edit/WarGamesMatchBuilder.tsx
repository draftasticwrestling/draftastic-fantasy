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

const entryOrderStyle = {
  background: '#2a2a2a',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #444',
  marginBottom: '16px',
};

const entryRowStyle = {
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

export default function WarGamesMatchBuilder({ 
  wrestlers = [], 
  value, 
  onChange, 
  onResultChange 
}) {
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  
  // Two teams of 5 wrestlers each
  const [team1, setTeam1] = useState(Array(5).fill(''));
  const [team2, setTeam2] = useState(Array(5).fill(''));
  
  // Entry order: array of { team: 1 or 2, wrestler: slug, entryNumber: 1-10 }
  // First two entries are the starting wrestlers (one from each team)
  const [entryOrder, setEntryOrder] = useState([]);
  
  // Match result
  const [winningTeam, setWinningTeam] = useState('');
  const [pinSubmissionWinner, setPinSubmissionWinner] = useState('');
  const [method, setMethod] = useState('');
  const [time, setTime] = useState('');

  // Initialize entry order when teams are set
  useEffect(() => {
    // Entry order will be set manually by user, but we need to track it
    // The first two entries should be the starting wrestlers
  }, []);

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
        onChange(participantString, '5-on-5 War Games Match');
      }
    }
  }, [team1, team2, value, safeWrestlers, onChange]);

  // Update parent when result changes
  useEffect(() => {
    if (winningTeam && pinSubmissionWinner && method) {
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
      
      const pinWinnerName = safeWrestlers.find(w => w.id === pinSubmissionWinner)?.name || pinSubmissionWinner;
      
      const resultData = {
        team1: validTeam1,
        team2: validTeam2,
        entryOrder: entryOrder,
        winningTeam: parseInt(winningTeam),
        pinSubmissionWinner: pinSubmissionWinner,
        method: method,
        time: time,
        team1Names: team1Names,
        team2Names: team2Names,
        pinWinnerName: pinWinnerName
      };
      
      onResultChange(resultData);
    }
  }, [winningTeam, pinSubmissionWinner, method, time, team1, team2, entryOrder, safeWrestlers, onResultChange]);

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

  const updateEntryOrder = (entryIndex, wrestlerSlug) => {
    if (!wrestlerSlug) {
      // Remove entry if no wrestler selected
      const newEntryOrder = entryOrder.filter(e => e.entryNumber !== entryIndex + 1);
      setEntryOrder(newEntryOrder);
      return;
    }
    
    // Determine which team the wrestler belongs to
    const teamNum = team1.includes(wrestlerSlug) ? 1 : (team2.includes(wrestlerSlug) ? 2 : null);
    
    if (!teamNum) {
      // Wrestler not found in either team, skip
      return;
    }
    
    const newEntryOrder = [...entryOrder];
    const existingIndex = newEntryOrder.findIndex(e => e.entryNumber === entryIndex + 1);
    
    if (existingIndex >= 0) {
      newEntryOrder[existingIndex] = {
        entryNumber: entryIndex + 1,
        team: teamNum,
        wrestler: wrestlerSlug
      };
    } else {
      newEntryOrder.push({
        entryNumber: entryIndex + 1,
        team: teamNum,
        wrestler: wrestlerSlug
      });
    }
    
    // Sort by entry number
    newEntryOrder.sort((a, b) => a.entryNumber - b.entryNumber);
    setEntryOrder(newEntryOrder);
  };

  const getWrestlerName = (slug) => {
    const wrestler = safeWrestlers.find(w => w.id === slug);
    return wrestler ? wrestler.name : slug;
  };

  const getTeamMembers = (teamNum) => {
    return teamNum === 1 ? team1 : team2;
  };

  // Build entry order display
  const buildEntryOrder = () => {
    const order = [];
    
    // First, get the starting wrestlers (should be set first)
    const starting1 = entryOrder.find(e => e.entryNumber === 1);
    const starting2 = entryOrder.find(e => e.entryNumber === 2);
    
    if (starting1) order.push({ ...starting1, position: 'Starts' });
    if (starting2) order.push({ ...starting2, position: 'Starts' });
    
    // Then get the rest in order
    for (let i = 3; i <= 10; i++) {
      const entry = entryOrder.find(e => e.entryNumber === i);
      if (entry) {
        order.push({ ...entry, position: `Entry #${i - 2}` });
      }
    }
    
    return order;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Team 1 */}
      <div style={teamSectionStyle}>
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
          Team 1 (5 wrestlers)
        </div>
        {team1.map((wrestler, index) => (
          <div key={index} style={{ marginBottom: '8px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
              Wrestler {index + 1}:
            </label>
            <WrestlerAutocomplete
              wrestlers={safeWrestlers}
              value={wrestler}
              onChange={(value) => updateTeamMember(1, index, value)}
              placeholder={`Team 1 Wrestler ${index + 1}`}
            />
          </div>
        ))}
      </div>

      {/* Team 2 */}
      <div style={teamSectionStyle}>
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
          Team 2 (5 wrestlers)
        </div>
        {team2.map((wrestler, index) => (
          <div key={index} style={{ marginBottom: '8px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
              Wrestler {index + 1}:
            </label>
            <WrestlerAutocomplete
              wrestlers={safeWrestlers}
              value={wrestler}
              onChange={(value) => updateTeamMember(2, index, value)}
              placeholder={`Team 2 Wrestler ${index + 1}`}
            />
          </div>
        ))}
      </div>

      {/* Entry Order */}
      {(team1.some(t => t.trim()) || team2.some(t => t.trim())) && (
        <div style={entryOrderStyle}>
          <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
            Entry Order
          </div>
          <div style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
            Two wrestlers start (one from each team), then participants enter at intervals until all 10 are in.
          </div>
          
          {/* Starting Wrestlers */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontWeight: '600', marginBottom: '8px' }}>
              Starting Wrestlers:
            </div>
            <div style={entryRowStyle}>
              <span style={{ color: '#fff', minWidth: '100px' }}>Entry #1 (Starts):</span>
              <select
                value={entryOrder.find(e => e.entryNumber === 1)?.wrestler || ''}
                onChange={(e) => updateEntryOrder(0, e.target.value)}
                style={inputStyle}
              >
                <option value="">Select wrestler...</option>
                {team1.filter(t => t.trim()).map(slug => (
                  <option key={slug} value={slug}>{getWrestlerName(slug)} (Team 1)</option>
                ))}
                {team2.filter(t => t.trim()).map(slug => (
                  <option key={slug} value={slug}>{getWrestlerName(slug)} (Team 2)</option>
                ))}
              </select>
            </div>
            <div style={entryRowStyle}>
              <span style={{ color: '#fff', minWidth: '100px' }}>Entry #2 (Starts):</span>
              <select
                value={entryOrder.find(e => e.entryNumber === 2)?.wrestler || ''}
                onChange={(e) => updateEntryOrder(1, e.target.value)}
                style={inputStyle}
              >
                <option value="">Select wrestler...</option>
                {team1.filter(t => t.trim()).map(slug => (
                  <option key={slug} value={slug}>{getWrestlerName(slug)} (Team 1)</option>
                ))}
                {team2.filter(t => t.trim()).map(slug => (
                  <option key={slug} value={slug}>{getWrestlerName(slug)} (Team 2)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Remaining Entries */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontWeight: '600', marginBottom: '8px' }}>
              Remaining Entries (3-10):
            </div>
            {[3, 4, 5, 6, 7, 8, 9, 10].map(entryNum => (
              <div key={entryNum} style={entryRowStyle}>
                <span style={{ color: '#fff', minWidth: '100px' }}>Entry #{entryNum}:</span>
                <select
                  value={entryOrder.find(e => e.entryNumber === entryNum)?.wrestler || ''}
                  onChange={(e) => updateEntryOrder(entryNum - 1, e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select wrestler...</option>
                  {team1.filter(t => t.trim()).map(slug => (
                    <option key={slug} value={slug}>{getWrestlerName(slug)} (Team 1)</option>
                  ))}
                  {team2.filter(t => t.trim()).map(slug => (
                    <option key={slug} value={slug}>{getWrestlerName(slug)} (Team 2)</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match Result (only show if event is completed) */}
      <div style={resultSectionStyle}>
        <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
          Match Result
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
            Winning Team: *
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
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
            Who got the pin/submission: *
          </label>
          <select
            value={pinSubmissionWinner}
            onChange={(e) => setPinSubmissionWinner(e.target.value)}
            style={inputStyle}
            required
          >
            <option value="">Select wrestler...</option>
            {winningTeam && (
              <>
                {(winningTeam === '1' ? team1 : team2).filter(t => t.trim()).map(slug => (
                  <option key={slug} value={slug}>{getWrestlerName(slug)}</option>
                ))}
              </>
            )}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#fff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
            Method: *
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={inputStyle}
            required
          >
            <option value="">Select method...</option>
            <option value="Pinfall">Pinfall</option>
            <option value="Submission">Submission</option>
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
            placeholder="e.g. 12:34"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

