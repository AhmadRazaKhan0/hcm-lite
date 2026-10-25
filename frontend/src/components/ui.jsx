import { X, Loader2, Inbox } from 'lucide-react';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-box animate-scale-in ${wide ? 'max-w-3xl' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button className="text-slate-400 hover:text-white" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  return <div className="flex items-center justify-center h-40 text-slate-400"><Loader2 className="animate-spin mr-2" size={18} /> Loading…</div>;
}

export function Empty({ text = 'Nothing here yet' }) {
  return <div className="flex flex-col items-center justify-center py-12 text-slate-500"><Inbox size={36} className="mb-2 opacity-50" /><p className="text-sm">{text}</p></div>;
}

export function Field({ label, children }) {
  return <div className="form-group"><label className="input-label">{label}</label>{children}</div>;
}

export const STATUS_BADGE = {
  present: 'badge-success', late: 'badge-warning', 'half-day': 'badge-info', absent: 'badge-danger',
  pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger', cancelled: 'badge-neutral',
  draft: 'badge-warning', finalized: 'badge-success',
};
export const Badge = ({ s }) => <span className={STATUS_BADGE[s] || 'badge-neutral'}>{s}</span>;

export const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
export const pkr = (n) => `PKR ${Math.round(n || 0).toLocaleString()}`;
export const errMsg = (e, fb = 'Something went wrong') =>
  e.response?.data?.errors?.map((x) => x.reason).join(', ') || e.response?.data?.message || fb;
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
