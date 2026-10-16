/**
 * Staff authentication and user management for the back office.
 */
import type { z } from "zod";
import { dbConnect } from "@/backend/config/database";
import { User } from "@/backend/models/User";
import { Settings, ensureSettings } from "@/backend/models/Settings";
import { hashPassword, verifyPassword } from "@/backend/lib/password";
import { startSession } from "@/backend/lib/cookies";
import { ServiceError, type SessionUser } from "@/backend/types";
import type { loginSchema, setupSchema, userSchema } from "@/backend/validators/erp.validator";

function toSession(u: { _id: unknown; email: string; name: string; role: SessionUser["role"] }): SessionUser {
  return { id: String(u._id), email: u.email, name: u.name, role: u.role };
}

export const authService = {
  async needsSetup() {
    await dbConnect();
    return !(await User.exists({}));
  },

  /** First run only: creates the business profile and the owner/admin account. */
  async setup(data: z.infer<typeof setupSchema>) {
    await dbConnect();
    if (await User.exists({})) throw new ServiceError("CONFLICT", "Setup is already complete. Please log in.", 409);
    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: await hashPassword(data.password),
      role: "admin",
    });
    const { _id } = await ensureSettings();
    await Settings.updateOne({ _id }, { $set: { businessName: data.businessName } });
    const session = toSession(user);
    await startSession(session);
    return { user: session };
  },

  async login(data: z.infer<typeof loginSchema>) {
    await dbConnect();
    const user = await User.findOne({ email: data.email.toLowerCase() }).select("+password");
    const bad = new ServiceError("UNAUTHORIZED", "Email or password is incorrect", 401);
    if (!user || !user.isActive) throw bad;
    if (!(await verifyPassword(data.password, user.password))) throw bad;
    user.lastLoginAt = new Date();
    await user.save();
    const session = toSession(user);
    await startSession(session);
    return { user: session };
  },

  async listUsers() {
    await dbConnect();
    return User.find().sort({ role: 1, name: 1 }).lean();
  },

  async saveUser(id: string | null, data: z.infer<typeof userSchema>, actor: SessionUser) {
    await dbConnect();
    const email = data.email.toLowerCase();
    const clash = await User.findOne({ email, ...(id ? { _id: { $ne: id } } : {}) }).select("_id").lean();
    if (clash) throw new ServiceError("CONFLICT", "Another user already has this email", 409);
    if (!id) {
      if (!data.password) throw new ServiceError("VALIDATION", "Set a password for the new user", 400);
      const u = await User.create({ ...data, email, password: await hashPassword(data.password) });
      return { _id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive };
    }
    const user = await User.findById(id);
    if (!user) throw new ServiceError("NOT_FOUND", "User not found", 404);
    // Never lock the business out of its own back office.
    if (String(user._id) === actor.id && (data.role !== "admin" || !data.isActive)) {
      throw new ServiceError("VALIDATION", "You cannot demote or deactivate your own account", 400);
    }
    if (user.role === "admin" && (data.role !== "admin" || !data.isActive)) {
      const admins = await User.countDocuments({ role: "admin", isActive: true });
      if (admins <= 1) throw new ServiceError("VALIDATION", "Keep at least one active admin", 400);
    }
    Object.assign(user, { name: data.name, email, phone: data.phone, role: data.role, isActive: data.isActive });
    if (data.password) user.password = await hashPassword(data.password);
    await user.save();
    return { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  },
};
