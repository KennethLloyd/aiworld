export interface WorldRecord {
  id: string;
  name: string;
  slug: string;
  description: Record<string, string> | null;
  rules: string[];
  topicScope: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
