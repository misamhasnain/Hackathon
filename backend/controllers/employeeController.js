
import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const createEmployee = async (req, res) => {
  try {
    const { name, email, password, department, designation, salary } =
      req.body ?? {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password (8+ characters) are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    const parsedSalary = salary === undefined ? 0 : Number(salary);

    if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
      return res.status(400).json({
        success: false,
        message: "Salary must be a valid non-negative number.",
      });
    }

    const employee = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: "employee",
      organization: req.user.organization,
      department: typeof department === "string" ? department.trim() : "",
      designation: typeof designation === "string" ? designation.trim() : "",
      salary: parsedSalary,
    });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        designation: employee.designation,
        salary: employee.salary,
      },
    });
  } catch (error) {
    console.error("Create employee error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not create employee.",
    });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const filter = {
      organization: req.user.organization,
      role: "employee",
    };

    if (req.query.department) {
      filter.department = req.query.department;
    }

    const employees = await User.find(filter)
      .select("name email department designation salary createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Get employees error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch employees.",
    });
  }
};
