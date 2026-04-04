// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import WrestlerAutocomplete from './WrestlerAutocomplete';
import { createClient } from '@/lib/supabase/client';

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

const buttonStyle = {
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: '4px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '14px',
  marginRight: '8px',
  marginBottom: '8px',
};

const activeButtonStyle = {
  ...buttonStyle,
  background: gold,
  color: '#232323',
  borderColor: gold,
};

const actionButtonStyle = {
  background: gold,
  color: '#232323',
  border: '1px solid gold',
  borderRadius: '4px',
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
  marginRight: '8px',
  marginBottom: '8px',
};

const participantCardStyle = {
  background: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: '4px',
  padding: '6px',
  margin: '2px',
  minWidth: '120px',
  maxWidth: '130px',
  position: 'relative',
};

const vsStyle = {
  color: '#fff',
  fontSize: '14px',
  fontWeight: 'bold',
  textAlign: 'center',
  margin: '4px 2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const suggestionStyle = {
  background: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: '3px',
  padding: '4px',
  margin: '2px 0',
  cursor: 'pointer',
  fontSize: '10px',
  color: '#C6A04F',
  transition: 'all 0.2s ease',
};

const suggestionHoverStyle = {
  ...suggestionStyle,
  background: '#3a3a3a',
  borderColor: '#C6A04F',
};

const dismissButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: '8px',
  padding: '1px 3px',
  borderRadius: '2px',
  transition: 'all 0.2s ease',
};

const dismissButtonHoverStyle = {
  ...dismissButtonStyle,
  background: '#333',
  color: '#999',
};

export default function VisualMatchBuilder({ 
  wrestlers = [], 
  value, 
  onChange, 
  maxParticipants = 30,
  initialStructure = null,
  initialTagTeamData = null,
  isTitleMatch = false,
  defendingChampion = null,
  onDefendingChampionChange = null
}) {
  // Ensure wrestlers is always an array
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  // Note: For Gauntlet Matches, participants are displayed in order of entry
  // The first participant starts, then each subsequent participant enters after the previous match ends
  // The winner of the final match wins the entire Gauntlet Match
  const [matchStructure, setMatchStructure] = useState(() => {
    if (initialStructure) {
      return initialStructure;
    }
    return [{ type: 'individual', participants: [''] }];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredWrestlers, setFilteredWrestlers] = useState([]);
  const [tagTeamData, setTagTeamData] = useState({});
  const [tagTeamSuggestions, setTagTeamSuggestions] = useState({});
  const [hoveredSuggestion, setHoveredSuggestion] = useState(null);
  const [hoveredDismissButton, setHoveredDismissButton] = useState(null);
  const [isUpdatingFromInitialStructure, setIsUpdatingFromInitialStructure] = useState(false);

  // Handle initial structure on mount
  useEffect(() => {
    if (initialStructure) {
      setMatchStructure(initialStructure);
    } else if (value) {
      parseInitialValue(value);
    }
  }, []); // Only run on mount

  // Update structure when initialStructure prop changes
  useEffect(() => {
    if (initialStructure) {
      // Only reset if we're starting fresh (no wrestlers selected yet)
      const hasWrestlers = Array.isArray(matchStructure) && matchStructure.some(side => 
        Array.isArray(side.participants) && side.participants.some(participant => participant && participant.trim() !== '')
      );
      
      if (!hasWrestlers) {
        setIsUpdatingFromInitialStructure(true);
        setMatchStructure(initialStructure);
        // Reset the flag after the state update
        setTimeout(() => {
          setIsUpdatingFromInitialStructure(false);
        }, 50);
      }
    }
  }, [initialStructure]);

  // Tag team data: prefer server-passed map (service role); else anon client fetch (RLS permitting).
  useEffect(() => {
    if (initialTagTeamData && typeof initialTagTeamData === 'object' && Object.keys(initialTagTeamData).length > 0) {
      setTagTeamData(initialTagTeamData);
      return;
    }
    fetchTagTeamData();
  }, []);

  const fetchTagTeamData = async () => {
    try {
      const supabase = createClient();

      const { data: tagTeams, error } = await supabase
        .from('tag_teams')
        .select('*');
      
      if (error) {
        console.error('Error fetching tag teams:', error);
        return;
      }

      console.log('Tag teams fetched:', tagTeams);

      const { data: tagTeamMembers, error: membersError } = await supabase
        .from('tag_team_members')
        .select('*');
      
      if (membersError) {
        console.error('Error fetching tag team members:', membersError);
        return;
      }

      console.log('Tag team members fetched:', tagTeamMembers);

      // Fetch wrestler information including gender
      const { data: wrestlers, error: wrestlersError } = await supabase
        .from('wrestlers')
        .select('id, name, gender, brand');
      
      if (wrestlersError) {
        console.error('Error fetching wrestlers:', wrestlersError);
        return;
      }

      console.log('Wrestlers fetched:', wrestlers);

      // Build tag team data structure with enriched member data
      const teamData = {};
      tagTeams.forEach(team => {
        const teamMembers = tagTeamMembers
          .filter(member => member.tag_team_id === team.id)
          .sort((a, b) => a.member_order - b.member_order)
          .map(member => {
            const wrestler = wrestlers.find(w => w.id === member.wrestler_slug);
            return {
              ...member,
              wrestler_name: wrestler?.name || member.wrestler_slug,
              wrestler_gender: wrestler?.gender || 'male',
              wrestler_brand: wrestler?.brand || ''
            };
          });
        
        teamData[team.id] = {
          ...team,
          members: teamMembers
        };
      });

      console.log('Built tag team data structure with enriched members:', teamData);
      setTagTeamData(teamData);
    } catch (error) {
      console.error('Error fetching tag team data:', error);
    }
  };

  // Get tag team suggestions for a wrestler
  const getTagTeamSuggestions = (wrestlerSlug) => {
    console.log('getTagTeamSuggestions called for wrestler:', wrestlerSlug);
    console.log('tagTeamData available:', Object.keys(tagTeamData));
    
    if (!tagTeamData || Object.keys(tagTeamData).length === 0) {
      console.log('No tag team data available');
      return [];
    }

    // Always show tag team suggestions unless it's explicitly a Gauntlet Match
    const isGauntletMatch = Array.isArray(matchStructure) && matchStructure.length >= 5 && 
      matchStructure.every(side => side.type === 'individual' && side.participants.length === 1);
    
    if (isGauntletMatch) {
      console.log('Returning empty suggestions due to Gauntlet Match');
      return [];
    }
    
    const suggestions = [];
    
    Object.values(tagTeamData).forEach(team => {
      console.log(`Processing team ${team.id}:`, team);
      console.log(`Team members:`, team.members);
      
      const isMember = Array.isArray(team.members) && team.members.some(member => member.wrestler_slug === wrestlerSlug);
      
      if (isMember) {
        console.log(`Wrestler ${wrestlerSlug} is a member of team ${team.id}`);
        
        // Get other members as full member objects (not just slugs)
        const otherMemberObjects = team.members.filter(member => member.wrestler_slug !== wrestlerSlug);
        console.log('Other member objects:', otherMemberObjects);

        // Handle different team types with appropriate suggestions
        if (team.id === 'judgment-day') {
          console.log('Processing Judgment Day team...');
          const selectedWrestler = team.members.find(member => member.wrestler_slug === wrestlerSlug);
          console.log('Selected wrestler:', selectedWrestler);
          
          if (selectedWrestler) {
            console.log('Selected wrestler gender:', selectedWrestler.wrestler_gender);
            console.log('Other member objects before filtering:', otherMemberObjects);
            
            const maleMembers = otherMemberObjects.filter(member => {
              console.log(`Checking member ${member.wrestler_slug}:`, member);
              return member.wrestler_gender === 'male' || member.wrestler_gender === 'Male';
            });
            console.log('Male members after filtering:', maleMembers);
            
            const femaleMembers = otherMemberObjects.filter(member => {
              return member.wrestler_gender === 'female' || member.wrestler_gender === 'Female';
            });
            console.log('Female members after filtering:', femaleMembers);
            
            console.log('Suggestions array before pushing:', suggestions);
            
            // For Judgment Day, show all individual members as separate options
            otherMemberObjects.forEach((member, index) => {
              const genderLabel = (member.wrestler_gender === 'male' || member.wrestler_gender === 'Male') ? 'Male' : 'Female';
              suggestions.push({ 
                teamName: team.name, 
                teamId: team.id, 
                members: [member.wrestler_slug], 
                description: `${member.wrestler_name || member.wrestler_slug} (${genderLabel})` 
              });
            });
            
            // Also show gender-based groupings for convenience
            if ((selectedWrestler.wrestler_gender === 'male' || selectedWrestler.wrestler_gender === 'Male') && maleMembers.length > 0) {
              console.log('Adding male suggestion for male wrestler');
              const maleSlugs = maleMembers.map(m => m.wrestler_slug).slice(0, 1);
              suggestions.push({ teamName: `${team.name} (Male)`, teamId: team.id, members: maleSlugs, description: 'Male tag team combination' });
              console.log('Suggestions after male push:', suggestions);
            } else if ((selectedWrestler.wrestler_gender === 'female' || selectedWrestler.wrestler_gender === 'Female') && femaleMembers.length > 0) {
              console.log('Adding female suggestion for female wrestler');
              const femaleSlugs = femaleMembers.map(m => m.wrestler_slug).slice(0, 1);
              suggestions.push({ teamName: `${team.name} (Female)`, teamId: team.id, members: femaleSlugs, description: 'Female tag team combination' });
              console.log('Suggestions after female push:', suggestions);
            }
            
            const oppositeGenderMembers = (selectedWrestler.wrestler_gender === 'male' || selectedWrestler.wrestler_gender === 'Male') ? femaleMembers : maleMembers;
            console.log('Opposite gender members:', oppositeGenderMembers);
            
            if (oppositeGenderMembers.length > 0) {
              console.log('Adding mixed suggestion');
              const oppositeSlugs = oppositeGenderMembers.map(m => m.wrestler_slug).slice(0, 1);
              suggestions.push({ teamName: `${team.name} (Mixed)`, teamId: team.id, members: oppositeSlugs, description: 'Mixed gender combination' });
              console.log('Suggestions after mixed push:', suggestions);
            }
            
            console.log('Final suggestions for Judgment Day:', suggestions);
          }
        } else if (team.members.length === 2) {
          const otherSlugs = otherMemberObjects.map(m => m.wrestler_slug);
          suggestions.push({ teamName: team.name, teamId: team.id, members: otherSlugs, description: 'Tag team partner' });
        } else if (team.members.length === 3) {
          const primaryPartner = otherMemberObjects[0]?.wrestler_slug;
          if (primaryPartner) {
            suggestions.push({ teamName: team.name, teamId: team.id, members: [primaryPartner], description: 'Primary partner' });
          }
          const allOtherSlugs = otherMemberObjects.map(m => m.wrestler_slug);
          suggestions.push({ teamName: `${team.name} (Complete)`, teamId: team.id, members: allOtherSlugs, description: 'Complete 3-member team' });
        } else { // For larger teams (4+ members)
          // For large teams, show all individual members as separate options
          otherMemberObjects.forEach((member, index) => {
            suggestions.push({ 
              teamName: team.name, 
              teamId: team.id, 
              members: [member.wrestler_slug], 
              description: `${member.wrestler_name || member.wrestler_slug}` 
            });
          });
        }
      }
    });
    
    console.log('Final suggestions:', suggestions);
    return suggestions;
  };

  // Check if wrestlers form a complete tag team
  const getTagTeamForWrestlers = (wrestlerSlugs) => {
    const sortedSlugs = [...wrestlerSlugs].sort();
    
    for (const team of Object.values(tagTeamData)) {
      const teamMemberSlugs = team.members.map(m => m.wrestler_slug).sort();
      if (JSON.stringify(sortedSlugs) === JSON.stringify(teamMemberSlugs)) {
        return team;
      }
    }
    
    return null;
  };

  // Filter wrestlers based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredWrestlers(safeWrestlers.slice(0, 20));
    } else {
      const filtered = safeWrestlers
        .filter(w => 
          w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          w.id.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 10);
      setFilteredWrestlers(filtered);
    }
  }, [safeWrestlers, searchTerm]);

  // Parse the initial value from string format
  const parseInitialValue = (initialValue) => {
    if (!initialValue) {
      // Keep the initial participant when no value is provided
      setMatchStructure([{ type: 'individual', participants: [''] }]);
      return;
    }

    if (Array.isArray(initialValue)) {
      // Battle Royal format
      setMatchStructure([{ type: 'battle-royal', participants: initialValue }]);
    } else if (typeof initialValue === 'string' && initialValue.trim()) {
      // Check if it's a Gauntlet Match (contains arrows)
      if (initialValue.includes(' → ')) {
        // Gauntlet Match format: participant1 → participant2 → participant3
        const participants = initialValue.split(' → ').filter(s => s.trim()).map(s => s.trim());
        const structure = participants.map(participant => ({
          type: 'individual',
          participants: [participant]
        }));
        setMatchStructure(structure);
      } else {
        // Regular match format: side1 vs side2
        const sides = initialValue.split(' vs ').filter(s => s.trim());
        const structure = sides.map(side => {
          const teamMatch = side.match(/^([^(]+)\s*\(([^)]+)\)$/);
          if (teamMatch) {
            // Tag team with name
            const teamName = teamMatch[1].trim();
            const potentialSlugs = teamMatch[2].split('&').filter(s => s.trim()).map(s => s.trim());
            // Convert display names to slugs if needed
            const wrestlerSlugs = potentialSlugs.map(potentialSlug => {
              // If it's already a slug (exists in wrestlers by id), use it
              const foundById = safeWrestlers.find(w => w.id === potentialSlug || w.slug === potentialSlug);
              if (foundById) return foundById.id;
              // Otherwise, try to find by name
              const foundByName = safeWrestlers.find(w => w.name === potentialSlug);
              return foundByName ? foundByName.id : potentialSlug;
            });
            return { type: 'team', name: teamName, participants: wrestlerSlugs };
          } else {
            // Individual wrestlers
            const potentialSlugs = side.split('&').filter(s => s.trim()).map(s => s.trim());
            // Convert display names to slugs if needed
            const wrestlerSlugs = potentialSlugs.map(potentialSlug => {
              // If it's already a slug (exists in wrestlers by id), use it
              const foundById = safeWrestlers.find(w => w.id === potentialSlug || w.slug === potentialSlug);
              if (foundById) return foundById.id;
              // Otherwise, try to find by name
              const foundByName = safeWrestlers.find(w => w.name === potentialSlug);
              return foundByName ? foundByName.id : potentialSlug;
            });
            return { type: 'individual', participants: wrestlerSlugs };
          }
        });
        setMatchStructure(structure);
      }
    }
  };

  // Add a new opponent (new side)
  const addOpponent = () => {
    const newStructure = [...matchStructure, { type: 'individual', participants: [''] }];
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Add a teammate to the current side
  const addTeammate = (sideIndex) => {
    const newStructure = [...matchStructure];
    if (newStructure[sideIndex].type === 'individual') {
      newStructure[sideIndex] = { type: 'team', name: '', participants: newStructure[sideIndex].participants };
    }
    newStructure[sideIndex].participants.push('');
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Add teammate from suggestion
  const addTeammateFromSuggestion = (sideIndex, suggestion) => {
    const newStructure = [...matchStructure];
    
    // Convert to team if not already
    if (newStructure[sideIndex].type === 'individual') {
      newStructure[sideIndex] = { 
        type: 'team', 
        name: suggestion.teamName, 
        participants: newStructure[sideIndex].participants 
      };
    }
    
    // Get the current wrestler that was selected
    const currentWrestler = newStructure[sideIndex].participants.find(p => p && p.trim() !== '');
    
    // Create the complete team with current wrestler + suggested teammates
    const completeTeam = [currentWrestler, ...suggestion.members];
    
    // Replace the participants array with the complete team
    newStructure[sideIndex].participants = completeTeam;
    
    // Set team name
    newStructure[sideIndex].name = suggestion.teamName;
    
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
    
    // Clear suggestions after adding
    setTagTeamSuggestions(prev => {
      const newSuggestions = { ...prev };
      delete newSuggestions[`${sideIndex}-0`];
      return newSuggestions;
    });
  };

  // Remove a participant
  const removeParticipant = (sideIndex, participantIndex) => {
    const newStructure = [...matchStructure];
    newStructure[sideIndex].participants.splice(participantIndex, 1);
    
    // If no participants left, add an empty participant instead of removing the side
    if (newStructure[sideIndex].participants.length === 0) {
      newStructure[sideIndex].participants.push('');
    }
    // If only one participant left, convert back to individual
    else if (newStructure[sideIndex].participants.length === 1 && newStructure[sideIndex].type === 'team') {
      newStructure[sideIndex] = { type: 'individual', participants: newStructure[sideIndex].participants };
    }
    
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Update a participant
  const updateParticipant = (sideIndex, participantIndex, wrestlerSlug) => {
    console.log('=== UPDATE PARTICIPANT CALLED ===');
    console.log('updateParticipant called with:', { sideIndex, participantIndex, wrestlerSlug });
    console.log('Current matchStructure before update:', JSON.stringify(matchStructure, null, 2));
    
    const newStructure = [...matchStructure];
    newStructure[sideIndex].participants[participantIndex] = wrestlerSlug;
    
    console.log('New structure after update:', JSON.stringify(newStructure, null, 2));
    
    // Get tag team suggestions for this wrestler
    console.log('About to call getTagTeamSuggestions for:', wrestlerSlug);
    const suggestions = getTagTeamSuggestions(wrestlerSlug);
    console.log('Suggestions returned:', suggestions);
    if (suggestions.length > 0) {
      setTagTeamSuggestions(prev => ({
        ...prev,
        [`${sideIndex}-${participantIndex}`]: suggestions
      }));
    }
    
    // Check if the current side now forms a complete tag team
    const currentSide = newStructure[sideIndex];
    const validParticipants = currentSide.participants.filter(p => p && p.trim() !== '');
    
    if (validParticipants.length >= 2) {
      // Check if these wrestlers form a complete tag team
      const tagTeam = getTagTeamForWrestlers(validParticipants);
      if (tagTeam && !currentSide.name) {
        // Auto-fill the team name
        newStructure[sideIndex].name = tagTeam.name;
        newStructure[sideIndex].type = 'team';
        console.log('Auto-filled team name:', tagTeam.name);
      }
    }
    
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Update team name
  const updateTeamName = (sideIndex, teamName) => {
    const newStructure = [...matchStructure];
    newStructure[sideIndex].name = teamName;
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Convert to team
  const convertToTeam = (sideIndex) => {
    const newStructure = [...matchStructure];
    newStructure[sideIndex] = { 
      type: 'team', 
      name: '', 
      participants: newStructure[sideIndex].participants 
    };
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Convert to individual
  const convertToIndividual = (sideIndex) => {
    const newStructure = [...matchStructure];
    newStructure[sideIndex] = { 
      type: 'individual', 
      participants: newStructure[sideIndex].participants 
    };
    setMatchStructure(newStructure);
    updateParentValue(newStructure);
  };

  // Update parent component value
  const updateParentValue = (structure) => {
    // Prevent infinite loops
    if (isUpdatingFromInitialStructure) {
      console.log('Skipping updateParentValue due to isUpdatingFromInitialStructure flag');
      return;
    }
    
    // Determine match type based on structure
    const totalParticipants = Array.isArray(structure) ? structure.flatMap(side => side.participants).filter(Boolean).length : 0;
    const hasTeams = Array.isArray(structure) && structure.some(side => side.type === 'team');
    const isBattleRoyal = totalParticipants > 8 && !hasTeams; // Only treat as battle royal if no teams and more than 8 participants
    const isGauntletMatch = Array.isArray(structure) && structure.length >= 5 && structure.length <= 10 && structure.every(side => side.type === 'individual');
    const isTagTeamGauntletMatch = Array.isArray(structure) && structure.length >= 4 && structure.length <= 10 &&
      structure.every(side => side.type === 'team') &&
      structure.every(side => side.participants && side.participants.length === 2);
    
    console.log('updateParentValue called with structure:', structure);
    console.log('totalParticipants:', totalParticipants, 'isBattleRoyal:', isBattleRoyal, 'isGauntletMatch:', isGauntletMatch, 'isTagTeamGauntletMatch:', isTagTeamGauntletMatch);
    
    // Determine match type based on structure
    let matchType = 'Singles Match';
    const numSides = Array.isArray(structure) ? structure.length : 0;
    
    if (isBattleRoyal) {
      matchType = 'Battle Royal';
    } else if (isTagTeamGauntletMatch) {
      matchType = 'Tag Team Gauntlet Match';
    } else if (isGauntletMatch) {
      matchType = 'Gauntlet Match';
    } else if (numSides === 3) {
      // Check if it's 3-way tag team or triple threat
      const hasTeams = structure.some(side => side.type === 'team');
      matchType = hasTeams ? '3-way Tag Team' : 'Triple Threat match';
    } else if (numSides === 4) {
      // Check if it's 4-way tag team or fatal four-way
      const hasTeams = structure.some(side => side.type === 'team');
      matchType = hasTeams ? '4-way Tag Team' : 'Fatal Four-way match';
    } else if (numSides === 5) {
      // 5-team tag team
      const hasTeams = structure.some(side => side.type === 'team');
      const participantsPerSide = structure[0]?.participants?.length || 1;
      if (hasTeams && participantsPerSide === 2) {
        matchType = '5-team Tag Team';
      } else if (hasTeams && participantsPerSide > 2) {
        matchType = '6-person Tag Team';
      } else {
        matchType = 'Fatal Four-way match'; // 5 individuals -> treat as multi-way
      }
    } else if (numSides === 6) {
      // Check if it's 6-team tag team or other 6-person match
      const hasTeams = structure.some(side => side.type === 'team');
      const participantsPerSide = structure[0]?.participants?.length || 1;
      if (hasTeams && participantsPerSide === 2) {
        matchType = '6-team Tag Team';
      } else if (hasTeams && participantsPerSide > 2) {
        matchType = '6-person Tag Team';
      } else {
        matchType = 'Battle Royal'; // Default for 6 individual participants
      }
    } else if (numSides === 2) {
      // Check if it's tag team or singles
      const hasTeams = structure.some(side => side.type === 'team');
      const participantsPerSide = structure[0]?.participants?.length || 1;
      if (hasTeams) {
        if (participantsPerSide === 3) matchType = '6-person Tag Team';
        else if (participantsPerSide === 4) matchType = '8-person Tag Team';
        else if (participantsPerSide === 5) matchType = '10-man Tag Team';
        else matchType = 'Tag Team';
      } else {
        matchType = 'Singles Match';
      }
    }
    
    if (isBattleRoyal) {
      // Battle Royal: array of slugs
      const allParticipants = Array.isArray(structure) ? structure.flatMap(side => side.participants).filter(Boolean) : [];
      onChange(allParticipants, matchType);
    } else if (isTagTeamGauntletMatch) {
      // Tag Team Gauntlet: "a & b → c & d → ..." (each team 2 wrestlers)
      const teamStrings = structure.map(side => {
        const participants = (side.participants || []).filter(Boolean);
        return participants.length === 2 ? participants.join(' & ') : '';
      }).filter(Boolean);
      const participantsString = teamStrings.join(' → ');
      console.log('Tag Team Gauntlet Match - sending:', participantsString);
      onChange(participantsString, matchType);
    } else if (isGauntletMatch) {
      // Gauntlet Match: participants in order with arrows (5–10 individuals)
      const participants = structure.map(side => {
        const participant = side.participants.filter(Boolean)[0];
        return participant || '';
      }).filter(Boolean);
      
      const participantsString = participants.join(' → ');
      console.log('Gauntlet Match - sending:', participantsString);
      onChange(participantsString, matchType);
    } else {
      // Regular match: string format
      const sides = structure.map(side => {
        const participants = side.participants.filter(Boolean);
        if (participants.length === 0) return '';
        
        if (side.type === 'team' && side.name && side.name.trim()) {
          // Tag team with name: TeamName (wrestler1 & wrestler2)
          return `${side.name} (${participants.join(' & ')})`;
        } else {
          // Individual wrestlers or team without name
          return participants.join(' & ');
        }
      });
      
      console.log('Regular match - sides array:', sides);
      
      // Build the participants string for all sides
      const validSides = sides.filter(side => side && side.trim() !== '');
      let participantsString = '';
      
      if (validSides.length > 0) {
        participantsString = validSides.join(' vs ');
        console.log(`${validSides.length} sides - sending:`, participantsString);
      } else {
        // No wrestlers selected
        participantsString = '';
        console.log('No wrestlers - sending empty string');
      }
      
      onChange(participantsString, matchType);
    }
  };

  // Clear all participants
  const clearAll = () => {
    setMatchStructure([{ type: 'individual', participants: [''] }]);
    onChange('');
  };

  // Get wrestler name from slug
  const getWrestlerName = (slug) => {
    console.log('getWrestlerName called with slug:', slug);
    console.log('wrestlers array sample:', safeWrestlers.slice(0, 3));
    const wrestler = safeWrestlers.find(w => w.id === slug || w.slug === slug);
    console.log('Found wrestler:', wrestler);
    return wrestler ? wrestler.name : slug;
  };

  // Get wrestler brand from slug
  const getWrestlerBrand = (slug) => {
    const wrestler = safeWrestlers.find(w => w.id === slug);
    return wrestler ? wrestler.brand : 'Unassigned';
  };

  // Get wrestler image from slug
  const getWrestlerImage = (slug) => {
    const wrestler = safeWrestlers.find(w => w.id === slug);
    return wrestler ? wrestler.image_url : null;
  };

  // Dismiss tag team suggestions for a wrestler
  const dismissTagTeamSuggestions = (sideIndex, participantIndex) => {
    setTagTeamSuggestions(prev => {
      const newSuggestions = { ...prev };
      delete newSuggestions[`${sideIndex}-${participantIndex}`];
      return newSuggestions;
    });
  };

  // Render action buttons
  const renderActionButtons = () => (
    <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={addOpponent}
        style={actionButtonStyle}
      >
        + Opponent
      </button>
      <button
        type="button"
        onClick={() => addTeammate(matchStructure.length - 1)}
        style={actionButtonStyle}
      >
        + Teammate
      </button>
      <button
        type="button"
        onClick={clearAll}
        style={{
          ...buttonStyle,
          background: '#dc3545',
          borderColor: '#dc3545',
        }}
      >
        Clear All
      </button>
    </div>
  );

  // Render participant card
  const renderParticipantCard = (wrestlerSlug, sideIndex, participantIndex) => {
    const hasWrestler = wrestlerSlug && wrestlerSlug.trim() !== '';
    const wrestlerName = hasWrestler ? getWrestlerName(wrestlerSlug) : '';
    const wrestlerBrand = hasWrestler ? getWrestlerBrand(wrestlerSlug) : '';
    const wrestlerImage = hasWrestler ? getWrestlerImage(wrestlerSlug) : null;

    return (
      <div key={participantIndex} style={participantCardStyle}>
        {hasWrestler ? (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            {wrestlerImage && (
              <img
                src={wrestlerImage}
                alt={wrestlerName}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  marginRight: '6px',
                  objectFit: 'cover'
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {wrestlerName}
              </div>
              <div style={{ color: '#bbb', fontSize: '9px' }}>
                {wrestlerBrand}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeParticipant(sideIndex, participantIndex)}
              style={{
                background: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '3px'
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#333', marginRight: '6px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#666', fontSize: '11px' }}>Select wrestler</div>
            </div>
          </div>
        )}
        
        {/* Wrestler selector */}
        <WrestlerAutocomplete
          key={`${sideIndex}-${participantIndex}`}
          wrestlers={safeWrestlers}
          value={wrestlerSlug || ''}
          onChange={(value) => {
            console.log(`WrestlerAutocomplete onChange for side ${sideIndex}, participant ${participantIndex}:`, value);
            updateParticipant(sideIndex, participantIndex, value);
          }}
          placeholder="Search..."
        />
        
        {/* Tag team suggestions */}
        {hasWrestler && tagTeamSuggestions[`${sideIndex}-${participantIndex}`] && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ color: '#C6A04F', fontSize: '10px', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Partners:</span>
              <button
                type="button"
                onClick={() => dismissTagTeamSuggestions(sideIndex, participantIndex)}
                style={hoveredDismissButton === `${sideIndex}-${participantIndex}` ? dismissButtonHoverStyle : dismissButtonStyle}
                onMouseEnter={() => setHoveredDismissButton(`${sideIndex}-${participantIndex}`)}
                onMouseLeave={() => setHoveredDismissButton(null)}
                title="Dismiss partner suggestions (wrestler competing individually)"
              >
                ×
              </button>
            </div>
            {Array.isArray(tagTeamSuggestions[`${sideIndex}-${participantIndex}`]) && tagTeamSuggestions[`${sideIndex}-${participantIndex}`].map((suggestion, idx) => {
              const suggestionKey = `${sideIndex}-${participantIndex}-${idx}`;
              const isHovered = hoveredSuggestion === suggestionKey;
              
              return (
                <div 
                  key={idx} 
                  style={isHovered ? suggestionHoverStyle : suggestionStyle}
                  onClick={() => addTeammateFromSuggestion(sideIndex, suggestion)}
                  onMouseEnter={() => setHoveredSuggestion(suggestionKey)}
                  onMouseLeave={() => setHoveredSuggestion(null)}
                  title={`Click to add ${suggestion.teamName} members`}
                >
                  <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px' }}>{suggestion.teamName}</span>
                    <span style={{ fontSize: '8px', color: '#888' }}>+</span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#bbb' }}>
                    {Array.isArray(suggestion.members) && suggestion.members.map(slug => getWrestlerName(slug)).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Get side identifier for defending champion comparison
  const getSideIdentifier = (side) => {
    const validParticipants = side.participants.filter(Boolean);
    if (validParticipants.length === 0) return null;
    
    if (side.type === 'team' && side.name && side.name.trim()) {
      // Tag team with name: return team name
      return side.name.trim();
    } else {
      // Individual wrestlers or team without name: return participant names joined
      const participantNames = validParticipants.map(slug => getWrestlerName(slug)).filter(Boolean);
      return participantNames.join(' & ');
    }
  };

  // Render side (opponent/team)
  const renderSide = (side, sideIndex) => {
    const isTeam = side.type === 'team' || side.participants.length > 1;
    const canAddTeammate = side.participants.length < 4; // Max 4 per team
    const sideIdentifier = getSideIdentifier(side);
    const isDefendingChampion = isTitleMatch && sideIdentifier && defendingChampion && 
      sideIdentifier.trim().toLowerCase() === defendingChampion.trim().toLowerCase();

    return (
      <div key={sideIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '140px', maxWidth: '140px', position: 'relative' }}>
        {/* Champion "C" button - only show for title matches */}
        {isTitleMatch && sideIdentifier && (
          <button
            type="button"
            onClick={() => {
              if (onDefendingChampionChange) {
                // Toggle: if already selected, clear it; otherwise set it
                const newChampion = isDefendingChampion ? null : sideIdentifier;
                onDefendingChampionChange(newChampion);
              }
            }}
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: `2px solid ${isDefendingChampion ? gold : '#666'}`,
              background: isDefendingChampion ? gold : '#1a1a1a',
              color: isDefendingChampion ? '#232323' : '#999',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              transition: 'all 0.2s ease',
              boxShadow: isDefendingChampion ? `0 0 8px ${gold}` : 'none'
            }}
            title={isDefendingChampion ? 'Defending Champion (click to clear)' : 'Mark as Defending Champion'}
          >
            C
          </button>
        )}

        {/* Team name input for teams */}
        {isTeam && (
          <input
            type="text"
            value={side.name || ''}
            onChange={(e) => updateTeamName(sideIndex, e.target.value)}
            placeholder="Team name"
            style={{
              ...inputStyle,
              marginBottom: '4px',
              textAlign: 'center',
              width: '120px',
              fontSize: '11px',
              padding: '3px 4px'
            }}
          />
        )}

        {/* Participants */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          {Array.isArray(side.participants) && side.participants.map((participant, participantIndex) => 
            renderParticipantCard(participant, sideIndex, participantIndex)
          )}
          
          {/* Add teammate button */}
          {canAddTeammate && (
            <button
              type="button"
              onClick={() => addTeammate(sideIndex)}
              style={{
                ...buttonStyle,
                marginTop: '2px',
                fontSize: '9px',
                padding: '2px 4px'
              }}
            >
              + Add Teammate
            </button>
          )}
          
          {/* Convert to team button */}
          {side.participants.length > 1 && side.type === 'individual' && (
            <button
              type="button"
              onClick={() => convertToTeam(sideIndex)}
              style={{
                ...buttonStyle,
                marginTop: '2px',
                fontSize: '9px',
                padding: '2px 4px',
                background: '#C6A04F',
                borderColor: '#C6A04F'
              }}
            >
              Make Team
            </button>
          )}
          
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>
              Type: {side.type}, Participants: {side.participants.length}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render match structure
  const renderMatchStructure = () => {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        flexWrap: 'wrap',
        gap: '4px',
        maxWidth: '100%'
      }}>
        {Array.isArray(matchStructure) && matchStructure.map((side, sideIndex) => (
          <React.Fragment key={sideIndex}>
            {renderSide(side, sideIndex)}
            {sideIndex < matchStructure.length - 1 && (
              <div style={vsStyle}>VS</div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Render preview
  const renderPreview = () => {
    const totalParticipants = Array.isArray(matchStructure) ? matchStructure.flatMap(side => side.participants).filter(Boolean).length : 0;
    const hasTeams = Array.isArray(matchStructure) && matchStructure.some(side => side.type === 'team');
    const isBattleRoyal = totalParticipants > 8 && !hasTeams;
    const isGauntletMatch = Array.isArray(matchStructure) && matchStructure.length >= 5 && matchStructure.length <= 10 && matchStructure.every(side => side.type === 'individual');
    const isTagTeamGauntletMatch = Array.isArray(matchStructure) && matchStructure.length >= 4 && matchStructure.length <= 10 &&
      matchStructure.every(side => side.type === 'team') &&
      matchStructure.every(side => side.participants && side.participants.length === 2);
    
    let previewValue;
    if (totalParticipants === 0) {
      previewValue = 'No participants selected';
    } else if (isBattleRoyal) {
      previewValue = Array.isArray(matchStructure) ? matchStructure.flatMap(side => side.participants).filter(Boolean) : [];
    } else if (isTagTeamGauntletMatch) {
      // Tag Team Gauntlet: teams in order with arrows
      previewValue = matchStructure.map(side => {
        const validParticipants = side.participants.filter(Boolean);
        if (side.type === 'team' && side.name && validParticipants.length > 0) {
          return `${side.name} (${validParticipants.join(' & ')})`;
        }
        return validParticipants.length >= 2 ? validParticipants.join(' & ') : '';
      }).filter(Boolean).join(' → ');
    } else if (isGauntletMatch) {
      // Gauntlet Match: participants in order with arrows
      previewValue = matchStructure.map(side => {
        const participant = side.participants.filter(Boolean)[0];
        return participant || '';
      }).filter(Boolean).join(' → ');
    } else {
      previewValue = matchStructure.map(side => {
        const validParticipants = side.participants.filter(Boolean);
        if (side.type === 'team' && side.name && validParticipants.length > 0) {
          return `${side.name} (${validParticipants.join(' & ')})`;
        } else if (validParticipants.length > 0) {
          return validParticipants.join(' & ');
        } else {
          return '';
        }
      }).filter(Boolean).join(' vs ');
    }

    return (
      <div style={{ marginTop: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #555' }}>
        <div style={{ color: gold, fontWeight: '500', marginBottom: '8px' }}>Final Format:</div>
        <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px', wordBreak: 'break-all' }}>
          {Array.isArray(previewValue) ? previewValue.join(', ') : previewValue}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderActionButtons()}
      {renderMatchStructure()}
      {renderPreview()}
    </div>
  );
} 