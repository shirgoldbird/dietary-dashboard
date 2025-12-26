// Theme detection and application
(function() {
  'use strict';

  // Function to get the current theme
  function getTheme() {
    try {
      // Check localStorage first
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
    } catch (e) {
      // localStorage might not be available
      console.warn('localStorage not available, falling back to system preference');
    }

    // Check if system preference is supported and what it prefers
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemPrefersDark = mediaQuery.matches;

    // If the media query is supported, use system preference; otherwise default to light mode
    if (mediaQuery.media !== 'not all') {
      return systemPrefersDark ? 'dark' : 'light';
    } else {
      // System preference not supported, default to light mode
      return 'light';
    }
  }

  // Function to get the current theme with logging (for initial load)
  function getThemeWithLogging() {
    // Log the theme detection process
    try {
      const savedTheme = localStorage.getItem('theme');
      console.log('Saved theme from localStorage:', savedTheme);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        console.log('Using saved theme:', savedTheme);
        return savedTheme;
      }
    } catch (e) {
      console.warn('localStorage not available, falling back to system preference');
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemPrefersDark = mediaQuery.matches;
    console.log('System prefers dark mode:', systemPrefersDark);
    console.log('Media query supported:', mediaQuery.media !== 'not all');

    const theme = getTheme();
    console.log('Final theme decision:', theme);
    return theme;
  }

  // Function to apply theme
  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }

  // Apply theme immediately
  const currentTheme = getThemeWithLogging();
  applyTheme(currentTheme);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', function(e) {
    // Only apply system preference if user hasn't set a preference
    try {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        // Use the same logic as getTheme() for consistency
        if (mediaQuery.media !== 'not all') {
          applyTheme(e.matches ? 'dark' : 'light');
        } else {
          // System preference not supported, default to light mode
          applyTheme('light');
        }
      }
    } catch (e) {
      // If localStorage fails, use system preference if supported, otherwise default to light
      if (mediaQuery.media !== 'not all') {
        applyTheme(e.matches ? 'dark' : 'light');
      } else {
        applyTheme('light');
      }
    }
  });

  // Expose theme functions globally for the toggle component
  window.themeUtils = {
    getTheme,
    applyTheme,
    setTheme: function(theme) {
      try {
        localStorage.setItem('theme', theme);
      } catch (e) {
        console.warn('Could not save theme preference');
      }
      applyTheme(theme);
    },
    clearTheme: function() {
      try {
        localStorage.removeItem('theme');
        console.log('Cleared saved theme preference');
        // Reapply theme based on system preference
        const newTheme = getTheme();
        applyTheme(newTheme);
      } catch (e) {
        console.warn('Could not clear theme preference');
      }
    },
    // Debug version of getTheme with logging
    getThemeDebug: function() {
      return getThemeWithLogging();
    }
  };
})();
