import { authController } from "@/backend/controllers/auth.controller";

export const GET = authController.setupStatus;
export const POST = authController.setup;
