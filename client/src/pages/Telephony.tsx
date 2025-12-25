import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveKitTestPanel } from "@/components/LiveKitTestPanel";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  Pause,
  FileText,
  Bot,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Volume2,
  MessageSquare,
  Network,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import type { CallScript, ElevenLabsAgent, CallCampaign, CallLog, SipTrunk } from "@shared/schema";

// ============ Types ============
interface SipTrunkFormData {
  name: string;
  provider: string;
  termination_uri: string;
  username: string;
  password: string;
  transport: string;
  from_number: string;
  is_active: boolean;
}

const emptySipTrunkForm: SipTrunkFormData = {
  name: "",
  provider: "exolve",
  termination_uri: "sip.exolve.ru",
  username: "",
  password: "",
  transport: "udp",
  from_number: "",
  is_active: true,
};

interface ScriptFormData {
  name: string;
  description: string;
  system_prompt: string;
  first_message: string;
  voice_id: string;
  language: string;
  llm_model: string;
  max_duration_seconds: number;
  is_active: boolean;
}

interface CampaignFormData {
  name: string;
  description: string;
  script_id: string;
  agent_id: string;
  call_hours_start: string;
  call_hours_end: string;
  max_concurrent_calls: number;
}

const emptyScriptForm: ScriptFormData = {
  name: "",
  description: "",
  system_prompt: "",
  first_message: "",
  voice_id: "",
  language: "ru",
  llm_model: "claude-3-5-sonnet",
  max_duration_seconds: 300,
  is_active: true,
};

const emptyCampaignForm: CampaignFormData = {
  name: "",
  description: "",
  script_id: "",
  agent_id: "",
  call_hours_start: "09:00",
  call_hours_end: "18:00",
  max_concurrent_calls: 1,
};

// ============ Status Helpers ============
const getCallStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    initiated: { label: "Инициирован", variant: "outline" },
    ringing: { label: "Звонок", variant: "secondary" },
    answered: { label: "Ответил", variant: "default" },
    completed: { label: "Завершен", variant: "default" },
    failed: { label: "Ошибка", variant: "destructive" },
    no_answer: { label: "Нет ответа", variant: "secondary" },
    busy: { label: "Занято", variant: "secondary" },
  };
  const config = statusMap[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getCampaignStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    draft: { label: "Черновик", variant: "outline", icon: <FileText className="w-3 h-3" /> },
    scheduled: { label: "Запланирована", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
    running: { label: "Запущена", variant: "default", icon: <Play className="w-3 h-3" /> },
    paused: { label: "Пауза", variant: "secondary", icon: <Pause className="w-3 h-3" /> },
    completed: { label: "Завершена", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const config = statusMap[status] || { label: status, variant: "outline" as const, icon: null };
  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
};

// ============ Main Component ============
export default function Telephony() {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Scripts state
  const [isScriptDialogOpen, setIsScriptDialogOpen] = useState(false);
  const [isScriptDeleteOpen, setIsScriptDeleteOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<CallScript | null>(null);
  const [scriptForm, setScriptForm] = useState<ScriptFormData>(emptyScriptForm);

  // Campaigns state
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isCampaignDeleteOpen, setIsCampaignDeleteOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CallCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormData>(emptyCampaignForm);

  // Call detail state
  const [isCallDetailOpen, setIsCallDetailOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  // SIP Trunks state
  const [isSipTrunkDialogOpen, setIsSipTrunkDialogOpen] = useState(false);
  const [isSipTrunkDeleteOpen, setIsSipTrunkDeleteOpen] = useState(false);
  const [selectedSipTrunk, setSelectedSipTrunk] = useState<SipTrunk | null>(null);
  const [sipTrunkForm, setSipTrunkForm] = useState<SipTrunkFormData>(emptySipTrunkForm);

  // ============ Queries ============
  const { data: scripts = [], isLoading: isLoadingScripts } = useQuery<CallScript[]>({
    queryKey: ["/api/telephony/scripts"],
  });

  const { data: agents = [] } = useQuery<ElevenLabsAgent[]>({
    queryKey: ["/api/telephony/agents"],
  });

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<CallCampaign[]>({
    queryKey: ["/api/telephony/campaigns"],
  });

  const { data: calls = [], isLoading: isLoadingCalls } = useQuery<CallLog[]>({
    queryKey: ["/api/telephony/calls"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/telephony/stats"],
  });

  const { data: elevenLabsStatus } = useQuery<{ configured: boolean; masked?: string }>({
    queryKey: ["/api/telephony/elevenlabs/status"],
  });

  const { data: sipTrunks = [], isLoading: isLoadingSipTrunks } = useQuery<SipTrunk[]>({
    queryKey: ["/api/telephony/sip-trunks"],
  });

  // ============ SIP Trunk Mutations ============
  const createSipTrunkMutation = useMutation({
    mutationFn: (data: SipTrunkFormData) => apiRequest("/api/telephony/sip-trunks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/sip-trunks"] });
      setIsSipTrunkDialogOpen(false);
      setSipTrunkForm(emptySipTrunkForm);
      toast({ title: "SIP Trunk создан", description: "Соединение успешно зарегистрировано в ElevenLabs" });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message || "Не удалось создать SIP trunk", variant: "destructive" });
    },
  });

  const updateSipTrunkMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SipTrunkFormData> }) =>
      apiRequest(`/api/telephony/sip-trunks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/sip-trunks"] });
      setIsSipTrunkDialogOpen(false);
      setSelectedSipTrunk(null);
      setSipTrunkForm(emptySipTrunkForm);
      toast({ title: "SIP Trunk обновлён" });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteSipTrunkMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/telephony/sip-trunks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/sip-trunks"] });
      setIsSipTrunkDeleteOpen(false);
      setSelectedSipTrunk(null);
      toast({ title: "SIP Trunk удалён" });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const testSipTrunkMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/telephony/sip-trunks/${id}/test`, { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/sip-trunks"] });
      if (data.success) {
        toast({ title: "Соединение успешно", description: "SIP trunk работает" });
      } else {
        toast({ title: "Ошибка соединения", description: data.error, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Ошибка тестирования", description: error.message, variant: "destructive" });
    },
  });

  // ============ Script Mutations ============
  const createScriptMutation = useMutation({
    mutationFn: (data: ScriptFormData) => apiRequest("/api/telephony/scripts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/scripts"] });
      setIsScriptDialogOpen(false);
      setScriptForm(emptyScriptForm);
      toast({ title: "Сценарий создан" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось создать сценарий", variant: "destructive" }),
  });

  const updateScriptMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScriptFormData> }) =>
      apiRequest(`/api/telephony/scripts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/scripts"] });
      setIsScriptDialogOpen(false);
      setSelectedScript(null);
      toast({ title: "Сценарий обновлен" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось обновить сценарий", variant: "destructive" }),
  });

  const deleteScriptMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/telephony/scripts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/scripts"] });
      setIsScriptDeleteOpen(false);
      setSelectedScript(null);
      toast({ title: "Сценарий удален" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось удалить сценарий", variant: "destructive" }),
  });

  // ============ Campaign Mutations ============
  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormData) => apiRequest("/api/telephony/campaigns", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/campaigns"] });
      setIsCampaignDialogOpen(false);
      setCampaignForm(emptyCampaignForm);
      toast({ title: "Кампания создана" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось создать кампанию", variant: "destructive" }),
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CampaignFormData> }) =>
      apiRequest(`/api/telephony/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/campaigns"] });
      setIsCampaignDialogOpen(false);
      setSelectedCampaign(null);
      toast({ title: "Кампания обновлена" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось обновить кампанию", variant: "destructive" }),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/telephony/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/campaigns"] });
      setIsCampaignDeleteOpen(false);
      setSelectedCampaign(null);
      toast({ title: "Кампания удалена" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось удалить кампанию", variant: "destructive" }),
  });

  const startCampaignMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/telephony/campaigns/${id}/start`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/campaigns"] });
      toast({ title: "Кампания запущена" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось запустить кампанию", variant: "destructive" }),
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/telephony/campaigns/${id}/pause`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/campaigns"] });
      toast({ title: "Кампания приостановлена" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось приостановить кампанию", variant: "destructive" }),
  });

  // ============ Handlers ============
  const handleOpenScriptDialog = (script?: CallScript) => {
    if (script) {
      setSelectedScript(script);
      setScriptForm({
        name: script.name,
        description: script.description || "",
        system_prompt: script.system_prompt,
        first_message: script.first_message || "",
        voice_id: script.voice_id || "",
        language: script.language,
        llm_model: script.llm_model || "claude-3-5-sonnet",
        max_duration_seconds: script.max_duration_seconds || 300,
        is_active: script.is_active,
      });
    } else {
      setSelectedScript(null);
      setScriptForm(emptyScriptForm);
    }
    setIsScriptDialogOpen(true);
  };

  const handleOpenCampaignDialog = (campaign?: CallCampaign) => {
    if (campaign) {
      setSelectedCampaign(campaign);
      setCampaignForm({
        name: campaign.name,
        description: campaign.description || "",
        script_id: campaign.script_id || "",
        agent_id: campaign.agent_id || "",
        call_hours_start: campaign.call_hours_start || "09:00",
        call_hours_end: campaign.call_hours_end || "18:00",
        max_concurrent_calls: campaign.max_concurrent_calls || 1,
      });
    } else {
      setSelectedCampaign(null);
      setCampaignForm(emptyCampaignForm);
    }
    setIsCampaignDialogOpen(true);
  };

  const handleSubmitScript = () => {
    if (selectedScript) {
      updateScriptMutation.mutate({ id: selectedScript.id, data: scriptForm });
    } else {
      createScriptMutation.mutate(scriptForm);
    }
  };

  const handleSubmitCampaign = () => {
    if (selectedCampaign) {
      updateCampaignMutation.mutate({ id: selectedCampaign.id, data: campaignForm });
    } else {
      createCampaignMutation.mutate(campaignForm);
    }
  };

  // ============ Render ============
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Phone className="w-8 h-8" />
              AI Телефония
            </h1>
            <p className="text-muted-foreground mt-1">
              Автоматические звонки с AI агентами ElevenLabs
            </p>
          </div>
          <div className="flex items-center gap-2">
            {elevenLabsStatus?.configured ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                ElevenLabs подключен
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                ElevenLabs не настроен
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего звонков</CardTitle>
              <PhoneCall className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_calls || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Успешных</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.answered_calls || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Неудачных</CardTitle>
              <XCircle className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.failed_calls || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ср. длительность</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.avg_duration ? `${Math.round(stats.avg_duration)}с` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="campaigns" className="gap-2">
              <Users className="w-4 h-4" />
              Кампании
            </TabsTrigger>
            <TabsTrigger value="scripts" className="gap-2">
              <FileText className="w-4 h-4" />
              Сценарии
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2">
              <Phone className="w-4 h-4" />
              История звонков
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="w-4 h-4" />
              Агенты
            </TabsTrigger>
            <TabsTrigger value="sip-trunks" className="gap-2">
              <Network className="w-4 h-4" />
              SIP (Exolve)
            </TabsTrigger>
            <TabsTrigger value="livekit-test" className="gap-2">
              <Wifi className="w-4 h-4" />
              Тест LiveKit
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск кампаний..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => handleOpenCampaignDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Создать кампанию
              </Button>
            </div>

            {isLoadingCampaigns ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Нет кампаний</h3>
                  <p className="text-muted-foreground mb-4">
                    Создайте первую кампанию для автоматического обзвона
                  </p>
                  <Button onClick={() => handleOpenCampaignDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать кампанию
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{campaign.name}</h3>
                            {getCampaignStatusBadge(campaign.status)}
                          </div>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground mb-3">{campaign.description}</p>
                          )}
                          <div className="flex items-center gap-6 text-sm">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {campaign.total_contacts || 0} контактов
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              {campaign.completed_calls || 0} завершено
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {campaign.call_hours_start} - {campaign.call_hours_end}
                            </span>
                          </div>
                          {(campaign.total_contacts || 0) > 0 && (
                            <Progress
                              value={((campaign.completed_calls || 0) / (campaign.total_contacts || 1)) * 100}
                              className="mt-3 h-2"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {campaign.status === "running" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : campaign.status !== "completed" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startCampaignMutation.mutate(campaign.id)}
                              disabled={!campaign.agent_id}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCampaignDialog(campaign)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setIsCampaignDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Scripts Tab */}
          <TabsContent value="scripts" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск сценариев..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => handleOpenScriptDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Создать сценарий
              </Button>
            </div>

            {isLoadingScripts ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : scripts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Нет сценариев</h3>
                  <p className="text-muted-foreground mb-4">
                    Создайте сценарий с промптом для AI агента
                  </p>
                  <Button onClick={() => handleOpenScriptDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать сценарий
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Язык</TableHead>
                    <TableHead>LLM</TableHead>
                    <TableHead>Макс. длительность</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scripts.map((script) => (
                    <TableRow key={script.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{script.name}</div>
                          {script.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {script.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{script.language.toUpperCase()}</TableCell>
                      <TableCell>{script.llm_model}</TableCell>
                      <TableCell>{script.max_duration_seconds}с</TableCell>
                      <TableCell>
                        <Badge variant={script.is_active ? "default" : "secondary"}>
                          {script.is_active ? "Активен" : "Неактивен"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenScriptDialog(script)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedScript(script);
                              setIsScriptDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск звонков..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoadingCalls ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : calls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Нет звонков</h3>
                  <p className="text-muted-foreground">
                    Здесь будет история всех звонков
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Направление</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Длительность</TableHead>
                    <TableHead>Результат</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium">{call.phone_number}</TableCell>
                      <TableCell>
                        {call.direction === "outbound" ? (
                          <span className="flex items-center gap-1 text-blue-600">
                            <PhoneCall className="w-4 h-4" />
                            Исходящий
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
                            <Phone className="w-4 h-4" />
                            Входящий
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getCallStatusBadge(call.status)}</TableCell>
                      <TableCell>
                        {call.duration_seconds ? `${call.duration_seconds}с` : "—"}
                      </TableCell>
                      <TableCell>
                        {call.outcome ? (
                          <Badge variant="outline">{call.outcome}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(call.created_at).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCall(call);
                            setIsCallDetailOpen(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  ElevenLabs Агенты
                </CardTitle>
                <CardDescription>
                  Агенты создаются автоматически из сценариев и связываются с номерами телефонов
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Агенты будут созданы при настройке кампаний</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>ElevenLabs ID</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium">{agent.name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {agent.elevenlabs_agent_id.slice(0, 12)}...
                          </TableCell>
                          <TableCell>{agent.phone_number || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={agent.is_active ? "default" : "secondary"}>
                              {agent.is_active ? "Активен" : "Неактивен"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIP Trunks Tab */}
          <TabsContent value="sip-trunks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">SIP Соединения</h3>
                <p className="text-sm text-muted-foreground">
                  Подключите Exolve или другой SIP провайдер для исходящих звонков
                </p>
              </div>
              <Button onClick={() => {
                setSelectedSipTrunk(null);
                setSipTrunkForm(emptySipTrunkForm);
                setIsSipTrunkDialogOpen(true);
              }} className="gap-2">
                <Plus className="w-4 h-4" />
                Добавить SIP Trunk
              </Button>
            </div>

            {/* ElevenLabs Status Alert */}
            {!elevenLabsStatus?.configured && (
              <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>
                      ElevenLabs API не настроен. Добавьте ELEVENLABS_API_KEY в файл .env
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoadingSipTrunks ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : sipTrunks.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Network className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Нет SIP соединений</h3>
                  <p className="text-muted-foreground mb-4">
                    Добавьте SIP trunk для подключения к Exolve или другому провайдеру
                  </p>
                  <Button onClick={() => {
                    setSelectedSipTrunk(null);
                    setSipTrunkForm(emptySipTrunkForm);
                    setIsSipTrunkDialogOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить первый SIP Trunk
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {sipTrunks.map((trunk) => (
                  <Card key={trunk.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            trunk.connection_status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' :
                            trunk.connection_status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                            'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            {trunk.connection_status === 'connected' ? (
                              <Wifi className="w-5 h-5 text-green-600" />
                            ) : trunk.connection_status === 'error' ? (
                              <WifiOff className="w-5 h-5 text-red-600" />
                            ) : (
                              <Network className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold">{trunk.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {trunk.provider?.toUpperCase()} • {trunk.termination_uri}
                            </div>
                            {trunk.from_number && (
                              <div className="text-sm text-muted-foreground">
                                CallerID: {trunk.from_number}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={trunk.is_active ? "default" : "secondary"}>
                            {trunk.is_active ? "Активен" : "Неактивен"}
                          </Badge>
                          <Badge variant={
                            trunk.connection_status === 'connected' ? "default" :
                            trunk.connection_status === 'error' ? "destructive" : "outline"
                          }>
                            {trunk.connection_status === 'connected' ? "Подключен" :
                             trunk.connection_status === 'error' ? "Ошибка" : "Не проверен"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testSipTrunkMutation.mutate(trunk.id)}
                            disabled={testSipTrunkMutation.isPending}
                          >
                            <RefreshCw className={`w-4 h-4 ${testSipTrunkMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSipTrunk(trunk);
                              setSipTrunkForm({
                                name: trunk.name,
                                provider: trunk.provider || 'exolve',
                                termination_uri: trunk.termination_uri,
                                username: trunk.username || '',
                                password: '', // Don't show password
                                transport: trunk.transport || 'udp',
                                from_number: trunk.from_number || '',
                                is_active: trunk.is_active,
                              });
                              setIsSipTrunkDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSipTrunk(trunk);
                              setIsSipTrunkDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Инструкция по настройке Exolve</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Войдите в личный кабинет Exolve (exolve.ru)</p>
                <p>2. Перейдите в раздел "SIP-соединения"</p>
                <p>3. Создайте SIP ID (будет формата 883140XXXXXX)</p>
                <p>4. Скопируйте username и password</p>
                <p>5. Укажите server: <code className="bg-muted px-1 rounded">sip.exolve.ru</code></p>
                <p>6. Установите определяемый номер (CallerID) для исходящих</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LiveKit Voice Agent Test Tab */}
          <TabsContent value="livekit-test">
            <LiveKitTestPanel />
          </TabsContent>
        </Tabs>

        {/* SIP Trunk Dialog */}
        <Dialog open={isSipTrunkDialogOpen} onOpenChange={setIsSipTrunkDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedSipTrunk ? "Редактировать SIP Trunk" : "Добавить SIP Trunk"}
              </DialogTitle>
              <DialogDescription>
                Настройте соединение с Exolve или другим SIP провайдером
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название *</Label>
                  <Input
                    value={sipTrunkForm.name}
                    onChange={(e) => setSipTrunkForm({ ...sipTrunkForm, name: e.target.value })}
                    placeholder="Exolve Main"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Провайдер</Label>
                  <Select
                    value={sipTrunkForm.provider}
                    onValueChange={(v) => setSipTrunkForm({ ...sipTrunkForm, provider: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exolve">Exolve (МТС)</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="custom">Другой</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SIP Server *</Label>
                  <Input
                    value={sipTrunkForm.termination_uri}
                    onChange={(e) => setSipTrunkForm({ ...sipTrunkForm, termination_uri: e.target.value })}
                    placeholder="sip.exolve.ru"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Транспорт</Label>
                  <Select
                    value={sipTrunkForm.transport}
                    onValueChange={(v) => setSipTrunkForm({ ...sipTrunkForm, transport: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="udp">UDP</SelectItem>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="tls">TLS (шифрование)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username (SIP ID)</Label>
                  <Input
                    value={sipTrunkForm.username}
                    onChange={(e) => setSipTrunkForm({ ...sipTrunkForm, username: e.target.value })}
                    placeholder="883140XXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={sipTrunkForm.password}
                    onChange={(e) => setSipTrunkForm({ ...sipTrunkForm, password: e.target.value })}
                    placeholder={selectedSipTrunk ? "Оставьте пустым чтобы не менять" : "Пароль от SIP"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CallerID (номер отправителя)</Label>
                <Input
                  value={sipTrunkForm.from_number}
                  onChange={(e) => setSipTrunkForm({ ...sipTrunkForm, from_number: e.target.value })}
                  placeholder="+7XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Номер, который увидит клиент при входящем звонке
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={sipTrunkForm.is_active}
                  onCheckedChange={(checked) => setSipTrunkForm({ ...sipTrunkForm, is_active: checked })}
                />
                <Label>Активен</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSipTrunkDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => {
                  if (selectedSipTrunk) {
                    const updateData: Partial<SipTrunkFormData> = { ...sipTrunkForm };
                    if (!updateData.password) delete updateData.password;
                    updateSipTrunkMutation.mutate({ id: selectedSipTrunk.id, data: updateData });
                  } else {
                    createSipTrunkMutation.mutate(sipTrunkForm);
                  }
                }}
                disabled={!sipTrunkForm.name || !sipTrunkForm.termination_uri || createSipTrunkMutation.isPending || updateSipTrunkMutation.isPending}
              >
                {createSipTrunkMutation.isPending || updateSipTrunkMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SIP Trunk Delete Dialog */}
        <AlertDialog open={isSipTrunkDeleteOpen} onOpenChange={setIsSipTrunkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить SIP Trunk?</AlertDialogTitle>
              <AlertDialogDescription>
                SIP соединение "{selectedSipTrunk?.name}" будет удалено из ElevenLabs и базы данных.
                Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedSipTrunk && deleteSipTrunkMutation.mutate(selectedSipTrunk.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Script Dialog */}
        <Dialog open={isScriptDialogOpen} onOpenChange={setIsScriptDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedScript ? "Редактировать сценарий" : "Создать сценарий"}
              </DialogTitle>
              <DialogDescription>
                Настройте промпт и параметры для AI агента
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название *</Label>
                  <Input
                    value={scriptForm.name}
                    onChange={(e) => setScriptForm({ ...scriptForm, name: e.target.value })}
                    placeholder="Название сценария"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Язык</Label>
                  <Select
                    value={scriptForm.language}
                    onValueChange={(v) => setScriptForm({ ...scriptForm, language: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="uk">Українська</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  value={scriptForm.description}
                  onChange={(e) => setScriptForm({ ...scriptForm, description: e.target.value })}
                  placeholder="Краткое описание сценария"
                />
              </div>

              <div className="space-y-2">
                <Label>Системный промпт *</Label>
                <Textarea
                  value={scriptForm.system_prompt}
                  onChange={(e) => setScriptForm({ ...scriptForm, system_prompt: e.target.value })}
                  placeholder="Вы - AI ассистент компании..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>Первое сообщение</Label>
                <Textarea
                  value={scriptForm.first_message}
                  onChange={(e) => setScriptForm({ ...scriptForm, first_message: e.target.value })}
                  placeholder="Здравствуйте! Меня зовут..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>LLM модель</Label>
                  <Select
                    value={scriptForm.llm_model}
                    onValueChange={(v) => setScriptForm({ ...scriptForm, llm_model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Макс. длительность (сек)</Label>
                  <Input
                    type="number"
                    value={scriptForm.max_duration_seconds}
                    onChange={(e) => setScriptForm({ ...scriptForm, max_duration_seconds: parseInt(e.target.value) || 300 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Активен</Label>
                <Switch
                  checked={scriptForm.is_active}
                  onCheckedChange={(v) => setScriptForm({ ...scriptForm, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsScriptDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleSubmitScript}
                disabled={!scriptForm.name || !scriptForm.system_prompt}
              >
                {selectedScript ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Campaign Dialog */}
        <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedCampaign ? "Редактировать кампанию" : "Создать кампанию"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  placeholder="Название кампании"
                />
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  placeholder="Описание кампании"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Сценарий</Label>
                <Select
                  value={campaignForm.script_id}
                  onValueChange={(v) => setCampaignForm({ ...campaignForm, script_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сценарий" />
                  </SelectTrigger>
                  <SelectContent>
                    {scripts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Агент</Label>
                <Select
                  value={campaignForm.agent_id}
                  onValueChange={(v) => setCampaignForm({ ...campaignForm, agent_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите агента" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Время начала</Label>
                  <Input
                    type="time"
                    value={campaignForm.call_hours_start}
                    onChange={(e) => setCampaignForm({ ...campaignForm, call_hours_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Время окончания</Label>
                  <Input
                    type="time"
                    value={campaignForm.call_hours_end}
                    onChange={(e) => setCampaignForm({ ...campaignForm, call_hours_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Макс. одновременных звонков</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={campaignForm.max_concurrent_calls}
                  onChange={(e) => setCampaignForm({ ...campaignForm, max_concurrent_calls: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCampaignDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleSubmitCampaign}
                disabled={!campaignForm.name}
              >
                {selectedCampaign ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Script Dialog */}
        <AlertDialog open={isScriptDeleteOpen} onOpenChange={setIsScriptDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить сценарий?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Сценарий "{selectedScript?.name}" будет удален.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedScript && deleteScriptMutation.mutate(selectedScript.id)}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Campaign Dialog */}
        <AlertDialog open={isCampaignDeleteOpen} onOpenChange={setIsCampaignDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить кампанию?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Кампания "{selectedCampaign?.name}" и все её контакты будут удалены.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedCampaign && deleteCampaignMutation.mutate(selectedCampaign.id)}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Call Detail Sheet */}
        <Sheet open={isCallDetailOpen} onOpenChange={setIsCallDetailOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle>Детали звонка</SheetTitle>
            </SheetHeader>
            {selectedCall && (
              <div className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Номер</span>
                    <span className="font-medium">{selectedCall.phone_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Статус</span>
                    {getCallStatusBadge(selectedCall.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Длительность</span>
                    <span>{selectedCall.duration_seconds ? `${selectedCall.duration_seconds} сек` : "—"}</span>
                  </div>
                  {selectedCall.outcome && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Результат</span>
                      <Badge variant="outline">{selectedCall.outcome}</Badge>
                    </div>
                  )}
                  {selectedCall.sentiment && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Тональность</span>
                      <Badge
                        variant={
                          selectedCall.sentiment === "positive"
                            ? "default"
                            : selectedCall.sentiment === "negative"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {selectedCall.sentiment === "positive"
                          ? "Позитивная"
                          : selectedCall.sentiment === "negative"
                          ? "Негативная"
                          : "Нейтральная"}
                      </Badge>
                    </div>
                  )}
                </div>

                {selectedCall.summary && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Краткое содержание</h4>
                    <p className="text-sm text-muted-foreground">{selectedCall.summary}</p>
                  </div>
                )}

                {selectedCall.transcript && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Транскрипция</h4>
                    <div className="bg-muted rounded-lg p-4 text-sm max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                      {selectedCall.transcript}
                    </div>
                  </div>
                )}

                {selectedCall.recording_url && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Запись</h4>
                    <audio controls className="w-full">
                      <source src={selectedCall.recording_url} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
