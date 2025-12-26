import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// Hash name to a deterministic cool color (blues, greens, purples, cyans)
function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Cool color range: 180-300 (cyan, blue, purple, with some green)
  const hueRange = 120; // Range of 120 degrees
  const hueOffset = 180; // Start at cyan (180°)
  const hue = hueOffset + (Math.abs(hash) % hueRange);

  const saturation = 50 + (Math.abs(hash >> 8) % 30); // 50-80%
  const lightness = 40 + (Math.abs(hash >> 16) % 20); // 40-60%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Get contrasting text color (light or dark) based on background
function getContrastColor(hslColor) {
  // Extract lightness from HSL
  const lightnessMatch = hslColor.match(/(\d+)%\)$/);
  if (!lightnessMatch) return '#ffffff';

  const lightness = parseInt(lightnessMatch[1]);
  return lightness > 55 ? '#1a1a1a' : '#ffffff';
}

// ========================================
// DIETARY RESTRICTIONS SORTING CONFIGURATION
// ========================================
// This controls the order that restrictions appear in the summary.
// Edit this configuration to change sorting behavior.
const RESTRICTION_SORT_CONFIG = {
  // Items in this list appear first, in the order specified
  priorityItems: [
    'Vegetarian',
    'Vegan',
    'gluten' // Special: matches any item containing "gluten" (case-insensitive)
  ],

  // After priority items, remaining items are sorted by:
  // - Number of people affected (most to least)

  // Items in this list appear last, in the order specified
  bottomItems: [
    'None'
  ]
};

// Helper function to sort dietary restrictions based on config
function sortDietaryRestrictions(restrictionsArray) {
  const config = RESTRICTION_SORT_CONFIG;

  return restrictionsArray.sort((a, b) => {
    const [itemA, peopleA] = a;
    const [itemB, peopleB] = b;
    const itemALower = itemA.toLowerCase();
    const itemBLower = itemB.toLowerCase();

    // Check if items are in priority list
    let priorityA = -1;
    let priorityB = -1;

    config.priorityItems.forEach((priority, index) => {
      const priorityLower = priority.toLowerCase();
      // Check for exact match or partial match (for "gluten")
      if (itemALower === priorityLower || itemALower.includes(priorityLower)) {
        priorityA = index;
      }
      if (itemBLower === priorityLower || itemBLower.includes(priorityLower)) {
        priorityB = index;
      }
    });

    // Check if items are in bottom list
    const bottomA = config.bottomItems.findIndex(item =>
      itemALower === item.toLowerCase()
    );
    const bottomB = config.bottomItems.findIndex(item =>
      itemBLower === item.toLowerCase()
    );

    // Priority items come first
    if (priorityA !== -1 && priorityB === -1) return -1;
    if (priorityA === -1 && priorityB !== -1) return 1;
    if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;

    // Bottom items come last
    if (bottomA !== -1 && bottomB === -1) return 1;
    if (bottomA === -1 && bottomB !== -1) return -1;
    if (bottomA !== -1 && bottomB !== -1) return bottomA - bottomB;

    // For everything else, sort by number of people (descending)
    return peopleB.length - peopleA.length;
  });
}
// ========================================

export default function DietaryRestrictionsTool({ data }) {
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [mealName, setMealName] = useState("");
  const [summary, setSummary] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1 = selection, 2 = summary
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  // URL Parameter Sync - Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const attendeesParam = params.get('attendees');
    const mealParam = params.get('meal');

    if (attendeesParam) {
      const attendees = attendeesParam.split(',').filter(Boolean);
      setSelectedAttendees(attendees);

      if (mealParam) {
        setMealName(decodeURIComponent(mealParam));
      }

      // Auto-generate summary if attendees were loaded from URL
      if (attendees.length > 0) {
        generateSummary(attendees, mealParam ? decodeURIComponent(mealParam) : '');
        setCurrentStep(2);
      }
    }

    // Handle browser back/forward buttons
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const attendeesParam = params.get('attendees');

      if (!attendeesParam) {
        // No params in URL, go back to step 1
        setCurrentStep(1);
        setSummary(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Clean up blur timeout on unmount
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function generateSummary(attendees, meal) {
    const attendeeData = data.members.filter(m =>
      attendees.includes(m.name.toLowerCase())
    ).map(person => ({
      ...person,
      // Filter out "Attending?" restriction entries
      restrictions: person.restrictions.filter(r =>
        !r.item.toLowerCase().includes('attending')
      )
    }));

    if (attendeeData.length === 0) {
      setSummary(null);
      return;
    }

    // Group airborne allergies
    const airborneMap = new Map();
    attendeeData.forEach(person => {
      person.restrictions
        .filter(r => r.severity === "airborne")
        .forEach(r => {
          if (!airborneMap.has(r.item)) {
            airborneMap.set(r.item, []);
          }
          airborneMap.get(r.item).push({
            name: person.name,
            notes: r.notes
          });
        });
    });

    // Group other restrictions
    const otherMap = new Map();
    attendeeData.forEach(person => {
      person.restrictions
        .filter(r => r.severity !== "airborne")
        .forEach(r => {
          if (!otherMap.has(r.item)) {
            otherMap.set(r.item, []);
          }
          otherMap.get(r.item).push({
            name: person.name,
            severity: r.severity,
            notes: r.notes
          });
        });
    });

    // Add people with no restrictions to "None" category
    attendeeData.forEach(person => {
      if (person.restrictions.length === 0) {
        if (!otherMap.has('None')) {
          otherMap.set('None', []);
        }
        otherMap.get('None').push({
          name: person.name,
          severity: 'yes',
          notes: 'None'
        });
      }
    });

    // Sort other restrictions using the configuration
    const sortedOther = sortDietaryRestrictions(Array.from(otherMap.entries()));

    setSummary({
      mealName: meal,
      attendees: attendeeData.map(a => a.name),
      airborne: Array.from(airborneMap.entries()),
      other: sortedOther,
      byPerson: attendeeData
    });
  }

  function handleGenerate() {
    generateSummary(selectedAttendees, mealName);
    setCurrentStep(2);

    // Update URL to reflect current selection
    const params = new URLSearchParams();
    params.set('attendees', selectedAttendees.join(','));
    if (mealName) {
      params.set('meal', encodeURIComponent(mealName));
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  }

  function handleGenerateNew() {
    setCurrentStep(1);
    setSummary(null);
    // Clear URL when going back to selection
    window.history.pushState({}, '', window.location.pathname);
  }

  function formatSummaryAsText(summary) {
    let text = summary.mealName
      ? `Dietary Summary - ${summary.mealName}\n\n`
      : "Dietary Summary\n\n";

    text += `Attendees: ${summary.attendees.length} (${summary.attendees.join(', ')})\n\n`;

    if (summary.airborne.length > 0) {
      text += "⚠️  AIRBORNE ALLERGIES ⚠️\n";
      text += "==========================================\n";
      summary.airborne.forEach(([item, people]) => {
        text += `${item}\n`;
        people.forEach(p => {
          text += `  - ${p.name}\n`;
        });
      });
      text += "\n";
    }

    if (summary.other.length > 0) {
      text += "Dietary Restrictions:\n";
      summary.other.forEach(([item, people]) => {
        text += `${item}\n`;
        people.forEach(p => {
          const detail = p.severity !== "yes" ? ` (${p.severity})` : '';
          text += `  - ${p.name}${detail}\n`;
        });
      });
      text += "\n";
    }

    text += "Restrictions by Person:\n";
    summary.byPerson.forEach(person => {
      const restrictions = person.restrictions.map(r => {
        const severity = r.severity === "airborne" ? " (AIRBORNE)" :
                        r.severity !== "yes" ? ` (${r.severity})` : '';
        return `${r.item}${severity}`;
      });
      text += `- ${person.name}: ${restrictions.join(', ') || 'None'}\n`;
    });

    return text;
  }

  async function copyToClipboard() {
    if (!summary) return;

    const text = formatSummaryAsText(summary);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadAsTextFile() {
    if (!summary) return;

    const text = formatSummaryAsText(summary);
    const filename = summary.mealName
      ? `${summary.mealName.replace(/\s+/g, '-')}-dietary-dashboard.txt`
      : 'dietary-dashboard.txt';

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  async function shareUrl() {
    const url = window.location.href;
    const title = summary?.mealName || 'Dietary Dashboard';

    // Check if Web Share API is supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: 'Here\'s the dietary needs for our upcoming meal:',
          url: url,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        // User cancelled or error occurred
        if (err.name !== 'AbortError') {
          // Fallback to copying URL
          await navigator.clipboard.writeText(url);
          setUrlCopied(true);
          setTimeout(() => setUrlCopied(false), 2000);
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  }

  async function copyUrl() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }

  function handleAttendeeChange(memberName) {
    const lowerName = memberName.toLowerCase();
    setSelectedAttendees(prev =>
      prev.includes(lowerName)
        ? prev.filter(n => n !== lowerName)
        : [...prev, lowerName]
    );
  }

  // Autocomplete functions
  function getFilteredMembers() {
    const search = searchInput.toLowerCase().trim();

    return data.members
      .filter(member => {
        const memberNameLower = member.name.toLowerCase();
        // Always exclude already selected attendees
        if (selectedAttendees.includes(memberNameLower)) {
          return false;
        }
        // If there's a search term, filter by it
        if (search) {
          return memberNameLower.includes(search);
        }
        // If no search term, show all unselected members
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function handleSelectMember(memberName) {
    const lowerName = memberName.toLowerCase();
    if (!selectedAttendees.includes(lowerName)) {
      setSelectedAttendees(prev => [...prev, lowerName]);
    }
    setSearchInput("");
    setHighlightedIndex(-1);
    setShowDropdown(true);
    // Keep input focused for quick multiple selections
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleRemoveMember(memberName) {
    setSelectedAttendees(prev => prev.filter(n => n !== memberName));
  }

  function handleSearchInput(e) {
    setSearchInput(e.target.value);
    setShowDropdown(true);
    setHighlightedIndex(-1);
  }

  function handleSearchFocus() {
    // Cancel any pending blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setShowDropdown(true);
  }

  function handleSearchBlur() {
    // Delay hiding dropdown to allow click events to fire
    blurTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }, 200);
  }

  function handleKeyDown(e) {
    const filteredMembers = getFilteredMembers();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowDropdown(true);
      setHighlightedIndex(prev =>
        prev < filteredMembers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      if (filteredMembers[highlightedIndex]) {
        handleSelectMember(filteredMembers[highlightedIndex].name);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }

  // Get member display name from lowercase name
  function getMemberDisplayName(lowerName) {
    const member = data.members.find(m => m.name.toLowerCase() === lowerName);
    return member ? member.name : lowerName;
  }

  if (!data || !data.members || data.members.length === 0) {
    return (
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p class="text-yellow-800 dark:text-yellow-200">
          No dietary restrictions data available. Please configure Google Sheets and run the sync script.
        </p>
      </div>
    );
  }

  // Step 1: Selection Interface
  if (currentStep === 1) {
    return (
      <div class="space-y-6 animate-fade-in">
        {/* Attendee Selection */}
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Select Attendees</h2>

          {/* Autocomplete Input with Chips */}
          <div class="relative">
            <div class="flex flex-wrap gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              {/* Selected Chips */}
              {selectedAttendees.map(attendee => {
                const bgColor = nameToColor(attendee);
                const textColor = getContrastColor(bgColor);
                return (
                  <span
                    key={attendee}
                    style={{ backgroundColor: bgColor, color: textColor }}
                    class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {getMemberDisplayName(attendee)}
                    <button
                      onClick={() => handleRemoveMember(attendee)}
                      class="hover:opacity-80 rounded-full p-0.5 transition-opacity"
                      aria-label={`Remove ${getMemberDisplayName(attendee)}`}
                    >
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                );
              })}

              {/* Search Input */}
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onInput={handleSearchInput}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                onKeyDown={handleKeyDown}
                placeholder={selectedAttendees.length === 0 ? "Type to search attendees..." : "Add more..."}
                class="flex-1 min-w-[150px] outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Dropdown */}
            {showDropdown && getFilteredMembers().length > 0 && (
              <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {getFilteredMembers().map((member, index) => (
                  <button
                    key={member.name}
                    onMouseDown={() => {
                      // Cancel blur timeout when clicking dropdown
                      if (blurTimeoutRef.current) {
                        clearTimeout(blurTimeoutRef.current);
                      }
                    }}
                    onClick={() => handleSelectMember(member.name)}
                    class={`w-full text-left px-4 py-2 text-gray-900 dark:text-gray-100 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      index === highlightedIndex
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meal Name Input */}
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <label htmlFor="meal-name" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Meal Name (Optional)
          </label>
          <input
            type="text"
            id="meal-name"
            value={mealName}
            onInput={(e) => setMealName(e.target.value)}
            placeholder="e.g., Shabbos Dinner, Rosh Hashana Day 1 Lunch"
            class="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Generate Button */}
        <div class="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={selectedAttendees.length === 0}
            class="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Generate Summary
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Summary View
  return (
    <div class="space-y-6 animate-fade-in">
      {/* Compact Attendee Pills Header */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Attendees ({selectedAttendees.length}):
          </span>
          <div class="flex flex-wrap gap-2">
            {selectedAttendees.map(attendee => {
              const bgColor = nameToColor(attendee);
              const textColor = getContrastColor(bgColor);
              return (
                <button
                  key={attendee}
                  onClick={handleGenerateNew}
                  style={{ backgroundColor: bgColor, color: textColor }}
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
                  title="Click to modify selection"
                >
                  {getMemberDisplayName(attendee)}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleGenerateNew}
            class="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            ← Modify Selection
          </button>
        </div>
      </div>

      {/* Summary Display */}
      {summary && (
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-blue-500 space-y-6">
          <div class="flex justify-between items-start">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.mealName || 'Dietary Summary'}
            </h2>
            <div class="flex gap-1 items-center">
              <button
                onClick={copyToClipboard}
                class="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none transition-colors text-lg"
                title={copied ? 'Copied!' : 'Copy to clipboard'}
                aria-label="Copy to clipboard"
              >
                <i class={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              </button>
              <button
                onClick={downloadAsTextFile}
                class="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none transition-colors text-lg"
                title={downloaded ? 'Downloaded!' : 'Download as text file'}
                aria-label="Download as text file"
              >
                <i class={`fa-solid ${downloaded ? 'fa-check' : 'fa-download'}`}></i>
              </button>
              <button
                onClick={shareUrl}
                class="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none transition-colors text-lg"
                title={shared ? 'Shared!' : 'Share via...'}
                aria-label="Share"
              >
                <i class={`fa-solid ${shared ? 'fa-check' : 'fa-share-nodes'}`}></i>
              </button>
              <button
                onClick={copyUrl}
                class="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none transition-colors text-lg"
                title={urlCopied ? 'Link copied!' : 'Copy link'}
                aria-label="Copy link"
              >
                <i class={`fa-solid ${urlCopied ? 'fa-check' : 'fa-link'}`}></i>
              </button>
            </div>
          </div>

          {/* Attendees */}
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Attendees: {summary.attendees.length}
            </h3>
            <p class="text-gray-700 dark:text-gray-300">
              {summary.attendees.join(', ')}
            </p>
          </div>

          {/* Airborne Allergies */}
          {summary.airborne.length > 0 && (
            <div class="bg-red-50 dark:bg-red-950 border-2 border-red-500 dark:border-red-600 rounded-lg p-6">
              <h3 class="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <i class="fa-solid fa-triangle-exclamation"></i>
                AIRBORNE ALLERGIES
              </h3>
              <div class="space-y-4">
                {summary.airborne.map(([item, people]) => (
                  <div key={item}>
                    <h4 class="font-bold text-red-800 dark:text-red-300 mb-2 text-lg">{item}</h4>
                    <ul class="ml-6 space-y-1 list-disc marker:text-red-600">
                      {people.map(p => (
                        <li key={p.name} class="text-red-900 dark:text-red-200">
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Dietary Restrictions */}
          {summary.other.length > 0 && (
            <div>
              <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b-2 border-gray-300 dark:border-gray-600">
                Dietary Restrictions
              </h3>
              <div class="space-y-4">
                {summary.other.map(([item, people]) => (
                  <div key={item}>
                    <h4 class="font-bold text-gray-900 dark:text-gray-100 mb-2">{item}</h4>
                    <ul class="ml-6 space-y-1 list-disc marker:text-blue-600">
                      {people.map(p => (
                        <li key={p.name} class="text-gray-700 dark:text-gray-300">
                          {p.name}{p.severity !== 'yes' ? ` (${p.severity})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restrictions by Person */}
          <div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b-2 border-gray-300 dark:border-gray-600">
              Restrictions by Person
            </h3>
            <ul class="ml-6 space-y-2 list-disc marker:text-blue-600">
              {summary.byPerson.map(person => {
                // Check if person only has "None" or no restrictions
                const hasOnlyNone = person.restrictions.length === 1 &&
                                    person.restrictions[0].item.toLowerCase() === 'none';
                const hasNoRestrictions = person.restrictions.length === 0;

                return (
                  <li key={person.name} class="text-gray-900 dark:text-gray-100">
                    <span class="font-medium">{person.name}:</span>{' '}
                    {hasOnlyNone || hasNoRestrictions ? (
                      <span class="text-gray-700 dark:text-gray-300 italic">None</span>
                    ) : (
                      <span class="text-gray-700 dark:text-gray-300">
                        {person.restrictions.map(r => {
                          const severity = r.severity === "airborne" ? " (AIRBORNE)" :
                                          r.severity !== "yes" ? ` (${r.severity})` : '';
                          return `${r.item}${severity}`;
                        }).join(', ')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
