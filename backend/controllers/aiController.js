import Groq from "groq-sdk";
import AiLog from "../models/AiLog.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Payroll from "../models/Payroll.js";

const MODEL = "openai/gpt-oss-20b";
const TIMEOUT_MS = 15000;
const HOURLY_LIMIT = 20;
const QUOTAS = { annual: 14, sick: 8, casual: 10 };
const LEAVE_TYPES = ["annual", "sick", "casual", "unpaid"];
const TZ = "Asia/Karachi";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const weekday = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date());
const isStaff = (u) => u.role === "admin" || u.role === "hr";
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Client is created lazily so the key is read after dotenv has loaded
const getClient = () => {
  const key = process.env.AI_API_KEY || process.env.GROQ_API_KEY;
  return key ? new Groq({ apiKey: key }) : null;
};

const callModel = (client, messages, extra = {}) =>
  client.chat.completions.create(
    { model: MODEL, messages, ...extra },
    { timeout: TIMEOUT_MS }
  );

const POLICY = `COMPANY POLICY:
- Office starts 09:00 with a 15 minute grace period. Check-in after 09:15 is marked late.
- Working less than 5 hours is a half day. No check-in and no approved leave is absent. No check-out is missing_checkout.
- Weekend is Saturday and Sunday. Only one check-in per day is allowed.
- Leave quotas per year: annual 14, sick 8, casual 10, unpaid unlimited. Only working days count.
- Overlapping leave or leave above the balance is rejected.
- Payroll: gross = 1.5 x basic salary (HRA 40%, medical 10%). Per day = gross / working days. Deductions apply for absent days, unpaid leave and half days (0.5 day). Admin finalizes payroll and finalized payroll is locked.`;

const systemPrompt = (user) => `You are the HCM Lite assistant helping ${user.name} (role: ${user.role}). Today is ${today()} (${weekday()}), Pakistan time.
Rules:
- For any number, name or record, call a tool. Never guess or invent data.
- Answer only from tool results and the company policy below. If you do not know, say so.
- You only see what this user is allowed to see. If an employee asks about another person's salary or private data, politely refuse.
- You cannot change any data. For leave requests, tell the user to use the Leaves page.
- Reply in the same language as the user (English, Urdu or Roman Urdu). Keep answers short and clear.

${POLICY}`;

// ---------- Tools ----------
const fn = (name, description, properties = {}) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: { type: "object", properties, required: [] },
  },
});

const DATE_P = { type: "string", description: "Date as YYYY-MM-DD. Defaults to today." };
const MONTH_P = { type: "string", description: "Month as YYYY-MM. Defaults to the current month." };

const STAFF_TOOLS = [
  fn("get_headcount", "Number of active employees, optionally for one department.", {
    department: { type: "string", description: "Department name (optional)." },
  }),
  fn("get_attendance_summary", "Attendance counts by status for one day or one month.", {
    date: DATE_P,
    month: MONTH_P,
  }),
  fn("get_late_comers", "Top 5 employees who were late most often in a month.", { month: MONTH_P }),
  fn("get_leave_summary", "Leave counts this year and who is on leave today."),
  fn("get_payroll_summary", "Payroll totals for a month.", {
    month: { type: "integer", description: "1 to 12" },
    year: { type: "integer" },
  }),
  fn("search_employees", "Find employees by name, email, department or designation.", {
    query: { type: "string" },
  }),
];

const EMPLOYEE_TOOLS = [
  fn("get_attendance_summary", "The user's own attendance counts for one day or one month.", {
    date: DATE_P,
    month: MONTH_P,
  }),
  fn("get_leave_summary", "The user's own leave counts this year."),
  fn("get_my_leave_balance", "The user's remaining leave balance for this year."),
];

const STAFF_ONLY = ["get_headcount", "get_late_comers", "get_payroll_summary", "search_employees"];

const usedDays = async (employeeId, type, year) => {
  const leaves = await Leave.find({
    employee: employeeId,
    type,
    status: { $in: ["pending", "approved"] },
    startDate: {
      $gte: new Date(`${year}-01-01T00:00:00Z`),
      $lt: new Date(`${year + 1}-01-01T00:00:00Z`),
    },
  }).lean();
  return leaves.reduce((s, l) => s + (l.days || 0), 0);
};

const runTool = async (name, args, user) => {
  const org = user.organization;
  const staff = isStaff(user);

  // Server-side permission check (the model's tool list is not trusted)
  if (STAFF_ONLY.includes(name) && !staff) return { error: "Not allowed for this user." };
  if (name === "get_my_leave_balance" && user.role !== "employee") {
    return { error: "Only employees have a personal leave balance." };
  }

  switch (name) {
    case "get_headcount": {
      const filter = { organization: org, role: "employee" };
      if (args.department) filter.department = new RegExp(`^${esc(args.department)}$`, "i");
      const total = await User.countDocuments(filter);
      const groups = await User.aggregate([
        { $match: filter },
        { $group: { _id: "$department", count: { $sum: 1 } } },
      ]);
      const by_department = {};
      groups.forEach((g) => (by_department[g._id || "Unassigned"] = g.count));
      return { total_employees: total, by_department };
    }

    case "get_attendance_summary": {
      const filter = { organization: org };
      if (!staff) filter.employee = user._id;
      let label;
      if (/^\d{4}-\d{2}$/.test(args.month || "")) {
        filter.date = { $regex: `^${args.month}` };
        label = { month: args.month };
      } else {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(args.date || "") ? args.date : today();
        filter.date = date;
        label = { date };
      }
      const rows = await Attendance.find(filter).lean();
      const t = today();
      const counts = {};
      rows.forEach((r) => {
        const s = !r.checkOut && r.date < t ? "missing_checkout" : r.status;
        counts[s] = (counts[s] || 0) + 1;
      });
      const out = { ...label, total_records: rows.length, by_status: counts };
      if (label.month && rows.length) {
        const good =
          (counts.present || 0) + (counts.late || 0) + (counts.missing_checkout || 0) +
          0.5 * (counts.half_day || 0);
        out.attendance_rate_percent = Math.round((good / rows.length) * 1000) / 10;
        out.note = "Rate is calculated over recorded attendance days.";
      }
      if (staff && label.date) {
        const hc = await User.countDocuments({ organization: org, role: "employee" });
        out.employees_not_checked_in = Math.max(hc - rows.length, 0);
      }
      return out;
    }

    case "get_late_comers": {
      const month = /^\d{4}-\d{2}$/.test(args.month || "") ? args.month : today().slice(0, 7);
      const top = await Attendance.aggregate([
        { $match: { organization: org, status: "late", date: { $regex: `^${month}` } } },
        { $group: { _id: "$employee", late_days: { $sum: 1 } } },
        { $sort: { late_days: -1 } },
        { $limit: 5 },
      ]);
      const users = await User.find({ _id: { $in: top.map((x) => x._id) } })
        .select("name department")
        .lean();
      const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
      return {
        month,
        late_comers: top.map((x) => ({
          name: byId[String(x._id)]?.name || "Unknown",
          department: byId[String(x._id)]?.department || "",
          late_days: x.late_days,
        })),
      };
    }

    case "get_leave_summary": {
      const year = Number(today().slice(0, 4));
      const filter = {
        organization: org,
        startDate: {
          $gte: new Date(`${year}-01-01T00:00:00Z`),
          $lt: new Date(`${year + 1}-01-01T00:00:00Z`),
        },
      };
      if (!staff) filter.employee = user._id;
      const leaves = await Leave.find(filter).populate("employee", "name department").lean();
      const by_status = {};
      const approved_days_by_type = {};
      leaves.forEach((l) => {
        by_status[l.status] = (by_status[l.status] || 0) + 1;
        if (l.status === "approved") {
          const ty = l.type || "casual";
          approved_days_by_type[ty] = (approved_days_by_type[ty] || 0) + (l.days || 1);
        }
      });
      const out = { year, by_status, approved_days_by_type };
      if (staff) {
        const now = new Date(`${today()}T00:00:00Z`);
        out.on_leave_today = leaves
          .filter((l) => l.status === "approved" && l.startDate <= now && l.endDate >= now)
          .map((l) => ({ name: l.employee?.name, type: l.type || "casual" }));
      }
      return out;
    }

    case "get_my_leave_balance": {
      const year = Number(today().slice(0, 4));
      const balance = {};
      for (const type of LEAVE_TYPES) {
        const used = await usedDays(user._id, type, year);
        const quota = QUOTAS[type] ?? null;
        balance[type] = { quota, used, remaining: quota === null ? "unlimited" : quota - used };
      }
      return { year, balance };
    }

    case "get_payroll_summary": {
      const month = Number(args.month) || Number(today().slice(5, 7));
      const year = Number(args.year) || Number(today().slice(0, 4));
      const rows = await Payroll.find({ organization: org, month, year }).lean();
      const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
      return {
        month,
        year,
        records: rows.length,
        paid: rows.filter((r) => r.status === "paid").length,
        total_basic: sum("basicSalary"),
        total_bonus: sum("bonus"),
        total_deductions: sum("deductions"),
        total_net: sum("netSalary"),
      };
    }

    case "search_employees": {
      const q = String(args.query || "").trim();
      const rx = new RegExp(esc(q), "i");
      const filter = { organization: org, role: "employee" };
      if (q) filter.$or = [{ name: rx }, { email: rx }, { department: rx }, { designation: rx }];
      const found = await User.find(filter).select("name email department designation").limit(10).lean();
      return { count: found.length, employees: found };
    }

    default:
      return { error: "Unknown tool." };
  }
};

// ---------- Helpers ----------
const overLimit = async (user) => {
  const used = await AiLog.countDocuments({
    user: user._id,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  return used >= HOURLY_LIMIT;
};

const sendFailure = (res, error) => {
  console.error("AI error:", error.status, error.message);
  const timedOut = /timed? ?out/i.test(error.message || "") || error.name === "APIConnectionTimeoutError";
  if (timedOut) {
    return res.status(504).json({ success: false, message: "The AI took too long to answer. Please try again." });
  }
  if (error.status === 401) {
    return res.status(502).json({ success: false, message: "AI API key is invalid." });
  }
  if (error.status === 429) {
    return res.status(429).json({ success: false, message: "AI rate limit reached. Try again later." });
  }
  return res.status(502).json({ success: false, message: "AI is not available right now. Please try again." });
};

// ---------- POST /api/ai/chat ----------
export const chat = async (req, res) => {
  const message = req.body?.message;
  const log = {
    user: req.user._id,
    organization: req.user.organization,
    endpoint: "chat",
    prompt: typeof message === "string" ? message.slice(0, 1000) : "",
    tools: [],
  };

  try {
    if (typeof message !== "string" || !message.trim() || message.length > 1000) {
      return res.status(400).json({ success: false, message: "Please enter a message (up to 1000 characters)." });
    }

    const client = getClient();
    if (!client) {
      return res.status(500).json({ success: false, message: "AI key is missing from .env." });
    }

    if (await overLimit(req.user)) {
      return res.status(429).json({
        success: false,
        message: "You reached the limit of 20 AI requests per hour. Please try again later.",
      });
    }

    const tools = isStaff(req.user) ? STAFF_TOOLS : EMPLOYEE_TOOLS;
    const messages = [
      { role: "system", content: systemPrompt(req.user) },
      { role: "user", content: message.trim() },
    ];

    let reply = "";
    for (let i = 0; i < 4; i++) {
      const r = await callModel(client, messages, { tools, tool_choice: "auto" });
      const msg = r.choices?.[0]?.message;

      if (!msg?.tool_calls?.length) {
        reply = msg?.content || "";
        break;
      }

      messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });

      for (const call of msg.tool_calls) {
        let result;
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          result = await runTool(call.function.name, args, req.user);
        } catch (e) {
          result = { error: "Tool failed." };
        }
        log.tools.push(call.function.name);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    if (!reply) reply = "Sorry, I could not find an answer. Please try rephrasing your question.";

    log.reply = reply;
    log.ok = true;
    return res.status(200).json({ success: true, reply, label: "AI-generated" });
  } catch (error) {
    log.error = error.message;
    return sendFailure(res, error);
  } finally {
    await AiLog.create(log).catch(() => {});
  }
};

// ---------- POST /api/ai/smart-leave ----------
const parseLeaveJson = (text) => {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[0]);
    const ok =
      LEAVE_TYPES.includes(j.type) &&
      /^\d{4}-\d{2}-\d{2}$/.test(j.start) &&
      /^\d{4}-\d{2}-\d{2}$/.test(j.end) &&
      !Number.isNaN(new Date(j.start).getTime()) &&
      !Number.isNaN(new Date(j.end).getTime()) &&
      j.end >= j.start &&
      typeof j.reason === "string" &&
      j.reason.trim();
    return ok ? { type: j.type, start: j.start, end: j.end, reason: j.reason.trim() } : null;
  } catch {
    return null;
  }
};

export const smartLeave = async (req, res) => {
  const text = req.body?.text;
  const log = {
    user: req.user._id,
    organization: req.user.organization,
    endpoint: "smart_leave",
    prompt: typeof text === "string" ? text.slice(0, 1000) : "",
  };

  try {
    if (typeof text !== "string" || !text.trim() || text.length > 500) {
      return res.status(400).json({ success: false, message: "Describe the leave you need (up to 500 characters)." });
    }

    const client = getClient();
    if (!client) {
      return res.status(500).json({ success: false, message: "AI key is missing from .env." });
    }

    if (await overLimit(req.user)) {
      return res.status(429).json({ success: false, message: "You reached the limit of 20 AI requests per hour." });
    }

    const messages = [
      {
        role: "system",
        content: `Today is ${today()} (${weekday()}), Pakistan time. Turn the user's leave request into JSON only, with no other text:
{"type":"casual|sick|annual|unpaid","start":"YYYY-MM-DD","end":"YYYY-MM-DD","reason":"short reason in English"}
Rules: "next Monday" means the first Monday after today. Weddings and family events are casual. Illness is sick. Holidays and travel are annual. If only one day is needed, start and end are the same.`,
      },
      { role: "user", content: text.trim() },
    ];

    let suggestion = null;
    for (let attempt = 0; attempt < 2 && !suggestion; attempt++) {
      const r = await callModel(client, messages);
      suggestion = parseLeaveJson(r.choices?.[0]?.message?.content);
    }

    if (!suggestion) {
      log.error = "Could not parse leave JSON";
      return res.status(422).json({
        success: false,
        message: "I could not understand that. Please fill the form yourself.",
      });
    }

    log.reply = JSON.stringify(suggestion);
    log.ok = true;
    return res.status(200).json({ success: true, suggestion, label: "AI-generated" });
  } catch (error) {
    log.error = error.message;
    return sendFailure(res, error);
  } finally {
    await AiLog.create(log).catch(() => {});
  }
};