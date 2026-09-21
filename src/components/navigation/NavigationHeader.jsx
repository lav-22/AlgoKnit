import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './NavigationHeader.module.css';
import useTheme from '../../hooks/useTheme';
import ThemeToggle from '../ui/ThemeToggle';

const NavigationHeader = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isStudentPage = location.pathname === '/' || location.pathname === '/student';
  const isEducatorPage = location.pathname === '/educator';
  const isFeedbackPage = location.pathname === '/feedback';

  return (
    <nav className={styles.navigationHeader} aria-label="Main navigation">
      <div className={styles.navContainer}>
        <Link to="/student" className={styles.logo}>
          <span className={styles.brandName}>🧮 SUTD Parsons Puzzles</span>
          <span className={styles.subtitle}>50.004 Algorithms</span>
        </Link>
        <div className={styles.navTabs}>
          <Link to="/student" aria-current={isStudentPage ? 'page' : undefined}
            className={`${styles.navControl} ${isStudentPage ? styles.active : ''}`}>
            <span aria-hidden="true">🎓</span> Student Mode
          </Link>
          <Link to="/educator" aria-current={isEducatorPage ? 'page' : undefined}
            className={`${styles.navControl} ${isEducatorPage ? styles.active : ''}`}>
            <span aria-hidden="true">👨‍🏫</span> Educator Mode
          </Link>
        </div>
        <div className={styles.navActions}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} className={styles.navControl} />
          <Link to="/feedback" state={{ from: location.pathname }}
            aria-current={isFeedbackPage ? 'page' : undefined}
            className={`${styles.navControl} ${isFeedbackPage ? styles.active : ''}`}>
            <span aria-hidden="true">💬</span> Feedback
          </Link>
          <div id="navigation-status" className={styles.statusSlot} />
        </div>
      </div>
    </nav>
  );
};

export default NavigationHeader;
