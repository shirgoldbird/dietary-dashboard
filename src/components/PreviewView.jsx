import { h } from 'preact';
import { useState } from 'preact/hooks';

export default function PreviewView({ data }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter out "Attending?" and "Approved?" from restrictions
  const getMemberRestrictions = (member) => {
    return member.restrictions.filter(r =>
      !r.item.toLowerCase().includes('attending') &&
      !r.item.toLowerCase().includes('approved')
    );
  };

  if (!data || !data.members || data.members.length === 0) {
    return (
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p class="text-yellow-800 dark:text-yellow-200">
          No dietary restrictions data available. Please configure Google Sheets and run the sync script.
        </p>
      </div>
    );
  }

  // Filter members based on search query (admin view - only show unapproved)
  const filteredMembers = data.members.filter(member => {
    // Only show unapproved members
    if (member.approved) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return member.name.toLowerCase().includes(query) ||
           member.restrictions.some(r => r.item.toLowerCase().includes(query));
  });

  // Count approved vs unapproved
  const approvedCount = data.members.filter(m => m.approved).length;
  const unapprovedCount = data.members.filter(m => !m.approved).length;

  return (
    <div class="space-y-6">
      {/* Admin Mode Banner */}
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-eye text-yellow-600 dark:text-yellow-400 text-2xl"></i>
          <div>
            <h2 class="text-lg font-bold text-yellow-800 dark:text-yellow-300">Preview Mode - Pending Approvals</h2>
            <p class="text-sm text-yellow-700 dark:text-yellow-400">
              Showing {unapprovedCount} pending member{unapprovedCount !== 1 ? 's' : ''}. Click a card to view their preview page at <code class="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">/preview/name</code>
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Pending Members
        </h2>

        {/* Search Input */}
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

          const previewUrl = `/preview/${member.name.toLowerCase().replace(/\s+/g, '-')}`;

          return (
            <a
              key={member.name}
              href={previewUrl}
              class={`block bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer ${
                member.approved
                  ? 'border-green-500'
                  : 'border-yellow-500'
              }`}
            >
              {/* Member Name with Status Badge */}
              <div class="flex items-start justify-between mb-3">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {member.name}
                </h3>
                {member.approved ? (
                  <span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded">
                    <i class="fa-solid fa-check-circle"></i>
                    Approved
                  </span>
                ) : (
                  <span class="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-medium rounded">
                    <i class="fa-solid fa-clock"></i>
                    Pending
                  </span>
                )}
              </div>

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

            </a>
          );
        })}
      </div>

      {unapprovedCount === 0 ? (
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
          <i class="fa-solid fa-check-circle text-green-600 dark:text-green-400 text-4xl mb-3"></i>
          <p class="text-green-800 dark:text-green-200 font-medium">
            All members have been approved!
          </p>
        </div>
      ) : filteredMembers.length === 0 && searchQuery ? (
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          No pending members found matching "{searchQuery}"
        </div>
      ) : null}
    </div>
  );
}
