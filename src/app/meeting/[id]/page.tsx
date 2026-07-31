'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp,
  MessageSquare, Users, Clock, PhoneOff, Copy, Check,
  ChevronRight, Send, ShieldAlert, Sparkles
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';

interface PeerStream {
  peerId: string;
  socketId: string;
  name: string;
  stream: MediaStream;
  isMuted: boolean;
  isVideoOff: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || '';

  // State
  const [event, setEvent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'agenda' | null>('chat');
  
  const [participants, setParticipants] = useState<any[]>([]);
  const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  // References
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerInstanceRef = useRef<any>(null);
  const peersMapRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    initMeeting();

    return () => {
      // Cleanup streams & sockets
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerInstanceRef.current) {
        peerInstanceRef.current.destroy();
      }
    };
  }, [roomId]);

  const initMeeting = async () => {
    try {
      // 1. Fetch Auth user & event metadata
      const [authRes, eventRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => r.json()).catch(() => ({ user: null })),
        fetch(`/api/events/${roomId}`).then((r) => r.json()),
      ]);

      const currentUser = authRes.user || {
        id: 'guest-' + Math.random().toString(36).substr(2, 5),
        name: 'Guest User ' + Math.floor(Math.random() * 100)
      };
      setUser(currentUser);
      setEvent(eventRes.event);

      // 2. Access local user media (Mic & Camera)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (mediaErr) {
        console.warn('Camera/Microphone access restricted:', mediaErr);
        setCameraPermissionError(true);
        // Create canvas silent placeholder stream
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#6366f1';
          ctx.font = '24px sans-serif';
          ctx.fillText(currentUser.name, 220, 240);
        }
        const canvasStream = canvas.captureStream(10);
        localStreamRef.current = canvasStream;
      }

      // 3. Initialize PeerJS client with global STUN ICE servers for NAT traversal worldwide
      const Peer = (await import('peerjs')).default;
      const myPeer = new Peer(undefined, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
          ]
        }
      });

      myPeer.on('open', (peerId) => {
        console.log('[PeerJS] Initialized with Peer ID:', peerId);

        // Connect Socket.io
        const socket = io({ path: '/socket.io' });
        socketRef.current = socket;

        socket.emit('join-room', {
          roomId,
          userId: currentUser.id,
          name: currentUser.name,
          peerId,
        });

        // Event listeners
        socket.on('room-participants', (list: any[]) => {
          setParticipants(list);
        });

        socket.on('user-joined', (newParticipant: any) => {
          setParticipants((prev) => [...prev.filter((p) => p.socketId !== newParticipant.socketId), newParticipant]);
          // Call incoming peer
          if (localStreamRef.current && newParticipant.peerId) {
            connectToNewPeer(myPeer, newParticipant, localStreamRef.current);
          }
        });

        socket.on('participant-updated', (updated: any) => {
          setParticipants((prev) =>
            prev.map((p) => (p.socketId === updated.socketId ? updated : p))
          );
        });

        socket.on('new-message', (msg: ChatMessage) => {
          setMessages((prev) => [...prev, msg]);
        });

        socket.on('user-left', ({ socketId, peerId }: any) => {
          setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
          setPeerStreams((prev) => prev.filter((p) => p.peerId !== peerId));
          if (peersMapRef.current.has(peerId)) {
            peersMapRef.current.get(peerId).close();
            peersMapRef.current.delete(peerId);
          }
        });
      });

      // Handle incoming calls
      myPeer.on('call', (call) => {
        if (localStreamRef.current) {
          call.answer(localStreamRef.current);
          call.on('stream', (userVideoStream) => {
            addPeerStream(call.peer, userVideoStream);
          });
        }
      });

      peerInstanceRef.current = myPeer;
    } catch (err) {
      console.error('Meeting init error:', err);
    }
  };

  const connectToNewPeer = (peerObj: any, newPeerInfo: any, stream: MediaStream) => {
    const call = peerObj.call(newPeerInfo.peerId, stream);
    call.on('stream', (userVideoStream: MediaStream) => {
      addPeerStream(newPeerInfo.peerId, userVideoStream, newPeerInfo.name);
    });
    call.on('close', () => {
      setPeerStreams((prev) => prev.filter((p) => p.peerId !== newPeerInfo.peerId));
    });

    peersMapRef.current.set(newPeerInfo.peerId, call);
  };

  const addPeerStream = (peerId: string, stream: MediaStream, name = 'Participant') => {
    setPeerStreams((prev) => {
      if (prev.some((p) => p.peerId === peerId)) return prev;
      return [...prev, { peerId, socketId: '', name, stream, isMuted: false, isVideoOff: false }];
    });
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !micActive;
        setMicActive(!micActive);
        socketRef.current?.emit('toggle-audio', { isMuted: micActive });
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !cameraActive;
        setCameraActive(!cameraActive);
        socketRef.current?.emit('toggle-video', { isVideoOff: cameraActive });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
        socketRef.current?.emit('toggle-screen-share', { isScreenSharing: true });
      } catch (err) {
        console.error('Screen sharing cancelled:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsScreenSharing(false);
    socketRef.current?.emit('toggle-screen-share', { isScreenSharing: false });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !socketRef.current) return;

    socketRef.current.emit('send-message', {
      roomId,
      message: { text: inputMsg.trim(), senderName: user?.name || 'You' },
    });
    setInputMsg('');
  };

  const copyMeetingCode = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const leaveMeeting = () => {
    router.push('/dashboard');
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col justify-between text-slate-100">
      
      {/* Top Meeting Header */}
      <header className="h-16 px-6 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center text-white">
            <VideoIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-heading">{event?.title || 'EventConnect Video Meeting'}</h2>
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Session
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyMeetingCode}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-750 text-xs font-mono font-bold text-slate-200"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {event?.code || roomId}
          </button>
        </div>
      </header>

      {/* Main Body Area: Video Grid & Side Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Video Canvas Container */}
        <div className="flex-1 p-4 flex items-center justify-center overflow-auto relative">
          
          <div className={`w-full h-full grid gap-4 ${
            peerStreams.length === 0 ? 'grid-cols-1 max-w-4xl max-h-[80vh]' :
            peerStreams.length === 1 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl max-h-[85vh]' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl'
          }`}>
            
            {/* Local Video Card */}
            <div className="relative rounded-2xl overflow-hidden glass-panel border border-indigo-500/30 flex items-center justify-center bg-slate-900 group">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
              />
              {!cameraActive && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-semibold text-slate-400">Camera Off</span>
                </div>
              )}
              
              <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 border border-slate-800">
                <span>{user?.name || 'You'} (You)</span>
                {!micActive && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
              </div>
            </div>

            {/* Peer Video Feeds */}
            {peerStreams.map((peer) => (
              <div key={peer.peerId} className="relative rounded-2xl overflow-hidden glass-panel border border-slate-800 flex items-center justify-center bg-slate-900">
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && peer.stream) el.srcObject = peer.stream;
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 border border-slate-800">
                  <span>{peer.name}</span>
                </div>
              </div>
            ))}

          </div>

          {cameraPermissionError && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2 z-10">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Camera/Microphone permission denied or in use by another app. Showing avatar fallback.</span>
            </div>
          )}

        </div>

        {/* Side Panel / Drawers (Chat, Participants, Agenda) */}
        {activeTab && (
          <aside className="w-80 sm:w-96 bg-slate-900/90 border-l border-slate-800 flex flex-col z-20 backdrop-blur-xl">
            
            {/* Panel Tabs */}
            <div className="h-12 border-b border-slate-800 flex items-center justify-around px-2 text-xs font-semibold text-slate-400">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 h-full flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === 'chat' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Chat ({messages.length})
              </button>
              <button
                onClick={() => setActiveTab('participants')}
                className={`flex-1 h-full flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === 'participants' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> People ({participants.length + 1})
              </button>
              <button
                onClick={() => setActiveTab('agenda')}
                className={`flex-1 h-full flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === 'agenda' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Agenda
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div className="h-full flex flex-col justify-between">
                  <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1">
                    {messages.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-10">No messages yet. Start the conversation!</p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold text-indigo-300">{msg.senderName}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed">{msg.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={sendMessage} className="mt-4 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-xs"
                    />
                    <button
                      type="submit"
                      className="gradient-btn p-2.5 rounded-xl text-white shadow-md shadow-indigo-500/20"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* PARTICIPANTS TAB */}
              {activeTab === 'participants' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-indigo-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{user?.name} (You)</p>
                        <span className="text-[10px] text-indigo-400">Host</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      {micActive ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                    </div>
                  </div>

                  {participants.map((p) => (
                    <div key={p.socketId} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                          {p.name?.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-xs font-semibold text-white">{p.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AGENDA TAB */}
              {activeTab === 'agenda' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Event Schedule</h4>
                  {event?.agendaItems?.length === 0 ? (
                    <p className="text-xs text-slate-500">No agenda configured.</p>
                  ) : (
                    event?.agendaItems?.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{item.title}</span>
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                            {item.startTime}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>

          </aside>
        )}

      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="h-20 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between px-6 z-20 backdrop-blur-xl">
        
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Room Code: <strong className="text-white font-mono">{event?.code || roomId}</strong></span>
        </div>

        {/* Center Meeting Controls */}
        <div className="flex items-center gap-3 mx-auto md:mx-0">
          
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              micActive
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
            }`}
            title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              cameraActive
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
            }`}
            title={cameraActive ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {cameraActive ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          {/* Toggle Side Panels */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Toggle Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'participants'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Toggle Participants"
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'agenda' ? null : 'agenda')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'agenda'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Toggle Agenda"
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* End Call Button */}
          <button
            onClick={leaveMeeting}
            className="w-14 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 ml-2"
            title="Leave Meeting"
          >
            <PhoneOff className="w-5 h-5" />
          </button>

        </div>

        <div className="hidden md:block w-36 text-right" />

      </footer>

    </div>
  );
}
