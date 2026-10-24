import Payroll from "../models/Payroll.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";

const TZ = "Asia/Karachi";
const ymd = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const today = () => ymd(new Date());
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// Working days (Mon to Fri) between two YYYY-MM-DD dates, inclusive
const workingDays = (fromStr, toStr) => {
  const out = [];
  const d = new Date(`${fromStr}T00:00:00Z`);
  const end = new Date(`${toStr}T00:00:00Z`);
  while (d <= end) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

// Tax slab on annual gross
const annualTax = (a) => {
  if (a <= 600000) return 0;
  if (a <= 1200000) return (a - 600000) * 0.05;
  if (a <= 2400000) return 30000 + (a - 1200000) * 0.15;
  if (a <= 3600000) return 210000 + (a - 2400000) * 0.25;
  return 510000 + (a - 3600000) * 0.35;
};

const fail = (status, message) => Object.assign(new Error(message), { status });

const calculate = async (employee, month, year, bonus, otherDeductions) => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const t = today();

  const joined = ymd(employee.createdAt);
  if (joined > monthEnd) {
    throw fail(422, "This employee joined after the selected month.");
  }
  if (monthStart > t) {
    throw fail(422, "This month has not started yet.");
  }

  const totalWorking = workingDays(monthStart, monthEnd).length;
  const from = joined > monthStart ? joined : monthStart;
  const to = t < monthEnd ? t : monthEnd;
  const eligible = from <= to ? workingDays(from, to) : [];
  const payableDays = workingDays(from, monthEnd).length; // joiner proration

  const attendance = await Attendance.find({
    employee: employee._id,
    date: { $gte: monthStart, $lte: monthEnd },
  }).lean();
  const byDate = Object.fromEntries(attendance.map((a) => [a.date, a]));

  const leaves = await Leave.find({
    employee: employee._id,
    status: "approved",
    startDate: { $lte: new Date(`${monthEnd}T00:00:00Z`) },
    endDate: { $gte: new Date(`${monthStart}T00:00:00Z`) },
  }).lean();

  let absent = 0;
  let unpaid = 0;
  let half = 0;

  for (const d of eligible) {
    const rec = byDate[d];
    if (rec) {
      if (rec.status === "absent") absent++;
      if (rec.status === "half_day") half++;
      continue;
    }
    const leave = leaves.find((l) => iso(l.startDate) <= d && iso(l.endDate) >= d);
    if (leave) {
      if (leave.type === "unpaid") unpaid++;
      continue; // paid leave: no deduction
    }
    if (d !== t) absent++; // today may still check in
  }

  const basic = employee.salary || 0;
  const hra = basic * 0.4;
  const medical = basic * 0.1;
  const gross = basic * 1.5;
  const perDay = totalWorking ? gross / totalWorking : 0;
  const earned = totalWorking ? perDay * payableDays : 0;
  const attendanceDeduction = perDay * (absent + unpaid + 0.5 * half);
  const tax = annualTax(gross * 12) / 12;
  const deductions = attendanceDeduction + tax + otherDeductions;
  const net = Math.max(0, earned - attendanceDeduction - tax + bonus - otherDeductions);

  const r = Math.round;
  return {
    basicSalary: r(basic),
    hra: r(hra),
    medical: r(medical),
    grossSalary: r(gross),
    workingDays: totalWorking,
    payableDays,
    absentDays: absent,
    unpaidDays: unpaid,
    halfDays: half,
    attendanceDeduction: r(attendanceDeduction),
    tax: r(tax),
    otherDeductions: r(otherDeductions),
    bonus: r(bonus),
    deductions: r(deductions),
    netSalary: r(net),
  };
};

export const generatePayroll = async (req, res) => {
  try {
    const { employeeId, month, year, bonus = 0 } = req.body ?? {};
    const other = req.body?.otherDeductions ?? req.body?.deductions ?? 0;

    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    const parsedBonus = Number(bonus);
    const parsedOther = Number(other);

    if (
      !employeeId ||
      !Number.isInteger(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      !Number.isInteger(parsedYear) ||
      parsedYear < 2020 ||
      !Number.isFinite(parsedBonus) ||
      parsedBonus < 0 ||
      !Number.isFinite(parsedOther) ||
      parsedOther < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid employee ID, month, year, bonus and other deductions.",
      });
    }

    const employee = await User.findOne({
      _id: employeeId,
      organization: req.user.organization,
      role: "employee",
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your organization.",
      });
    }

    const existing = await Payroll.findOne({
      employee: employee._id,
      month: parsedMonth,
      year: parsedYear,
    });

    if (existing && existing.status !== "draft") {
      return res.status(409).json({
        success: false,
        message: "This payroll is finalized and locked. It cannot be changed.",
      });
    }

    const figures = await calculate(employee, parsedMonth, parsedYear, parsedBonus, parsedOther);

    let payroll;
    if (existing) {
      Object.assign(existing, figures);
      payroll = await existing.save();
    } else {
      payroll = await Payroll.create({
        employee: employee._id,
        organization: req.user.organization,
        month: parsedMonth,
        year: parsedYear,
        ...figures,
      });
    }

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? "Payroll draft updated." : "Payroll draft created.",
      payroll,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Payroll already exists for this employee and month.",
      });
    }
    console.error("Generate payroll error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not generate payroll.",
    });
  }
};

export const getPayroll = async (req, res) => {
  try {
    const filter = { organization: req.user.organization };

    if (req.user.role === "employee") {
      filter.employee = req.user._id;
      filter.status = { $in: ["finalized", "paid"] }; // no drafts for employees
    } else if (req.query.employeeId) {
      filter.employee = req.query.employeeId;
    }

    if (req.query.month) filter.month = Number(req.query.month);
    if (req.query.year) filter.year = Number(req.query.year);

    const payrolls = await Payroll.find(filter)
      .populate("employee", "name email department designation")
      .sort({ year: -1, month: -1 });

    return res.status(200).json({
      success: true,
      count: payrolls.length,
      payrolls,
    });
  } catch (error) {
    console.error("Get payroll error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch payroll.",
    });
  }
};

export const finalizePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found.",
      });
    }

    if (payroll.status === "finalized" || payroll.status === "paid") {
      return res.status(409).json({
        success: false,
        message: "This payroll is already finalized.",
      });
    }

    payroll.status = "finalized"; // also fixes old records saved as "generated"
    payroll.finalizedBy = req.user._id;
    payroll.finalizedAt = new Date();
    await payroll.save();

    return res.status(200).json({
      success: true,
      message: "Payroll finalized and locked.",
      payroll,
    });
  } catch (error) {
    console.error("Finalize payroll error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not finalize payroll.",
    });
  }
};

export const markPayrollPaid = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found.",
      });
    }

    if (payroll.status === "paid") {
      return res.status(409).json({
        success: false,
        message: "This payroll is already marked as paid.",
      });
    }

    if (payroll.status !== "finalized") {
      return res.status(409).json({
        success: false,
        message: "Only finalized payroll can be marked as paid. Ask the admin to finalize it first.",
      });
    }

    payroll.status = "paid";
    await payroll.save();

    return res.status(200).json({
      success: true,
      message: "Payroll marked as paid.",
      payroll,
    });
  } catch (error) {
    console.error("Mark payroll paid error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update payroll status.",
    });
  }
};