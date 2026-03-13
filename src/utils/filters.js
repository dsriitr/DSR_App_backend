/**
 * Parses standard filter params from query string:
 * managerId, period, dateFrom, dateTo, projectId
 * Returns { dateFrom, dateTo, managerId, projectId, whereClauses[], params[] }
 */
function parseFilters(query, paramOffset = 1) {
  const { managerId, period, dateFrom, dateTo, projectId } = query;
  const whereClauses = [];
  const params = [];
  let idx = paramOffset;

  // Date range
  let from = dateFrom;
  let to = dateTo;

  if (!from || !to) {
    const now = new Date();
    switch (period) {
      case 'Today':
        from = to = now.toISOString().split('T')[0];
        break;
      case 'Yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        from = to = y.toISOString().split('T')[0];
        break;
      }
      case 'This Week': {
        const day = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        from = mon.toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
        break;
      }
      case 'Last Month': {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lme = new Date(now.getFullYear(), now.getMonth(), 0);
        from = lm.toISOString().split('T')[0];
        to = lme.toISOString().split('T')[0];
        break;
      }
      case 'This Month':
      default: {
        from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        to = now.toISOString().split('T')[0];
      }
    }
  }

  return { from, to, managerId, projectId, whereClauses, params, idx };
}

module.exports = { parseFilters };
