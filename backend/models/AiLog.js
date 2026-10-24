import mongoose from "mongoose";

const aiLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    endpoint: { type: String, enum: ["chat", "smart_leave"], required: true },
    prompt: { type: String, default: "" },
    reply: { type: String, default: "" },
    tools: { type: [String], default: [] },
    ok: { type: Boolean, default: false },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

aiLogSchema.index({ user: 1, createdAt: -1 });

const AiLog = mongoose.model("AiLog", aiLogSchema);
export default AiLog;