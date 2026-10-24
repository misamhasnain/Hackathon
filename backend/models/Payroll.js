import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    basicSalary: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    medical: { type: Number, default: 0, min: 0 },
    grossSalary: { type: Number, default: 0, min: 0 },

    workingDays: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    unpaidDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },

    attendanceDeduction: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    otherDeductions: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },

    // total of attendanceDeduction + tax + otherDeductions
    deductions: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["draft", "finalized", "paid"],
      default: "draft",
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

payrollSchema.index(
  { employee: 1, month: 1, year: 1 },
  { unique: true }
);

const Payroll = mongoose.model("Payroll", payrollSchema);
export default Payroll;