import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  ElevenLabsModel,
  TaskType,
  TaskMode,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState, useSpeechToText } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";

// Initial default config that will be overridden by server config
const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATARS[0].avatar_id,
  knowledgeId: undefined,
  voice: {
    voiceId: undefined,
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  language: "en",
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  activityIdleTimeout: 30
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();
  const { startListening, stopListening, isListening, recognizedText, error: sttError, checkPermission } = useSpeechToText();

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [micPermissionState, setMicPermissionState] = useState<PermissionState | null>(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(true);

  const mediaStream = useRef<HTMLVideoElement>(null);

  // Check microphone permission when component mounts
  useEffect(() => {
    async function checkMicPermission() {
      try {
        console.log("Checking microphone permission on component mount");

        // Check if we're in a browser environment and if the Permissions API is available
        if (typeof navigator !== 'undefined' && navigator.permissions) {
          console.log("Permissions API is available, querying microphone permission");

          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log("Initial permission status:", permissionStatus.state);

          setMicPermissionState(permissionStatus.state);

          // Listen for changes to the permission state
          permissionStatus.onchange = () => {
            const newState = permissionStatus.state;
            console.log("Microphone permission state changed:", newState);
            setMicPermissionState(newState);

            // If permission becomes granted, hide the prompt
            if (newState === 'granted') {
              console.log("Permission granted via state change, hiding prompt");
              setShowPermissionPrompt(false);
            }
          };

          // If permission is already granted, hide the prompt
          if (permissionStatus.state === 'granted') {
            console.log("Permission already granted, hiding prompt");
            setShowPermissionPrompt(false);
          } else {
            console.log("Permission not granted, showing prompt:", permissionStatus.state);
          }
        } else {
          console.warn('Permissions API not available in this environment');

          // Try to detect if we have permission using a different method
          try {
            // Just check if we can access the microphone without actually using it
            if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              console.log("Trying to detect microphone permission using getUserMedia");

              // This will show the permission prompt if permission hasn't been granted yet
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

              // If we get here, permission was granted
              console.log("Microphone access granted via getUserMedia check");

              // Stop the tracks immediately
              stream.getTracks().forEach(track => track.stop());

              // Set permission state and hide prompt
              setMicPermissionState('granted');
              setShowPermissionPrompt(false);
            }
          } catch (mediaErr) {
            console.warn("Could not detect microphone permission:", mediaErr);
            // Keep the prompt visible since we couldn't determine permission status
          }
        }
      } catch (err) {
        console.error('Error checking microphone permission:', err);
      }
    }

    // Only run this in the browser, not during SSR
    if (typeof window !== 'undefined') {
      checkMicPermission();
    }
  }, []);

  // Function to request microphone permission
  const requestMicrophonePermission = async () => {
    console.log("requestMicrophonePermission called - attempting to request microphone access");

    let processingIndicator: HTMLDivElement | null = null;

    try {
      // Create a visible indicator that we're processing the request
      try {
        processingIndicator = document.createElement('div');
        processingIndicator.style.position = 'fixed';
        processingIndicator.style.top = '50%';
        processingIndicator.style.left = '50%';
        processingIndicator.style.transform = 'translate(-50%, -50%)';
        processingIndicator.style.padding = '10px 20px';
        processingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        processingIndicator.style.color = 'white';
        processingIndicator.style.borderRadius = '5px';
        processingIndicator.style.zIndex = '10000';
        processingIndicator.textContent = 'Processing permission request...';
        document.body.appendChild(processingIndicator);
      } catch (indicatorError) {
        console.warn("Could not create processing indicator:", indicatorError);
        // Continue without the indicator
      }

      // Check if we're in a browser environment and if the MediaDevices API is available
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log("MediaDevices API is available, requesting microphone access...");

        try {
          // This will trigger the browser's permission prompt
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("Microphone access granted, stream obtained:", stream);

          // Stop the tracks immediately since we don't need them now
          stream.getTracks().forEach(track => {
            console.log("Stopping track:", track.kind, track.label);
            track.stop();
          });

          // Check the permission status again
          if (typeof navigator.permissions !== 'undefined') {
            console.log("Checking permission status after getUserMedia...");
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            console.log("Current permission status:", permissionStatus.state);

            setMicPermissionState(permissionStatus.state);

            // If permission is granted, hide the prompt
            if (permissionStatus.state === 'granted') {
              console.log("Permission granted, hiding prompt");
              setShowPermissionPrompt(false);
            } else {
              console.log("Permission not granted despite successful getUserMedia:", permissionStatus.state);
              // This is unusual but can happen in some browsers
              // Let's assume permission is granted since getUserMedia succeeded
              setMicPermissionState('granted');
              setShowPermissionPrompt(false);
            }
          } else {
            console.log("Permissions API not available, but getUserMedia succeeded - assuming permission granted");
            setMicPermissionState('granted');
            setShowPermissionPrompt(false);
          }

          console.log("Microphone permission granted successfully");

          // Show success message to the user
          try {
            if (processingIndicator && document.body.contains(processingIndicator)) {
              document.body.removeChild(processingIndicator);
            }

            const successIndicator = document.createElement('div');
            successIndicator.style.position = 'fixed';
            successIndicator.style.top = '50%';
            successIndicator.style.left = '50%';
            successIndicator.style.transform = 'translate(-50%, -50%)';
            successIndicator.style.padding = '10px 20px';
            successIndicator.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
            successIndicator.style.color = 'white';
            successIndicator.style.borderRadius = '5px';
            successIndicator.style.zIndex = '10000';
            successIndicator.textContent = 'Microphone access granted!';
            document.body.appendChild(successIndicator);

            // Remove the success indicator after a short delay
            setTimeout(() => {
              if (document.body.contains(successIndicator)) {
                document.body.removeChild(successIndicator);
              }
            }, 2000);
          } catch (indicatorError) {
            console.warn("Could not show success indicator:", indicatorError);
            // Continue without the indicator
          }

          // Force a re-render to ensure UI updates
          setTimeout(() => {
            console.log("Forcing UI update");
            setMicPermissionState('granted'); // Force to granted since getUserMedia succeeded
            setShowPermissionPrompt(false);
          }, 100);

          return true;
        } catch (getUserMediaError) {
          console.error("Error in getUserMedia:", getUserMediaError);
          console.error("Error name:", getUserMediaError instanceof Error ? getUserMediaError.name : "Unknown error type");
          console.error("Error message:", getUserMediaError instanceof Error ? getUserMediaError.message : String(getUserMediaError));

          // Check if this is a permission denied error
          if (getUserMediaError instanceof DOMException && 
              (getUserMediaError.name === 'NotAllowedError' || getUserMediaError.name === 'PermissionDeniedError')) {
            console.log("Permission explicitly denied by user");
            setMicPermissionState('denied');

            // Show denied message to the user
            try {
              if (processingIndicator && document.body.contains(processingIndicator)) {
                document.body.removeChild(processingIndicator);
              }
            } catch (indicatorError) {
              console.warn("Could not remove processing indicator:", indicatorError);
            }

            window.alert("Microphone access was denied. Speech-to-text functionality will not work without microphone access.");
          } else {
            // Some other error occurred
            try {
              if (processingIndicator && document.body.contains(processingIndicator)) {
                document.body.removeChild(processingIndicator);
              }
            } catch (indicatorError) {
              console.warn("Could not remove processing indicator:", indicatorError);
            }

            window.alert(`Error accessing microphone: ${getUserMediaError instanceof Error ? getUserMediaError.message : String(getUserMediaError)}`);
          }

          // Check the permission status
          if (typeof navigator.permissions !== 'undefined') {
            try {
              const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
              console.log("Permission status after getUserMedia error:", permissionStatus.state);
              setMicPermissionState(permissionStatus.state);
            } catch (permError) {
              console.error("Error checking permission status:", permError);
            }
          }

          return false;
        }
      } else {
        console.warn("MediaDevices API not available in this environment");

        try {
          if (processingIndicator && document.body.contains(processingIndicator)) {
            document.body.removeChild(processingIndicator);
          }
        } catch (indicatorError) {
          console.warn("Could not remove processing indicator:", indicatorError);
        }

        window.alert("Your browser doesn't support microphone access. Please try a different browser.");
        return false;
      }
    } catch (err) {
      console.error("Unexpected error in requestMicrophonePermission:", err);

      // Remove the processing indicator
      try {
        if (processingIndicator && document.body.contains(processingIndicator)) {
          document.body.removeChild(processingIndicator);
        }
      } catch (indicatorError) {
        console.warn("Could not remove processing indicator:", indicatorError);
      }

      // Show an alert to the user
      window.alert("An unexpected error occurred while requesting microphone access. Please try again or use a different browser.");

      return false;
    }
  };

  // Fetch avatar configuration from server
  useEffect(() => {
    async function fetchAvatarConfig() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/get-avatar-config');
        if (!response.ok) {
          throw new Error('Failed to fetch avatar configuration');
        }
        const serverConfig = await response.json();
        setConfig(prevConfig => ({
          ...prevConfig,
          ...serverConfig,
          // Ensure knowledgeId is preserved if it was set in the UI
          knowledgeId: prevConfig.knowledgeId
        }));
      } catch (error) {
        console.error('Error fetching avatar configuration:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAvatarConfig();
  }, []);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      // Check if microphone permission has been granted
      if (micPermissionState !== 'granted') {
        // If permission is not granted, show the permission prompt
        setShowPermissionPrompt(true);

        // If permission is denied, show an alert
        if (micPermissionState === 'denied') {
          window.alert("Microphone access is denied. Please enable microphone access in your browser settings and refresh the page.");
        }

        // Ask for permission again
        try {
          await requestMicrophonePermission();

          // If permission is still not granted after the request, continue anyway
          // but log a warning
          if (micPermissionState !== 'granted') {
            console.warn("Starting session without microphone permission");
          }
        } catch (permError) {
          console.error("Error requesting microphone permission:", permError);
          // Continue anyway, as the user might still want to use text chat
        }
      }

      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      // Mute input audio to prevent the avatar from listening to audio
      avatar.muteInputAudio();
      console.log("Avatar input audio muted during initialization to prevent automatic input processing");

      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
      });
      avatar.on(StreamingEvents.STREAM_READY, async (event) => {
        console.log(">>>>> Stream ready:", event.detail);

        // Send a welcome message when the stream is ready
        try {
          const welcomeMessage = "السلام عليكم, أنا مساعدك الشخصي من منصة قيوى, كيف يمكنني مساعدتك اليوم";
          await avatar.speak({
            text: welcomeMessage,
            taskType: TaskType.REPEAT,
            taskMode: TaskMode.SYNC
          });
          console.log("Welcome message sent successfully");

          // Start STT when the avatar stream is ready, but only if it's not already running
          try {
            // Use the current permission state from our component state
            console.log("Microphone permission status before auto-starting STT:", micPermissionState);

            // If permission is not granted, show the permission prompt
            if (micPermissionState !== 'granted') {
              setShowPermissionPrompt(true);
              console.log("Showing microphone permission prompt because permission is not granted");
            }

            // Only start STT if it's not already running
            if (!isListening) {
              await startListening();
              console.log("Speech-to-text started automatically");
            } else {
              console.log("Speech-to-text already running, not starting again");
            }
          } catch (sttStartError) {
            console.error("Error starting speech-to-text:", sttStartError);
          }
        } catch (error) {
          console.error("Error sending welcome message:", error);
        }
      });
      avatar.on(StreamingEvents.USER_START, (event) => {
        console.log(">>>>> User started talking:", event);
      });
      avatar.on(StreamingEvents.USER_STOP, (event) => {
        console.log(">>>>> User stopped talking:", event);
      });
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
        console.log(">>>>> User end message:", event);
        // We'll repeat the user's message in the USER_TALKING_MESSAGE event
      });
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
        console.log(">>>>> User talking message:", event);
        console.log(">>>>> User talking message detail:", event.detail);

        // We're now calling speakText directly in useSpeechToText.ts,
        // so we don't need to call avatar.speak() here.
        // This prevents the avatar from speaking the text twice.
        console.log(">>>>> Not speaking text here to avoid duplication - speech is handled in useSpeechToText.ts");
      });
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log(">>>>> Avatar talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log(">>>>> Avatar end message:", event);
      });

      await startAvatar(config);

      if (isVoiceChat) {
        try {
          // Pass true for isInputAudioMuted to prevent the avatar from listening to audio
          await startVoiceChat(true);
        } catch (error) {
          console.warn("Could not start voice chat, continuing without it:", error);
          // We can continue without voice chat since we're implementing our own solution later
        }
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
    }
  });

  useUnmount(() => {
    stopAvatar();
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Microphone Permission Prompt Overlay */}
      {showPermissionPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">Microphone Access Required</h2>
            <p className="text-gray-300 mb-6">
              This application needs access to your microphone for speech-to-text functionality. 
              Please click the button below to grant microphone access.
            </p>
            <div className="flex flex-col gap-4">
              <Button 
                onClick={requestMicrophonePermission}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Grant Microphone Access
              </Button>
              <Button 
                onClick={() => setShowPermissionPrompt(false)}
                className="bg-zinc-600 hover:bg-zinc-700"
              >
                Continue Without Microphone
              </Button>
            </div>
            {micPermissionState === 'denied' && (
              <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded-lg">
                <p className="text-red-300 text-sm">
                  <strong>Microphone access denied.</strong> Please enable microphone access in your browser settings and refresh the page.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <LoadingIcon />
              <span className="ml-2">Loading configuration...</span>
            </div>
          ) : sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <div className="flex items-center justify-center">
              <h2 className="text-xl font-semibold text-white">Ready to start your avatar session</h2>

              {/* Show microphone status if not showing the permission prompt */}
              {!showPermissionPrompt && micPermissionState !== 'granted' && (
                <div className="mt-4 text-center">
                  <p className="text-yellow-400 mb-2">
                    {micPermissionState === 'denied' 
                      ? "Microphone access is denied" 
                      : "Microphone access not granted"}
                  </p>
                  <Button 
                    onClick={requestMicrophonePermission}
                    className="bg-blue-600 hover:bg-blue-700 text-sm"
                  >
                    Grant Microphone Access
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {isLoading ? (
            <LoadingIcon />
          ) : sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)}>
                Start Voice Chat
              </Button>
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED && (
        <MessageHistory />
      )}
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  const [baseApiUrl, setBaseApiUrl] = useState<string>('https://api.heygen.com');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBaseApiUrl() {
      try {
        const response = await fetch('/api/get-base-api-url');
        if (response.ok) {
          const data = await response.json();
          setBaseApiUrl(data.baseApiUrl);
        }
      } catch (error) {
        console.error('Error fetching base API URL:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBaseApiUrl();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingIcon />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <StreamingAvatarProvider basePath={baseApiUrl}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
