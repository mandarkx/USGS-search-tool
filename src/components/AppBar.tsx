import { useState } from 'react';
import './AppBar.css';

interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface AppBarProps {
  title?: string;
  logo?: React.ReactNode;
  navLinks?: NavLink[];
  userAction?: React.ReactNode;
}

const AppBar = ({ 
  title = 'My App', 
  logo = null, 
  navLinks = [], 
  userAction = null 
}: AppBarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="app-bar">
      <div className="app-bar-container">
        {/* Left: Logo and Brand Name */}
        <div className="app-bar-brand">
          {logo ? (
            <span className="app-bar-logo">{logo}</span>
          ) : (
            <svg 
              className="app-bar-default-logo" 
              viewBox="0 0 24 24" 
              fill="pink" 
              width="28" 
              height="28"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L2 22h20L12 2z" />
            </svg>
          )}
          <span className="app-bar-title">{title}</span>
        </div>

        {/* Mobile Toggle Button */}
        <button 
          className="app-bar-mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={isMobileMenuOpen}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            {isMobileMenuOpen ? (
               <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            ) : (
               <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            )}
          </svg>
        </button>

        {/* Center: Navigation Links */}
        <nav className={`app-bar-nav ${isMobileMenuOpen ? 'open' : ''}`}>
          <ul>
            {navLinks.map((link, index) => (
              <li key={index}>
                <a 
                  href={link.href} 
                  className={link.active ? 'active' : ''}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right: User Action */}
        <div className="app-bar-actions">
          {userAction || (
            <button className="app-bar-button">Sign In</button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppBar;