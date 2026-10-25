/**
 * AI HR Assistant Service
 * 
 * Uses Google Gemini API (or OpenAI if OPENAI_API_KEY is set) to power
 * natural-language HR queries. Implements tool/function calling so the AI
 * only queries real database data.
 * 
 * All tools enforce company scoping and role-based access.
 * Never expose PII beyond what the role is allowed to see.
 */

import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import Payroll from '../models/Payroll.js';
import { dayOnly } from '../utils/dateGeo.js';

// ─── Tool definitions (what the AI can call) ─────────────────────────────────

const TOOLS = [
  {
    name: 'get_headcount',
    description: 'Get total and active employee count for the company',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_attendance_summary',
    description: 'Get attendance summary for a specific date (default: today). Returns present, late, absent, half-day counts.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Default: today.' },
      },
      required: [],
    },
  },
  {
    name: 'get_late_comers',
    description: 'Get list of employees who were late on a given date (default: today)',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
      },
      required: [],
    },
  },
  {
    name: 'get_leave_summary',
    description: 'Get pending leave request count and recent leave requests (HR/Admin only)',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_my_leave_balance',
    description: 'Get the leave balance for the currently logged-in employee',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_payroll_summary',
    description: 'Get payroll summary for a given month and year (HR/Admin only)',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: '1-12' },
        year: { type: 'number', description: '4-digit year' },
      },
      required: [],
    },
  },
  {
    name: 'search_employees',
    description: 'Search employees by name or ID (HR/Admin only)',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or employee ID to search' },
      },
      required: ['query'],
    },
  },
];

// ─── Tool executors ───────────────────────────────────────────────────────────

async function executeTool(name, args, { companyId, userId, role }) {
  switch (name) {
    case 'get_headcount': {
      const [total, active] = await Promise.all([
        Employee.countDocuments({ company: companyId }),
        Employee.countDocuments({ company: companyId, employmentStatus: 'active' }),
      ]);
      return { total, active, inactive: total - active };
    }

    case 'get_attendance_summary': {
      const date = args.date ? dayOnly(new Date(args.date)) : dayOnly(new Date());
      const records = await Attendance.find({ company: companyId, date });
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const halfDay = records.filter(r => r.status === 'half-day').length;
      const absent = records.filter(r => r.status === 'absent').length;
      return { date: date.toISOString().slice(0, 10), present, late, halfDay, absent, total: records.length };
    }

    case 'get_late_comers': {
      // Only HR/Admin can see names of late comers
      if (role === 'employee') return { error: 'Access denied' };
      const date = args.date ? dayOnly(new Date(args.date)) : dayOnly(new Date());
      const records = await Attendance.find({ company: companyId, date, status: 'late' })
        .populate({ path: 'employee', select: 'employeeId', populate: { path: 'user', select: 'name' } })
        .select('clockIn employee')
        .limit(20);
      return {
        date: date.toISOString().slice(0, 10),
        count: records.length,
        employees: records.map(r => ({
          name: r.employee?.user?.name || 'Unknown',
          employeeId: r.employee?.employeeId,
          clockIn: r.clockIn,
        })),
      };
    }

    case 'get_leave_summary': {
      if (role === 'employee') return { error: 'Access denied' };
      const [pending, approved, rejected] = await Promise.all([
        LeaveRequest.countDocuments({ company: companyId, status: 'pending' }),
        LeaveRequest.countDocuments({ company: companyId, status: 'approved' }),
        LeaveRequest.countDocuments({ company: companyId, status: 'rejected' }),
      ]);
      const recent = await LeaveRequest.find({ company: companyId, status: 'pending' })
        .populate({ path: 'employee', select: 'employeeId', populate: { path: 'user', select: 'name' } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('leaveType startDate endDate days employee');
      return {
        pending, approved, rejected,
        recentPending: recent.map(r => ({
          employee: r.employee?.user?.name,
          leaveType: r.leaveType,
          startDate: r.startDate,
          endDate: r.endDate,
          days: r.days,
        })),
      };
    }

    case 'get_my_leave_balance': {
      const employee = await Employee.findOne({ user: userId, company: companyId });
      if (!employee) return { error: 'Employee profile not found' };
      const year = new Date().getFullYear();
      const balance = await LeaveBalance.findOne({ employee: employee._id, year });
      if (!balance) return { message: 'No leave balance record found for this year' };
      return {
        year,
        annual: { total: balance.annual.total, used: balance.annual.used, remaining: balance.annual.total - balance.annual.used },
        sick: { total: balance.sick.total, used: balance.sick.used, remaining: balance.sick.total - balance.sick.used },
        casual: { total: balance.casual.total, used: balance.casual.used, remaining: balance.casual.total - balance.casual.used },
      };
    }

    case 'get_payroll_summary': {
      if (role === 'employee') return { error: 'Access denied' };
      const now = new Date();
      const month = args.month || (now.getMonth() + 1);
      const year = args.year || now.getFullYear();
      const result = await Payroll.aggregate([
        { $match: { company: companyId, month, year } },
        { $group: { _id: '$status', total: { $sum: '$netSalary' }, count: { $sum: 1 } } },
      ]);
      const byStatus = {};
      result.forEach(r => { byStatus[r._id] = { total: r.total, count: r.count }; });
      return { month, year, byStatus };
    }

    case 'search_employees': {
      if (role === 'employee') return { error: 'Access denied' };
      const { query } = args;
      if (!query) return { error: 'Search query required' };
      const employees = await Employee.aggregate([
        { $match: { company: companyId } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userInfo' } },
        { $unwind: '$userInfo' },
        {
          $match: {
            $or: [
              { 'userInfo.name': { $regex: query, $options: 'i' } },
              { employeeId: { $regex: query, $options: 'i' } },
            ],
          },
        },
        { $limit: 10 },
        { $project: { employeeId: 1, jobTitle: 1, employmentStatus: 1, 'userInfo.name': 1, 'userInfo.email': 1 } },
      ]);
      return { count: employees.length, employees };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main chat function ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI HR Assistant for HCM Lite, a Human Capital Management system.
You help HR managers, admins, and employees with HR-related queries.
You have access to real-time company data through tools.
You can also answer in Roman Urdu (e.g. "Aaj kitne employees present hain?").
Always be accurate and use data from tools — never make up statistics.
Respect role-based access: employees can only see their own data.
Format numbers in PKR where relevant (e.g., PKR 85,000).
Keep responses concise and helpful.`;

export async function chat({ messages, companyId, userId, role }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      reply: "AI assistant is not configured. Please add GEMINI_API_KEY to the backend .env file.",
      isConfigured: false,
    };
  }

  // Use Gemini if GEMINI_API_KEY is set, otherwise OpenAI
  if (process.env.GEMINI_API_KEY) {
    return chatWithGemini({ messages, companyId, userId, role, apiKey });
  } else {
    return chatWithOpenAI({ messages, companyId, userId, role, apiKey });
  }
}

async function chatWithGemini({ messages, companyId, userId, role, apiKey }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai').catch(() => null) || {};

  if (!GoogleGenerativeAI) {
    // Fallback: simple tool resolution without SDK
    return simpleToolChat({ messages, companyId, userId, role });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: TOOLS }],
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    let result = await chat.sendMessage(lastMessage.content);

    // Handle tool calls
    let response = result.response;
    const toolCalls = response.functionCalls?.() || [];

    if (toolCalls.length > 0) {
      const toolResults = [];
      for (const call of toolCalls) {
        const toolResult = await executeTool(call.name, call.args, { companyId, userId, role });
        toolResults.push({
          functionResponse: { name: call.name, response: toolResult },
        });
      }
      result = await chat.sendMessage(toolResults);
      response = result.response;
    }

    return { reply: response.text(), isConfigured: true };
  } catch (err) {
    console.error('[AI] Gemini error:', err.message);
    return { reply: `AI error: ${err.message}`, isConfigured: true };
  }
}

async function simpleToolChat({ messages, companyId, userId, role }) {
  // Fallback when Gemini SDK not installed: do simple keyword matching to call tools
  const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

  let toolName = null;
  let toolArgs = {};

  if (lastMsg.includes('headcount') || lastMsg.includes('kitne employee') || lastMsg.includes('employees hain')) {
    toolName = 'get_headcount';
  } else if (lastMsg.includes('present') || lastMsg.includes('attendance') || lastMsg.includes('hazir')) {
    toolName = 'get_attendance_summary';
  } else if (lastMsg.includes('late') || lastMsg.includes('der se')) {
    toolName = 'get_late_comers';
  } else if (lastMsg.includes('leave') || lastMsg.includes('chutti') || lastMsg.includes('pending')) {
    toolName = 'get_leave_summary';
  } else if (lastMsg.includes('my leave') || lastMsg.includes('meri leaves') || lastMsg.includes('meri chutti')) {
    toolName = 'get_my_leave_balance';
  } else if (lastMsg.includes('payroll') || lastMsg.includes('salary') || lastMsg.includes('tankhwah')) {
    toolName = 'get_payroll_summary';
  }

  if (toolName) {
    const data = await executeTool(toolName, toolArgs, { companyId, userId, role });
    return {
      reply: `Here is the data:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n(Note: Install @google/generative-ai for full AI responses)`,
      isConfigured: true,
    };
  }

  return {
    reply: "I can help with: employee headcount, attendance, leave requests, leave balances, and payroll summaries. Ask me anything! (Install @google/generative-ai for full AI support)",
    isConfigured: true,
  };
}

async function chatWithOpenAI({ messages, companyId, userId, role, apiKey }) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools: TOOLS.map(t => ({ type: 'function', function: t })),
        tool_choice: 'auto',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI error');

    const choice = data.choices[0];
    if (choice.finish_reason === 'tool_calls') {
      const toolCall = choice.message.tool_calls[0];
      const toolResult = await executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
        { companyId, userId, role }
      );

      // Send tool result back
      const followup = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
            choice.message,
            { role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) },
          ],
        }),
      });
      const followData = await followup.json();
      return { reply: followData.choices[0].message.content, isConfigured: true };
    }

    return { reply: choice.message.content, isConfigured: true };
  } catch (err) {
    console.error('[AI] OpenAI error:', err.message);
    return { reply: `AI error: ${err.message}`, isConfigured: true };
  }
}
