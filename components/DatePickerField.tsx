import React from 'react';
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function DatePickerField({ value, onChange }: Props) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: {
        border: '1px solid #E5E8EE',
        borderRadius: '6px',
        padding: '5px 8px',
        fontSize: '13px',
        color: value ? '#1A1D23' : '#9CA3AF',
        backgroundColor: '#F8F9FB',
        width: '100%',
        outline: 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        boxSizing: 'border-box',
        textAlign: 'left',
      },
    });
  }

  return (
    <DateTimePicker
      value={value ? new Date(`${value}T12:00:00`) : new Date()}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(_, selectedDate) => {
        if (selectedDate) {
          const y = selectedDate.getFullYear();
          const mo = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const da = String(selectedDate.getDate()).padStart(2, '0');
          onChange(`${y}-${mo}-${da}`);
        }
      }}
    />
  );
}
