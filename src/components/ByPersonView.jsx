import { h } from 'preact';
import { useState } from 'preact/hooks';

export default function ByPersonView({ data }) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!data || !data.members || data.members.length === 0) {
    return (
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p class="text-yellow-800 dark:text-yellow-200">
          No dietary restrictions data available. Please configure Google Sheets and run the sync script.
        </p>
      </div>
    );
  }

  // Filter members based on search query
  const filteredMembers = data.members.filter(member => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return member.name.toLowerCase().includes(query) ||
           member.restrictions.some(r => r.item.toLowerCase().includes(query));
  });

  // Filter out "Attending?" from restrictions
  const getMemberRestrictions = (member) => {
    return member.restrictions.filter(r =>
      !r.item.toLowerCase().includes('attending')
    );
  };

  return (
    <div class="space-y-6">
      {/* Search Bar with Title */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Directory
        </h2>
        <input
          type="text"
          value={searchQuery}
          onInput={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or restriction..."
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Members Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const restrictions = getMemberRestrictions(member);
          const airborneRestrictions = restrictions.filter(r => r.severity === "airborne");
          const otherRestrictions = restrictions.filter(r => r.severity !== "airborne");
          const hasOnlyNone = restrictions.length === 1 && restrictions[0].item.toLowerCase() === 'none';
          const hasNoRestrictions = restrictions.length === 0;

          return (
            <div
              key={member.name}
              class="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border-l-4 border-blue-500"
            >
              <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                {member.name}
              </h3>

              {/* Airborne Allergies */}
              {airborneRestrictions.length > 0 && (
                <div class="mb-4 bg-red-50 dark:bg-red-950 border border-red-500 dark:border-red-600 rounded p-3">
                  <h4 class="text-sm font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    AIRBORNE
                  </h4>
                  <ul class="space-y-1">
                    {airborneRestrictions.map(r => (
                      <li key={r.item} class="text-sm text-red-900 dark:text-red-200">
                        • {r.item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Other Restrictions */}
              {hasOnlyNone || hasNoRestrictions ? (
                <p class="text-gray-700 dark:text-gray-300 italic">None</p>
              ) : otherRestrictions.length > 0 ? (
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-400 mb-2">
                    Restrictions
                  </h4>
                  <ul class="space-y-1">
                    {otherRestrictions.map(r => (
                      <li key={r.item} class="text-sm text-gray-700 dark:text-gray-300">
                        • {r.item}
                        {r.severity !== 'yes' && ` (${r.severity})`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          No members found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}
