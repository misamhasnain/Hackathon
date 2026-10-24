import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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
    date: {
      type: String,
      required: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    workedMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["present", "late", "half_day", "absent", "missing_checkout"],
      default: "present",
    },
  },
  { timestamps: true }
);

attendanceSchema.index(
  { employee: 1, date: 1 },
  { unique: true }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;