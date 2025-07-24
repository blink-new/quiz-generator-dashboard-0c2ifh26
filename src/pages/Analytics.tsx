import { useState, useEffect, useCallback } from 'react'
import { 
  TrendingUp, 
  Target, 
  Clock, 
  BookOpen,
  Trophy,
  Calendar,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { blink } from '@/blink/client'
import { Quiz, QuizAttempt } from '@/types'

export function Analytics() {
  const [attempts, setAttempts] = useState<(QuizAttempt & { quiz?: Quiz })[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [user, setUser] = useState<any>(null)

  const loadAnalytics = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      
      // Load quiz attempts
      const attemptsData = await blink.db.quizAttempts.list({
        where: { userId: user.id },
        orderBy: { completedAt: 'desc' },
        limit: 200
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
        quiz: quizzesData.find(quiz => quiz?.id === attempt.quizId)
      }))

      setAttempts(attemptsWithQuizzes)
    } catch (error) {
      console.error('Error loading analytics:', error)
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
      loadAnalytics()
    }
  }, [user?.id, loadAnalytics])

  const getFilteredAttempts = () => {
    if (timeRange === 'all') return attempts
    
    const now = new Date()
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    
    return attempts.filter(attempt => new Date(attempt.completedAt) >= cutoff)
  }

  const filteredAttempts = getFilteredAttempts()

  const getScoreOverTime = () => {
    const data = filteredAttempts
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .map((attempt, index) => ({
        attempt: index + 1,
        score: Number(attempt.score) || 0,
        date: new Date(attempt.completedAt).toLocaleDateString()
      }))
    
    return data
  }

  const getDifficultyBreakdown = () => {
    const breakdown = filteredAttempts.reduce((acc, attempt) => {
      const difficulty = attempt.quiz?.difficulty || 'unknown'
      if (!acc[difficulty]) {
        acc[difficulty] = { count: 0, totalScore: 0 }
      }
      acc[difficulty].count++
      acc[difficulty].totalScore += Number(attempt.score) || 0
      return acc
    }, {} as Record<string, { count: number; totalScore: number }>)

    return Object.entries(breakdown).map(([difficulty, data]) => ({
      difficulty,
      count: data.count,
      averageScore: Math.round(data.totalScore / data.count)
    }))
  }

  const getTopicPerformance = () => {
    const topics = filteredAttempts.reduce((acc, attempt) => {
      const topic = attempt.quiz?.topic || 'Unknown'
      if (!acc[topic]) {
        acc[topic] = { count: 0, totalScore: 0, bestScore: 0 }
      }
      acc[topic].count++
      acc[topic].totalScore += Number(attempt.score) || 0
      acc[topic].bestScore = Math.max(acc[topic].bestScore, Number(attempt.score) || 0)
      return acc
    }, {} as Record<string, { count: number; totalScore: number; bestScore: number }>)

    return Object.entries(topics)
      .map(([topic, data]) => ({
        topic,
        attempts: data.count,
        averageScore: Math.round(data.totalScore / data.count),
        bestScore: data.bestScore
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5)
  }

  const calculateStats = () => {
    if (filteredAttempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        improvement: 0,
        totalTime: 0,
        averageTime: 0
      }
    }
    
    const scores = filteredAttempts.map(attempt => Number(attempt.score) || 0)
    const times = filteredAttempts.map(attempt => Number(attempt.timeSpent) || 0)
    
    const totalAttempts = filteredAttempts.length
    const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    const bestScore = Math.max(...scores)
    const totalTime = times.reduce((sum, time) => sum + time, 0)
    const averageTime = Math.round(totalTime / times.length)
    
    // Calculate improvement (compare first half vs second half)
    let improvement = 0
    if (totalAttempts >= 4) {
      const firstHalf = scores.slice(0, Math.floor(totalAttempts / 2))
      const secondHalf = scores.slice(Math.floor(totalAttempts / 2))
      const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length
      improvement = Math.round(secondAvg - firstAvg)
    }
    
    return { totalAttempts, averageScore, bestScore, improvement, totalTime, averageTime }
  }

  const stats = calculateStats()
  const scoreOverTime = getScoreOverTime()
  const difficultyBreakdown = getDifficultyBreakdown()
  const topicPerformance = getTopicPerformance()

  const COLORS = ['#6366F1', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we load your analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">
            Track your quiz performance and identify areas for improvement.
          </p>
        </div>
        <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '90d' | 'all') => setTimeRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quiz Attempts</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttempts}</div>
            <p className="text-xs text-muted-foreground">
              In selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.improvement > 0 && `+${stats.improvement}% improvement`}
              {stats.improvement < 0 && `${stats.improvement}% decline`}
              {stats.improvement === 0 && 'No change'}
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
            <CardTitle className="text-sm font-medium">Average Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(stats.averageTime)}</div>
            <p className="text-xs text-muted-foreground">
              Per quiz attempt
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAttempts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
            <p className="text-gray-600 mb-4">
              {timeRange === 'all' 
                ? 'Take some quizzes to see your analytics here.'
                : 'No quiz attempts in the selected time period.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Score Progression</CardTitle>
              <CardDescription>Your quiz scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoreOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="attempt" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Score']}
                    labelFormatter={(label) => `Attempt ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#6366F1" 
                    strokeWidth={2}
                    dot={{ fill: '#6366F1', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Difficulty Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Difficulty</CardTitle>
              <CardDescription>Average scores across difficulty levels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={difficultyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="difficulty" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'averageScore' ? `${value}%` : value,
                      name === 'averageScore' ? 'Average Score' : 'Attempts'
                    ]}
                  />
                  <Bar dataKey="averageScore" fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Topic Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Top Topics</CardTitle>
              <CardDescription>Your most attempted quiz topics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topicPerformance.map((topic, index) => (
                  <div key={topic.topic} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{topic.topic}</div>
                        <div className="text-sm text-gray-600">{topic.attempts} attempts</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{topic.averageScore}%</div>
                      <div className="text-sm text-gray-600">avg</div>
                    </div>
                  </div>
                ))}
                {topicPerformance.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No topic data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quiz Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Quiz Distribution</CardTitle>
              <CardDescription>Breakdown of attempts by difficulty</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={difficultyBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ difficulty, count }) => `${difficulty}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {difficultyBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}