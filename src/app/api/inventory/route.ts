import { inventoryController } from "@/backend/controllers/erp.controller";

export const GET = inventoryController.list;
export const POST = inventoryController.create;
