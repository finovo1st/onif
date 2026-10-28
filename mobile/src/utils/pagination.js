/**
 * FINOVO Mobile Pagination Helper Utilities
 */

/**
 * Extracts and normalizes paginated responses from Django REST Framework endpoints.
 * Handles both DRF paginated objects { count, next, previous, results: [] }
 * and plain arrays [ ... ].
 *
 * @param {object|array} data - Response from apiCall
 * @param {number} fallbackPage - The page that was requested (default 1)
 * @param {number} pageSize - Page size (default 20, matching DRF settings)
 * @returns {object} { results, count, currentPage, totalPages, hasNext, hasPrev }
 */
export const parsePaginatedResponse = (data, fallbackPage = 1, pageSize = 20) => {
  if (!data) {
    return {
      results: [],
      count: 0,
      currentPage: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
  }

  // Plain array fallback
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      currentPage: 1,
      totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
      hasNext: false,
      hasPrev: false,
    };
  }

  const results = Array.isArray(data.results) ? data.results : [];
  const count = typeof data.count === 'number' ? data.count : results.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  // Determine current page from next/previous links or fallback
  let currentPage = fallbackPage;
  if (data.previous) {
    const prevMatch = data.previous.match(/[?&]page=(\d+)/);
    if (prevMatch) {
      currentPage = parseInt(prevMatch[1], 10) + 1;
    } else {
      currentPage = 2;
    }
  } else if (data.next) {
    const nextMatch = data.next.match(/[?&]page=(\d+)/);
    if (nextMatch) {
      currentPage = Math.max(1, parseInt(nextMatch[1], 10) - 1);
    } else {
      currentPage = 1;
    }
  }

  return {
    results,
    count,
    currentPage,
    totalPages,
    hasNext: Boolean(data.next),
    hasPrev: Boolean(data.previous),
  };
};
