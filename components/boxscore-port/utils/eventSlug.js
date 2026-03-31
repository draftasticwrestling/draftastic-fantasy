/**
 * Normalize date string to YYYY-MM-DD for URLs and slugs.
 */
export function normalizeDateToISO(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).replace(/[^0-9-]/g, '');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (_) {
    return String(dateStr).replace(/[^0-9-]/g, '');
  }
}

/**
 * SEO-friendly event slug for URLs, e.g. "wwe-raw-2026-02-23"
 */
export function getEventSlug(event) {
  if (!event) return '';
  const name = (event.name || '').trim();
  const slugName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'event';
  const datePart = normalizeDateToISO(event.date);
  return datePart ? `${slugName}-${datePart}` : slugName;
}
