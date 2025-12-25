import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, PhoneOff, Wifi, WifiOff, User, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from "livekit-client";

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface Participant {
  identity: string;
  name: string;
  isAgent: boolean;
}

export function LiveKitTestPanel() {
  const { toast } = useToast();
  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [roomName, setRoomName] = useState("");

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    if (status === 'connected' || status === 'connecting') {
      return;
    }

    try {
      setStatus('connecting');
      toast({
        title: "Подключение...",
        description: "Создаю комнату и подключаюсь к LiveKit",
      });

      // Get token from backend
      const response = await apiRequest<{
        roomName: string;
        token: string;
        url: string;
        identity: string;
      }>("POST", "/api/telephony/livekit/test-call", {
        userName: userName || undefined,
      });

      setRoomName(response.roomName);

      // Debug: Check response structure
      console.log('🔍 Full response:', JSON.stringify(response, null, 2));
      console.log('🔍 Token type:', typeof response.token);
      console.log('🔍 Token value:', response.token);
      console.log('🔍 URL:', response.url);

      // Ensure token is a string
      const tokenString = String(response.token);
      const urlString = String(response.url);

      console.log('🔍 Token as string:', tokenString);
      console.log('🔍 Token length:', tokenString.length);

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = room;

      // Setup event handlers
      room.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to room');
        setStatus('connected');
        setParticipants([{
          identity: response.identity,
          name: userName || "Вы",
          isAgent: false,
        }]);
        toast({
          title: "Подключено!",
          description: "Ожидайте подключения Voice Agent...",
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        setStatus('disconnected');
        setParticipants([]);
        setMicEnabled(false);
        toast({
          title: "Отключено",
          description: "Соединение с комнатой разорвано",
          variant: "destructive",
        });
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        const isAgent = participant.identity.includes('agent') ||
                       participant.identity.includes('bot') ||
                       participant.name?.toLowerCase().includes('agent');

        console.log('👤 Participant connected:', participant.identity, isAgent ? '(AGENT)' : '');

        setParticipants(prev => [
          ...prev,
          {
            identity: participant.identity,
            name: isAgent ? "Voice Agent" : participant.identity,
            isAgent,
          },
        ]);

        if (isAgent) {
          toast({
            title: "🤖 Voice Agent присоединился!",
            description: "Можете начинать разговор",
          });
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('👋 Participant disconnected:', participant.identity);
        setParticipants(prev => prev.filter(p => p.identity !== participant.identity));
      });

      room.on(RoomEvent.TrackSubscribed, (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        console.log('🎵 Track subscribed:', track.kind, 'from', participant.identity);

        if (track.kind === Track.Kind.Audio && audioRef.current) {
          const audioTrack = track as any; // MediaStreamTrack
          const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
          audioRef.current.srcObject = mediaStream;
          audioRef.current.play().catch(e => console.error('Error playing audio:', e));

          toast({
            title: "🔊 Аудио подключено",
            description: `Слушаю ${participant.identity}`,
          });
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        console.log('🔇 Track unsubscribed:', track.kind, 'from', participant.identity);
      });

      // Connect to room
      console.log('🚀 Connecting with URL:', urlString, 'token length:', tokenString.length);
      await room.connect(urlString, tokenString);

      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicEnabled(true);

      console.log('🎤 Microphone enabled');

    } catch (error: any) {
      console.error('Connection error:', error);
      setStatus('disconnected');
      toast({
        title: "Ошибка подключения",
        description: error.message || "Не удалось подключиться к LiveKit",
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setStatus('disconnected');
    setParticipants([]);
    setMicEnabled(false);
    setRoomName("");
  };

  const toggleMic = async () => {
    if (!roomRef.current) return;

    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!micEnabled);
      setMicEnabled(!micEnabled);

      toast({
        title: micEnabled ? "Микрофон выключен" : "Микрофон включен",
        description: micEnabled ? "Voice Agent вас не слышит" : "Можете говорить",
      });
    } catch (error: any) {
      console.error('Error toggling microphone:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось переключить микрофон",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><Wifi className="w-3 h-3 mr-1" /> Подключено</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500"><Wifi className="w-3 h-3 mr-1" /> Подключение...</Badge>;
      default:
        return <Badge variant="secondary"><WifiOff className="w-3 h-3 mr-1" /> Не подключен</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎙️ Тест LiveKit Voice Agent
          </CardTitle>
          <CardDescription>
            Голосовой AI агент на базе Yandex SpeechKit (STT/TTS) + GPT-4o-mini через LiveKit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Label>Статус:</Label>
            {getStatusBadge()}
          </div>

          {/* User Name Input */}
          {status === 'disconnected' && (
            <div className="space-y-2">
              <Label htmlFor="userName">Ваше имя (опционально)</Label>
              <Input
                id="userName"
                placeholder="Например: Александр"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={status !== 'disconnected'}
              />
            </div>
          )}

          {/* Room Name */}
          {roomName && (
            <div className="space-y-2">
              <Label>Комната:</Label>
              <div className="text-sm font-mono bg-gray-100 p-2 rounded">{roomName}</div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2">
            {status === 'disconnected' ? (
              <Button onClick={connect} className="flex-1">
                <Wifi className="w-4 h-4 mr-2" />
                Начать разговор
              </Button>
            ) : (
              <>
                <Button
                  onClick={toggleMic}
                  variant={micEnabled ? "default" : "secondary"}
                  className="flex-1"
                  disabled={status !== 'connected'}
                >
                  {micEnabled ? <Mic className="w-4 h-4 mr-2" /> : <MicOff className="w-4 h-4 mr-2" />}
                  {micEnabled ? "Микрофон вкл" : "Микрофон выкл"}
                </Button>
                <Button onClick={disconnect} variant="destructive">
                  <PhoneOff className="w-4 h-4 mr-2" />
                  Завершить
                </Button>
              </>
            )}
          </div>

          {/* Participants */}
          {participants.length > 0 && (
            <div className="space-y-2">
              <Label>Участники комнаты ({participants.length}):</Label>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div
                    key={p.identity}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                  >
                    {p.isAgent ? (
                      <Bot className="w-4 h-4 text-purple-600" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="font-medium">{p.name}</span>
                    {p.isAgent && <Badge variant="outline" className="ml-auto">AI Agent</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden audio element for remote audio */}
          <audio ref={audioRef} autoPlay playsInline className="hidden" />

          {/* Instructions */}
          <div className="mt-4 p-3 bg-blue-50 rounded text-sm space-y-1">
            <p className="font-medium">💡 Инструкция:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Нажмите "Начать разговор"</li>
              <li>Разрешите доступ к микрофону в браузере</li>
              <li>Дождитесь подключения Voice Agent (обычно 3-5 секунд)</li>
              <li>Начните говорить - агент вас услышит и ответит</li>
            </ol>
          </div>

          {/* Tech Info */}
          <div className="mt-2 p-3 bg-gray-50 rounded text-xs space-y-1 text-gray-600">
            <p><strong>STT:</strong> Yandex SpeechKit (ru-RU)</p>
            <p><strong>TTS:</strong> Yandex SpeechKit (голос: alena, скорость: 1.1)</p>
            <p><strong>LLM:</strong> GPT-4o-mini через OpenRouter</p>
            <p><strong>Сервер:</strong> 147.45.146.149:7880</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
