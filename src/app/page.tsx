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
import { 
  Settings, 
  FileText, 
  History, 
  RefreshCw,
  Send,
  Loader2,
  Star,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pill,
  ExternalLink,
  Copy,
  Check
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
  generatedResponse?: string
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
}

interface SyncResult {
  reviewId: string
  authorName?: string
  rating: number
  responded: boolean
  response?: string
  error?: string
}

export default function Home() {
  // State
  const [activeTab, setActiveTab] = useState('config')
  const [config, setConfig] = useState<TrustpilotConfig | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [templates, setTemplates] = useState<ResponseTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])

  // Config form
  const [testApiKey, setTestApiKey] = useState('')
  const [testApiSecret, setTestApiSecret] = useState('')
  const [testBusinessUnitId, setTestBusinessUnitId] = useState('')

  // Fetch initial data
  useEffect(() => {
    fetchConfig()
    fetchTemplates()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/trustpilot/config')
      const data = await res.json()
      setConfig(data)
    } catch (error) {
      console.error('Error fetching config:', error)
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

  const testConfig = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/trustpilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: testApiKey, 
          apiSecret: testApiSecret, 
          businessUnitId: testBusinessUnitId 
        })
      })
      const data = await res.json()
      
      if (data.success) {
        alert(`✅ Connessione riuscita!\n${data.businessInfo ? `Attività: ${data.businessInfo.name}\nRecensioni: ${data.businessInfo.numberOfReviews}` : ''}`)
        fetchConfig()
      } else {
        alert(`❌ Errore: ${data.error}`)
      }
    } catch (error) {
      console.error('Error testing config:', error)
      alert('Errore durante il test della configurazione')
    } finally {
      setIsLoading(false)
    }
  }

  const syncReviews = async (withResponses: boolean = false) => {
    setIsSyncing(true)
    setSyncResults([])
    try {
      const res = await fetch('/api/trustpilot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          autoReply: withResponses, 
          dryRun: !withResponses,
          limit: 20
        })
      })
      const data = await res.json()
      
      if (data.success) {
        setSyncResults(data.results || [])
        alert(`✅ Sincronizzazione completata!\nRecensioni processate: ${data.reviewsProcessed}\nRisposte inviate: ${data.responsesSent}`)
      } else {
        alert(`❌ Errore: ${data.error}`)
      }
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Errore durante la sincronizzazione')
    } finally {
      setIsSyncing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
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
    const variants: Record<string, { bg: string; text: string }> = {
      connected: { bg: 'bg-green-100', text: 'text-green-800' },
      error: { bg: 'bg-red-100', text: 'text-red-800' },
      not_tested: { bg: 'bg-gray-100', text: 'text-gray-800' }
    }
    
    const v = variants[status] || variants.not_tested
    
    return (
      <Badge variant="outline" className={`${v.bg} ${v.text}`}>
        {status === 'connected' ? 'Connesso' : status === 'error' ? 'Errore' : 'Non testato'}
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
                <Pill className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AutoResponse</h1>
                <p className="text-green-100 text-sm">Gestione recensioni Trustpilot - Farmacia Soccavo</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {config?.configured && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  API Configurata
                </Badge>
              )}
              
              <a 
                href="https://www.farmaciasoccavo.it/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-100 hover:text-white text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                farmaciasoccavo.it
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="config" className="gap-2">
              <Settings className="w-4 h-4" />
              Configurazione
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sincronizza
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              Template
            </TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="config">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurazione API Trustpilot</CardTitle>
                  <CardDescription>
                    Le credenziali sono configurate tramite variabili d'ambiente su Vercel
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>📌 Variabili d'ambiente configurate:</strong>
                    </p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• <code className="bg-blue-100 px-1 rounded">TRUSTPILOT_API_KEY</code></li>
                      <li>• <code className="bg-blue-100 px-1 rounded">TRUSTPILOT_API_SECRET</code></li>
                      <li>• <code className="bg-blue-100 px-1 rounded">BUSINESS_UNIT_ID</code></li>
                    </ul>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-3">
                      <strong>Test connessione</strong> (usa credenziali diverse se necessario):
                    </p>
                    
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                          id="apiKey"
                          type="text"
                          placeholder="tpk-..."
                          value={testApiKey}
                          onChange={(e) => setTestApiKey(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apiSecret">API Secret</Label>
                        <Input
                          id="apiSecret"
                          type="password"
                          placeholder="tps-..."
                          value={testApiSecret}
                          onChange={(e) => setTestApiSecret(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessUnitId">Business Unit ID</Label>
                        <Input
                          id="businessUnitId"
                          placeholder="ID attività Trustpilot"
                          value={testBusinessUnitId}
                          onChange={(e) => setTestBusinessUnitId(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <Button 
                        onClick={testConfig} 
                        disabled={isLoading || !testApiKey || !testApiSecret}
                        className="w-full"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Testa Connessione
                      </Button>
                    </div>
                  </div>
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
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">Stato</span>
                        {getStatusBadge(config.connectionStatus || 'not_tested')}
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">API Key</span>
                        <span className="text-sm font-mono text-gray-600">{config.apiKey}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">Business Unit ID</span>
                        <span className="text-sm font-mono text-gray-600">{config.businessUnitId || 'Non configurato'}</span>
                      </div>
                      
                      {config.businessInfo && (
                        <>
                          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium">Attività</span>
                            <span className="text-sm">{config.businessInfo.name}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium">Recensioni totali</span>
                            <span className="text-sm font-bold">{config.businessInfo.numberOfReviews}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <AlertCircle className="w-12 h-12 mb-3" />
                      <p className="text-center">Configura le variabili d'ambiente<br />su Vercel per iniziare</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sync Tab */}
          <TabsContent value="sync">
            <Card>
              <CardHeader>
                <CardTitle>Sincronizzazione Recensioni</CardTitle>
                <CardDescription>
                  Sincronizza le recensioni da Trustpilot e genera risposte automatiche con AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <Button 
                    onClick={() => syncReviews(false)}
                    disabled={isSyncing || !config?.configured}
                    variant="outline"
                    size="lg"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5 mr-2" />
                    )}
                    Genera Risposte (Dry Run)
                  </Button>
                  <Button 
                    onClick={() => syncReviews(true)}
                    disabled={isSyncing || !config?.configured}
                    className="bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 mr-2" />
                    )}
                    Sincronizza e Invia
                  </Button>
                </div>

                {syncResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Risultati ({syncResults.length} recensioni)</h3>
                    <div className="space-y-3">
                      {syncResults.map((result, index) => (
                        <Card key={index} className={result.responded ? 'border-green-200' : 'border-yellow-200'}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {renderStars(result.rating)}
                                  <span className="text-sm font-medium">{result.authorName || 'Cliente'}</span>
                                </div>
                              </div>
                              <Badge variant={result.responded ? 'default' : 'secondary'}>
                                {result.responded ? 'Inviato' : 'Generato'}
                              </Badge>
                            </div>
                            
                            {result.response && (
                              <div className="bg-gray-50 p-3 rounded-lg mb-3 relative group">
                                <p className="text-sm text-gray-700 pr-8">{result.response}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => copyToClipboard(result.response || '')}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                            
                            {result.error && (
                              <p className="text-sm text-red-600">❌ {result.error}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Template di Risposta</CardTitle>
                <CardDescription>
                  Template predefiniti per la generazione delle risposte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{template.name}</span>
                          {template.isDefault && (
                            <Badge variant="outline" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {template.minRating}-{template.maxRating} ⭐ | Tono: {template.tone}
                        </div>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600">{template.description}</p>
                      )}
                      {template.customInstruction && (
                        <p className="text-sm text-gray-500 mt-2 italic">
                          "{template.customInstruction}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>💡 Nota:</strong> Su Vercel i template sono predefiniti. Per personalizzarli, modifica il file <code className="bg-yellow-100 px-1 rounded">src/app/api/templates/route.ts</code>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-green-800 text-green-100 py-4 mt-8">
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
