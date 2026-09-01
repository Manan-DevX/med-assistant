export type ReminderStatus = "pending" | "delivered" | "confirmed" | "snoozed" | "missed";
export type MessageKind = "text" | "audio";
export type ConversationRole = "user" | "assistant";

export interface Medication {
  id: number;
  elder_id: number;
  name: string;
  dosage: string;
  schedule_times: string[];
  active: boolean;
}

export interface ReminderEvent {
  id: number;
  medication_id: number;
  medication_name: string;
  scheduled_for: string;
  status: ReminderStatus;
  delivered_at: string | null;
  responded_at: string | null;
}

export interface Message {
  id: number;
  elder_id: number;
  sender_name: string;
  kind: MessageKind;
  content_text: string;
  audio_url: string | null;
  created_at: string;
  played_at: string | null;
}

export interface ConversationTurn {
  id: number;
  role: ConversationRole;
  content_text: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  caregiver_name: string;
  elder_id: number;
  elder_name: string;
}

export interface ConverseResponse {
  transcript: string;
  reply_text: string;
  reply_audio_base64: string;
}

export interface ReminderDueEvent {
  type: "reminder_due";
  event_id: number;
  medication_id: number;
  medication_name: string;
  dosage: string;
}

export interface FamilyMessageEvent {
  type: "family_message";
  message_id: number;
  sender_name: string;
  kind: MessageKind;
  content_text: string;
  audio_url: string | null;
}

export type CompanionEvent = ReminderDueEvent | FamilyMessageEvent;
