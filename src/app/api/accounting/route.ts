import { accountingController } from "@/backend/controllers/erp.controller";

export const GET = accountingController.list;
export const POST = accountingController.create;
