import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    status: {
      type: String,
      enum: ["subscribed", "unsubscribed"],
      default: "subscribed",
    },
    consent: {
      type: Boolean,
      required: [true, "Consent to receive editorial newsletters is required"],
      validate: {
        validator: (v) => v === true,
        message: "You must agree to receive newsletters",
      },
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

newsletterSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Newsletter", newsletterSchema);
