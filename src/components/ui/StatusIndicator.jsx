import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './StatusIndicator.module.css';

const StatusIndicator = ({ isUsingApi, isLoading = false }) => {
  const [menuSlot, setMenuSlot] = useState(null);
  useEffect(() => {
    setMenuSlot(document.getElementById('navigation-status'));
  }, []);

  const getStatus = () => {
    if (isLoading) {
      return {
        icon: '⏳',
        text: 'Connecting...',
        type: 'loading'
      };
    }
    
    if (isUsingApi) {
      return {
        icon: '🌐',
        text: 'Connected to MongoDB Atlas',
        type: 'online'
      };
    }
    
    return {
      icon: '💾',
      text: 'Using local puzzle data',
      type: 'offline'
    };
  };

  const status = getStatus();

  if (!menuSlot) return null;

  return createPortal(
    <div tabIndex={0} role="img" aria-label={status.text} className={`${styles.statusIndicator} ${styles[status.type]}`} title={status.text}>
      <div className={styles.statusIcon}>
        {status.icon}
      </div>
      <div className={styles.statusTooltip}>
        <div className={styles.tooltipContent}>
          <strong>Data Source</strong>
          <p>{status.text}</p>
          {status.type === 'online' && (
            <small>Real-time database connection active</small>
          )}
          {status.type === 'offline' && (
            <small>Running in offline mode</small>
          )}
          {status.type === 'loading' && (
            <small>Establishing connection...</small>
          )}
        </div>
      </div>
    </div>,
    menuSlot
  );
};

export default StatusIndicator;
