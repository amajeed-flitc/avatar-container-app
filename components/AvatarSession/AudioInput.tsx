import React, { useEffect } from "react";

import { useVoiceChat } from "../logic/useVoiceChat";
import { useSpeechToText } from "../logic";
import { MicIcon, MicOffIcon } from "../Icons";
import { useConversationState } from "../logic/useConversationState";

export const AudioInput: React.FC = () => {
  const { muteInputAudio, isMuted, isVoiceChatLoading } =
    useVoiceChat();
  const { isUserTalking } = useConversationState();
  const { 
    startListening, 
    isListening, 
    error: sttError,
    permissionState,
    checkPermission
  } = useSpeechToText();

  // Add a ref to track if this component has already attempted to start STT
  const hasAttemptedStart = React.useRef(false);

  // Check permission when component mounts
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Automatically start STT when component mounts, but only if it's not already started elsewhere
  useEffect(() => {
    const autoStartSTT = async () => {
      // Only attempt to start if not already listening and we haven't tried before
      if (!isListening && !hasAttemptedStart.current) {
        hasAttemptedStart.current = true;
        console.log("Auto-starting STT on component mount");
        try {
          await startListening();
          console.log("STT started successfully");
        } catch (error) {
          console.error("Error starting STT:", error);
        }
      }
    };

    autoStartSTT();
  }, [isListening, startListening]);

  // Always keep the avatar muted
  useEffect(() => {
    if (!isMuted) {
      muteInputAudio();
      console.log("Ensuring avatar microphone is muted");
    }
  }, [isMuted, muteInputAudio]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Microphone status indicators */}
      {permissionState === 'granted' && (
        <div className="flex items-center mt-1 bg-green-600 text-white px-2 py-1 rounded-md text-xs">
          <MicIcon size={12} className={`mr-1 ${isUserTalking ? "animate-pulse" : ""}`} />
          <span>Microphone active - STT is listening to your voice (avatar microphone is always muted)</span>
        </div>
      )}

      {permissionState === 'prompt' && (
        <div className="flex items-center mt-1 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs">
          <MicIcon size={12} className="mr-1" />
          <span>Microphone permission needed - please grant microphone access (avatar microphone is always muted)</span>
        </div>
      )}

      {permissionState === 'denied' && (
        <div className="flex items-center mt-1 bg-red-600 text-white px-2 py-1 rounded-md text-xs">
          <MicOffIcon size={12} className="mr-1" />
          <span>Microphone access denied - please enable microphone access in your browser settings</span>
        </div>
      )}

      {sttError && (
        <div className="text-red-500 text-sm mt-2 bg-red-100 px-3 py-2 rounded-md border border-red-300">
          <span className="font-bold">Error:</span> {sttError}
          {sttError.includes("Azure credentials") && (
            <div className="mt-1 text-xs">
              <span className="font-semibold">Possible solution:</span> Check that the Azure Speech SDK credentials are properly configured in the environment variables.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
