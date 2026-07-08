import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/user";
import { AuthedRequest } from "../middleware/requireAuth";

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

const sanitizeUser = (u: any) => {
  if (!u) return u;
  const obj = typeof u.toObject === "function" ? u.toObject() : u;
  delete obj.password;
  return obj;
};

function normalizeEmail(email: any): string {
  return String(email || "").toLowerCase().trim();
}

function isBcryptHash(pw: any): boolean {
  const s = String(pw || "");
  return s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$") || s.startsWith("$2");
}

export const signup: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    let { firstName, lastName, email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      console.warn(`[AUTH][${rid}] signup missing email/password`);
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.warn(`[AUTH][${rid}] signup user exists email=${email}`);
      res.status(409).json({ message: "User already exists" });
      return;
    }

    // IMPORTANT: DO NOT hash here (schema pre-save hook hashes)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: String(password),
      role: "Volunteer",
    });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, user: sanitizeUser(user) });
    return;
  } catch (err: any) {
    console.error(`[AUTH][${rid}] signup error:`, err?.message || err);
    res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    return;
  }
};

export const login: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    let { email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      console.warn(`[AUTH][${rid}] login missing email/password`);
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    // IMPORTANT: include password (schema has select:false)
    const user: any = await User.findOne({ email }).select("+password");
    console.log(`[AUTH][${rid}] login email=${email} userFound=${!!user}`);

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const stored = String(user.password || "");
    const input = String(password);

    let match = false;

    if (isBcryptHash(stored)) {
      match = await bcrypt.compare(input, stored);
    } else {
      // legacy plain password support (optional)
      match = input === stored;

      if (match) {
        // upgrading: assign raw password; pre-save hook will hash it
        user.password = input;
        await user.save();
        console.log(`[AUTH][${rid}] upgraded legacy password to bcrypt for userId=${user._id}`);
      }
    }

    console.log(`[AUTH][${rid}] passwordMatch=${match}`);

    if (!match) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    // remove password before returning
    const safeUser = user.toObject();
    delete safeUser.password;

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(200).json({ token, user: safeUser });
    return;
  } catch (err: any) {
    console.error(`[AUTH][${rid}] login error:`, err?.message || err);
    res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    return;
  }
};

export const me: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const user = (req as AuthedRequest).user;

    if (!user) {
      console.warn(`[AUTH][${rid}] /me req.user missing`);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    res.status(200).json({ user: sanitizeUser(user) });
    return;
  } catch (err: any) {
    console.error(`[AUTH][${rid}] /me error:`, err?.message || err);
    res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    return;
  }
};

export const resetPassword: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    let { email, newPassword } = req.body;
    email = normalizeEmail(email);

    if (!email || !newPassword) {
      res.status(400).json({ message: "Email and new password are required" });
      return;
    }

    const user: any = await User.findOne({ email }).select("+password");
    if (!user) {
      res.status(404).json({ message: "No account found with that email address" });
      return;
    }

    user.password = String(newPassword);
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
    return;
  } catch (err: any) {
    console.error(`[AUTH][${rid}] resetPassword error:`, err?.message || err);
    res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    return;
  }
};

export const changePassword: RequestHandler = async (req, res): Promise<void> => {
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const { currentPassword, newPassword } = req.body;

    const authed = req as AuthedRequest;
    const userId = authed.user?._id;

    if (!userId) {
      console.warn(`[AUTH][${rid}] changePassword missing req.user`);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // IMPORTANT: include password
    const user: any = await User.findById(userId).select("+password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const stored = String(user.password || "");
    const current = String(currentPassword || "");
    const next = String(newPassword || "");

    if (!current || !next) {
      res.status(400).json({ message: "Current password and new password are required" });
      return;
    }

    const ok = isBcryptHash(stored) ? await bcrypt.compare(current, stored) : current === stored;

    if (!ok) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    // assign raw; pre-save hook will hash
    user.password = next;
    await user.save();

    res.status(200).json({ message: "Password updated" });
    return;
  } catch (err: any) {
    console.error(`[AUTH][${rid}] changePassword error:`, err?.message || err);
    res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    return;
  }
};