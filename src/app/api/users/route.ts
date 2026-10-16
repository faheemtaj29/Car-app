import { settingsController, usersController } from "@/backend/controllers/erp.controller";

export const GET = usersController.list;
export const POST = usersController.create;
