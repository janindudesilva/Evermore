import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return ApiResponse.error(res, "Name, email, and password are required", 400);
    }

    if (password.length < 8) {
      return ApiResponse.error(res, "Password must be at least 8 characters long", 400);
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return ApiResponse.error(res, "Please provide a valid email address", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return ApiResponse.error(res, "An account with this email already exists", 409);
    }

    // Role is always customer upon public registration; cannot elevate to admin via body
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: "customer",
    });

    const token = generateToken(user);
    return ApiResponse.success(res, "Account created successfully", { user, token }, 201);
  } catch (err) {
    console.error("Register error:", err);
    return ApiResponse.error(res, "Could not register account. Please check your information.", 500);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return ApiResponse.error(res, "Email and password are required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(password))) {
      return ApiResponse.error(res, "Invalid email or password", 401);
    }

    const token = generateToken(user);
    return ApiResponse.success(res, "Signed in successfully", { user, token });
  } catch (err) {
    console.error("Login error:", err);
    return ApiResponse.error(res, "Sign in failed. Please try again.", 500);
  }
}

export async function getMe(req, res) {
  return ApiResponse.success(res, "Current user profile", req.user);
}

// PUT /api/auth/profile (authenticated)
export async function updateProfile(req, res) {
  try {
    const { name, phone, address } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return ApiResponse.error(res, "User not found", 404);

    if (name && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (address && typeof address === "object") {
      user.address = {
        line1: address.line1 || user.address?.line1 || "",
        city: address.city || user.address?.city || "",
        postalCode: address.postalCode || user.address?.postalCode || "",
      };
    }

    await user.save();
    return ApiResponse.success(res, "Profile updated successfully", user);
  } catch (err) {
    console.error("Profile update error:", err);
    return ApiResponse.error(res, "Failed to update profile", 400);
  }
}
