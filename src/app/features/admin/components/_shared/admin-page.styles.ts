// Shared style block reused by all expansion admin pages so they look uniform.
// Keep this small — components extend with their own ad-hoc styles when needed.
export const ADMIN_PAGE_STYLES = `
  .admin-page { padding: 24px; max-width: 1400px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
  .page-header h1 { font-size: 23px; font-weight: 600; color: #111827; margin: 0 0 4px; }
  .page-header h1 i { color: #6366f1; margin-right: 8px; }
  .page-header p { color: #6b7280; margin: 0; font-size: 13px; }
  .toast { padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; display: flex; gap: 8px; font-size: 13px; }
  .toast.ok { background: #d1fae5; color: #065f46; }
  .toast.err { background: #fee2e2; color: #991b1b; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 11px; padding: 14px; display: flex; gap: 11px; align-items: center; }
  .stat-icon { width: 38px; height: 38px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .stat-icon.indigo { background: #eef2ff; color: #6366f1; }
  .stat-icon.green { background: #d1fae5; color: #10b981; }
  .stat-icon.red { background: #fee2e2; color: #ef4444; }
  .stat-icon.amber { background: #fef3c7; color: #f59e0b; }
  .stat-icon.pink { background: #fce7f3; color: #ec4899; }
  .stat-icon.teal { background: #ccfbf1; color: #0d9488; }
  .stat-value { display: block; font-size: 20px; font-weight: 700; color: #111827; }
  .stat-label { font-size: 11px; color: #6b7280; }
  .layout { display: grid; gap: 18px; }
  .layout.two-col { grid-template-columns: 360px 1fr; align-items: flex-start; }
  @media (max-width: 1100px) { .layout.two-col { grid-template-columns: 1fr; } }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
  .card h2 { font-size: 15px; font-weight: 600; margin: 0 0 12px; color: #111827; display: flex; align-items: center; gap: 8px; }
  .card h2 i { color: #6366f1; }
  .row-list { display: flex; flex-direction: column; gap: 8px; max-height: 600px; overflow-y: auto; }
  .row-item { padding: 11px 13px; border: 1px solid #e5e7eb; border-radius: 9px; display: flex; gap: 10px; align-items: flex-start; }
  .row-item.muted { opacity: .65; }
  .row-item .grow { flex: 1; min-width: 0; }
  .badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 9px; letter-spacing: .4px; width: fit-content; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #fef3c7; color: #92400e; }
  .badge.err { background: #fee2e2; color: #991b1b; }
  .badge.idle { background: #e5e7eb; color: #4b5563; }
  .badge.indigo { background: #eef2ff; color: #4f46e5; }
  .badge.pink { background: #fce7f3; color: #9d174d; }
  .module-context { margin-bottom: 20px; }
  .module-context__head { margin-bottom: 10px; }
  .module-context__eyebrow { display: inline-block; margin-bottom: 6px; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
  .module-context__head h2 { margin: 0; font-size: 18px; color: #111827; }
  .module-context__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
  .module-context__card { background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
  .module-context__card--full { margin-top: 0; }
  .module-context__card h3 { margin: 0 0 8px; font-size: 14px; color: #111827; }
  .module-context__card p { margin: 0; color: #4b5563; font-size: 13px; line-height: 1.55; }
  .module-context__card ul { margin: 0; padding-left: 18px; color: #4b5563; font-size: 13px; line-height: 1.55; }
  .module-context__card li + li { margin-top: 4px; }
  @media (max-width: 900px) { .module-context__grid { grid-template-columns: 1fr; } }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table th { text-align: left; background: #f9fafb; padding: 8px; font-weight: 600; color: #374151; font-size: 11px; text-transform: uppercase; }
  table td { padding: 9px 8px; border-bottom: 1px solid #f3f4f6; color: #111827; }
  table tr:last-child td { border: none; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .form-grid.one { grid-template-columns: 1fr; }
  .form-grid > .wide { grid-column: 1 / -1; }
  .form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #6b7280; }
  .form-grid input, .form-grid select, .form-grid textarea { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit; }
  .form-grid textarea { resize: vertical; min-height: 60px; }
  .actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .btn { padding: 9px 14px; border-radius: 7px; cursor: pointer; font-weight: 500; font-size: 13px; display: inline-flex; gap: 6px; align-items: center; border: 1px solid transparent; }
  .btn.primary { background: #111; color: #fff; border-color: #111; }
  .btn.primary:hover { background: #333; }
  .btn.gradient { background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff; border: none; }
  .btn.danger { background: #ef4444; color: #fff; border-color: #ef4444; }
  .btn.ghost { background: transparent; color: #6366f1; border-color: #d1d5db; }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
  .filters input, .filters select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
  .filters input { min-width: 180px; }
  .empty, .loading { text-align: center; padding: 32px; color: #6b7280; font-size: 13px; }
  .mono { font-family: 'Courier New', monospace; font-size: 11px; color: #6b7280; }
  .small { font-size: 11px; color: #9ca3af; }
`;

export function adminAuthHeaders(): Record<string, string> {
  const t = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
  return t ? { Authorization: `Bearer ${t}` } : {};
}
