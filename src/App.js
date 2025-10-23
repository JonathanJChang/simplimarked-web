import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import './App.css';

function App() {
  const [inputText, setInputText] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connected');
  const [errorMessage, setErrorMessage] = useState('');
  const [sortOption, setSortOption] = useState('original'); // 'original', 'payment', 'alphabetical'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [username, setUsername] = useState(() => {
    // Load username from localStorage on initial render
    return localStorage.getItem('simplimarked-username') || '';
  });
  const [tempUsername, setTempUsername] = useState('');
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Save username to localStorage whenever it changes
  useEffect(() => {
    if (username) {
      localStorage.setItem('simplimarked-username', username);
    } else {
      localStorage.removeItem('simplimarked-username');
    }
  }, [username]);

  // Listen to Firebase for real-time updates
  useEffect(() => {
    const sessionRef = ref(database, 'session');
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      setSessionData(data); // Update even when null (for reset functionality)
      
      if (data) {
        // Load the raw input text from Firebase if it exists
        if (data.rawInput) {
          setInputText(data.rawInput);
        }
        
        // Auto-collapse input if data already exists (only on initial load)
        if (!hasInitialized) {
          setIsInputCollapsed(true);
          setHasInitialized(true);
        }
      } else {
        // Session was reset - clear input text on all devices
        setInputText('');
      }
      setSyncStatus('connected');
    }, (error) => {
      console.error('Firebase error:', error);
      setSyncStatus('error');
      setErrorMessage('Connection error. Check Firebase configuration.');
    });

    return () => unsubscribe();
  }, [hasInitialized]);

  // Parse the input text
  const parseSignupText = (text) => {
    if (!text || !text.trim()) {
      setErrorMessage('Please enter signup text to parse');
      setTimeout(() => setErrorMessage(''), 3000);
      return null;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      setErrorMessage('No valid content to parse');
      setTimeout(() => setErrorMessage(''), 3000);
      return null;
    }

    // Extract date from first line (remove asterisks and other formatting)
    const dateMatch = lines[0].match(/\*?(.*?(?:Signup|signup|Sign-up|sign-up))\*?/);
    const date = dateMatch ? dateMatch[1].trim() : lines[0].replace(/\*/g, '').trim();

    // Parse people from remaining lines
    const people = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip lines that don't look like person entries
      if (line.toLowerCase().includes('maximum') || 
          line.toLowerCase().includes('waitlist') ||
          line.length < 2) {
        continue;
      }

      // Only process lines that start with a number (with optional special chars before)
      // Matches: "1. Name", "⁠1. Name", "  1. Name", etc.
      const numberMatch = line.match(/^\s*[⁠\s]*(\d+)\.?\s*(.*)/);
      if (!numberMatch) {
        // Skip lines without number prefix
        continue;
      }

      // Extract the cleaned line (everything after the number)
      let cleanLine = numberMatch[2].trim();
      
      if (!cleanLine) continue;

      // Determine membership status
      let membershipType = 'dropin'; // default
      let needsPayment = true;

      // Check for (M)* - converting member
      if (/\(m\)\*/i.test(cleanLine)) {
        membershipType = 'converting';
        needsPayment = true;
        cleanLine = cleanLine.replace(/\(m\)\*/gi, '').trim();
      }
      // Check for (M) - regular member
      else if (/\(m\)/i.test(cleanLine)) {
        membershipType = 'member';
        needsPayment = false;
        cleanLine = cleanLine.replace(/\(m\)/gi, '').trim();
      }

      // Extract name (everything remaining)
      // Remove invisible/zero-width characters that come from WhatsApp, Slack, etc.
      const name = cleanLine.trim().replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '');
      
      if (name) {
        people.push({
          id: `person-${Date.now()}-${i}`,
          name: name,
          membershipType: membershipType,
          paid: !needsPayment, // Members are automatically marked as paid
          amount: null, // All start with empty amount
          paymentMethod: 'cash', // Default payment method
          lastUpdatedBy: username || 'user',
          lastUpdated: new Date().toISOString()
        });
      }
    }

    if (people.length === 0) {
      setErrorMessage('No valid names found in the text');
      setTimeout(() => setErrorMessage(''), 3000);
      return null;
    }

    return {
      date: date,
      people: people,
      rawInput: text, // Save the original input text
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: 'user'
    };
  };

  // Handle parse button click
  const handleParse = async () => {
    const parsed = parseSignupText(inputText);
    
    if (parsed) {
      try {
        const sessionRef = ref(database, 'session');
        await set(sessionRef, parsed);
        setErrorMessage('');
        setIsInputCollapsed(true); // Collapse input section after successful parse
        // Optionally clear input after successful parse
        // setInputText('');
      } catch (error) {
        console.error('Error saving to Firebase:', error);
        setErrorMessage('Failed to save data. Check Firebase configuration.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    }
  };

  // Toggle payment method (for drop-ins and converting members)
  const togglePaymentMethod = async (personId) => {
    if (!sessionData) return;

    const person = sessionData.people.find(p => p.id === personId);
    
    // If unpaid (no amount), focus the input field
    if (person && person.membershipType !== 'member' && (!person.amount || person.amount === 0)) {
      const inputElement = document.getElementById(`amount-input-${personId}`);
      if (inputElement) {
        inputElement.focus();
        // Add highlight effect to input and wrapper
        inputElement.classList.add('highlight-input');
        const wrapperElement = inputElement.closest('.amount-input-wrapper');
        if (wrapperElement) {
          wrapperElement.classList.add('highlight-input');
        }
        setTimeout(() => {
          inputElement.classList.remove('highlight-input');
          if (wrapperElement) {
            wrapperElement.classList.remove('highlight-input');
          }
        }, 1000);
      }
      return;
    }

    const updatedPeople = sessionData.people.map(person => {
      if (person.id === personId) {
        // Only toggle if there's an amount (i.e., they're "paid")
        if (person.membershipType !== 'member' && person.amount > 0) {
          const newMethod = person.paymentMethod === 'cash' ? 'et' : 'cash';
          return { 
            ...person, 
            paymentMethod: newMethod,
            lastUpdatedBy: username || 'user',
            lastUpdated: new Date().toISOString()
          };
        } else if (person.membershipType === 'member') {
          // For members, toggle paid status
          return { 
            ...person, 
            paid: !person.paid,
            lastUpdatedBy: username || 'user',
            lastUpdated: new Date().toISOString()
          };
        }
      }
      return person;
    });

    const updatedSession = {
      ...sessionData,
      people: updatedPeople,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: username || 'user'
    };

    try {
      const sessionRef = ref(database, 'session');
      await set(sessionRef, updatedSession);
    } catch (error) {
      console.error('Error updating payment method:', error);
      setErrorMessage('Failed to update. Check connection.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Update payment amount
  const updateAmount = async (personId, amount) => {
    if (!sessionData) return;

    const updatedPeople = sessionData.people.map(person => {
      if (person.id === personId) {
        return { 
          ...person, 
          amount: amount,
          lastUpdatedBy: username || 'user',
          lastUpdated: new Date().toISOString()
        };
      }
      return person;
    });

    const updatedSession = {
      ...sessionData,
      people: updatedPeople,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: username || 'user'
    };

    try {
      const sessionRef = ref(database, 'session');
      await set(sessionRef, updatedSession);
    } catch (error) {
      console.error('Error updating amount:', error);
      setErrorMessage('Failed to update. Check connection.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Check if person is considered "paid"
  const isPaid = (person) => {
    if (person.membershipType === 'member') {
      return person.paid; // Members use the paid flag
    }
    // Drop-ins and converting: paid if amount > 0
    return person.amount && person.amount > 0;
  };

  // Get payment button display
  const getPaymentButtonText = (person) => {
    if (person.membershipType === 'member') {
      return person.paid ? '✓ Paid' : '✗ Unpaid';
    }
    
    // For drop-ins and converting members
    if (person.amount && person.amount > 0) {
      const method = person.paymentMethod === 'et' ? 'ET' : 'Cash';
      return `✓ ${method}`;
    }
    return '✗ Unpaid';
  };

  // Calculate stats
  const stats = sessionData ? {
    total: sessionData.people.length,
    paid: sessionData.people.filter(p => isPaid(p)).length,
    unpaid: sessionData.people.filter(p => !isPaid(p)).length,
    members: sessionData.people.filter(p => p.membershipType === 'member').length,
    dropins: sessionData.people.filter(p => p.membershipType === 'dropin').length,
    converting: sessionData.people.filter(p => p.membershipType === 'converting').length,
    cashAmount: sessionData.people
      .filter(p => isPaid(p) && p.amount && p.paymentMethod === 'cash')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    etAmount: sessionData.people
      .filter(p => isPaid(p) && p.amount && p.paymentMethod === 'et')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  } : null;

  // Capitalize each word in a name
  const capitalizeName = (name) => {
    if (!name) return '';
    return name
      .trim()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => {
        // Remove ALL invisible/non-visible characters from the entire word
        const cleanWord = word.replace(/[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF]/g, '');
        if (cleanWord.length === 0) return '';
        const first = cleanWord.charAt(0).toUpperCase();
        const rest = cleanWord.slice(1).toLowerCase();
        return first + rest;
      })
      .filter(word => word.length > 0)
      .join(' ');
  };

  // Get status label
  const getStatusLabel = (person) => {
    if (person.membershipType === 'member') {
      return 'Member';
    } else if (person.membershipType === 'converting') {
      return 'Converting to Member';
    } else {
      return 'Drop-in';
    }
  };

  // Handle sort option click (toggle direction if clicking same option)
  const handleSortClick = (option) => {
    if (sortOption === option && option !== 'original') {
      // Toggle direction if clicking the same option (but not for 'original')
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set or reset to the new option
      setSortOption(option);
      setSortDirection('asc');
    }
  };

  // Sort people based on selected option
  const getSortedPeople = (people) => {
    if (!people || people.length === 0) return [];
    
    // Create a copy with original indices preserved
    const peopleWithIndex = people.map((person, index) => ({
      ...person,
      originalIndex: index
    }));

    let sorted = [...peopleWithIndex];

    switch (sortOption) {
      case 'payment':
        // Sort by paid status, then by original order
        sorted.sort((a, b) => {
          const aPaid = isPaid(a);
          const bPaid = isPaid(b);
          if (aPaid === bPaid) {
            return a.originalIndex - b.originalIndex;
          }
          return aPaid ? 1 : -1; // unpaid first for ascending
        });
        break;
      
      case 'alphabetical':
        // Sort alphabetically by name
        sorted.sort((a, b) => 
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
        break;
      
      case 'playerType':
        // Sort by membership type: drop-ins, converting, members
        const typeOrder = { 'dropin': 1, 'converting': 2, 'member': 3 };
        sorted.sort((a, b) => {
          const aOrder = typeOrder[a.membershipType] || 99;
          const bOrder = typeOrder[b.membershipType] || 99;
          if (aOrder === bOrder) {
            return a.originalIndex - b.originalIndex;
          }
          return aOrder - bOrder;
        });
        break;
      
      case 'original':
      default:
        // Already in original order
        break;
    }

    // Apply direction (reverse if descending)
    if (sortDirection === 'desc' && sortOption !== 'original') {
      sorted.reverse();
    }

    return sorted;
  };

  // Handle login
  const handleLogin = (e) => {
    e.preventDefault();
    if (tempUsername.trim()) {
      setUsername(tempUsername.trim());
      setTempUsername('');
    }
  };

  // Handle logout
  const handleLogout = () => {
    setUsername('');
  };

  // Reset session
  const handleResetSession = async () => {
    if (window.confirm('Are you sure you want to reset the session? This will clear all data.')) {
      try {
        const sessionRef = ref(database, 'session');
        await set(sessionRef, null);
        setSessionData(null);
        setInputText('');
        setIsInputCollapsed(false);
        setHasInitialized(false);
        setSortOption('original');
        setSortDirection('asc');
        setErrorMessage('');
      } catch (error) {
        console.error('Error resetting session:', error);
        setErrorMessage('Failed to reset session. Check connection.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    }
  };

  return (
    <div className="App">
      {/* Username Login Modal */}
      {!username && (
        <div className="modal-overlay">
          <div className="login-modal">
            <div className="modal-header">
              <h3>Welcome to SimpliMarked!</h3>
            </div>
            <div className="modal-body">
              <p className="login-description">Please enter your name to continue:</p>
              <form onSubmit={handleLogin} className="login-form">
                <input
                  type="text"
                  className="login-input"
                  placeholder="Enter your name"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" className="login-button" disabled={!tempUsername.trim()}>
                  Continue
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        <header className="header">
          <div className="header-content">
            {username && <div className="header-spacer"></div>}
            <div className="header-text">
              <h1>SimpliMarked</h1>
              <p className="subtitle">Weekly Signup Payment Tracker</p>
            </div>
            {username && (
              <div className="user-section">
                <span className="username-display">👤 {username}</span>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {sessionData && sessionData.date && (
          <div className="date-title">
            <h2>{sessionData.date}</h2>
            <div className="date-actions">
              <button 
                className="collapse-toggle"
                onClick={() => setIsInputCollapsed(!isInputCollapsed)}
              >
                {isInputCollapsed ? '📄 View Raw' : '▲ Hide'}
              </button>
              <button 
                className="reset-button"
                onClick={handleResetSession}
              >
                Reset Session
              </button>
            </div>
          </div>
        )}

        {(!sessionData || !isInputCollapsed) && (
          <div className="input-section">
            <label className="input-label">
              {sessionData ? 'Raw signup input:' : 'Paste your signup list below:'}
            </label>
            <div className="input-wrapper">
              <textarea
                className="input-textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                readOnly={sessionData ? true : false}
                placeholder={`*October 26th Signup*
1. sarah (M)
2. Michael Chen (M)
3.emma (M)*
4. David k (M)
5. Ashley
6.  Chris (M)*
7. jessica Williams (M)*
8. Ryan
9. olivia m (M)*
10.brandon (M)*
11. Nicole
12.Tyler j
13. maya (m)*
14. Jordan roberts
Maximum 24`}
              />
              {!sessionData && (
                <button 
                  className="parse-button"
                  onClick={handleParse}
                  disabled={!inputText.trim()}
                >
                  📝 Parse
                </button>
              )}
            </div>
            {errorMessage && (
              <div className="error-message">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {sessionData && sessionData.people && sessionData.people.length > 0 ? (
          <>
            <div className="people-list">
              <div className="list-header">
                <h3>Participants ({sessionData.people.length})</h3>
                <div className="sort-controls">
                  <button
                    className={`sort-button ${sortOption === 'original' ? 'active' : ''}`}
                    onClick={() => handleSortClick('original')}
                  >
                    Original
                  </button>
                  <button
                    className={`sort-button ${sortOption === 'payment' ? 'active' : ''}`}
                    onClick={() => handleSortClick('payment')}
                  >
                    Payment
                    {sortOption === 'payment' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                  <button
                    className={`sort-button ${sortOption === 'alphabetical' ? 'active' : ''}`}
                    onClick={() => handleSortClick('alphabetical')}
                  >
                    A-Z
                    {sortOption === 'alphabetical' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                  <button
                    className={`sort-button ${sortOption === 'playerType' ? 'active' : ''}`}
                    onClick={() => handleSortClick('playerType')}
                  >
                    Type
                    {sortOption === 'playerType' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </div>
              </div>
              {getSortedPeople(sessionData.people).map(person => (
                <div key={person.id} className="person-item">
                  <div className="person-info">
                    <div>
                      <div className="person-name">{capitalizeName(person.name)}</div>
                      <div className={`person-status ${person.membershipType}`}>
                        {getStatusLabel(person)}
                      </div>
                      {person.lastUpdated && (
                        <div className="person-last-updated">
                          {new Date(person.lastUpdated).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })} by {person.lastUpdatedBy}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="person-actions">
                    {person.membershipType !== 'member' && (
                      <div className="amount-input-wrapper">
                        <span className="amount-prefix">$</span>
                        <input
                          id={`amount-input-${person.id}`}
                          type="number"
                          className="amount-input"
                          value={person.amount || ''}
                          onChange={(e) => updateAmount(person.id, e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder={person.membershipType === 'dropin' ? '9' : '0'}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    )}
                    <button
                      className={`payment-toggle ${isPaid(person) ? 'paid' : 'unpaid'} ${person.paymentMethod === 'et' && isPaid(person) ? 'payment-et' : ''}`}
                      onClick={() => togglePaymentMethod(person.id)}
                    >
                      {getPaymentButtonText(person)}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {stats && (
              <>
                <div className="stats-summary">
                  <div className="stat-item stat-first-row">
                    <span className="stat-value">{stats.paid}/{stats.total}</span>
                    <span className="stat-label">Paid</span>
                  </div>
                  <div className="stat-item stat-first-row">
                    <span className="stat-value">${stats.cashAmount.toFixed(2)}</span>
                    <span className="stat-label">Cash</span>
                  </div>
                  <div className="stat-item stat-first-row">
                    <span className="stat-value">${stats.etAmount.toFixed(2)}</span>
                    <span className="stat-label">ET</span>
                  </div>
                  <div className="stat-item stat-second-row">
                    <span className="stat-value">{stats.members}</span>
                    <span className="stat-label">Members</span>
                  </div>
                  <div className="stat-item stat-second-row">
                    <span className="stat-value">{stats.dropins}</span>
                    <span className="stat-label">Drop-ins</span>
                  </div>
                  <div className="stat-item stat-second-row">
                    <span className="stat-value">{stats.converting}</span>
                    <span className="stat-label">Converting</span>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>👋 Welcome! Paste your signup list above and click "Parse" to get started.</p>
            <p>The app will extract names and automatically mark members as paid.</p>
            <div className="example">
              Example format:
              {'\n'}*October 26th Signup*
              {'\n'}1. Sarah (M)
              {'\n'}3.Emma (M)*
              {'\n'} 5. Ashley
              {'\n'}7. J Williams (M)*
            </div>
          </div>
        )}

        <div className="version">v1.0.0</div>

        {syncStatus === 'error' && (
          <div className="sync-indicator error">
            ⚠️ Connection error
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

