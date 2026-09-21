import React from 'react';

export default function ThemeToggle({ theme, onToggle, className }) {
  const isDark = theme === 'dark';
  return (
    <button type="button" onClick={onToggle} className={className}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}>
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
