import { Schema, models, model, Types } from "mongoose";

export interface IAuditEvent {
  actorId?: Types.ObjectId;
  actorName?: string;
  actorRole?: string;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    actorRole: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    summary: { type: String, required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  { timestamps: true }
);

AuditEventSchema.index({ entity: 1, entityId: 1 });
AuditEventSchema.index({ createdAt: -1 });

export const AuditEvent = models.AuditEvent || model<IAuditEvent>("AuditEvent", AuditEventSchema);
