'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp,
  MessageSquare, Users, Clock, PhoneOff, Copy, Check,
  Send, ShieldAlert, Sparkles, Hand, Smile, HelpCircle,
  BarChart2, ThumbsUp, Plus, CheckCircle
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';

interface PeerStream {
  peerId: string;
  socketId: string;
  name: string;
  stream: MediaStream;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised?: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface ReactionParticle {
  id: string;
  emoji: string;
  senderName: string;
  left: number;
}

interface PollOption {
  id: number;
  text: string;
  votes: number;
  voters: string[];
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdByName: string;
  createdAt: string;
}

interface Question {
  id: string;
  text: string;
  senderName: string;
  upvotes: number;
  upvoters: string[];
  isAnswered: boolean;
  createdAt: string;
}

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || '';

  // Core State
  const [event, setEvent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'agenda' | 'qna' | 'polls' | null>('chat');
  
  // Real-time Lists
  const [participants, setParticipants] = useState<any[]>([]);
  const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [reactions, setReactions] = useState<ReactionParticle[]>([]);

  // Input States
  const [inputMsg, setInputMsg] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Yes', 'No']);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  
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

      const isHost = eventRes.event?.hostId === currentUser.id;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (mediaErr) {
        console.warn('Camera/Microphone access restricted:', mediaErr);
        setCameraPermissionError(true);
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

      const Peer = (await import('peerjs')).default;
      const myPeer = new Peer('', {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        }
      });

      myPeer.on('open', (peerId) => {
        const socket = io({ path: '/socket.io' });
        socketRef.current = socket;

        socket.emit('join-room', {
          roomId,
          userId: currentUser.id,
          name: currentUser.name,
          peerId,
          role: isHost ? 'HOST' : 'ATTENDEE'
        });

        // Socket Listeners
        socket.on('room-participants', (list: any[]) => setParticipants(list));
        socket.on('room-polls', (pList: Poll[]) => setPolls(pList));
        socket.on('room-questions', (qList: Question[]) => setQuestions(qList));

        socket.on('user-joined', (newParticipant: any) => {
          setParticipants((prev) => [...prev.filter((p) => p.socketId !== newParticipant.socketId), newParticipant]);
          if (localStreamRef.current && newParticipant.peerId) {
            connectToNewPeer(myPeer, newParticipant, localStreamRef.current);
          }
        });

        socket.on('participant-updated', (updated: any) => {
          setParticipants((prev) => prev.map((p) => (p.socketId === updated.socketId ? updated : p)));
        });

        socket.on('new-message', (msg: ChatMessage) => {
          setMessages((prev) => [...prev, msg]);
        });

        socket.on('new-reaction', (react: any) => {
          const particle: ReactionParticle = {
            id: react.id,
            emoji: react.emoji,
            senderName: react.senderName,
            left: Math.floor(Math.random() * 70) + 15
          };
          setReactions((prev) => [...prev, particle]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== react.id));
          }, 3000);
        });

        socket.on('force-mute', () => {
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = false));
            setMicActive(false);
          }
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

  const toggleRaiseHand = () => {
    const newHandState = !handRaised;
    setHandRaised(newHandState);
    socketRef.current?.emit('toggle-hand', { isHandRaised: newHandState });
  };

  const sendReaction = (emoji: string) => {
    socketRef.current?.emit('send-reaction', { emoji });
    setShowReactions(false);
  };

  const hostMuteAll = () => {
    socketRef.current?.emit('host-mute-all');
  };

  const submitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    socketRef.current?.emit('submit-question', { text: newQuestionText.trim() });
    setNewQuestionText('');
  };

  const upvoteQuestion = (qId: string) => {
    socketRef.current?.emit('upvote-question', { questionId: qId });
  };

  const answerQuestion = (qId: string) => {
    socketRef.current?.emit('answer-question', { questionId: qId });
  };

  const createPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = pollOptions.filter((opt) => opt.trim() !== '');
    if (!pollQuestion.trim() || validOptions.length < 2) return;

    socketRef.current?.emit('create-poll', {
      question: pollQuestion.trim(),
      options: validOptions
    });
    setPollQuestion('');
    setPollOptions(['Yes', 'No']);
    setShowCreatePoll(false);
  };

  const votePoll = (pollId: string, optionId: number) => {
    socketRef.current?.emit('vote-poll', { pollId, optionId });
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        screenTrack.onended = () => stopScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen sharing error:', err);
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
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !socketRef.current) return;
    socketRef.current.emit('send-message', { roomId, message: { text: inputMsg.trim(), senderName: user?.name || 'You' } });
    setInputMsg('');
  };

  const isHost = event?.hostId === user?.id;

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col justify-between text-slate-100 relative">
      
      {/* Floating Emoji Particles Layer */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-24 text-4xl animate-bounce transition-all duration-1000 ease-out"
          >
            <span className="drop-shadow-lg">{r.emoji}</span>
          </div>
        ))}
      </div>

      {/* Meeting Header */}
      <header className="h-16 px-6 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center text-white">
            <VideoIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              {event?.title || 'EventConnect Meeting'}
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                🔒 E2EE Encrypted
              </span>
            </h2>
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Session
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (event) navigator.clipboard.writeText(event.code);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-750 text-xs font-mono font-bold text-slate-200"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {event?.code || roomId}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
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
              <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`} />
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

              {handRaised && (
                <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 backdrop-blur-md animate-pulse">
                  <Hand className="w-4 h-4 text-amber-400" /> Raised Hand
                </div>
              )}
            </div>

            {/* Peer Video Feeds */}
            {peerStreams.map((peer) => {
              const peerParticipant = participants.find((p) => p.peerId === peer.peerId);
              return (
                <div key={peer.peerId} className="relative rounded-2xl overflow-hidden glass-panel border border-slate-800 flex items-center justify-center bg-slate-900">
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => { if (el && peer.stream) el.srcObject = peer.stream; }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 border border-slate-800">
                    <span>{peer.name}</span>
                  </div>
                  {peerParticipant?.isHandRaised && (
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 backdrop-blur-md animate-pulse">
                      <Hand className="w-4 h-4 text-amber-400" /> Raised Hand
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          {cameraPermissionError && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2 z-10">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Camera permission restricted. Avatar fallback active.</span>
            </div>
          )}
        </div>

        {/* Side Panel Drawers */}
        {activeTab && (
          <aside className="w-80 sm:w-96 bg-slate-900/90 border-l border-slate-800 flex flex-col z-20 backdrop-blur-xl">
            
            {/* Drawer Navigation Tabs */}
            <div className="h-12 border-b border-slate-800 flex items-center justify-around px-1 text-[11px] font-semibold text-slate-400 overflow-x-auto">
              <button onClick={() => setActiveTab('chat')} className={`px-2.5 h-full flex items-center gap-1 border-b-2 ${activeTab === 'chat' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent'}`}>
                <MessageSquare className="w-3.5 h-3.5" /> Chat ({messages.length})
              </button>
              <button onClick={() => setActiveTab('participants')} className={`px-2.5 h-full flex items-center gap-1 border-b-2 ${activeTab === 'participants' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent'}`}>
                <Users className="w-3.5 h-3.5" /> People ({participants.length})
              </button>
              <button onClick={() => setActiveTab('qna')} className={`px-2.5 h-full flex items-center gap-1 border-b-2 ${activeTab === 'qna' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent'}`}>
                <HelpCircle className="w-3.5 h-3.5" /> Q&A ({questions.length})
              </button>
              <button onClick={() => setActiveTab('polls')} className={`px-2.5 h-full flex items-center gap-1 border-b-2 ${activeTab === 'polls' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent'}`}>
                <BarChart2 className="w-3.5 h-3.5" /> Polls ({polls.length})
              </button>
              <button onClick={() => setActiveTab('agenda')} className={`px-2.5 h-full flex items-center gap-1 border-b-2 ${activeTab === 'agenda' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent'}`}>
                <Clock className="w-3.5 h-3.5" /> Agenda
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div className="h-full flex flex-col justify-between">
                  <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1">
                    {messages.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-10">No messages yet.</p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold text-indigo-300">{msg.senderName}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-200">{msg.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={sendMessage} className="mt-4 flex items-center gap-2">
                    <input type="text" placeholder="Type a message..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-xs" />
                    <button type="submit" className="gradient-btn p-2.5 rounded-xl text-white"><Send className="w-4 h-4" /></button>
                  </form>
                </div>
              )}

              {/* PARTICIPANTS TAB & HOST MODERATION */}
              {activeTab === 'participants' && (
                <div className="space-y-3">
                  {isHost && (
                    <div className="p-3 rounded-xl bg-slate-800/90 border border-indigo-500/40 space-y-2">
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">Host Moderation Controls</span>
                      <button
                        onClick={hostMuteAll}
                        className="w-full py-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MicOff className="w-3.5 h-3.5" /> Mute All Microphones
                      </button>
                    </div>
                  )}

                  {participants.map((p) => (
                    <div key={p.socketId} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                          {p.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                            {p.name} {p.userId === user?.id && '(You)'}
                            {p.role === 'HOST' && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded">HOST</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.isHandRaised && <Hand className="w-4 h-4 text-amber-400 animate-bounce" />}
                        {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Q&A TAB */}
              {activeTab === 'qna' && (
                <div className="space-y-4">
                  <form onSubmit={submitQuestion} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Ask a question..."
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                    />
                    <button type="submit" className="w-full py-2 rounded-xl gradient-btn text-xs font-semibold text-white">
                      Ask Question
                    </button>
                  </form>

                  <div className="space-y-3">
                    {questions.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No questions asked yet.</p>
                    ) : (
                      questions.map((q) => (
                        <div key={q.id} className={`p-3.5 rounded-xl border ${q.isAnswered ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/60 border-slate-700/60'}`}>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold text-indigo-300">{q.senderName}</span>
                            {q.isAnswered && <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Answered</span>}
                          </div>
                          <p className="text-xs text-white font-medium">{q.text}</p>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                            <button
                              onClick={() => upvoteQuestion(q.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-indigo-300 flex items-center gap-1 hover:bg-slate-700"
                            >
                              <ThumbsUp className="w-3 h-3" /> {q.upvotes} Upvotes
                            </button>

                            {isHost && (
                              <button
                                onClick={() => answerQuestion(q.id)}
                                className="text-[10px] text-slate-400 hover:text-emerald-400 font-semibold"
                              >
                                {q.isAnswered ? 'Mark Unanswered' : 'Mark Answered'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* LIVE POLLS TAB */}
              {activeTab === 'polls' && (
                <div className="space-y-4">
                  {isHost && (
                    <div>
                      {!showCreatePoll ? (
                        <button
                          onClick={() => setShowCreatePoll(true)}
                          className="w-full py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-indigo-500/30"
                        >
                          <Plus className="w-4 h-4" /> Create New Poll
                        </button>
                      ) : (
                        <form onSubmit={createPoll} className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
                          <h4 className="text-xs font-bold text-white">Create Live Poll</h4>
                          <input
                            type="text"
                            placeholder="Poll Question?"
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg glass-input text-xs font-medium"
                            required
                          />
                          {pollOptions.map((opt, idx) => (
                            <input
                              key={idx}
                              type="text"
                              placeholder={`Option ${idx + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...pollOptions];
                                newOpts[idx] = e.target.value;
                                setPollOptions(newOpts);
                              }}
                              className="w-full px-3 py-1.5 rounded-lg glass-input text-xs"
                            />
                          ))}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPollOptions([...pollOptions, ''])}
                              className="px-2 py-1 rounded bg-slate-700 text-[10px] text-slate-200"
                            >
                              + Add Option
                            </button>
                            <button type="submit" className="flex-1 py-1.5 rounded gradient-btn text-xs font-bold text-white">
                              Launch Poll
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    {polls.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No active polls.</p>
                    ) : (
                      polls.map((poll) => {
                        const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
                        return (
                          <div key={poll.id} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span>{poll.question}</span>
                              <span className="text-[10px] text-slate-400">{totalVotes} votes</span>
                            </div>

                            <div className="space-y-2">
                              {poll.options.map((opt) => {
                                const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => votePoll(poll.id, opt.id)}
                                    className="w-full text-left p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 relative overflow-hidden transition-all group"
                                  >
                                    <div
                                      style={{ width: `${percentage}%` }}
                                      className="absolute inset-y-0 left-0 bg-indigo-600/30 transition-all duration-500"
                                    />
                                    <div className="relative z-10 flex items-center justify-between text-xs">
                                      <span className="font-semibold text-slate-200">{opt.text}</span>
                                      <span className="font-bold text-indigo-400">{percentage}% ({opt.votes})</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* AGENDA TAB */}
              {activeTab === 'agenda' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Event Schedule</h4>
                  {event?.agendaItems?.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span>{item.title}</span>
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{item.startTime}</span>
                      </div>
                      {item.description && <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}

            </div>

          </aside>
        )}

      </div>

      {/* Floating Control Toolbar */}
      <footer className="h-20 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between px-6 z-20 backdrop-blur-xl relative">
        
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Code: <strong className="text-white font-mono">{event?.code || roomId}</strong></span>
        </div>

        {/* Center Meeting Controls */}
        <div className="flex items-center gap-2.5 mx-auto md:mx-0">
          
          <button
            onClick={toggleMic}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              micActive ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' : 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
            }`}
            title="Mic"
          >
            {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              cameraActive ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' : 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
            }`}
            title="Camera"
          >
            {cameraActive ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              isScreenSharing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Share Screen"
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* Raise Hand Button */}
          <button
            onClick={toggleRaiseHand}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              handRaised ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Raise Hand"
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Emoji Reactions Trigger & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all"
              title="Send Emoji Reaction"
            >
              <Smile className="w-5 h-5 text-indigo-400" />
            </button>

            {showReactions && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 p-2 rounded-2xl glass-panel border border-slate-700 flex items-center gap-2 shadow-2xl z-50">
                {['👏', '❤️', '🔥', '🎉', '🚀', '👍'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          {/* Drawer Toggles */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all relative ${
              activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'participants' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Participants"
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'qna' ? null : 'qna')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'qna' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Q&A"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'polls' ? null : 'polls')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'polls' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Polls"
          >
            <BarChart2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                  track.stop();
                  console.log(`[Privacy Protection] Media track stopped: ${track.kind}`);
                });
                localStreamRef.current = null;
              }
              if (socketRef.current) {
                socketRef.current.disconnect();
              }
              if (peerInstanceRef.current) {
                peerInstanceRef.current.destroy();
              }
              router.push('/dashboard');
            }}
            className="w-12 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 ml-2"
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
