import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return ApiResponse.error(res, "Name, email, and password are required", 400);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return ApiResponse.error(res, "An account with this email already exists", 409);

    const user = await User.create({ name, email, password });
    const token = generateToken(user);

    return ApiResponse.success(res, "Account created", { user, token }, 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return ApiResponse.error(res, "Email and password are required", 400);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return ApiResponse.error(res, "Invalid email or password", 401);
    }

    const token = generateToken(user);
    return ApiResponse.success(res, "Signed in", { user, token });
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
}

export async function getMe(req, res) {
  return ApiResponse.success(res, "Current user", req.user);
}
