import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, BookOpen, Loader2, FileText, Brain } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { blink } from '@/blink/client'
import { Quiz, Question } from '@/types'

export function QuizGenerator() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('topic')
  
  // Topic-based generation
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [questionCount, setQuestionCount] = useState(10)
  
  // PDF-based generation
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfText, setPdfText] = useState('')

  const generateQuizFromTopic = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic for the quiz.')
      return
    }

    setLoading(true)
    try {
      console.log('Starting quiz generation for topic:', topic)
      
      // Generate quiz questions using AI
      const { object: quizData } = await blink.ai.generateObject({
        prompt: `Generate a ${difficulty} difficulty quiz about "${topic}" with ${questionCount} multiple choice questions. ${description ? `Additional context: ${description}` : ''}
        
        Each question should have:
        - A clear, well-written question
        - 4 multiple choice options (A, B, C, D)
        - The correct answer index (0-3)
        - A brief explanation of why the answer is correct
        
        Make sure questions are varied, educational, and appropriate for the difficulty level.`,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  options: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 4,
                    maxItems: 4
                  },
                  correctAnswer: { type: 'number', minimum: 0, maximum: 3 },
                  explanation: { type: 'string' }
                },
                required: ['question', 'options', 'correctAnswer', 'explanation']
              }
            }
          },
          required: ['title', 'questions']
        }
      })

      console.log('AI generated quiz data:', quizData)

      // Get current user
      const user = await blink.auth.me()
      console.log('Current user:', user)

      // Create quiz in database
      const quiz = await blink.db.quizzes.create({
        title: quizData.title,
        description: description || `A ${difficulty} quiz about ${topic}`,
        topic,
        difficulty,
        questions: JSON.stringify(quizData.questions.map((q: any, index: number) => ({
          id: `q_${index + 1}`,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation
        }))),
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      console.log('Quiz created in database:', quiz)

      // Navigate to the quiz
      navigate(`/quiz/${quiz.id}`)
    } catch (error) {
      console.error('Error generating quiz:', error)
      alert(`Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const generateQuizFromPDF = async () => {
    if (!pdfFile && !pdfText.trim()) {
      alert('Please upload a file or paste text content.')
      return
    }

    setLoading(true)
    try {
      let content = pdfText

      // If PDF file is provided, extract text from it
      if (pdfFile) {
        console.log('Extracting text from file:', pdfFile.name)
        try {
          content = await blink.data.extractFromBlob(pdfFile)
          console.log('Extracted content length:', content.length)
        } catch (extractError) {
          console.error('Error extracting text from file:', extractError)
          alert('Failed to extract text from the uploaded file. Please try pasting the text manually or use a different file.')
          return
        }
      }

      if (!content.trim()) {
        alert('No content found in the document. Please try a different file or paste text manually.')
        return
      }

      console.log('Starting quiz generation from document content')

      // Generate quiz questions from the extracted content
      const { object: quizData } = await blink.ai.generateObject({
        prompt: `Based on the following content, generate a ${difficulty} difficulty quiz with ${questionCount} multiple choice questions:

        ${content}
        
        Each question should:
        - Test understanding of key concepts from the content
        - Have 4 multiple choice options (A, B, C, D)
        - Include the correct answer index (0-3)
        - Provide a brief explanation referencing the source material
        
        Make sure questions cover different parts of the content and test various levels of comprehension.`,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  options: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 4,
                    maxItems: 4
                  },
                  correctAnswer: { type: 'number', minimum: 0, maximum: 3 },
                  explanation: { type: 'string' }
                },
                required: ['question', 'options', 'correctAnswer', 'explanation']
              }
            }
          },
          required: ['title', 'questions']
        }
      })

      console.log('AI generated quiz data from document:', quizData)

      // Get current user
      const user = await blink.auth.me()

      // Create quiz in database
      const quiz = await blink.db.quizzes.create({
        title: quizData.title,
        description: `Quiz generated from uploaded document`,
        topic: 'Document-based',
        difficulty,
        questions: JSON.stringify(quizData.questions.map((q: any, index: number) => ({
          id: `q_${index + 1}`,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation
        }))),
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      console.log('Quiz created in database:', quiz)

      // Navigate to the quiz
      navigate(`/quiz/${quiz.id}`)
    } catch (error) {
      console.error('Error generating quiz from PDF:', error)
      alert(`Failed to generate quiz from document: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setPdfFile(file)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Generate Quiz</h1>
        <p className="text-gray-600 mt-2">
          Create a new quiz from a topic or upload a PDF document
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="topic" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Topic-based
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-600" />
                Generate from Topic
              </CardTitle>
              <CardDescription>
                Enter a topic and let AI generate quiz questions for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Input
                  id="topic"
                  placeholder="e.g., World War II, JavaScript Fundamentals, Biology..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add any specific focus areas or additional context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questionCount">Number of Questions</Label>
                  <Select value={questionCount.toString()} onValueChange={(value) => setQuestionCount(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={generateQuizFromTopic}
                disabled={!topic.trim() || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Quiz
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Generate from PDF
              </CardTitle>
              <CardDescription>
                Upload a PDF document or paste text to generate quiz questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf-upload">Upload PDF Document</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.rtf,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {pdfFile ? pdfFile.name : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PDF, DOC, DOCX, TXT, RTF, MD files supported
                      </p>
                    </label>
                  </div>
                </div>

                <div className="text-center text-gray-500">
                  <span className="bg-gray-50 px-3 py-1 rounded-full text-sm">OR</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pdf-text">Paste Text Content</Label>
                  <Textarea
                    id="pdf-text"
                    placeholder="Paste your text content here..."
                    value={pdfText}
                    onChange={(e) => setPdfText(e.target.value)}
                    rows={8}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf-difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pdf-questionCount">Number of Questions</Label>
                  <Select value={questionCount.toString()} onValueChange={(value) => setQuestionCount(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={generateQuizFromPDF}
                disabled={(!pdfFile && !pdfText.trim()) || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Quiz
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}