import { Schema, models, model } from "mongoose";

/** A named lock. Creating a document with a fixed _id is atomic everywhere. */
export interface ILock {
  _id: string;
  holder: string;
  at: Date;
}

const LockSchema = new Schema<ILock>({
  _id: { type: String, required: true },
  holder: { type: String, required: true },
  at: { type: Date, default: Date.now },
});

export const Lock = models.Lock || model<ILock>("Lock", LockSchema);
