// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import WrestlerHeadshotImage from '@/app/components/WrestlerHeadshotImage';
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

const bracketStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '16px',
  background: '#1a1a1a',
  borderRadius: '8px',
  border: '1px solid #555',
};

const matchRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px',
  background: '#2a2a2a',
  borderRadius: '4px',
  border: '1px solid #444',
  flexWrap: 'wrap',
  minHeight: '60px',
};

const wrestlerCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  background: '#333',
  borderRadius: '4px',
  border: '1px solid #555',
  minWidth: '100px',
  flexShrink: 0,
};

const winnerStyle = {
  ...wrestlerCardStyle,
  border: `2px solid ${gold}`,
  background: '#3a3a3a',
};

const arrowStyle = {
  color: gold,
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 8px',
};

const resultStyle = {
  color: '#C6A04F',
  fontSize: '12px',
  fontWeight: 'bold',
  marginLeft: '8px',
};

export default function GauntletMatchBuilder({ 
  wrestlers = [], 
  value, 
  onChange, 
  onResultChange,
  /** When editing an existing gauntlet, pass stored progression so we don't overwrite with empty results */
  initialProgression = null
}) {
  // Ensure wrestlers is always an array
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  const [participants, setParticipants] = useState([]);
  /** Entry order: 1-based position per participant, or null for TBD (upcoming / unconfirmed) */
  const [entryOrder, setEntryOrder] = useState([]);
  const [matchResults, setMatchResults] = useState([]);
  const [currentWinner, setCurrentWinner] = useState('');
  const matchResultsRef = useRef(matchResults);
  matchResultsRef.current = matchResults;

  const MIN_PARTICIPANTS = 5;
  const MAX_PARTICIPANTS = 10;

  // Ordered list for progression: by entry # when all set and unique, else list order
  const getOrderedParticipantSlugs = () => {
    const n = participants.length;
    const valid = participants.filter(p => p && p.trim() !== '');
    if (valid.length === 0) return [];
    const allSet = entryOrder.length === n && entryOrder.every((e, i) => e != null && e >= 1 && e <= n);
    const unique = allSet && new Set(entryOrder).size === n;
    if (allSet && unique) {
      return [...participants]
        .map((slug, i) => ({ slug, pos: entryOrder[i] }))
        .sort((a, b) => a.pos - b.pos)
        .map(x => x.slug);
    }
    return participants;
  };

  // Parse initial value and optionally hydrate from existing gauntletProgression
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split(' → ').map(p => p.trim()).filter(Boolean);
      const clamped = parts.length === 0
        ? Array(MIN_PARTICIPANTS).fill('')
        : parts.length < MIN_PARTICIPANTS
          ? [...parts, ...Array(MIN_PARTICIPANTS - parts.length).fill('')]
          : parts.slice(0, MAX_PARTICIPANTS);
      setParticipants(clamped);
      const expectedResultsLength = clamped.length >= 2 ? clamped.length - 1 : 0;
      const hasValidProgression = Array.isArray(initialProgression) &&
        initialProgression.length === expectedResultsLength &&
        initialProgression.every(p => p && (p.participant1 != null || p.participant2 != null));

      if (hasValidProgression) {
        const ordered = [initialProgression[0].participant1, initialProgression[0].participant2];
        for (let i = 1; i < initialProgression.length; i++) {
          ordered.push(initialProgression[i].participant2);
        }
        const entryFromProgression = clamped.map(slug => {
          const idx = ordered.indexOf(slug);
          return idx >= 0 ? idx + 1 : null;
        });
        setEntryOrder(entryFromProgression.length ? entryFromProgression : clamped.map(() => null));
        const results = initialProgression.map((p, i) => ({
          match: (p.match ?? p.order ?? i + 1),
          participant1: p.participant1 ?? ordered[i],
          participant2: p.participant2 ?? ordered[i + 1],
          winner: p.winner ?? '',
          method: p.method ?? '',
          time: p.time ?? ''
        }));
        setMatchResults(results);
        const lastWinner = initialProgression[initialProgression.length - 1]?.winner;
        setCurrentWinner(lastWinner ?? ordered[0]);
      } else {
        setEntryOrder(clamped.map(() => null));
        const results = [];
        let winner = clamped[0];
        for (let i = 1; i < clamped.length; i++) {
          results.push({
            match: i,
            participant1: winner,
            participant2: clamped[i],
            winner: '',
            method: '',
            time: ''
          });
        }
        setMatchResults(results);
        setCurrentWinner(clamped[0]);
      }
    } else {
      setParticipants(Array(MIN_PARTICIPANTS).fill(''));
      setEntryOrder(Array(MIN_PARTICIPANTS).fill(null));
      setMatchResults([]);
      setCurrentWinner('');
    }
  }, [value, initialProgression]);

  // Use entry order for display; keep entryOrder length in sync with participants
  useEffect(() => {
    if (entryOrder.length !== participants.length) {
      const next = participants.map((_, i) => entryOrder[i] ?? null);
      if (next.length > entryOrder.length) {
        for (let i = entryOrder.length; i < next.length; i++) next[i] = null;
      }
      setEntryOrder(next);
    }
  }, [participants.length]);

  // Rebuild matchResults from ordered list when participants or entryOrder change; preserve winner/method/time where pair unchanged
  useEffect(() => {
    const ordered = getOrderedParticipantSlugs();
    if (ordered.length < 2) {
      setMatchResults([]);
      setCurrentWinner(ordered[0] || '');
      return;
    }
    const prev = matchResultsRef.current;
    const newResults = [];
    let winner = ordered[0];
    for (let i = 1; i < ordered.length; i++) {
      const p1 = winner;
      const p2 = ordered[i];
      const existing = prev.find(r => (r.participant1 === p1 && r.participant2 === p2) || (r.participant1 === p2 && r.participant2 === p1));
      newResults.push({
        match: i,
        participant1: p1,
        participant2: p2,
        winner: existing?.winner ?? '',
        method: existing?.method ?? '',
        time: existing?.time ?? ''
      });
      winner = (existing?.winner && (existing.winner === p1 || existing.winner === p2)) ? existing.winner : p1;
    }
    setMatchResults(newResults);
    setCurrentWinner(newResults.length ? (newResults[newResults.length - 1]?.winner || ordered[0]) : ordered[0]);
  }, [participants.join(','), entryOrder.join(',')]);

  // Update parent when participants or entry order change (send ordered list)
  useEffect(() => {
    const ordered = getOrderedParticipantSlugs();
    if (ordered.length > 0) {
      const valid = ordered.filter(p => p && p.trim() !== '');
      const participantString = valid.join(' → ');
      if (participantString !== value && participantString.trim() !== '') {
        onChange(participantString, 'Gauntlet Match');
      }
    }
  }, [participants, entryOrder, value]);

  // Update parent when results change — only when progression is complete (every match has winner + method)
  useEffect(() => {
    if (matchResults.length === 0) return;
    const allComplete = matchResults.every(r => r.winner && r.method);
    if (!allComplete) return;
    const finalWinner = matchResults[matchResults.length - 1]?.winner || currentWinner;
    if (finalWinner) {
      const ordered = getOrderedParticipantSlugs();
      const validParticipants = ordered.filter(p => p && p.trim() !== '');
      const resultData = {
        participants: validParticipants.join(' → '),
        winner: finalWinner,
        progression: matchResults.map(result => ({
          match: result.match,
          participant1: result.participant1,
          participant2: result.participant2,
          winner: result.winner,
          method: result.method,
          time: result.time
        }))
      };
      onResultChange(resultData);
    }
  }, [matchResults, currentWinner, participants, entryOrder]);

  const updateParticipant = (index, newParticipant) => {
    const newParticipants = [...participants];
    newParticipants[index] = newParticipant;
    setParticipants(newParticipants);
  };

  const updateEntryOrder = (index, num) => {
    const next = entryOrder.map((e, i) => {
      if (i === index) return num === '' || num === '—' ? null : Number(num);
      if (e === Number(num)) return null;
      return e;
    });
    setEntryOrder(next);
  };

  const updateMatchResult = (matchIndex, field, value) => {
    const newResults = [...matchResults];
    newResults[matchIndex] = { ...newResults[matchIndex], [field]: value };
    
    // Update current winner for next match
    if (field === 'winner' && value) {
      setCurrentWinner(value);
      // Update subsequent matches
      for (let i = matchIndex + 1; i < newResults.length; i++) {
        newResults[i] = {
          ...newResults[i],
          participant1: value
        };
      }
    }
    
    setMatchResults(newResults);
  };

  const getWrestlerName = (slug) => {
    const wrestler = safeWrestlers.find(w => w.id === slug);
    return wrestler ? wrestler.name : slug;
  };

  const getWrestlerImage = (slug) => {
    const wrestler = safeWrestlers.find(w => w.id === slug);
    return wrestler ? wrestler.image_url : null;
  };

  const addParticipant = () => {
    if (participants.length >= MAX_PARTICIPANTS) return;
    setParticipants([...participants, '']);
    setEntryOrder([...entryOrder, null]);
  };

  const removeParticipant = (index) => {
    if (participants.length <= MIN_PARTICIPANTS) return;
    setParticipants(participants.filter((_, i) => i !== index));
    setEntryOrder(entryOrder.filter((_, i) => i !== index));
  };

  return (
    <div style={bracketStyle}>
      <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
        Gauntlet Match Participants
      </div>
      <div style={{ color: '#888', fontSize: '12px', marginBottom: 12 }}>
        Add wrestlers below. Use <strong>Entry #</strong> to confirm order when known (e.g. after the match); leave as &quot;—&quot; for upcoming matches.
      </div>
      
      {/* Participant Selection */}
      <div style={{ marginBottom: '16px' }}>
        {participants.map((participant, index) => (
          <div key={index} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', minWidth: '60px' }}>#{index + 1}:</span>
            <WrestlerAutocomplete
              wrestlers={safeWrestlers}
              value={participant}
              onChange={(value) => updateParticipant(index, value)}
              placeholder={`Participant ${index + 1}`}
            />
            <span style={{ color: '#888', fontSize: '12px' }}>Entry #:</span>
            <select
              value={entryOrder[index] ?? '—'}
              onChange={(e) => updateEntryOrder(index, e.target.value)}
              style={{
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#222',
                color: '#fff',
                fontSize: '12px',
                minWidth: 52
              }}
            >
              <option value="—">—</option>
              {Array.from({ length: participants.length }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {participants.length > MIN_PARTICIPANTS && (
              <button
                type="button"
                onClick={() => removeParticipant(index)}
                style={{
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {participants.length < MAX_PARTICIPANTS && (
          <button
            type="button"
            onClick={addParticipant}
            style={{
              background: gold,
              color: '#232323',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            + Add Participant
          </button>
        )}
        <div style={{ color: '#888', fontSize: '12px', marginTop: 8 }}>
          Gauntlet supports {MIN_PARTICIPANTS}–{MAX_PARTICIPANTS} participants.
        </div>
      </div>

      {/* Match Progression: order follows Entry # when all set, else list order */}
      {participants.length >= 2 && (() => {
        const ordered = getOrderedParticipantSlugs();
        const hasAny = ordered.some(p => p && p.trim() !== '');
        if (!hasAny) return null;
        return (
        <div>
          <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
            Match Progression
          </div>
          {entryOrder.some(e => e == null) && (
            <div style={{ color: '#888', fontSize: '12px', marginBottom: 8 }}>
              Order is tentative (Entry # not set for all). Set Entry # above to confirm who enters when.
            </div>
          )}
          
          {/* First participant (starts the gauntlet) */}
          <div style={matchRowStyle}>
            <div style={wrestlerCardStyle}>
              <WrestlerHeadshotImage
                src={getWrestlerImage(ordered[0]) || null}
                alt={getWrestlerName(ordered[0])}
                width={24}
                height={24}
                sizes="24px"
                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span>{getWrestlerName(ordered[0])}</span>
            </div>
            <span style={arrowStyle}>→</span>
            <span style={{ color: '#888', fontSize: '12px' }}>Starts the gauntlet</span>
          </div>

          {/* Individual matches */}
          {matchResults.map((result, index) => (
            <div key={index} style={matchRowStyle}>
              <div style={result.winner === result.participant1 ? winnerStyle : wrestlerCardStyle}>
                <WrestlerHeadshotImage
                  src={getWrestlerImage(result.participant1) || null}
                  alt={getWrestlerName(result.participant1)}
                  width={24}
                  height={24}
                  sizes="24px"
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span>{getWrestlerName(result.participant1)}</span>
              </div>
              
              <span style={{ color: '#fff', fontSize: '14px' }}>vs</span>
              
              <div style={result.winner === result.participant2 ? winnerStyle : wrestlerCardStyle}>
                <WrestlerHeadshotImage
                  src={getWrestlerImage(result.participant2) || null}
                  alt={getWrestlerName(result.participant2)}
                  width={24}
                  height={24}
                  sizes="24px"
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span>{getWrestlerName(result.participant2)}</span>
              </div>

              <span style={arrowStyle}>→</span>

              {/* Match result controls */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <select
                  value={result.winner}
                  onChange={(e) => updateMatchResult(index, 'winner', e.target.value)}
                  style={{ 
                    padding: '4px 6px', 
                    borderRadius: '3px', 
                    border: '1px solid #444', 
                    background: '#222', 
                    color: '#fff', 
                    fontSize: '12px',
                    width: '110px', 
                    marginBottom: '0' 
                  }}
                >
                  <option value="">Select winner</option>
                  <option value={result.participant1}>{getWrestlerName(result.participant1)}</option>
                  <option value={result.participant2}>{getWrestlerName(result.participant2)}</option>
                </select>
                
                <select
                  value={result.method}
                  onChange={(e) => updateMatchResult(index, 'method', e.target.value)}
                  style={{ 
                    padding: '4px 6px', 
                    borderRadius: '3px', 
                    border: '1px solid #444', 
                    background: '#222', 
                    color: '#fff', 
                    fontSize: '12px',
                    width: '90px', 
                    marginBottom: '0' 
                  }}
                >
                  <option value="">Method</option>
                  <option value="Pinfall">Pinfall</option>
                  <option value="Submission">Submission</option>
                  <option value="DQ">DQ</option>
                  <option value="Count out">Count out</option>
                </select>
                
                <input
                  type="text"
                  value={result.time}
                  onChange={(e) => updateMatchResult(index, 'time', e.target.value)}
                  placeholder="Time"
                  style={{ 
                    padding: '4px 6px', 
                    borderRadius: '3px', 
                    border: '1px solid #444', 
                    background: '#222', 
                    color: '#fff', 
                    fontSize: '12px',
                    width: '70px', 
                    marginBottom: '0' 
                  }}
                />
              </div>

              {result.winner && (
                <div style={resultStyle}>
                  {getWrestlerName(result.winner)} wins
                </div>
              )}
            </div>
          ))}

          {/* Final winner display */}
          {matchResults.length > 0 && matchResults[matchResults.length - 1]?.winner && (
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: '#3a3a3a', 
              borderRadius: '4px', 
              border: `2px solid ${gold}`,
              textAlign: 'center'
            }}>
              <div style={{ color: gold, fontWeight: 'bold', fontSize: '16px' }}>
                🏆 Final Winner: {getWrestlerName(matchResults[matchResults.length - 1].winner)} 🏆
              </div>
            </div>
          )}
        </div>
        ); })()}
    </div>
  );
} 