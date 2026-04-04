// @ts-nocheck
"use client";
import React from 'react';
import Select from 'react-select';

export default function WrestlerAutocomplete({ wrestlers = [], value, onChange, placeholder = 'Select wrestler...' }) {
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];

  const options = safeWrestlers.map(w => {
    if (!w || typeof w !== 'object') {
      return { value: '', label: 'Invalid wrestler' };
    }
    return { value: w.id || w.slug || '', label: w.name || 'Unknown wrestler' };
  });
  
  // Find the selected option
  const selected = options.find(opt => opt.value === value) || null;

  return (
    <Select
      options={options}
      value={selected}
      onChange={opt => onChange(opt ? opt.value : null)}
      placeholder={placeholder}
      isClearable
      styles={{
        control: (base) => ({ 
          ...base, 
          background: '#222', 
          color: '#fff', 
          borderColor: '#444',
          minHeight: '28px',
          fontSize: '11px'
        }),
        menu: (base) => ({ ...base, background: '#222', color: '#fff' }),
        singleValue: (base) => ({ ...base, color: '#fff', fontSize: '11px' }),
        option: (base, state) => ({ 
          ...base, 
          color: state.isSelected ? '#232323' : '#fff', 
          background: state.isSelected ? '#C6A04F' : '#222',
          fontSize: '11px',
          padding: '4px 8px'
        }),
        placeholder: (base) => ({ ...base, color: '#bbb', fontSize: '11px' }),
        input: (base) => ({ ...base, fontSize: '11px' }),
        valueContainer: (base) => ({ ...base, padding: '2px 6px' }),
        indicatorsContainer: (base) => ({ ...base, height: '24px' }),
        clearIndicator: (base) => ({ ...base, padding: '2px' }),
        dropdownIndicator: (base) => ({ ...base, padding: '2px' }),
      }}
    />
  );
} 