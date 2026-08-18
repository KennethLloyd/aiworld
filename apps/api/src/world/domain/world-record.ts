export interface WorldRecord {
  id: string;
  name: string;
  slug: string;
  description: Record<string, string> | null;
  rules: string[];
  topicScope: string;
  residentCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
