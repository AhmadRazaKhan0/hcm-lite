import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api.js';
import { PageHeader, errMsg } from '../components/ui.jsx';
import { Send, Bot, Sparkles } from 'lucide-react';

const POLICY = 'Office starts 09:00 with a 15-minute grace; half day under 5 hours; weekend Sat–Sun. Leave quotas: annual 14, sick 8, casual 10, unpaid unlimited.';
const SUGGEST = {
  admin: ['How many active employees do we have?', 'What is this month\'s payroll status?', 'Who is late today?'],
  hr: ['Who is late today?', 'How many leave requests are pending?', 'Attendance summary today'],
  employee: ['How many sick leaves do I have left?', 'What is the grace period for check-in?', 'What is my colleague\'s salary?'],
};

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy]);

  async function send(q) {
    const content = (q ?? text).trim();
    if (!content || busy) return;
    const next = [...msgs, { role: 'user', content }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const { data } = await api.post('/ai/chat', { messages: next.map(({ role, content }) => ({ role, content })) });
      setMsgs([...next, { role: 'assistant', content: data.reply, ai: true }]);
    } catch (e) { setMsgs([...next, { role: 'assistant', content: errMsg(e, 'The assistant is unavailable right now.'), error: true }]); }
    finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Answers use your own access level and live company data" />
      <div className="card flex flex-col h-[65vh]">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {!msgs.length && <div className="text-center text-slate-500 mt-10">
            <Bot size={40} className="mx-auto mb-3 opacity-50" /><p className="mb-1">Ask about attendance, leave, payroll or policy.</p>
            <p className="text-xs max-w-md mx-auto mb-4">{POLICY}</p>
            <div className="flex flex-wrap justify-center gap-2">{(SUGGEST[user.role] || []).map((s) => <button key={s} className="btn-secondary btn-sm" onClick={() => send(s)}>{s}</button>)}</div></div>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-teal-600 text-white' : m.error ? 'bg-red-500/10 text-red-300' : 'bg-slate-700/60 text-slate-200'}`}>
                {m.content}{m.ai && <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Sparkles size={10} /> AI-generated</div>}</div></div>))}
          {busy && <div className="text-sm text-slate-400 animate-pulse">Thinking…</div>}
          <div ref={end} />
        </div>
        <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" placeholder="Ask a question…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary" disabled={busy}><Send size={16} /></button>
        </form>
      </div>
    </>
  );
}
