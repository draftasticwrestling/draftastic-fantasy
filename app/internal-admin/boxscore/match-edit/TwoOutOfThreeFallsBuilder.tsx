// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import WrestlerAutocomplete from './WrestlerAutocomplete';

export default function TwoOutOfThreeFallsBuilder({ wrestlers = [], value, onChange, onResultChange }) {
  // Ensure wrestlers is always an array
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  const [participants, setParticipants] = useState(['', '']); // 2 participants
  const [matchResults, setMatchResults] = useState([
    { winner: '', method: '', time: '' },
    { winner: '', method: '', time: '' },
    { winner: '', method: '', time: '' }
  ]); // Up to 3 falls
  const [currentWinner, setCurrentWinner] = useState(''); // Track who's winning the series

  // Parse initial value
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split(' vs ');
      if (parts.length === 2) {
        setParticipants([parts[0].trim(), parts[1].trim()]);
      }
    }
  }, [value]);

  // Update parent when participants change
  useEffect(() => {
    const validParticipants = participants.filter(p => p.trim());
    if (validParticipants.length === 2) {
      const participantString = validParticipants.join(' vs ');
      if (participantString !== value) {
        onChange(participantString, '2 out of 3 Falls');
      }
    }
  }, [participants, onChange, value]);

  // Update parent when results change
  useEffect(() => {
    const validResults = matchResults.filter(result => result.winner && result.method);
    if (validResults.length > 0) {
      // Format results as "Winner1 def. Loser1 (Method1) → Winner2 def. Loser2 (Method2) → ..."
      const resultStrings = validResults.map(result => {
        const winner = result.winner;
        const loser = participants.find(p => p !== winner) || '';
        return `${winner} def. ${loser} (${result.method})`;
      });
      
      const progressionString = resultStrings.join(' → ');
      const finalWinner = currentWinner || (validResults.length > 0 ? validResults[validResults.length - 1].winner : '');
      
      onResultChange({
        gauntletProgression: progressionString,
        winner: finalWinner,
        method: validResults.length > 0 ? validResults[validResults.length - 1].method : '',
        time: validResults.length > 0 ? validResults[validResults.length - 1].time : ''
      });
    }
  }, [matchResults, currentWinner, participants, onResultChange]);

  const updateParticipant = (index, value) => {
    const newParticipants = [...participants];
    newParticipants[index] = value;
    setParticipants(newParticipants);
  };

  const updateMatchResult = (fallIndex, field, value) => {
    const newResults = [...matchResults];
    newResults[fallIndex] = { ...newResults[fallIndex], [field]: value };
    setMatchResults(newResults);

    // Update current winner based on who has more wins
    if (field === 'winner' && value) {
      const participant1Wins = newResults.filter(result => result.winner === participants[0]).length;
      const participant2Wins = newResults.filter(result => result.winner === participants[1]).length;
      
      if (participant1Wins > participant2Wins) {
        setCurrentWinner(participants[0]);
      } else if (participant2Wins > participant1Wins) {
        setCurrentWinner(participants[1]);
      } else {
        setCurrentWinner(''); // Tie
      }
    }
  };

  const getWinnerOptions = () => {
    return participants.filter(p => p.trim());
  };

  const getMethodOptions = () => [
    "Pinfall",
    "Submission", 
    "DQ",
    "Count out",
    "No Contest"
  ];

  const getCurrentScore = () => {
    const participant1Wins = matchResults.filter(result => result.winner === participants[0]).length;
    const participant2Wins = matchResults.filter(result => result.winner === participants[1]).length;
    return { participant1Wins, participant2Wins };
  };

  const isMatchComplete = () => {
    const { participant1Wins, participant2Wins } = getCurrentScore();
    return participant1Wins === 2 || participant2Wins === 2;
  };

  const getNextFallNumber = () => {
    const validResults = matchResults.filter(result => result.winner && result.method);
    return validResults.length + 1;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#C6A04F', fontWeight: 600, marginBottom: 8, display: 'block' }}>
          Participants:
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>
              Participant 1:
            </label>
            <WrestlerAutocomplete
              wrestlers={safeWrestlers}
              value={participants[0]}
              onChange={value => updateParticipant(0, value)}
              placeholder="Select wrestler..."
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>
              Participant 2:
            </label>
            <WrestlerAutocomplete
              wrestlers={safeWrestlers}
              value={participants[1]}
              onChange={value => updateParticipant(1, value)}
              placeholder="Select wrestler..."
            />
          </div>
        </div>
      </div>

      {/* Score Display */}
      {participants[0] && participants[1] && (
        <div style={{ 
          background: '#2a2a2a', 
          padding: 12, 
          borderRadius: 8, 
          marginBottom: 16,
          border: '1px solid #444'
        }}>
          <div style={{ color: '#C6A04F', fontWeight: 700, fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
            Current Score
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 12 }}>{participants[0]}</div>
              <div style={{ 
                color: '#C6A04F', 
                fontSize: 24, 
                fontWeight: 'bold',
                border: currentWinner === participants[0] ? '2px solid #C6A04F' : '2px solid transparent',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '8px auto'
              }}>
                {getCurrentScore().participant1Wins}
              </div>
            </div>
            <div style={{ color: '#C6A04F', fontSize: 18, fontWeight: 'bold' }}>vs</div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 12 }}>{participants[1]}</div>
              <div style={{ 
                color: '#C6A04F', 
                fontSize: 24, 
                fontWeight: 'bold',
                border: currentWinner === participants[1] ? '2px solid #C6A04F' : '2px solid transparent',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '8px auto'
              }}>
                {getCurrentScore().participant2Wins}
              </div>
            </div>
          </div>
          {isMatchComplete() && (
            <div style={{ 
              color: '#4CAF50', 
              fontSize: 14, 
              fontWeight: 'bold', 
              textAlign: 'center', 
              marginTop: 8 
            }}>
              Match Complete! {currentWinner} wins 2-{getCurrentScore().participant1Wins === 2 ? getCurrentScore().participant2Wins : getCurrentScore().participant1Wins}
            </div>
          )}
        </div>
      )}

      {/* Falls Recording */}
      {participants[0] && participants[1] && !isMatchComplete() && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#C6A04F', fontWeight: 600, marginBottom: 8, display: 'block' }}>
            Record Fall {getNextFallNumber()}:
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>
                Winner:
              </label>
              <select
                value={matchResults[getNextFallNumber() - 1]?.winner || ''}
                onChange={e => updateMatchResult(getNextFallNumber() - 1, 'winner', e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#222',
                  color: '#fff'
                }}
              >
                <option value="">Select winner...</option>
                {getWinnerOptions().map(participant => (
                  <option key={participant} value={participant}>{participant}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>
                Method:
              </label>
              <select
                value={matchResults[getNextFallNumber() - 1]?.method || ''}
                onChange={e => updateMatchResult(getNextFallNumber() - 1, 'method', e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#222',
                  color: '#fff'
                }}
              >
                <option value="">Select method...</option>
                {getMethodOptions().map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>
                Time:
              </label>
              <input
                type="text"
                value={matchResults[getNextFallNumber() - 1]?.time || ''}
                onChange={e => updateMatchResult(getNextFallNumber() - 1, 'time', e.target.value)}
                placeholder="e.g. 12:34"
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#222',
                  color: '#fff'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Falls History */}
      {matchResults.filter(result => result.winner && result.method).length > 0 && (
        <div style={{ 
          background: '#1a1a1a', 
          padding: 12, 
          borderRadius: 8, 
          border: '1px solid #444' 
        }}>
          <div style={{ color: '#C6A04F', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Falls History:
          </div>
          {matchResults
            .filter(result => result.winner && result.method)
            .map((result, index) => (
              <div key={index} style={{ 
                color: '#fff', 
                fontSize: 13, 
                marginBottom: 4,
                padding: 4,
                background: '#2a2a2a',
                borderRadius: 4
              }}>
                Fall {index + 1}: {result.winner} def. {participants.find(p => p !== result.winner)} ({result.method})
                {result.time && ` - ${result.time}`}
              </div>
            ))}
        </div>
      )}
    </div>
  );
} 