
import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    officeStartTime: {
      type: String,
      default: "09:00",
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15,
    },
  },
  { timestamps: true }
);

const Organization = mongoose.model(
  "Organization",
  organizationSchema
);

export default Organization;
