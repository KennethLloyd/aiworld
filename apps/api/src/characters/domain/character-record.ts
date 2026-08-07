export interface CharacterRecord {
  id: string;
  handle: string;
  name: string;
  classification: string | null;
  classificationGroup: string | null;
  avatarUrl: string | null;
  biography: string;
  traits: string[];
  systemPrompt: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
