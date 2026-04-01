export interface Question {
  id: string;
  question: string;
  author: string;
  email?: string;
  answer?: string;
  answered_by?: string;
  status: 'pending' | 'approved' | 'hidden';
  created_at: number;
  updated_at: number;
  answered_at?: number;
}

export interface QnaSummary {
  total: number;
  answered: number;
  unanswered: number;
}
