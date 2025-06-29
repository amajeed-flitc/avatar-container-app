import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useVoiceChat = () => {
  const {
    avatarRef,
    isMuted,
    setIsMuted,
    isVoiceChatActive,
    setIsVoiceChatActive,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
  } = useStreamingAvatarContext();

  const startVoiceChat = useCallback(
    async (isInputAudioMuted?: boolean) => {
      if (!avatarRef.current) return;
      setIsVoiceChatLoading(true);
      // Always force isInputAudioMuted to true regardless of the parameter
      await avatarRef.current?.startVoiceChat({
        isInputAudioMuted: true,
      });
      setIsVoiceChatLoading(false);
      setIsVoiceChatActive(true);
      setIsMuted(true); // Always set to muted

      // Log that we're forcing the audio to be muted
      if (!isInputAudioMuted) {
        console.log("Voice chat started with forced audio muting (overriding parameter)");
      } else {
        console.log("Voice chat started with input audio muted");
      }
    },
    [avatarRef, setIsMuted, setIsVoiceChatActive, setIsVoiceChatLoading],
  );

  const stopVoiceChat = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.closeVoiceChat();
    setIsVoiceChatActive(false);
    setIsMuted(true);
  }, [avatarRef, setIsMuted, setIsVoiceChatActive]);

  const muteInputAudio = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.muteInputAudio();
    setIsMuted(true);
  }, [avatarRef, setIsMuted]);

  // This function is intentionally modified to always keep the avatar muted
  const unmuteInputAudio = useCallback(() => {
    if (!avatarRef.current) return;
    // Always keep the avatar muted, never unmute
    avatarRef.current?.muteInputAudio();
    setIsMuted(true);
    console.log("Attempted to unmute avatar audio, but keeping it muted as required");
  }, [avatarRef, setIsMuted]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
  };
};
