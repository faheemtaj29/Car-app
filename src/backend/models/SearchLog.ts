import { Schema, models, model } from "mongoose";

/**
 * One anonymous filtered search ("Corolla in Lahore"). Holds no member id, IP
 * or phone: it only tells the business what buyers are looking for.
 */
export interface ISearchLog {
  at: Date;
  kind: "car" | "bike" | "part";
  make?: string;
  model?: string;
  city?: string;
  results: number;
}

const SearchLogSchema = new Schema<ISearchLog>({
  at: { type: Date, default: Date.now, index: true },
  kind: { type: String, enum: ["car", "bike", "part"], required: true },
  make: { type: String, trim: true, maxlength: 60 },
  model: { type: String, trim: true, maxlength: 60 },
  city: { type: String, trim: true, maxlength: 60 },
  results: { type: Number, default: 0 },
});
// Old rows disappear by themselves after 90 days.
SearchLogSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 86_400, name: "at_ttl" });

export const SearchLog = models.SearchLog || model<ISearchLog>("SearchLog", SearchLogSchema);
