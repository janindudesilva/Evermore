import { ApiResponse } from "../utils/ApiResponse.js";

export async function submitContact(req, res) {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return ApiResponse.error(res, "Full name, email address, and message are required", 400);
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return ApiResponse.error(res, "Please provide a valid email address", 400);
    }

    console.log(`[EVERMORE Contact Inquiry] From: ${name} <${email}> | Subject: ${subject || "General"} | Message: ${message.slice(0, 100)}...`);

    return ApiResponse.success(res, "Thank you for reaching out. Our team has received your message and will respond within 24 hours.", {
      receivedAt: new Date(),
    });
  } catch (err) {
    console.error("Contact inquiry error:", err);
    return ApiResponse.error(res, "Could not submit inquiry. Please try again.", 500);
  }
}

export async function submitNewsletter(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return ApiResponse.error(res, "Email address is required", 400);
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return ApiResponse.error(res, "Please provide a valid email address", 400);
    }

    console.log(`[EVERMORE Newsletter Signup] Email: ${email.toLowerCase().trim()}`);

    return ApiResponse.success(res, "You have been successfully subscribed to THE EVERMORE journal and drops.", {
      email: email.toLowerCase().trim(),
    });
  } catch (err) {
    console.error("Newsletter subscription error:", err);
    return ApiResponse.error(res, "Could not process subscription.", 500);
  }
}
