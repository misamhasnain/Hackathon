
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";

const today = () => new Date().toISOString().slice(0, 10);

export const checkIn = async (req, res) => {
  try {
    const employeeId =
      req.user.role === "employee" ? req.user._id : req.body.employeeId;

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

    const existing = await Attendance.findOne({
      employee: employee._id,
      date: today(),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for today.",
      });
    }

    const attendance = await Attendance.create({
      employee: employee._id,
      organization: req.user.organization,
      date: today(),
      checkIn: new Date(),
      status: "present",
    });

    return res.status(201).json({
      success: true,
      message: "Check-in successful.",
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for today.",
      });
    }

    console.error("Check-in error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not record check-in.",
    });
  }
};

export const checkOut = async (req, res) => {
  try {
    const employeeId =
      req.user.role === "employee" ? req.user._id : req.body.employeeId;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required.",
      });
    }

    const attendance = await Attendance.findOne({
      employee: employeeId,
      organization: req.user.organization,
      date: today(),
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Check-in record not found for today.",
      });
    }

    if (attendance.checkOut) {
      return res.status(409).json({
        success: false,
        message: "Check-out already recorded.",
      });
    }

    attendance.checkOut = new Date();
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Check-out successful.",
      attendance,
    });
  } catch (error) {
    console.error("Check-out error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not record check-out.",
    });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const filter = {
      organization: req.user.organization,
    };

    if (req.user.role === "employee") {
      filter.employee = req.user._id;
    } else if (req.query.employeeId) {
      filter.employee = req.query.employeeId;
    }

    if (req.query.date) {
      filter.date = req.query.date;
    }

    const records = await Attendance.find(filter)
      .populate("employee", "name email department designation")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Attendance fetch error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch attendance.",
    });
  }
};
