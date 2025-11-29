export type AnswerChoice = 'mom' | 'dad'

export interface Game {
  id: string
  slug: string
  title: string
  is_open: boolean
  option_a_label?: string
  option_b_label?: string
  tiebreaker_enabled: boolean
  tiebreaker_prompt?: string
  tiebreaker_answer?: string
  created_by?: string
  created_at?: string
}

export interface Question {
  id: string
  game_id: string
  prompt: string
  correct_answer: AnswerChoice
  order_index: number
}

export interface Submission {
  id: string
  game_id: string
  first_name: string
  last_name?: string
  email?: string
  score: number
  tiebreaker_guess?: string
  created_at?: string
}

export interface SubmissionAnswer {
  id: string
  submission_id: string
  question_id: string
  choice: AnswerChoice
}
