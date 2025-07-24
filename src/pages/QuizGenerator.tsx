import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, BookOpen, Loader2, FileText, Brain, Clock, Timer } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
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
  
  // Timer settings
  const [isTimedQuiz, setIsTimedQuiz] = useState(true)
  const [timeLimit, setTimeLimit] = useState(30) // minutes
  
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
        isTimed: isTimedQuiz,
        timeLimit: isTimedQuiz ? timeLimit : null,
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
        console.log('Extracting text from file:', pdfFile.name, 'Type:', pdfFile.type, 'Size:', pdfFile.size)
        
        try {
          // First, try to upload the file to storage and then extract from URL
          console.log('Uploading file to storage...')
          const { publicUrl } = await blink.storage.upload(
            pdfFile,
            `temp-uploads/${Date.now()}-${pdfFile.name}`,
            { upsert: true }
          )
          console.log('File uploaded to:', publicUrl)
          
          // Extract text from the uploaded file URL
          console.log('Extracting text from URL...')
          content = await blink.data.extractFromUrl(publicUrl)
          console.log('Extracted content length:', content.length)
          
          // Clean up the temporary file after extraction
          try {
            await blink.storage.remove(`temp-uploads/${Date.now()}-${pdfFile.name}`)
          } catch (cleanupError) {
            console.warn('Could not clean up temporary file:', cleanupError)
          }
          
        } catch (extractError) {
          console.error('Error extracting text from file:', extractError)
          
          // Fallback: Try direct blob extraction
          try {
            console.log('Trying direct blob extraction as fallback...')
            content = await blink.data.extractFromBlob(pdfFile)
            console.log('Fallback extraction successful, content length:', content.length)
          } catch (fallbackError) {
            console.error('Fallback extraction also failed:', fallbackError)
            alert(`Failed to extract text from the uploaded file. 

Possible solutions:
1. Try pasting the text content manually in the text area below
2. Convert your PDF to a text file (.txt) and upload that instead
3. Use a different PDF file

Error details: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`)
            return
          }
        }
      }

      if (!content.trim()) {
        alert('No content found in the document. The file might be empty, image-based, or corrupted. Please try pasting the text manually or use a different file.')
        return
      }

      // Limit content length to avoid API limits
      if (content.length > 50000) {
        console.log('Content too long, truncating to 50000 characters')
        content = content.substring(0, 50000) + '...'
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
        isTimed: isTimedQuiz,
        timeLimit: isTimedQuiz ? timeLimit : null,
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
      console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size)
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size too large. Please select a file smaller than 10MB.')
        return
      }
      
      // Check file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
        'text/markdown',
        'text/x-markdown'
      ]
      
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.md']
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        alert('Unsupported file type. Please upload a PDF, DOC, DOCX, TXT, RTF, or MD file.')
        return
      }
      
      setPdfFile(file)
      // Clear the text area when a file is selected
      setPdfText('')
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

              {/* Timer Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    <Label htmlFor="timed-quiz" className="text-sm font-medium">
                      Timed Quiz
                    </Label>
                  </div>
                  <Switch
                    id="timed-quiz"
                    checked={isTimedQuiz}
                    onCheckedChange={setIsTimedQuiz}
                  />
                </div>
                
                {isTimedQuiz && (
                  <div className="space-y-2">
                    <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                    <Select value={timeLimit.toString()} onValueChange={(value) => setTimeLimit(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <p className="text-xs text-gray-600">
                  {isTimedQuiz 
                    ? `Quiz will have a ${timeLimit}-minute time limit. Students can submit early.`
                    : 'Quiz will have no time limit. Students can take as long as needed.'
                  }
                </p>
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

              {/* Timer Settings for PDF */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    <Label htmlFor="pdf-timed-quiz" className="text-sm font-medium">
                      Timed Quiz
                    </Label>
                  </div>
                  <Switch
                    id="pdf-timed-quiz"
                    checked={isTimedQuiz}
                    onCheckedChange={setIsTimedQuiz}
                  />
                </div>
                
                {isTimedQuiz && (
                  <div className="space-y-2">
                    <Label htmlFor="pdf-time-limit">Time Limit (minutes)</Label>
                    <Select value={timeLimit.toString()} onValueChange={(value) => setTimeLimit(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <p className="text-xs text-gray-600">
                  {isTimedQuiz 
                    ? `Quiz will have a ${timeLimit}-minute time limit. Students can submit early.`
                    : 'Quiz will have no time limit. Students can take as long as needed.'
                  }
                </p>
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