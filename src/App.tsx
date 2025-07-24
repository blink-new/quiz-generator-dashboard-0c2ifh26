import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { QuizGenerator } from '@/pages/QuizGenerator'
import { TakeQuiz } from '@/pages/TakeQuiz'
import { QuizHistory } from '@/pages/QuizHistory'
import { Analytics } from '@/pages/Analytics'
import { Profile } from '@/pages/Profile'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<QuizGenerator />} />
          <Route path="/quiz/:id" element={<TakeQuiz />} />
          <Route path="/quiz" element={<div className="text-center py-12"><h2 className="text-2xl font-bold text-gray-900 mb-4">Select a Quiz</h2><p className="text-gray-600">Please select a quiz from your history or generate a new one.</p></div>} />
          <Route path="/history" element={<QuizHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App