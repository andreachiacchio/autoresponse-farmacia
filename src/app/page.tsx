'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  Settings, 
  MessageSquare, 
  FileText, 
  History, 
  Play, 
  Pause,
  RefreshCw,
  Send,
  Edit,
  Trash2,
  Check,
  X,
  Loader2,
  Star,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pharmacy,
  Plus,
  Save
} from 'lucide-react'

// Types
interface TrustpilotConfig {
  configured: boolean
  apiKey?: string
  businessUnitId?: string
  connectionStatus?: string
  businessInfo?: {
    name: string
    numberOfReviews: number
  }
}

interface Review {
  id: string
  trustpilotId: string
  authorName?: string
  title?: string
  text?: string
  rating: number
  createdAt: string
  respondedAt?: string
  response?: AutoResponse
}

interface AutoResponse {
  id: string
  generatedResponse: string
  status: string
  createdAt: string
  sentAt?: string
  template?: ResponseTemplate
}

interface ResponseTemplate {
  id: string
  name: string
  description?: string
  minRating: number
  maxRating: number
  customInstruction?: string
  tone: string
  isDefault: boolean
  isActive: boolean
  priority: number
  _count?: { responses: number }
}

interface CronLog {
  id: string
  jobName: string
  status: string
  startedAt: string
  completedAt?: string
  reviewsProcessed: number
  responsesSent: number
  errorMessage?: string
}

export default function Home() {
  // State
  const [activeTab, setActiveTab] = useState('config')
  const [config, setConfig] = useState<TrustpilotConfig | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [templates, setTemplates] = useState<ResponseTemplate[]>([])
  const [cronLogs, setCronLogs] = useState<CronLog[]>([])
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingResponses, setPendingResponses] = useState<AutoResponse[]>([])

  // Config form
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [businessUnitId, setBusinessUnitId] = useState('')

  // Template form
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    minRating: 1,
    maxRating: 5,
    customInstruction: '',
    tone: 'professionale',
    isDefault: false
  })

  // Fetch initial data
  useEffect(() => {
    fetchConfig()
    fetchTemplates()
    fetchCronLogs()
    fetchSettings()
  }, [])

  // Fetch reviews when tab changes
  useEffect(() => {
    if (activeTab === 'reviews' || activeTab === 'pending') {
      fetchReviews()
    }
  }, [activeTab])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/trustpilot/config')
      const data = await res.json()
      setConfig(data)
    } catch (error) {
      console.error('Error fetching config:', error)
    }
  }

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/trustpilot/reviews?source=db&limit=50')
      const data = await res.json()
      setReviews(data.reviews || [])
      
      // Get pending responses
      const pendingRes = await fetch('/api/responses?status=pending')
      const pendingData = await pendingRes.json()
      setPendingResponses(pendingData.responses || [])
    } catch (error) {
      console.error('Error fetching reviews:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchCronLogs = async () => {
    try {
      const res = await fetch('/api/cron')
      const data = await res.json()
      setCronLogs(data.logs || [])
      setAutoReplyEnabled(data.settings?.auto_reply_enabled === 'true')
    } catch (error) {
      console.error('Error fetching cron logs:', error)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/cron')
      const data = await res.json()
      setAutoReplyEnabled(data.settings?.auto_reply_enabled === 'true')
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const saveConfig = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/trustpilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret, businessUnitId })
      })
      const data = await res.json()
      
      if (data.success) {
        fetchConfig()
        setApiKey('')
        setApiSecret('')
        setBusinessUnitId('')
      } else {
        alert(data.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const syncReviews = async (autoReply = false) => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/trustpilot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReply, dryRun: !autoReply })
      })
      const data = await res.json()
      
      if (data.success) {
        fetchReviews()
        fetchCronLogs()
      }
      
      alert(`Sincronizzazione completata!\nRecensioni processate: ${data.reviewsProcessed}\nRisposte inviate: ${data.responsesSent}`)
    } catch (error) {
      console.error('Error syncing:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const toggleAutoReply = async (enabled: boolean) => {
    try {
      await fetch('/api/cron', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'auto_reply_enabled', value: enabled.toString() })
      })
      setAutoReplyEnabled(enabled)
    } catch (error) {
      console.error('Error toggling auto-reply:', error)
    }
  }

  const saveTemplate = async () => {
    if (!newTemplate.name) {
      alert('Il nome del template è obbligatorio')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      })
      const data = await res.json()
      
      if (data.success) {
        fetchTemplates()
        setNewTemplate({
          name: '',
          description: '',
          minRating: 1,
          maxRating: 5,
          customInstruction: '',
          tone: 'professionale',
          isDefault: false
        })
      }
    } catch (error) {
      console.error('Error saving template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo template?')) return
    
    try {
      await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const approveResponse = async (responseId: string, editedResponse?: string) => {
    try {
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, editedResponse })
      })
      const data = await res.json()
      
      if (data.success) {
        fetchReviews()
      } else {
        alert(data.error || 'Errore durante l\'invio')
      }
    } catch (error) {
      console.error('Error approving response:', error)
    }
  }

  const rejectResponse = async (responseId: string) => {
    try {
      await fetch(`/api/responses?id=${responseId}`, { method: 'DELETE' })
      fetchReviews()
    } catch (error) {
      console.error('Error rejecting response:', error)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      sent: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="w-3 h-3" /> },
      manual: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Edit className="w-3 h-3" /> }
    }
    
    const v = variants[status] || variants.pending
    
    return (
      <Badge variant="outline" className={`${v.bg} ${v.text} gap-1`}>
        {v.icon}
        {status}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-700 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                <Pharmacy className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AutoResponse</h1>
                <p className="text-green-100 text-sm">Gestione automatica recensioni Trustpilot</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {config?.configured && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connesso
                </Badge>
              )}
              
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-reply" className="text-sm">Auto-Reply</Label>
                <Switch
                  id="auto-reply"
                  checked={autoReplyEnabled}
                  onCheckedChange={toggleAutoReply}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="config" className="gap-2">
              <Settings className="w-4 h-4" />
              Configurazione
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              In Attesa
              {pendingResponses.length > 0 && (
                <Badge className="ml-1 bg-yellow-500">{pendingResponses.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              Template
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="w-4 h-4" />
              Log
            </TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="config">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurazione API Trustpilot</CardTitle>
                  <CardDescription>
                    Inserisci le credenziali della tua app Trustpilot
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="text"
                      placeholder="tpk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiSecret">API Secret</Label>
                    <Input
                      id="apiSecret"
                      type="password"
                      placeholder="tps-..."
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessUnitId">Business Unit ID (opzionale)</Label>
                    <Input
                      id="businessUnitId"
                      placeholder="ID della tua attività su Trustpilot"
                      value={businessUnitId}
                      onChange={(e) => setBusinessUnitId(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={saveConfig} 
                    disabled={isLoading || !apiKey || !apiSecret}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salva Configurazione
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stato Connessione</CardTitle>
                  <CardDescription>
                    Informazioni sulla connessione Trustpilot
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {config?.configured ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium">Stato</span>
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connesso
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">API Key</span>
                        <span className="text-sm font-mono text-gray-600">{config.apiKey}</span>
                      </div>
                      
                      {config.businessInfo && (
                        <>
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium">Attività</span>
                            <span className="text-sm">{config.businessInfo.name}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium">Recensioni</span>
                            <span className="text-sm">{config.businessInfo.numberOfReviews}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <AlertCircle className="w-12 h-12 mb-3" />
                      <p className="text-center">Configura le credenziali API<br />per iniziare</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Sincronizzazione Manuale</CardTitle>
                  <CardDescription>
                    Avvia manualmente la sincronizzazione delle recensioni
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => syncReviews(false)}
                      disabled={isSyncing || !config?.configured}
                      variant="outline"
                    >
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Solo Sincronizzazione
                    </Button>
                    <Button 
                      onClick={() => syncReviews(true)}
                      disabled={isSyncing || !config?.configured}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Sincronizza e Rispondi
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pending Responses Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Risposte in Attesa di Approvazione</CardTitle>
                <CardDescription>
                  Review e approva le risposte generate automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingResponses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <CheckCircle2 className="w-16 h-16 mb-4" />
                    <p className="text-center">Nessuna risposta in attesa</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingResponses.map((response) => (
                      <Card key={response.id} className="border-yellow-200">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {renderStars(response.template?.minRating || 0)}
                                <span className="text-sm text-gray-500">
                                  Template: {response.template?.name || 'Default'}
                                </span>
                              </div>
                              {response.review && (
                                <p className="text-sm font-medium">
                                  {response.review.authorName || 'Cliente Anonimo'}
                                </p>
                              )}
                            </div>
                            {getStatusBadge(response.status)}
                          </div>
                          
                          {response.review && (
                            <div className="bg-gray-50 p-3 rounded-lg mb-3">
                              <p className="text-sm text-gray-700">
                                <strong>Recensione:</strong> {response.review.text}
                              </p>
                            </div>
                          )}
                          
                          <div className="bg-green-50 p-3 rounded-lg mb-3">
                            <p className="text-sm text-gray-700">
                              <strong>Risposta generata:</strong><br />
                              {response.generatedResponse}
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveResponse(response.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Approva e Invia
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectResponse(response.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Rifiuta
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nuovo Template</CardTitle>
                  <CardDescription>
                    Crea un template per le risposte automatiche
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="templateName">Nome Template *</Label>
                    <Input
                      id="templateName"
                      placeholder="es. Recensioni Negative"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="templateDesc">Descrizione</Label>
                    <Input
                      id="templateDesc"
                      placeholder="Breve descrizione"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rating Minimo</Label>
                      <Select 
                        value={newTemplate.minRating.toString()}
                        onValueChange={(v) => setNewTemplate({ ...newTemplate, minRating: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={n.toString()}>{n} stelle</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rating Massimo</Label>
                      <Select 
                        value={newTemplate.maxRating.toString()}
                        onValueChange={(v) => setNewTemplate({ ...newTemplate, maxRating: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={n.toString()}>{n} stelle</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tono</Label>
                    <Select 
                      value={newTemplate.tone}
                      onValueChange={(v) => setNewTemplate({ ...newTemplate, tone: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professionale">Professionale</SelectItem>
                        <SelectItem value="amichevole">Amichevole</SelectItem>
                        <SelectItem value="formale">Formale</SelectItem>
                        <SelectItem value="empatico">Empatico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="customInstruction">Istruzioni Personalizzate</Label>
                    <Textarea
                      id="customInstruction"
                      placeholder="Istruzioni aggiuntive per l'AI..."
                      value={newTemplate.customInstruction}
                      onChange={(e) => setNewTemplate({ ...newTemplate, customInstruction: e.target.value })}
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isDefault"
                      checked={newTemplate.isDefault}
                      onCheckedChange={(v) => setNewTemplate({ ...newTemplate, isDefault: v })}
                    />
                    <Label htmlFor="isDefault">Template predefinito</Label>
                  </div>
                  
                  <Button onClick={saveTemplate} disabled={isLoading} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Crea Template
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Template Esistenti</CardTitle>
                  <CardDescription>
                    Gestisci i template di risposta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <FileText className="w-12 h-12 mb-3" />
                      <p className="text-center">Nessun template creato</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              {template.isDefault && (
                                <Badge variant="outline" className="text-xs">Default</Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              Rating: {template.minRating}-{template.maxRating} | Tono: {template.tone}
                            </div>
                            {template._count && (
                              <div className="text-xs text-gray-400">
                                Usato {template._count.responses} volte
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTemplate(template.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Log delle Attività</CardTitle>
                <CardDescription>
                  Storico delle sincronizzazioni e risposte automatiche
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cronLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <History className="w-16 h-16 mb-4" />
                    <p className="text-center">Nessuna attività registrata</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cronLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          {log.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : log.status === 'failed' ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          )}
                          <div>
                            <div className="font-medium">{log.jobName}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(log.startedAt).toLocaleString('it-IT')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Processate:</span>
                              <span className="font-medium ml-1">{log.reviewsProcessed}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Inviate:</span>
                              <span className="font-medium ml-1">{log.responsesSent}</span>
                            </div>
                          </div>
                          {log.errorMessage && (
                            <div className="text-sm text-red-500 mt-1">{log.errorMessage}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-green-800 text-green-100 py-3 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>AutoResponse - Farmacia Soccavo</p>
          <a 
            href="https://www.farmaciasoccavo.it/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-300 hover:text-white underline"
          >
            www.farmaciasoccavo.it
          </a>
        </div>
      </footer>
    </div>
  )
}
