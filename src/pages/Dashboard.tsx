import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  TrendingUp,
  Plus,
  History,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { blink } from '@/blink/client'
import { QuizStats } from '@/types'

export function Dashboard() {
  const [stats, setStats] = useState<QuizStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  const loadStats = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      
      // Load quiz attempts for stats
      const attempts = await blink.db.quizAttempts.list({
        where: { userId: user.id },
        orderBy: { completedAt: 'desc' },
        limit: 100
      })

      // Load total quizzes created
      const quizzes = await blink.db.quizzes.list({
        where: { userId: user.id }
      })

      // Calculate stats
      const totalAttempts = attempts.length
      const averageScore = totalAttempts > 0 
        ? attempts.reduce((sum, attempt) => sum + (Number(attempt.score) || 0), 0) / totalAttempts 
        : 0
      const bestScore = totalAttempts > 0 
        ? Math.max(...attempts.map(attempt => Number(attempt.score) || 0))
        : 0
      const totalTimeSpent = attempts.reduce((sum, attempt) => sum + (Number(attempt.timeSpent) || 0), 0)

      setStats({
        totalQuizzes: quizzes.length,
        totalAttempts,
        averageScore: Math.round(averageScore),
        bestScore,
        totalTimeSpent,
        recentActivity: attempts.slice(0, 5)
      })
    } catch (error) {
      console.error('Error loading stats:', error)
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
      loadStats()
    }
  }, [user?.id, loadStats])

  // Refresh stats when the component becomes visible (user navigates back to dashboard)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        loadStats()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id, loadStats])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we load your dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.displayName || user.email}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's an overview of your quiz activity and performance.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/generate">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-indigo-200 hover:border-indigo-300">
            <CardContent className="flex items-center p-6">
              <div className="p-3 bg-indigo-100 rounded-lg mr-4">
                <Plus className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Generate Quiz</h3>
                <p className="text-sm text-gray-600">Create a new quiz</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/history">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-amber-200 hover:border-amber-300">
            <CardContent className="flex items-center p-6">
              <div className="p-3 bg-amber-100 rounded-lg mr-4">
                <History className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Quiz History</h3>
                <p className="text-sm text-gray-600">View past quizzes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/analytics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200 hover:border-green-300">
            <CardContent className="flex items-center p-6">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Analytics</h3>
                <p className="text-sm text-gray-600">View performance</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats?.totalQuizzes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Quizzes created by you
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quiz Attempts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats?.totalAttempts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total quiz attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : `${stats?.averageScore || 0}%`}</div>
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
            <div className="text-2xl font-bold">{loading ? '...' : `${stats?.bestScore || 0}%`}</div>
            <p className="text-xs text-muted-foreground">
              Your highest score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your latest quiz attempts and results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Quiz Attempt</p>
                      <p className="text-sm text-gray-600">
                        Completed {new Date(attempt.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{attempt.score}%</p>
                    <p className="text-sm text-gray-600">
                      {Math.floor((Number(attempt.timeSpent) || 0) / 60)}m {(Number(attempt.timeSpent) || 0) % 60}s
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No quiz attempts yet</h3>
              <p className="text-gray-600 mb-4">Start by generating your first quiz!</p>
              <Link to="/generate">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Quiz
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}