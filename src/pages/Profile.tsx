import { useState, useEffect } from 'react'
import { User, Mail, Calendar, Trophy, BookOpen, Clock, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { blink } from '@/blink/client'

export function Profile() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalAttempts: 0,
    averageScore: 0,
    bestScore: 0,
    totalTimeSpent: 0,
    joinDate: ''
  })

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      if (state.user) {
        setUser(state.user)
        setDisplayName(state.user.displayName || '')
        
        // Load user stats
        try {
          const [quizzes, attempts] = await Promise.all([
            blink.db.quizzes.list({ where: { userId: state.user.id } }),
            blink.db.quizAttempts.list({ where: { userId: state.user.id } })
          ])

          const scores = attempts.map(attempt => Number(attempt.score) || 0)
          const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
          const bestScore = scores.length > 0 ? Math.max(...scores) : 0
          const totalTimeSpent = attempts.reduce((sum, attempt) => sum + (Number(attempt.timeSpent) || 0), 0)

          setStats({
            totalQuizzes: quizzes.length,
            totalAttempts: attempts.length,
            averageScore,
            bestScore,
            totalTimeSpent,
            joinDate: state.user.createdAt || new Date().toISOString()
          })
        } catch (error) {
          console.error('Error loading user stats:', error)
        }
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleUpdateProfile = async () => {
    if (!user) return

    try {
      await blink.auth.updateMe({ displayName })
      setEditing(false)
      // Refresh user data
      const updatedUser = await blink.auth.me()
      setUser(updatedUser)
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getPerformanceLevel = (averageScore: number) => {
    if (averageScore >= 90) return { level: 'Expert', color: 'bg-purple-100 text-purple-800' }
    if (averageScore >= 80) return { level: 'Advanced', color: 'bg-blue-100 text-blue-800' }
    if (averageScore >= 70) return { level: 'Intermediate', color: 'bg-green-100 text-green-800' }
    if (averageScore >= 60) return { level: 'Beginner', color: 'bg-yellow-100 text-yellow-800' }
    return { level: 'Novice', color: 'bg-gray-100 text-gray-800' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Profile...</h2>
          <p className="text-gray-600">Please wait while we load your profile</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
        <p className="text-gray-600">Please sign in to view your profile.</p>
      </div>
    )
  }

  const performanceLevel = getPerformanceLevel(stats.averageScore)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">
          Manage your account settings and view your quiz statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.photoURL} alt={user.displayName || user.email} />
                  <AvatarFallback className="text-lg">
                    {getInitials(user.displayName || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {user.displayName || 'Anonymous User'}
                  </h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <Badge className={performanceLevel.color}>
                  {performanceLevel.level}
                </Badge>
              </div>

              <Separator />

              {/* Edit Profile */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  {editing ? (
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-md text-sm">
                      {user.displayName || 'No display name set'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                    {user.email}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="joinDate">Member Since</Label>
                  <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-600 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(stats.joinDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button onClick={handleUpdateProfile} className="flex-1">
                        Save Changes
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setEditing(false)
                          setDisplayName(user.displayName || '')
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setEditing(true)} className="w-full">
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quizzes Created</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalQuizzes}</div>
                <p className="text-xs text-muted-foreground">
                  Total quizzes generated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quiz Attempts</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAttempts}</div>
                <p className="text-xs text-muted-foreground">
                  Quizzes completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
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
          </div>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your quiz milestones and accomplishments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Quiz */}
                <div className={`p-4 rounded-lg border-2 ${stats.totalQuizzes > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${stats.totalQuizzes > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <BookOpen className={`h-5 w-5 ${stats.totalQuizzes > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">First Quiz</h4>
                      <p className="text-sm text-gray-600">Generate your first quiz</p>
                    </div>
                  </div>
                </div>

                {/* Quiz Master */}
                <div className={`p-4 rounded-lg border-2 ${stats.totalQuizzes >= 10 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${stats.totalQuizzes >= 10 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Trophy className={`h-5 w-5 ${stats.totalQuizzes >= 10 ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Quiz Master</h4>
                      <p className="text-sm text-gray-600">Create 10 quizzes ({stats.totalQuizzes}/10)</p>
                    </div>
                  </div>
                </div>

                {/* Perfect Score */}
                <div className={`p-4 rounded-lg border-2 ${stats.bestScore === 100 ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${stats.bestScore === 100 ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      <Trophy className={`h-5 w-5 ${stats.bestScore === 100 ? 'text-purple-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Perfect Score</h4>
                      <p className="text-sm text-gray-600">Score 100% on a quiz</p>
                    </div>
                  </div>
                </div>

                {/* Time Spent */}
                <div className={`p-4 rounded-lg border-2 ${stats.totalTimeSpent >= 3600 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${stats.totalTimeSpent >= 3600 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      <Clock className={`h-5 w-5 ${stats.totalTimeSpent >= 3600 ? 'text-amber-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Dedicated Learner</h4>
                      <p className="text-sm text-gray-600">Spend 1 hour learning ({formatTime(stats.totalTimeSpent)}/1h)</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>Manage your account and data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Total Learning Time</h4>
                  <p className="text-sm text-gray-600">Time spent on quizzes: {formatTime(stats.totalTimeSpent)}</p>
                </div>
                <Clock className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Account Status</h4>
                  <p className="text-sm text-gray-600">Active member since {new Date(stats.joinDate).getFullYear()}</p>
                </div>
                <User className="h-5 w-5 text-gray-400" />
              </div>

              <Button 
                variant="outline" 
                onClick={() => blink.auth.logout()}
                className="w-full"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}