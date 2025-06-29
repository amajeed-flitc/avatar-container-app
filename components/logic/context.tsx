import StreamingAvatar, {
  ConnectionQuality,
  StreamingTalkingMessageEvent,
  UserTalkingMessageEvent,
  TaskType,
  TaskMode,
} from "@heygen/streaming-avatar";
import React, { useRef, useState } from "react";

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export enum MessageSender {
  CLIENT = "CLIENT",
  AVATAR = "AVATAR",
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
}

type StreamingAvatarContextProps = {
  avatarRef: React.MutableRefObject<StreamingAvatar | null>;
  basePath?: string;

  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
  isVoiceChatLoading: boolean;
  setIsVoiceChatLoading: (isVoiceChatLoading: boolean) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (isVoiceChatActive: boolean) => void;

  sessionState: StreamingAvatarSessionState;
  setSessionState: (sessionState: StreamingAvatarSessionState) => void;
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;
  conversation_id: string | null;
  setConversation_id: (conversation_id: string | null) => void;
  language: string | null;
  setLanguage: (language: string | null) => void;

  messages: Message[];
  clearMessages: () => void;
  handleUserTalkingMessage: ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => void;
  handleStreamingTalkingMessage: ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => void;
  handleEndMessage: () => void;
  speakText: (text: string) => Promise<void>;

  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isUserTalking: boolean;
  setIsUserTalking: (isUserTalking: boolean) => void;
  isAvatarTalking: boolean;
  setIsAvatarTalking: (isAvatarTalking: boolean) => void;

  connectionQuality: ConnectionQuality;
  setConnectionQuality: (connectionQuality: ConnectionQuality) => void;
};

const StreamingAvatarContext = React.createContext<StreamingAvatarContextProps>(
  {
    avatarRef: { current: null },
    isMuted: true,
    setIsMuted: () => {},
    isVoiceChatLoading: false,
    setIsVoiceChatLoading: () => {},
    sessionState: StreamingAvatarSessionState.INACTIVE,
    setSessionState: () => {},
    isVoiceChatActive: false,
    setIsVoiceChatActive: () => {},
    stream: null,
    setStream: () => {},
    conversation_id: null,
    setConversation_id: () => {},
    language: null,
    setLanguage: () => {},
    messages: [],
    clearMessages: () => {},
    handleUserTalkingMessage: () => {},
    handleStreamingTalkingMessage: () => {},
    handleEndMessage: () => {},
    speakText: async () => {},
    isListening: false,
    setIsListening: () => {},
    isUserTalking: false,
    setIsUserTalking: () => {},
    isAvatarTalking: false,
    setIsAvatarTalking: () => {},
    connectionQuality: ConnectionQuality.UNKNOWN,
    setConnectionQuality: () => {},
  },
);

const useStreamingAvatarSessionState = () => {
  const [sessionState, setSessionState] = useState(
    StreamingAvatarSessionState.INACTIVE,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [conversation_id, setConversation_id] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  return {
    sessionState,
    setSessionState,
    stream,
    setStream,
    conversation_id,
    setConversation_id,
    language,
    setLanguage,
  };
};

const useStreamingAvatarVoiceChatState = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [isVoiceChatLoading, setIsVoiceChatLoading] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  return {
    isMuted,
    setIsMuted,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    isVoiceChatActive,
    setIsVoiceChatActive,
  };
};

const useStreamingAvatarMessageState = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const currentSenderRef = useRef<MessageSender | null>(null);

  const handleUserTalkingMessage = ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => {
    console.log("handleUserTalkingMessage called with:", detail);

    // Check if we have a valid message
    if (!detail || !detail.message) {
      console.warn("Invalid detail or message in handleUserTalkingMessage");
      return;
    }

    if (currentSenderRef.current === MessageSender.CLIENT) {
      console.log("Appending to existing client message");
      setMessages((prev) => {
        if (prev.length === 0) {
          console.warn("No previous messages to append to");
          return [{
            id: Date.now().toString(),
            sender: MessageSender.CLIENT,
            content: detail.message,
          }];
        }

        return [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: [prev[prev.length - 1].content, detail.message].join(""),
          },
        ];
      });
    } else {
      console.log("Creating new client message");
      currentSenderRef.current = MessageSender.CLIENT;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: MessageSender.CLIENT,
          content: detail.message,
        },
      ]);
    }
  };

  const handleStreamingTalkingMessage = ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => {
    console.log("handleStreamingTalkingMessage called with:", detail);

    // Check if we have a valid message
    if (!detail || !detail.message) {
      console.warn("Invalid detail or message in handleStreamingTalkingMessage");
      return;
    }

    if (currentSenderRef.current === MessageSender.AVATAR) {
      console.log("Appending to existing avatar message");
      setMessages((prev) => {
        if (prev.length === 0) {
          console.warn("No previous messages to append to");
          return [{
            id: Date.now().toString(),
            sender: MessageSender.AVATAR,
            content: detail.message,
          }];
        }

        return [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: [prev[prev.length - 1].content, detail.message].join(""),
          },
        ];
      });
    } else {
      console.log("Creating new avatar message");
      currentSenderRef.current = MessageSender.AVATAR;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: MessageSender.AVATAR,
          content: detail.message,
        },
      ]);
    }
  };

  const handleEndMessage = () => {
    console.log("handleEndMessage called, resetting currentSenderRef from:", currentSenderRef.current);
    currentSenderRef.current = null;
  };

  return {
    messages,
    clearMessages: () => {
      setMessages([]);
      currentSenderRef.current = null;
    },
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
  };
};

const useStreamingAvatarListeningState = () => {
  const [isListening, setIsListening] = useState(false);

  return { isListening, setIsListening };
};

const useStreamingAvatarTalkingState = () => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  return {
    isUserTalking,
    setIsUserTalking,
    isAvatarTalking,
    setIsAvatarTalking,
  };
};

const useStreamingAvatarConnectionQualityState = () => {
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.UNKNOWN,
  );

  return { connectionQuality, setConnectionQuality };
};

export const StreamingAvatarProvider = ({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath?: string;
}) => {
  const avatarRef = React.useRef<StreamingAvatar>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const messageState = useStreamingAvatarMessageState();
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();

  // Add a speakText function that will call avatar.speak() with the recognized text
  const speakText = React.useCallback(async (text: string) => {
    if (!avatarRef.current) {
      console.warn("Cannot speak text: avatar is not initialized");
      return;
    }

    try {
      console.log("Speaking text via context function:", text);
      await avatarRef.current.speak({
        text,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC
      });
      console.log("Avatar speak task completed successfully via context function");
    } catch (error) {
      console.error("Error in avatar.speak via context function:", error);
    }
  }, [avatarRef]);

  return (
    <StreamingAvatarContext.Provider
      value={{
        avatarRef,
        basePath,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
        speakText,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
