import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, XCircle, ArrowRight, ArrowLeft, Timer } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { blink } from '@/blink/client'
import { Quiz } from '@/types'

export function TakeQuiz() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [results, setResults] = useState<{ score: number; correctAnswers: number; totalQuestions: number } | null>(null)
  const [showExplanations, setShowExplanations] = useState(false)

  const loadQuiz = useCallback(async () => {
    if (!id) return
    
    try {
      setLoading(true)
      const quizData = await blink.db.quizzes.list({
        where: { id },
        limit: 1
      })
      
      if (quizData.length > 0) {
        const quizItem = quizData[0]
        // Parse questions from JSON string
        const parsedQuiz = {
          ...quizItem,
          questions: typeof quizItem.questions === 'string' 
            ? JSON.parse(quizItem.questions) 
            : quizItem.questions
        }
        setQuiz(parsedQuiz)
        
        // Set timer based on quiz settings
        if (Number(parsedQuiz.isTimed) > 0 && parsedQuiz.timeLimit) {
          // Convert minutes to seconds
          setTimeLeft(parsedQuiz.timeLimit * 60)
        } else {
          // No time limit
          setTimeLeft(0)
        }
        
        setStartTime(new Date())
      } else {
        navigate('/generate')
      }
    } catch (error) {
      console.error('Error loading quiz:', error)
      navigate('/generate')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  const handleSubmitQuiz = useCallback(async () => {
    if (!quiz || !startTime) return

    const endTime = new Date()
    const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
    
    // Calculate score
    let correctAnswers = 0
    quiz.questions.forEach(question => {
      if (answers[question.id] === question.correctAnswer) {
        correctAnswers++
      }
    })
    
    const score = Math.round((correctAnswers / quiz.questions.length) * 100)
    
    try {
      // Get current user
      const user = await blink.auth.me()
      console.log('Submitting quiz attempt for user:', user.id)
      console.log('Quiz ID:', quiz.id)
      console.log('Answers:', answers)
      console.log('Score:', score)
      
      // Save quiz attempt
      const attempt = await blink.db.quizAttempts.create({
        id: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quizId: quiz.id,
        userId: user.id,
        answers: JSON.stringify(answers),
        score: score,
        totalQuestions: quiz.questions.length,
        timeSpent: timeSpent,
        completedAt: endTime.toISOString(),
        createdAt: endTime.toISOString(),
        updatedAt: endTime.toISOString()
      })
      
      console.log('Quiz attempt saved successfully:', attempt)
      setResults({ score, correctAnswers, totalQuestions: quiz.questions.length })
      setIsCompleted(true)
    } catch (error) {
      console.error('Error submitting quiz:', error)
      alert(`Failed to submit quiz: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    }
  }, [quiz, startTime, answers])

  useEffect(() => {
    loadQuiz()
  }, [loadQuiz])

  // Timer countdown (only for timed quizzes)
  useEffect(() => {
    if (!startTime || isCompleted || !quiz) return
    
    // Only run timer for timed quizzes
    if (Number(quiz.isTimed) === 0 || timeLeft === 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmitQuiz()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [startTime, isCompleted, timeLeft, handleSubmitQuiz, quiz])

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Quiz...</h2>
          <p className="text-gray-600">Please wait while we prepare your quiz</p>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quiz Not Found</h2>
        <p className="text-gray-600 mb-6">The quiz you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/generate')}>
          Generate New Quiz
        </Button>
      </div>
    )
  }

  if (isCompleted && results) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              {results.score >= 80 ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : results.score >= 60 ? (
                <Clock className="h-16 w-16 text-yellow-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            <CardTitle className="text-3xl">Quiz Completed!</CardTitle>
            <CardDescription>
              Here are your results for "{quiz.title}"
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">{results.score}%</div>
                <div className="text-sm text-gray-600">Final Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{results.correctAnswers}</div>
                <div className="text-sm text-gray-600">Correct Answers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{results.totalQuestions}</div>
                <div className="text-sm text-gray-600">Total Questions</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => setShowExplanations(!showExplanations)}
                variant="outline"
              >
                {showExplanations ? 'Hide' : 'Show'} Explanations
              </Button>
              <Button onClick={() => navigate('/history')}>
                View History
              </Button>
              <Button onClick={() => navigate('/generate')}>
                Generate New Quiz
              </Button>
            </div>
          </CardContent>
        </Card>

        {showExplanations && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Question Review</h3>
            {quiz.questions.map((question, index) => {
              const userAnswer = answers[question.id]
              const isCorrect = userAnswer === question.correctAnswer
              
              return (
                <Card key={question.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        Question {index + 1}
                      </CardTitle>
                      {isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <CardDescription>{question.question}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={`p-3 rounded-lg border ${
                            optionIndex === question.correctAnswer
                              ? 'bg-green-50 border-green-200 text-green-800'
                              : optionIndex === userAnswer && !isCorrect
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="font-medium mr-2">
                              {String.fromCharCode(65 + optionIndex)}.
                            </span>
                            {option}
                            {optionIndex === question.correctAnswer && (
                              <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                            )}
                            {optionIndex === userAnswer && !isCorrect && (
                              <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Explanation:</h4>
                      <p className="text-blue-800 text-sm">{question.explanation}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const currentQuestion = quiz.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100
  const isTimedQuiz = Number(quiz.isTimed) > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Quiz Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {quiz.title}
                <Badge className={getDifficultyColor(quiz.difficulty)}>
                  {quiz.difficulty}
                </Badge>
                {!isTimedQuiz && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Timer className="h-3 w-3 mr-1" />
                    No Time Limit
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{quiz.description}</CardDescription>
            </div>
            <div className="text-right">
              {isTimedQuiz ? (
                <>
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Clock className="h-5 w-5" />
                    <span className={timeLeft < 60 ? 'text-red-600' : 'text-gray-900'}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Time Remaining</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-lg font-semibold text-green-600">
                    <Timer className="h-5 w-5" />
                    <span>No Time Limit</span>
                  </div>
                  <p className="text-sm text-gray-600">Take your time</p>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Current Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Question {currentQuestionIndex + 1}
          </CardTitle>
          <CardDescription className="text-lg">
            {currentQuestion.question}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(currentQuestion.id, index)}
                className={`p-4 text-left rounded-lg border-2 transition-all ${
                  answers[currentQuestion.id] === index
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <span className="font-medium mr-3 text-gray-500">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <Button
                onClick={handleSubmitQuiz}
                className="bg-green-600 hover:bg-green-700"
              >
                Submit Quiz
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                disabled={answers[currentQuestion.id] === undefined}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question Navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {quiz.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`aspect-square rounded-lg border-2 text-sm font-medium transition-all ${
                  index === currentQuestionIndex
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : answers[quiz.questions[index].id] !== undefined
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Early Submit Option */}
      {!isTimedQuiz && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-amber-900">Ready to submit?</h3>
                <p className="text-sm text-amber-700">
                  You can submit your quiz at any time. Make sure you've answered all questions.
                </p>
              </div>
              <Button
                onClick={handleSubmitQuiz}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                Submit Early
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}