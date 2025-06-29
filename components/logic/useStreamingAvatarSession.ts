import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
} from "@heygen/streaming-avatar";
import { useCallback } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";
import { useSpeechToText } from "./useSpeechToText";

// Helper function to generate a UUID v4 in a cross-browser compatible way
const generateUUID = (): string => {
  // Use a simple implementation that works in all environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const useStreamingAvatarSession = () => {
  const {
    avatarRef,
    basePath,
    sessionState,
    setSessionState,
    stream,
    setStream,
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    clearMessages,
    conversation_id,
    setConversation_id,
    language,
    setLanguage,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();
  const { stopListening } = useSpeechToText();

  useMessageHistory();

  const init = useCallback(
    (token: string) => {
      avatarRef.current = new StreamingAvatar({
        token,
        basePath: basePath,
      });

      return avatarRef.current;
    },
    [basePath, avatarRef],
  );

  const handleStream = useCallback(
    ({ detail }: { detail: MediaStream }) => {
      setStream(detail);
      setSessionState(StreamingAvatarSessionState.CONNECTED);
    },
    [setSessionState, setStream],
  );

  const stop = useCallback(async () => {
    avatarRef.current?.off(StreamingEvents.STREAM_READY, handleStream);
    avatarRef.current?.off(StreamingEvents.STREAM_DISCONNECTED, stop);
    clearMessages();
    stopVoiceChat();
    await stopListening();
    setIsListening(false);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setStream(null);
    setConversation_id(null);
    setLanguage(null);
    await avatarRef.current?.stopAvatar();
    setSessionState(StreamingAvatarSessionState.INACTIVE);
  }, [
    handleStream,
    setSessionState,
    setStream,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    stopListening,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
    setConversation_id,
    setLanguage,
  ]);

  const start = useCallback(
    async (config: StartAvatarRequest, token?: string) => {
      if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
        throw new Error("There is already an active session");
      }

      if (!avatarRef.current) {
        if (!token) {
          throw new Error("Token is required");
        }
        init(token);
      }

      if (!avatarRef.current) {
        throw new Error("Avatar is not initialized");
      }

      // Generate a new UUID for the conversation
      const newConversationId = generateUUID();
      setConversation_id(newConversationId);

      setSessionState(StreamingAvatarSessionState.CONNECTING);
      avatarRef.current.on(StreamingEvents.STREAM_READY, handleStream);
      avatarRef.current.on(StreamingEvents.STREAM_DISCONNECTED, stop);
      avatarRef.current.on(
        StreamingEvents.CONNECTION_QUALITY_CHANGED,
        ({ detail }: { detail: ConnectionQuality }) =>
          setConnectionQuality(detail),
      );
      avatarRef.current.on(StreamingEvents.USER_START, () => {
        setIsUserTalking(true);
      });
      avatarRef.current.on(StreamingEvents.USER_STOP, () => {
        setIsUserTalking(false);
      });
      avatarRef.current.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setIsAvatarTalking(true);
      });
      avatarRef.current.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setIsAvatarTalking(false);
      });
      // We're still registering the event handlers for message history purposes,
      // but the actual processing of user speech is handled in InteractiveAvatar.tsx
      avatarRef.current.on(
        StreamingEvents.USER_TALKING_MESSAGE,
        handleUserTalkingMessage,
      );
      avatarRef.current.on(
        StreamingEvents.AVATAR_TALKING_MESSAGE,
        handleStreamingTalkingMessage,
      );
      avatarRef.current.on(StreamingEvents.USER_END_MESSAGE, handleEndMessage);
      avatarRef.current.on(
        StreamingEvents.AVATAR_END_MESSAGE,
        handleEndMessage,
      );

      await avatarRef.current.createStartAvatar(config);

      return avatarRef.current;
    },
    [
      init,
      handleStream,
      stop,
      setSessionState,
      avatarRef,
      sessionState,
      setConnectionQuality,
      setIsUserTalking,
      handleUserTalkingMessage,
      handleStreamingTalkingMessage,
      handleEndMessage,
      setIsAvatarTalking,
      setConversation_id,
      setLanguage,
    ],
  );

  return {
    avatarRef,
    sessionState,
    stream,
    conversation_id,
    language,
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
  };
};
