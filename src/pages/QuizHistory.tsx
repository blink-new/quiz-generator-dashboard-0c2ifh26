import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  Clock, 
  Trophy, 
  Calendar, 
  Search, 
  Filter,
  BookOpen,
  TrendingUp,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { blink } from '@/blink/client'
import { Quiz, QuizAttempt } from '@/types'

export function QuizHistory() {
  const [attempts, setAttempts] = useState<(QuizAttempt & { quiz?: Quiz })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [user, setUser] = useState<any>(null)

  const loadHistory = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      
      // Load quiz attempts
      const attemptsData = await blink.db.quizAttempts.list({
        where: { userId: user.id },
        orderBy: { completedAt: 'desc' },
        limit: 100
      })

      // Load quiz details for each attempt
      const quizIds = [...new Set(attemptsData.map(attempt => attempt.quizId))]
      const quizzesData = await Promise.all(
        quizIds.map(async (quizId) => {
          const quiz = await blink.db.quizzes.list({
            where: { id: quizId },
            limit: 1
          })
          return quiz[0]
        })
      )

      // Combine attempts with quiz data
      const attemptsWithQuizzes = attemptsData.map(attempt => ({
        ...attempt,
        answers: typeof attempt.answers === 'string' ? JSON.parse(attempt.answers) : attempt.answers,
        quiz: quizzesData.find(quiz => quiz?.id === attempt.quizId)
      }))

      setAttempts(attemptsWithQuizzes)
    } catch (error) {
      console.error('Error loading quiz history:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (user?.id) {
      loadHistory()
    }
  }, [user?.id, loadHistory])

  const filteredAttempts = attempts.filter(attempt => {
    const matchesSearch = !searchTerm || 
      attempt.quiz?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attempt.quiz?.topic.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDifficulty = difficultyFilter === 'all' || 
      attempt.quiz?.difficulty === difficultyFilter

    return matchesSearch && matchesDifficulty
  }).sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    } else {
      return (Number(b.score) || 0) - (Number(a.score) || 0)
    }
  })

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const calculateStats = () => {
    if (attempts.length === 0) return { totalAttempts: 0, averageScore: 0, bestScore: 0, totalTime: 0 }
    
    const totalAttempts = attempts.length
    const scores = attempts.map(attempt => Number(attempt.score) || 0)
    const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    const bestScore = Math.max(...scores)
    const totalTime = attempts.reduce((sum, attempt) => sum + (Number(attempt.timeSpent) || 0), 0)
    
    return { totalAttempts, averageScore, bestScore, totalTime }
  }

  const stats = calculateStats()

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we load your quiz history</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quiz History</h1>
        <p className="text-gray-600 mt-2">
          View all your past quiz attempts and track your progress over time.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttempts}</div>
            <p className="text-xs text-muted-foreground">
              Quiz attempts completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              Across all attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bestScore}%</div>
            <p className="text-xs text-muted-foreground">
              Your highest score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(stats.totalTime)}</div>
            <p className="text-xs text-muted-foreground">
              Time spent on quizzes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by quiz title or topic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: 'date' | 'score') => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="score">Sort by Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quiz History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Attempts</CardTitle>
          <CardDescription>
            {filteredAttempts.length} of {attempts.length} attempts shown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-full h-16 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredAttempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {attempt.quiz?.title || 'Unknown Quiz'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {attempt.quiz?.topic || 'No topic'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getDifficultyColor(attempt.quiz?.difficulty || 'medium')}>
                          {attempt.quiz?.difficulty || 'medium'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(Number(attempt.score) || 0)}`}>
                          {attempt.score}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTime(Number(attempt.timeSpent) || 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(attempt.completedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/quiz/${attempt.quizId}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Retake
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || difficultyFilter !== 'all' ? 'No matching quiz attempts' : 'No quiz attempts yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || difficultyFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by generating and taking your first quiz!'
                }
              </p>
              {!searchTerm && difficultyFilter === 'all' && (
                <Link to="/generate">
                  <Button>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Quiz
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}