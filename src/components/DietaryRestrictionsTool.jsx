import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

export default function DietaryRestrictionsTool({ data }) {
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [mealName, setMealName] = useState("");
  const [summary, setSummary] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

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
      }
    }
  }, []);

  function generateSummary(attendees, meal) {
    const attendeeData = data.members.filter(m =>
      attendees.includes(m.name.toLowerCase())
    );

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

    setSummary({
      mealName: meal,
      attendees: attendeeData.map(a => a.name),
      airborne: Array.from(airborneMap.entries()),
      other: Array.from(otherMap.entries()),
      byPerson: attendeeData
    });
  }

  function handleGenerate() {
    generateSummary(selectedAttendees, mealName);
  }

  function formatSummaryAsText(summary) {
    let text = summary.mealName
      ? `Dietary Summary - ${summary.mealName}\n\n`
      : "Dietary Summary\n\n";

    text += `Attendees: ${summary.attendees.length} (${summary.attendees.join(', ')})\n\n`;

    if (summary.airborne.length > 0) {
      text += "Airborne Allergies:\n";
      summary.airborne.forEach(([item, people]) => {
        text += `• ${item}\n`;
        people.forEach(p => {
          text += `  - ${p.name}${p.notes ? ` (${p.notes})` : ''}\n`;
        });
      });
      text += "\n";
    }

    if (summary.other.length > 0) {
      text += "Other Dietary Restrictions:\n";
      summary.other.forEach(([item, people]) => {
        text += `• ${item}\n`;
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
      text += `• ${person.name}: ${restrictions.join(', ') || 'None'}\n`;
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
      ? `${summary.mealName.replace(/\s+/g, '-')}-dietary.txt`
      : 'dietary-restrictions.txt';

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

  function shareUrl() {
    const params = new URLSearchParams();
    params.set('attendees', selectedAttendees.join(','));
    if (mealName) {
      params.set('meal', encodeURIComponent(mealName));
    }
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
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
    if (!searchInput.trim()) return data.members;

    const search = searchInput.toLowerCase();
    return data.members.filter(member =>
      member.name.toLowerCase().includes(search) &&
      !selectedAttendees.includes(member.name.toLowerCase())
    );
  }

  function handleSelectMember(memberName) {
    const lowerName = memberName.toLowerCase();
    if (!selectedAttendees.includes(lowerName)) {
      setSelectedAttendees(prev => [...prev, lowerName]);
    }
    setSearchInput("");
    setShowDropdown(false);
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
  }

  function handleSearchFocus() {
    setShowDropdown(true);
  }

  function handleSearchBlur() {
    // Delay hiding dropdown to allow click events to fire
    setTimeout(() => setShowDropdown(false), 200);
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

  return (
    <div class="space-y-6">
      {/* Attendee Selection */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-green-500">
        <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Select Attendees</h2>

        {/* Autocomplete Input with Chips */}
        <div class="relative">
          <div class="flex flex-wrap gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
            {/* Selected Chips */}
            {selectedAttendees.map(attendee => (
              <span
                key={attendee}
                class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-full text-sm font-medium"
              >
                {getMemberDisplayName(attendee)}
                <button
                  onClick={() => handleRemoveMember(attendee)}
                  class="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${getMemberDisplayName(attendee)}`}
                >
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            ))}

            {/* Search Input */}
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onInput={handleSearchInput}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder={selectedAttendees.length === 0 ? "Type to search attendees..." : "Add more..."}
              class="flex-1 min-w-[150px] outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Dropdown */}
          {showDropdown && getFilteredMembers().length > 0 && (
            <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {getFilteredMembers().map(member => (
                <button
                  key={member.name}
                  onClick={() => handleSelectMember(member.name)}
                  class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {member.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meal Name Input */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-green-500">
        <label htmlFor="meal-name" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Meal Name (Optional)
        </label>
        <input
          type="text"
          id="meal-name"
          value={mealName}
          onInput={(e) => setMealName(e.target.value)}
          placeholder="e.g., Shabbat Dinner, RH1 Lunch"
          class="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Generate Button */}
      <div class="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={selectedAttendees.length === 0}
          class="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate Summary
        </button>
      </div>

      {/* Summary Display */}
      {summary && (
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-green-500 space-y-6">
          <div class="flex justify-between items-start">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.mealName || 'Dietary Summary'}
            </h2>
            <div class="flex gap-2">
              <button
                onClick={copyToClipboard}
                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <button
                onClick={downloadAsTextFile}
                class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
              >
                {downloaded ? '✓ Downloaded!' : 'Download'}
              </button>
              <button
                onClick={shareUrl}
                class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                {urlCopied ? '✓ URL Copied!' : 'Share URL'}
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
            <div>
              <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                Airborne Allergies
              </h3>
              <ul class="space-y-2">
                {summary.airborne.map(([item, people]) => (
                  <li key={item} class="text-gray-900 dark:text-gray-100">
                    <span class="font-medium">• {item}</span>
                    <ul class="ml-4 mt-1 space-y-1">
                      {people.map(p => (
                        <li key={p.name} class="text-gray-700 dark:text-gray-300">
                          - {p.name}{p.notes ? ` (${p.notes})` : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Other Dietary Restrictions */}
          {summary.other.length > 0 && (
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Other Dietary Restrictions
              </h3>
              <ul class="space-y-2">
                {summary.other.map(([item, people]) => (
                  <li key={item} class="text-gray-900 dark:text-gray-100">
                    <span class="font-medium">• {item}</span>
                    <ul class="ml-4 mt-1 space-y-1">
                      {people.map(p => (
                        <li key={p.name} class="text-gray-700 dark:text-gray-300">
                          - {p.name}{p.severity !== 'yes' ? ` (${p.severity})` : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Restrictions by Person */}
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Restrictions by Person
            </h3>
            <ul class="space-y-2">
              {summary.byPerson.map(person => (
                <li key={person.name} class="text-gray-900 dark:text-gray-100">
                  <span class="font-medium">• {person.name}:</span>{' '}
                  {person.restrictions.length > 0 ? (
                    <span class="text-gray-700 dark:text-gray-300">
                      {person.restrictions.map(r => {
                        const severity = r.severity === "airborne" ? " (AIRBORNE)" :
                                        r.severity !== "yes" ? ` (${r.severity})` : '';
                        return `${r.item}${severity}`;
                      }).join(', ')}
                    </span>
                  ) : (
                    <span class="text-gray-500 dark:text-gray-400 italic">None</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
