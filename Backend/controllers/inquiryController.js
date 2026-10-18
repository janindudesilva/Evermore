import Inquiry from "../models/Inquiry.js";
import Newsletter from "../models/Newsletter.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// POST /api/inquiries/contact
export async function submitContact(req, res) {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return ApiResponse.error(res, "Full name is required (minimum 2 characters)", 400);
    }
    if (name.trim().length > 100) {
      return ApiResponse.error(res, "Name cannot exceed 100 characters", 400);
    }

    if (!email || typeof email !== "string") {
      return ApiResponse.error(res, "Email address is required", 400);
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return ApiResponse.error(res, "Please provide a valid email address", 400);
    }

    if (subject && String(subject).length > 200) {
      return ApiResponse.error(res, "Subject cannot exceed 200 characters", 400);
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return ApiResponse.error(res, "Message is required (minimum 5 characters)", 400);
    }
    if (message.trim().length > 5000) {
      return ApiResponse.error(res, "Message cannot exceed 5000 characters", 400);
    }

    // Persist contact inquiry in MongoDB
    const inquiry = await Inquiry.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: subject ? String(subject).trim() : "General Inquiry",
      message: message.trim(),
      status: "new",
      ip: req.ip || req.headers?.["x-forwarded-for"] || "",
    });

    return ApiResponse.success(
      res,
      "Thank you. Your inquiry has been received by our client service team. We will review your message and reply via email within 24-48 business hours.",
      {
        id: inquiry._id,
        receivedAt: inquiry.createdAt,
        status: inquiry.status,
      },
      200
    );
  } catch (err) {
    console.error("Contact inquiry submission error:", err.message);
    return ApiResponse.error(res, "Could not submit inquiry due to a database error. Please try again later.", 500);
  }
}

// POST /api/inquiries/newsletter
export async function submitNewsletter(req, res) {
  try {
    const { email, consent } = req.body || {};

    if (!email || typeof email !== "string") {
      return ApiResponse.error(res, "Email address is required", 400);
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    const normalizedEmail = email.toLowerCase().trim();
    if (!emailRegex.test(normalizedEmail)) {
      return ApiResponse.error(res, "Please provide a valid email address", 400);
    }

    // Require consent (reject if consent is false or explicitly denied)
    if (consent === false || consent === "false") {
      return ApiResponse.error(
        res,
        "Consent is required to subscribe to the newsletter",
        400
      );
    }

    // Check for existing subscription
    const existing = await Newsletter.findOne({ email: normalizedEmail });

    if (existing) {
      if (existing.status === "subscribed") {
        return ApiResponse.error(
          res,
          "This email address is already subscribed to the EVERMORE newsletter.",
          409
        );
      }
      // Re-subscribe previous subscriber
      existing.status = "subscribed";
      existing.consent = true;
      existing.subscribedAt = new Date();
      existing.unsubscribedAt = null;
      await existing.save();

      return ApiResponse.success(
        res,
        "Welcome back! You have been re-subscribed to THE EVERMORE journal.",
        { status: "subscribed" },
        200
      );
    }

    // Create new persistent subscription
    await Newsletter.create({
      email: normalizedEmail,
      consent: true,
      status: "subscribed",
    });

    return ApiResponse.success(
      res,
      "Thank you for subscribing to THE EVERMORE journal.",
      { status: "subscribed" },
      200
    );
  } catch (err) {
    if (err.code === 11000) {
      return ApiResponse.error(
        res,
        "This email address is already subscribed to the EVERMORE newsletter.",
        409
      );
    }
    console.error("Newsletter subscription error:", err.message);
    return ApiResponse.error(res, "Could not process subscription.", 500);
  }
}

// POST /api/inquiries/newsletter/unsubscribe
export async function unsubscribeNewsletter(req, res) {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== "string") {
      return ApiResponse.error(res, "Email address is required to unsubscribe", 400);
    }
    const normalizedEmail = email.toLowerCase().trim();

    const subscriber = await Newsletter.findOne({ email: normalizedEmail });
    if (!subscriber || subscriber.status === "unsubscribed") {
      return ApiResponse.success(res, "This email address is not currently subscribed.", {
        status: "unsubscribed",
      });
    }

    subscriber.status = "unsubscribed";
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    return ApiResponse.success(res, "You have been successfully unsubscribed from THE EVERMORE newsletter.", {
      status: "unsubscribed",
    });
  } catch (err) {
    console.error("Newsletter unsubscribe error:", err.message);
    return ApiResponse.error(res, "Could not process unsubscribe request.", 500);
  }
}

// GET /api/inquiries (admin only)
export async function getInquiries(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && ["new", "read", "resolved", "archived"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const total = await Inquiry.countDocuments(filter);
    const inquiries = await Inquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.success(res, "Inquiries retrieved", {
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("Get inquiries error:", err.message);
    return ApiResponse.error(res, "Could not retrieve inquiries", 500);
  }
}

// PUT /api/inquiries/:id/status (admin only)
export async function updateInquiryStatus(req, res) {
  try {
    const { status, notes } = req.body || {};

    if (!status || !["new", "read", "resolved", "archived"].includes(status)) {
      return ApiResponse.error(res, "Valid status ('new', 'read', 'resolved', 'archived') is required", 400);
    }

    const updateData = { status };
    if (notes !== undefined) {
      updateData.notes = String(notes).trim().slice(0, 1000);
    }

    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!inquiry) {
      return ApiResponse.error(res, "Inquiry not found", 404);
    }

    return ApiResponse.success(res, "Inquiry updated successfully", inquiry);
  } catch (err) {
    console.error("Update inquiry error:", err.message);
    return ApiResponse.error(res, "Could not update inquiry", 500);
  }
}
