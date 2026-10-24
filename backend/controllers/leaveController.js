import Leave from "../models/Leave.js";
import User from "../models/User.js";

const QUOTAS = { annual: 14, sick: 8, casual: 10 };
const LEAVE_TYPES = ["annual", "sick", "casual", "unpaid"];
const ACTIVE = ["pending", "approved"];

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date()
  );

// Count working days between two YYYY-MM-DD dates (skips Saturday and Sunday)
const countWorkingDays = (startStr, endStr) => {
  let count = 0;
  const d = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  while (d <= end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
};

// Days already used (pending + approved) for one type in one year
const usedDays = async (employeeId, type, year) => {
  const leaves = await Leave.find({
    employee: employeeId,
    type,
    status: { $in: ACTIVE },
    startDate: {
      $gte: new Date(`${year}-01-01T00:00:00Z`),
      $lt: new Date(`${year + 1}-01-01T00:00:00Z`),
    },
  }).lean();
  return leaves.reduce((sum, l) => sum + (l.days || 0), 0);
};

export const requestLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason, type = "casual" } = req.body ?? {};

    if (!startDate || !endDate || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Start date, end date and reason are required.",
      });
    }

    if (!LEAVE_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Leave type must be annual, sick, casual or unpaid.",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start.toISOString().slice(0, 10) !== startDate ||
      end.toISOString().slice(0, 10) !== endDate ||
      end < start
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid dates; end date must not be before start date.",
      });
    }

    if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
      return res.status(400).json({
        success: false,
        message: "Leave cannot span two years. Please submit two separate requests.",
      });
    }

    const days = countWorkingDays(startDate, endDate);

    if (days === 0) {
      return res.status(422).json({
        success: false,
        message: "The selected dates are only weekends. Choose working days.",
      });
    }

    // Overlap check
    const overlap = await Leave.findOne({
      employee: req.user._id,
      status: { $in: ACTIVE },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlap) {
      return res.status(422).json({
        success: false,
        message: "You already have a leave request overlapping these dates.",
      });
    }

    // Balance check (unpaid is unlimited)
    if (type !== "unpaid") {
      const year = Number(startDate.slice(0, 4));
      const used = await usedDays(req.user._id, type, year);
      const remaining = QUOTAS[type] - used;

      if (days > remaining) {
        return res.status(422).json({
          success: false,
          message: `Not enough ${type} leave. You need ${days} day(s) but have ${remaining} left this year.`,
        });
      }
    }

    const leave = await Leave.create({
      employee: req.user._id,
      organization: req.user.organization,
      type,
      startDate: start,
      endDate: end,
      days,
      reason: reason.trim(),
    });

    return res.status(201).json({
      success: true,
      message: `Leave request submitted (${days} working day${days > 1 ? "s" : ""}).`,
      leave,
    });
  } catch (error) {
    console.error("Leave request error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not submit leave request.",
    });
  }
};

export const getLeaveBalance = async (req, res) => {
  try {
    const employeeId =
      req.user.role === "employee" ? req.user._id : req.query.employeeId;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required.",
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

    const year = Number(req.query.year) || Number(today().slice(0, 4));
    const balance = {};

    for (const type of LEAVE_TYPES) {
      const used = await usedDays(employee._id, type, year);
      const quota = QUOTAS[type] ?? null;
      balance[type] = {
        quota,
        used,
        remaining: quota === null ? null : quota - used,
      };
    }

    return res.status(200).json({ success: true, year, balance });
  } catch (error) {
    console.error("Leave balance error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch leave balance.",
    });
  }
};

export const getLeaves = async (req, res) => {
  try {
    const filter = { organization: req.user.organization };

    if (req.user.role === "employee") {
      filter.employee = req.user._id;
    } else if (req.query.status) {
      if (
        !["pending", "approved", "rejected", "cancelled"].includes(
          req.query.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid leave status.",
        });
      }
      filter.status = req.query.status;
    }

    const leaves = await Leave.find(filter)
      .populate("employee", "name email department")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    console.error("Get leaves error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch leave requests.",
    });
  }
};

export const reviewLeave = async (req, res) => {
  try {
    const { status, comment } = req.body ?? {};

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected.",
      });
    }

    const leave = await Leave.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found.",
      });
    }

    if (leave.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This leave request has already been reviewed or cancelled.",
      });
    }

    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.reviewComment = typeof comment === "string" ? comment.trim() : "";
    await leave.save();

    return res.status(200).json({
      success: true,
      message: `Leave ${status}.`,
      leave,
    });
  } catch (error) {
    console.error("Review leave error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not review leave request.",
    });
  }
};

export const cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({
      _id: req.params.id,
      employee: req.user._id,
      organization: req.user.organization,
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found.",
      });
    }

    if (!ACTIVE.includes(leave.status)) {
      return res.status(409).json({
        success: false,
        message: "Only pending or approved leaves can be cancelled.",
      });
    }

    if (leave.endDate.toISOString().slice(0, 10) < today()) {
      return res.status(409).json({
        success: false,
        message: "This leave has already ended and cannot be cancelled.",
      });
    }

    leave.status = "cancelled";
    await leave.save();

    return res.status(200).json({
      success: true,
      message: "Leave cancelled.",
      leave,
    });
  } catch (error) {
    console.error("Cancel leave error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not cancel leave.",
    });
  }
};