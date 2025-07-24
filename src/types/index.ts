export interface User {
  id: string
  email: string
  displayName?: string
  createdAt: string
}

export interface Quiz {
  id: string
  title: string
  description?: string
  topic?: string
  difficulty: 'easy' | 'medium' | 'hard'
  questions: Question[]
  userId: string
  createdAt: string
  updatedAt: string
}

export interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export interface QuizAttempt {
  id: string
  quizId: string
  userId: string
  answers: number[]
  score: number
  totalQuestions: number
  timeSpent: number
  completedAt: string
  quiz?: Quiz
}

export interface QuizStats {
  totalQuizzes: number
  totalAttempts: number
  averageScore: number
  bestScore: number
  totalTimeSpent: number
  recentActivity: QuizAttempt[]
}