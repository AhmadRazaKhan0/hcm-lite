import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Loading, Empty, errMsg } from '../components/ui.jsx';

export default function AuditPage() {
  const toast = useToast();
  const [data, setData] = useState({ logs: [], pages: 1 });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { params: { page, limit: 25, action: action || undefined } })
      .then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [page, action]); // eslint-disable-line
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Read-only record of important actions">
        <input className="input w-56" placeholder="Filter action e.g. FINALIZE" value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} />
      </PageHeader>
      <div className="card p-0">{loading ? <Loading /> : !data.logs.length ? <Empty text="No audit entries" /> : (
        <div className="table-container"><table className="hcm-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{data.logs.map((l) => (<tr key={l._id}><td className="whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
            <td>{l.actorName} <span className="badge-neutral">{l.actorRole}</span></td><td><span className="badge-purple">{l.action}</span></td>
            <td>{l.targetModel} {l.targetName}</td><td className="text-xs text-slate-500 max-w-xs truncate" title={JSON.stringify(l.details)}>{Object.keys(l.details || {}).length ? JSON.stringify(l.details) : '—'}</td></tr>))}</tbody></table></div>)}</div>
      <div className="flex items-center justify-end gap-2 mt-4 text-sm text-slate-400">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span>Page {page} / {data.pages || 1}</span>
        <button className="btn-secondary btn-sm" disabled={page >= (data.pages || 1)} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </>
  );
}
