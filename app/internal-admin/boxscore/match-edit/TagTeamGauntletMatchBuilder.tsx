// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import WrestlerAutocomplete from './WrestlerAutocomplete';
import { createClient } from '@/lib/supabase/client';

const gold = '#C6A04F';
const suggestionStyle = {
  padding: '4px 8px',
  borderRadius: '4px',
  background: '#2a2a2a',
  border: '1px solid #444',
  cursor: 'pointer',
  marginBottom: '4px',
  fontSize: '10px',
};
const suggestionHoverStyle = { ...suggestionStyle, borderColor: gold, background: '#333' };
const dismissButtonStyle = { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 4px', fontSize: '14px' };
const dismissButtonHoverStyle = { ...dismissButtonStyle, color: '#fff' };
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

const arrowStyle = { color: gold, fontSize: '18px', fontWeight: 'bold', margin: '0 8px' };
const resultStyle = { color: '#C6A04F', fontSize: '12px', fontWeight: 'bold', marginLeft: '8px' };

function teamToString(members) {
  return Array.isArray(members) ? members.filter(Boolean).join(' & ') : '';
}

function parseTeam(part) {
  const trimmed = (part || '').trim();
  if (!trimmed) return ['', ''];
  const members = trimmed.split('&').map(m => m.trim()).filter(Boolean);
  return [members[0] || '', members[1] || ''];
}

export default function TagTeamGauntletMatchBuilder({
  wrestlers = [],
  value,
  onChange,
  onResultChange,
  initialProgression = null,
}) {
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  const MIN_TEAMS = 4;
  const MAX_TEAMS = 10;

  const [teams, setTeams] = useState([]); // array of [member1, member2]
  const [matchResults, setMatchResults] = useState([]);
  const [currentWinner, setCurrentWinner] = useState(''); // team string "slug1 & slug2"
  const [tagTeamData, setTagTeamData] = useState({});
  const [tagTeamSuggestions, setTagTeamSuggestions] = useState({});
  const [teamNames, setTeamNames] = useState({}); // teamIndex -> display name
  const [hoveredSuggestion, setHoveredSuggestion] = useState(null);
  const [hoveredDismissButton, setHoveredDismissButton] = useState(null);

  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split(' → ').map(p => p.trim()).filter(Boolean);
      const parsed = parts.map(parseTeam);
      const clamped =
        parsed.length === 0
          ? Array(MIN_TEAMS).fill(null).map(() => ['', ''])
          : parsed.length < MIN_TEAMS
            ? [...parsed, ...Array(MIN_TEAMS - parsed.length).fill(null).map(() => ['', ''])]
            : parsed.slice(0, MAX_TEAMS);
      setTeams(clamped);

      const expectedResultsLength = clamped.length >= 2 ? clamped.length - 1 : 0;
      const hasValidProgression =
        Array.isArray(initialProgression) &&
        initialProgression.length === expectedResultsLength &&
        initialProgression.every((p) => p && (p.participant1 != null || p.participant2 != null));

      if (hasValidProgression) {
        const results = initialProgression.map((p, i) => ({
          match: (p.match ?? p.order ?? i + 1),
          participant1: p.participant1 ?? teamToString(clamped[i]),
          participant2: p.participant2 ?? teamToString(clamped[i + 1]),
          winner: p.winner ?? '',
          method: p.method ?? '',
          time: p.time ?? '',
        }));
        setMatchResults(results);
        const lastWinner = initialProgression[initialProgression.length - 1]?.winner;
        setCurrentWinner(lastWinner ?? teamToString(clamped[0]));
      } else {
        const results = [];
        let winner = teamToString(clamped[0]);
        for (let i = 1; i < clamped.length; i++) {
          results.push({
            match: i,
            participant1: winner,
            participant2: teamToString(clamped[i]),
            winner: '',
            method: '',
            time: '',
          });
        }
        setMatchResults(results);
        setCurrentWinner(teamToString(clamped[0]));
      }
    } else {
      setTeams(Array(MIN_TEAMS).fill(null).map(() => ['', '']));
      setMatchResults([]);
      setCurrentWinner('');
    }
  }, [value, initialProgression]);

  useEffect(() => {
    fetchTagTeamData();
  }, []);

  // When tag team data or teams change, fill team names for any team that matches a known tag team
  useEffect(() => {
    if (!tagTeamData || Object.keys(tagTeamData).length === 0 || !teams.length) return;
    const next = { ...teamNames };
    let changed = false;
    teams.forEach((t, i) => {
      const pair = [t[0], t[1]].filter((s) => s && s.trim());
      if (pair.length === 2) {
        const tagTeam = getTagTeamForWrestlers(pair);
        if (tagTeam && next[i] !== tagTeam.name) {
          next[i] = tagTeam.name;
          changed = true;
        }
      }
    });
    if (changed) setTeamNames(next);
  }, [tagTeamData, teams.map((t) => t.join('&')).join('|')]);

  async function fetchTagTeamData() {
    try {
      const supabase = createClient();
      const { data: tagTeams, error } = await supabase.from('tag_teams').select('*');
      if (error) return;
      const { data: tagTeamMembers, error: membersError } = await supabase.from('tag_team_members').select('*');
      if (membersError) return;
      const { data: wrestlersFromDb, error: wrestlersError } = await supabase.from('wrestlers').select('id, name, gender, brand');
      if (wrestlersError) return;
      const teamData = {};
      (tagTeams || []).forEach((team) => {
        const teamMembers = (tagTeamMembers || [])
          .filter((m) => m.tag_team_id === team.id)
          .sort((a, b) => (a.member_order || 0) - (b.member_order || 0))
          .map((member) => {
            const w = (wrestlersFromDb || []).find((r) => r.id === member.wrestler_slug);
            return {
              ...member,
              wrestler_name: w?.name || member.wrestler_slug,
              wrestler_gender: w?.gender || 'male',
            };
          });
        teamData[team.id] = { ...team, members: teamMembers };
      });
      setTagTeamData(teamData);
    } catch (err) {
      console.error('Tag team data fetch error:', err);
    }
  }

  function getTagTeamSuggestions(wrestlerSlug) {
    if (!wrestlerSlug || !tagTeamData || Object.keys(tagTeamData).length === 0) return [];
    const suggestions = [];
    Object.values(tagTeamData).forEach((team) => {
      const isMember = Array.isArray(team.members) && team.members.some((m) => m.wrestler_slug === wrestlerSlug);
      if (!isMember) return;
      const otherMembers = (team.members || []).filter((m) => m.wrestler_slug !== wrestlerSlug);
      if (team.id === 'judgment-day') {
        otherMembers.forEach((member) => {
          const genderLabel = (member.wrestler_gender === 'male' || member.wrestler_gender === 'Male') ? 'Male' : 'Female';
          suggestions.push({
            teamName: team.name,
            teamId: team.id,
            members: [member.wrestler_slug],
            description: `${member.wrestler_name || member.wrestler_slug} (${genderLabel})`,
          });
        });
        const selectedWrestler = team.members.find((m) => m.wrestler_slug === wrestlerSlug);
        const maleMembers = otherMembers.filter((m) => m.wrestler_gender === 'male' || m.wrestler_gender === 'Male');
        const femaleMembers = otherMembers.filter((m) => m.wrestler_gender === 'female' || m.wrestler_gender === 'Female');
        if (selectedWrestler && (selectedWrestler.wrestler_gender === 'male' || selectedWrestler.wrestler_gender === 'Male') && maleMembers.length > 0) {
          suggestions.push({ teamName: `${team.name} (Male)`, teamId: team.id, members: maleMembers.map((m) => m.wrestler_slug).slice(0, 1), description: 'Male tag team' });
        } else if (selectedWrestler && (selectedWrestler.wrestler_gender === 'female' || selectedWrestler.wrestler_gender === 'Female') && femaleMembers.length > 0) {
          suggestions.push({ teamName: `${team.name} (Female)`, teamId: team.id, members: femaleMembers.map((m) => m.wrestler_slug).slice(0, 1), description: 'Female tag team' });
        }
      } else if (team.members.length === 2) {
        suggestions.push({ teamName: team.name, teamId: team.id, members: otherMembers.map((m) => m.wrestler_slug), description: 'Tag team partner' });
      } else if (team.members.length === 3) {
        if (otherMembers[0]) {
          suggestions.push({ teamName: team.name, teamId: team.id, members: [otherMembers[0].wrestler_slug], description: 'Primary partner' });
        }
        suggestions.push({ teamName: `${team.name} (Complete)`, teamId: team.id, members: otherMembers.map((m) => m.wrestler_slug), description: 'Complete team' });
      } else {
        otherMembers.forEach((member) => {
          suggestions.push({
            teamName: team.name,
            teamId: team.id,
            members: [member.wrestler_slug],
            description: member.wrestler_name || member.wrestler_slug,
          });
        });
      }
    });
    return suggestions;
  }

  function getTagTeamForWrestlers(slugs) {
    const sorted = [...slugs].filter(Boolean).sort();
    for (const team of Object.values(tagTeamData)) {
      const teamSlugs = (team.members || []).map((m) => m.wrestler_slug).sort();
      if (JSON.stringify(sorted) === JSON.stringify(teamSlugs)) return team;
    }
    return null;
  }

  useEffect(() => {
    if (teams.length > 0) {
      const validTeams = teams.filter((t) => t[0]?.trim() || t[1]?.trim());
      const participantString = validTeams.map((t) => teamToString(t)).filter(Boolean).join(' → ');
      if (participantString !== value && participantString.trim() !== '') {
        onChange(participantString, 'Tag Team Gauntlet Match');
      }
    }
  }, [teams, value]);

  useEffect(() => {
    if (matchResults.length === 0) return;
    const allComplete = matchResults.every((r) => r.winner && r.method);
    if (!allComplete) return;
    const finalWinner = matchResults[matchResults.length - 1]?.winner || currentWinner;
    if (finalWinner) {
      const validTeams = teams.filter((t) => t[0]?.trim() || t[1]?.trim());
      const resultData = {
        participants: validTeams.map((t) => teamToString(t)).join(' → '),
        winner: finalWinner,
        progression: matchResults.map((r) => ({
          match: r.match,
          participant1: r.participant1,
          participant2: r.participant2,
          winner: r.winner,
          method: r.method,
          time: r.time,
        })),
      };
      onResultChange(resultData);
    }
  }, [matchResults, currentWinner, teams]);

  const updateTeam = (index, memberIndex, slug) => {
    const newTeams = teams.map((t, i) =>
      i === index ? [memberIndex === 0 ? slug : t[0], memberIndex === 1 ? slug : t[1]] : [...t]
    );
    setTeams(newTeams);
    if (slug && slug.trim()) {
      const suggestions = getTagTeamSuggestions(slug.trim());
      if (suggestions.length > 0) {
        setTagTeamSuggestions((prev) => ({ ...prev, [`${index}-${memberIndex}`]: suggestions }));
      }
    }
    const pair = [newTeams[index][0], newTeams[index][1]].filter((s) => s && s.trim());
    if (pair.length === 2) {
      const tagTeam = getTagTeamForWrestlers(pair);
      if (tagTeam) {
        setTeamNames((prev) => ({ ...prev, [index]: tagTeam.name }));
      }
    }
    const results = [];
    let winner = teamToString(newTeams[0]);
    for (let i = 1; i < newTeams.length; i++) {
      results.push({
        match: i,
        participant1: winner,
        participant2: teamToString(newTeams[i]),
        winner: '',
        method: '',
        time: '',
      });
    }
    setMatchResults(results);
    setCurrentWinner(teamToString(newTeams[0]));
  };

  const applyPartnerSuggestion = (teamIndex, memberIndex, suggestion) => {
    const otherIndex = memberIndex === 0 ? 1 : 0;
    const partnerSlug = Array.isArray(suggestion.members) && suggestion.members[0] ? suggestion.members[0] : '';
    const newTeams = teams.map((t, i) => {
      if (i !== teamIndex) return [...t];
      const next = [...t];
      next[otherIndex] = partnerSlug;
      if (suggestion.members && suggestion.members.length >= 2) {
        next[0] = suggestion.members[0] || t[0];
        next[1] = suggestion.members[1] || t[1];
      }
      return next;
    });
    setTeams(newTeams);
    setTeamNames((prev) => ({ ...prev, [teamIndex]: suggestion.teamName || prev[teamIndex] }));
    setTagTeamSuggestions((prev) => {
      const next = { ...prev };
      delete next[`${teamIndex}-${memberIndex}`];
      return next;
    });
    const results = [];
    let winner = teamToString(newTeams[0]);
    for (let i = 1; i < newTeams.length; i++) {
      results.push({
        match: i,
        participant1: winner,
        participant2: teamToString(newTeams[i]),
        winner: '',
        method: '',
        time: '',
      });
    }
    setMatchResults(results);
    setCurrentWinner(teamToString(newTeams[0]));
  };

  const dismissSuggestions = (teamIndex, memberIndex) => {
    setTagTeamSuggestions((prev) => {
      const next = { ...prev };
      delete next[`${teamIndex}-${memberIndex}`];
      return next;
    });
  };

  const updateMatchResult = (matchIndex, field, value) => {
    const newResults = [...matchResults];
    newResults[matchIndex] = { ...newResults[matchIndex], [field]: value };
    if (field === 'winner' && value) {
      setCurrentWinner(value);
      for (let i = matchIndex + 1; i < newResults.length; i++) {
        newResults[i] = { ...newResults[i], participant1: value };
      }
    }
    setMatchResults(newResults);
  };

  const addTeam = () => {
    if (teams.length >= MAX_TEAMS) return;
    setTeams([...teams, ['', '']]);
  };

  const removeTeam = (index) => {
    if (teams.length <= MIN_TEAMS) return;
    const newTeams = teams.filter((_, i) => i !== index);
    setTeams(newTeams);
    const results = [];
    let winner = teamToString(newTeams[0]);
    for (let i = 1; i < newTeams.length; i++) {
      results.push({
        match: i,
        participant1: winner,
        participant2: teamToString(newTeams[i]),
        winner: '',
        method: '',
        time: '',
      });
    }
    setMatchResults(results);
    setCurrentWinner(teamToString(newTeams[0]));
  };

  const getWrestlerName = (slug) => safeWrestlers.find((w) => w.id === slug)?.name || slug;
  const getWrestlerImage = (slug) => safeWrestlers.find((w) => w.id === slug)?.image_url || null;
  const getTeamDisplay = (teamStr) => {
    if (!teamStr) return '';
    const [a, b] = teamStr.split('&').map((s) => s.trim());
    const na = getWrestlerName(a);
    const nb = getWrestlerName(b);
    return b ? `${na} & ${nb}` : na;
  };

  return (
    <div style={bracketStyle}>
      <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>
        Tag Team Gauntlet – Teams (entry order)
      </div>

      <div style={{ marginBottom: '16px' }}>
        {teams.map((team, index) => (
          <div key={index} style={{ marginBottom: '16px', padding: '12px', background: '#222', borderRadius: '8px', border: '1px solid #444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ color: '#fff', minWidth: '50px' }}>#{index + 1}:</span>
              {teamNames[index] && (
                <span style={{ color: gold, fontSize: '12px', fontWeight: 600 }}>{teamNames[index]}</span>
              )}
              {teams.length > MIN_TEAMS && (
                <button
                  type="button"
                  onClick={() => removeTeam(index)}
                  style={{ marginLeft: 'auto', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Remove
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <WrestlerAutocomplete
                  wrestlers={safeWrestlers}
                  value={team[0]}
                  onChange={(v) => updateTeam(index, 0, v)}
                  placeholder="Member 1"
                />
                {team[0] && team[0].trim() && tagTeamSuggestions[`${index}-0`] && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ color: gold, fontSize: '10px', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Partners:</span>
                      <button
                        type="button"
                        onClick={() => dismissSuggestions(index, 0)}
                        style={hoveredDismissButton === `${index}-0` ? dismissButtonHoverStyle : dismissButtonStyle}
                        onMouseEnter={() => setHoveredDismissButton(`${index}-0`)}
                        onMouseLeave={() => setHoveredDismissButton(null)}
                        title="Dismiss partner suggestions"
                      >
                        ×
                      </button>
                    </div>
                    {(tagTeamSuggestions[`${index}-0`] || []).map((suggestion, idx) => {
                      const key = `${index}-0-${idx}`;
                      const isHovered = hoveredSuggestion === key;
                      return (
                        <div
                          key={idx}
                          style={isHovered ? suggestionHoverStyle : suggestionStyle}
                          onClick={() => applyPartnerSuggestion(index, 0, suggestion)}
                          onMouseEnter={() => setHoveredSuggestion(key)}
                          onMouseLeave={() => setHoveredSuggestion(null)}
                          title={`Click to add ${suggestion.teamName}`}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{suggestion.teamName}</div>
                          <div style={{ fontSize: '9px', color: '#bbb' }}>
                            {(suggestion.members || []).map((slug) => getWrestlerName(slug)).join(', ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <span style={{ color: '#888', alignSelf: 'center' }}>&</span>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <WrestlerAutocomplete
                  wrestlers={safeWrestlers}
                  value={team[1]}
                  onChange={(v) => updateTeam(index, 1, v)}
                  placeholder="Member 2"
                />
                {team[1] && team[1].trim() && tagTeamSuggestions[`${index}-1`] && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ color: gold, fontSize: '10px', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Partners:</span>
                      <button
                        type="button"
                        onClick={() => dismissSuggestions(index, 1)}
                        style={hoveredDismissButton === `${index}-1` ? dismissButtonHoverStyle : dismissButtonStyle}
                        onMouseEnter={() => setHoveredDismissButton(`${index}-1`)}
                        onMouseLeave={() => setHoveredDismissButton(null)}
                        title="Dismiss partner suggestions"
                      >
                        ×
                      </button>
                    </div>
                    {(tagTeamSuggestions[`${index}-1`] || []).map((suggestion, idx) => {
                      const key = `${index}-1-${idx}`;
                      const isHovered = hoveredSuggestion === key;
                      return (
                        <div
                          key={idx}
                          style={isHovered ? suggestionHoverStyle : suggestionStyle}
                          onClick={() => applyPartnerSuggestion(index, 1, suggestion)}
                          onMouseEnter={() => setHoveredSuggestion(key)}
                          onMouseLeave={() => setHoveredSuggestion(null)}
                          title={`Click to add ${suggestion.teamName}`}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{suggestion.teamName}</div>
                          <div style={{ fontSize: '9px', color: '#bbb' }}>
                            {(suggestion.members || []).map((slug) => getWrestlerName(slug)).join(', ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {teams.length < MAX_TEAMS && (
          <button
            type="button"
            onClick={addTeam}
            style={{ background: gold, color: '#232323', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add Team
          </button>
        )}
        <div style={{ color: '#888', fontSize: '12px', marginTop: 8 }}>
          Tag Team Gauntlet supports {MIN_TEAMS}–{MAX_TEAMS} teams.
        </div>
      </div>

      {teams.length >= 2 && (
        <div>
          <div style={{ color: gold, fontWeight: 'bold', marginBottom: '12px' }}>Match Progression</div>
          <div style={matchRowStyle}>
            <div style={wrestlerCardStyle}>
              <span>{getTeamDisplay(teamToString(teams[0])) || 'Team 1'}</span>
            </div>
            <span style={arrowStyle}>→</span>
            <span style={{ color: '#888', fontSize: '12px' }}>Starts the gauntlet</span>
          </div>

          {matchResults.map((result, index) => (
            <div key={index} style={matchRowStyle}>
              <div style={result.winner === result.participant1 ? winnerStyle : wrestlerCardStyle}>
                <span>{getTeamDisplay(result.participant1) || '—'}</span>
              </div>
              <span style={{ color: '#fff', fontSize: '14px' }}>vs</span>
              <div style={result.winner === result.participant2 ? winnerStyle : wrestlerCardStyle}>
                <span>{getTeamDisplay(result.participant2) || '—'}</span>
              </div>
              <span style={arrowStyle}>→</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <select
                  value={result.winner}
                  onChange={(e) => updateMatchResult(index, 'winner', e.target.value)}
                  style={{ padding: '4px 6px', borderRadius: '3px', border: '1px solid #444', background: '#222', color: '#fff', fontSize: '12px', width: '140px', marginBottom: 0 }}
                >
                  <option value="">Select winner</option>
                  <option value={result.participant1}>{getTeamDisplay(result.participant1)}</option>
                  <option value={result.participant2}>{getTeamDisplay(result.participant2)}</option>
                </select>
                <select
                  value={result.method}
                  onChange={(e) => updateMatchResult(index, 'method', e.target.value)}
                  style={{ padding: '4px 6px', borderRadius: '3px', border: '1px solid #444', background: '#222', color: '#fff', fontSize: '12px', width: '90px', marginBottom: 0 }}
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
                  style={{ padding: '4px 6px', borderRadius: '3px', border: '1px solid #444', background: '#222', color: '#fff', fontSize: '12px', width: '70px', marginBottom: 0 }}
                />
              </div>
              {result.winner && <div style={resultStyle}>{getTeamDisplay(result.winner)} wins</div>}
            </div>
          ))}

          {matchResults.length > 0 && matchResults[matchResults.length - 1]?.winner && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#3a3a3a', borderRadius: '4px', border: `2px solid ${gold}`, textAlign: 'center' }}>
              <div style={{ color: gold, fontWeight: 'bold', fontSize: '16px' }}>
                🏆 Final Winner: {getTeamDisplay(matchResults[matchResults.length - 1].winner)} 🏆
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
