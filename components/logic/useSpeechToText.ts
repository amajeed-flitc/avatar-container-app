import { useCallback, useEffect, useRef, useState } from "react";
import * as speechsdk from "microsoft-cognitiveservices-speech-sdk";
import { useStreamingAvatarContext } from "./context";

// Create a singleton instance to track if the hook has been initialized
let isInitialized = false;
let globalRecognizerInstance: speechsdk.SpeechRecognizer | null = null;
let globalAudioConfigInstance: speechsdk.AudioConfig | null = null;

// List of languages to detect
// This array defines the languages that Azure's automatic language detection will consider
const languagesToDetect = [
  "en-US",
  "ar-SA",
  "ur-IN",
];

// Function to clean up global resources
const cleanupGlobalResources = () => {
  if (globalRecognizerInstance) {
    try {
      console.log("Cleaning up global speech recognizer instance");

      // Safely stop the recognizer
      try {
        globalRecognizerInstance.stopContinuousRecognitionAsync();
      } catch (stopErr) {
        console.error("Error stopping global speech recognizer:", stopErr);
      }

      // Close the recognizer
      try {
        globalRecognizerInstance.close();
      } catch (closeErr) {
        console.error("Error closing global speech recognizer:", closeErr);
      }

      globalRecognizerInstance = null;
    } catch (err) {
      console.error("Error in global speech recognizer cleanup:", err);
    }
  }

  globalAudioConfigInstance = null;
  isInitialized = false;
};

// Helper function to check microphone permission status
const checkMicrophonePermission = async (): Promise<PermissionState | null> => {
  try {
    // Check if we're in a browser environment and if the Permissions API is available
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permissionStatus.state;
    } else {
      console.warn('Permissions API not available in this environment');
      return null;
    }
  } catch (err) {
    console.error('Error checking microphone permission:', err);
    return null;
  }
};

// Helper function to request microphone permissions explicitly
const requestMicrophonePermission = async (): Promise<{ stream: MediaStream | null; permissionState: PermissionState | null }> => {
  try {
    // Check if we're in a browser environment and if the MediaDevices API is available
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // First check the current permission status
      const permissionState = await checkMicrophonePermission();

      // This will trigger the browser's permission prompt if not already granted
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Return the stream so it can be properly managed, along with the permission state
      return { stream, permissionState };
    } else {
      console.warn('MediaDevices API not available in this environment');
      return { stream: null, permissionState: null };
    }
  } catch (err) {
    console.error('Error requesting microphone permission:', err);

    // If permission was denied, we can still return the permission state
    const permissionState = await checkMicrophonePermission();
    return { stream: null, permissionState };
  }
};

export const useSpeechToText = () => {
  const {
    avatarRef,
    isListening,
    setIsListening,
    isUserTalking,
    setIsUserTalking,
    handleUserTalkingMessage,
    handleEndMessage,
    setIsMuted,
    speakText,
    conversation_id,
    language,
    setLanguage,
  } = useStreamingAvatarContext();

  const [recognizedText, setRecognizedText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  const recognizerRef = useRef<speechsdk.SpeechRecognizer | null>(null);
  const audioConfigRef = useRef<speechsdk.AudioConfig | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const stopListeningRef = useRef<() => Promise<void>>();

  // Add refs to track the last recognized text and timestamp to prevent duplicates
  const lastRecognizedTextRef = useRef<string>("");
  const lastRecognitionTimestampRef = useRef<number>(0);
  const processingRecognitionRef = useRef<boolean>(false);

  // Function to set up event handlers for the speech recognizer
  const setupEventHandlers = useCallback((recognizer: speechsdk.SpeechRecognizer) => {
    recognizer.recognizing = (_, event) => {
      const text = event.result.text;
      if (text && text.trim() !== "") {
        setRecognizedText(text);

        // If user wasn't already talking, mark as talking now
        if (!isUserTalking) {
          setIsUserTalking(true);
        }

        // Don't send interim results to avoid word repetition
        // Just update the UI to show the user what's being recognized
        console.log("Interim recognition result:", text);
      }
    };

    recognizer.recognized = (_, event) => {
      const text = event.result.text;
      if (!text || text.trim() === "") {
        return;
      }

      setRecognizedText(text);

      // Extract the detected language from the result if available
      // This is only available when using automatic language detection
      if (conversation_id && !language && event.result.properties) {
        try {
          // Get the language detection result from Azure
          const detectedLanguage = event.result.properties.getProperty(
            speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult
          );

          if (detectedLanguage) {
            console.log(`Azure detected language: ${detectedLanguage} for conversation: ${conversation_id}`);
            setLanguage(detectedLanguage);
          } else {
            console.log("No language detected by Azure, defaulting to en-US");
            setLanguage("en-US");
          }
        } catch (error) {
          console.error("Error extracting language from recognition result:", error);
          setLanguage("en-US");
        }
      }

      // Get the current timestamp
      const now = Date.now();

      // Enhanced duplicate detection:
      // 1. Check if we're already processing a recognition event
      // 2. Check if the text is exactly the same as the last recognized text
      // 3. Check if the text was recognized within a short time window (increased to 1000ms for more reliability)
      // 4. Check if the text is very similar to the last recognized text (e.g., just added punctuation)
      const isSameText = text === lastRecognizedTextRef.current;
      const isWithinTimeWindow = now - lastRecognitionTimestampRef.current < 1000;
      const isSimilarText = text.toLowerCase().replace(/[.,!?]/g, '') === 
                           lastRecognizedTextRef.current.toLowerCase().replace(/[.,!?]/g, '');

      const isDuplicate = processingRecognitionRef.current || isSameText || (isWithinTimeWindow && isSimilarText);

      if (isDuplicate) {
        console.log("Duplicate recognized text, ignoring:", text);
        console.log("Time since last recognition:", now - lastRecognitionTimestampRef.current, "ms");
        console.log("Processing flag:", processingRecognitionRef.current);
        console.log("Same text:", isSameText);
        console.log("Within time window:", isWithinTimeWindow);
        console.log("Similar text:", isSimilarText);

        // Reset user talking state
        setIsUserTalking(false);
        return;
      }

      // Set the processing flag to prevent concurrent processing
      processingRecognitionRef.current = true;

      console.log("New recognized text:", text);
      console.log("Previous recognized text:", lastRecognizedTextRef.current);
      console.log("Time since last recognition:", now - lastRecognitionTimestampRef.current, "ms");

      // Update the last recognized text and timestamp
      lastRecognizedTextRef.current = text;
      lastRecognitionTimestampRef.current = now;

      // Send the final recognition result to update the message history
      console.log("Sending user talking message with text:", text);
      handleUserTalkingMessage({
        detail: {
          message: text,
        },
      });

      // Directly call speakText to make the avatar speak the recognized text
      console.log("Directly calling speakText with:", text);
      speakText(text).catch(error => {
        console.error("Error in speakText:", error);
      });

      // Mark the end of the message
      console.log("Sending end message");
      handleEndMessage();

      // Reset the processing flag after a longer delay to ensure all processing is complete
      setTimeout(() => {
        processingRecognitionRef.current = false;
      }, 1000);

      // Reset user talking state
      setIsUserTalking(false);
    };

    recognizer.canceled = (_, event) => {
      if (event.reason === speechsdk.CancellationReason.Error) {
        setError(`Speech recognition error: ${event.errorDetails}`);
      }
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
    };
  }, [handleEndMessage, handleUserTalkingMessage, isUserTalking, setIsUserTalking, speakText, conversation_id, language, setLanguage]);

  // Initialize the speech recognizer with automatic language detection
  const initializeSpeechRecognizer = useCallback(() => {
    try {
      // If already initialized, use the existing instance
      if (isInitialized && globalRecognizerInstance) {
        console.log("Speech recognizer already initialized, reusing existing instance");
        recognizerRef.current = globalRecognizerInstance;
        audioConfigRef.current = globalAudioConfigInstance;

        // We still need to set up the event handlers for this instance of the hook
        // This ensures that each component using the hook gets its own event handlers
        setupEventHandlers(recognizerRef.current);

        return true;
      }

      // Get the subscription key and region from environment variables
      const speechKey = process.env.AZURE_SPEECH_KEY;
      const speechRegion = process.env.AZURE_SPEECH_REGION;

      // Log the status of the credentials (without revealing the actual values)
      console.log("Speech SDK credentials status:", {
        keyConfigured: !!speechKey,
        regionConfigured: !!speechRegion
      });

      if (!speechKey || !speechRegion) {
        throw new Error("Azure Speech SDK credentials are not configured. Please check your environment variables.");
      }

      // Create the speech config
      const speechConfig = speechsdk.SpeechConfig.fromSubscription(speechKey, speechRegion);

      // Create auto language detection config with the languages we want to detect
      console.log("Setting up automatic language detection with these languages:", languagesToDetect);
      const autoDetectSourceLanguageConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(languagesToDetect);

      // Create the audio config for the microphone
      audioConfigRef.current = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
      globalAudioConfigInstance = audioConfigRef.current;

      // Create the speech recognizer with auto language detection
      recognizerRef.current = speechsdk.SpeechRecognizer.FromConfig(
        speechConfig,
        autoDetectSourceLanguageConfig,
        audioConfigRef.current
      );

      // Store the global instance
      globalRecognizerInstance = recognizerRef.current;
      isInitialized = true;

      // Setup event handlers
      setupEventHandlers(recognizerRef.current);

      return true;
    } catch (err) {
      // Log detailed error information for debugging
      console.error("Speech recognizer initialization error:", err);

      // Provide a more user-friendly error message
      if (err instanceof Error && err.message.includes("Azure Speech SDK credentials")) {
        setError(`Speech recognition unavailable: Azure credentials not properly configured. Please check your environment setup.`);
      } else {
        setError(`Failed to initialize speech recognizer: ${err instanceof Error ? err.message : String(err)}`);
      }

      return false;
    }
  }, [handleEndMessage, handleUserTalkingMessage, isUserTalking, setIsUserTalking, setupEventHandlers]);

  // Check the current microphone permission status
  const checkPermission = useCallback(async () => {
    const currentPermissionState = await checkMicrophonePermission();
    setPermissionState(currentPermissionState);
    return currentPermissionState;
  }, []);

  // Start listening for speech with automatic language detection
  const startListening = useCallback(async () => {
    try {
      console.log("Starting speech recognition with automatic language detection");

      // First, check the current permission status
      await checkPermission();

      // Then, explicitly request microphone permissions
      // This will trigger the browser's permission prompt if not already granted
      const { stream, permissionState } = await requestMicrophonePermission();

      // Update the permission state
      setPermissionState(permissionState);

      if (!stream) {
        if (permissionState === 'denied') {
          setError("Microphone permission denied. Please allow microphone access in your browser settings.");
        } else {
          setError("Could not access microphone. Please check your device settings.");
        }
        return;
      }

      // Store the microphone stream for later cleanup
      microphoneStreamRef.current = stream;

      // Now initialize the speech recognizer if needed
      // If we already have a global instance, use it
      if (isInitialized && globalRecognizerInstance) {
        console.log("Using existing global speech recognizer instance");
        recognizerRef.current = globalRecognizerInstance;
        audioConfigRef.current = globalAudioConfigInstance;
      } else {
        // Otherwise initialize a new one
        const initialized = initializeSpeechRecognizer();
        if (!initialized) {
          // Clean up the microphone stream if initialization fails
          microphoneStreamRef.current.getTracks().forEach(track => track.stop());
          microphoneStreamRef.current = null;
          return;
        }
      }

      // Ensure the avatar's microphone is muted before starting STT
      if (avatarRef.current) {
        avatarRef.current.muteInputAudio();
        setIsMuted(true);
        console.log("Muted avatar microphone before starting STT");
      }

      if (recognizerRef.current) {
        // Reset the last recognized text before starting
        const oldValue = lastRecognizedTextRef.current;
        lastRecognizedTextRef.current = "";
        console.log(`Reset last recognized text before starting listening (was: "${oldValue}")`);

        await recognizerRef.current.startContinuousRecognitionAsync();
        setIsListening(true);
        setError(null);
      }
    } catch (err) {
      // Log detailed error information for debugging
      console.error("Speech-to-text start error:", err);

      // Clean up any resources if an error occurs
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
      }

      // Check if this is a permission error
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
        setPermissionState('denied');
      } 
      // Check if this is an Azure Speech SDK credentials error
      else if (err instanceof Error && err.message.includes("Azure Speech SDK credentials")) {
        setError("Speech recognition unavailable: Azure credentials not properly configured. Please check your environment setup.");
      }
      // Check if this is a network error
      else if (err instanceof Error && (err.message.includes("network") || err.message.includes("connection"))) {
        setError("Speech recognition failed due to network issues. Please check your internet connection.");
      }
      // Generic error message for other types of errors
      else {
        setError(`Failed to start listening: ${err instanceof Error ? err.message : String(err)}`);
      }

      setIsListening(false);
    }
  }, [initializeSpeechRecognizer, setIsListening, checkPermission, avatarRef, setIsMuted]);

  // Stop listening for speech
  const stopListening = useCallback(async () => {
    try {
      if (recognizerRef.current) {
        // Stop continuous recognition but don't close the recognizer
        // since it's shared between components
        await recognizerRef.current.stopContinuousRecognitionAsync();
        setIsListening(false);
      }

      // Clean up the microphone stream
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
      }

      // Reset the last recognized text and other refs
      const oldValue = lastRecognizedTextRef.current;
      lastRecognizedTextRef.current = "";
      lastRecognitionTimestampRef.current = 0;
      processingRecognitionRef.current = false;
      console.log(`Reset last recognized text on stop listening (was: "${oldValue}")`);
    } catch (err) {
      // Log detailed error information for debugging
      console.error("Speech-to-text stop error:", err);

      // Provide a user-friendly error message
      setError(`Failed to stop listening: ${err instanceof Error ? err.message : String(err)}`);

      // Still try to clean up the microphone stream even if there's an error
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
      }

      // Reset the last recognized text and other refs even if there's an error
      const oldValue = lastRecognizedTextRef.current;
      lastRecognizedTextRef.current = "";
      lastRecognitionTimestampRef.current = 0;
      processingRecognitionRef.current = false;
      console.log(`Reset last recognized text on stop listening error case (was: "${oldValue}")`);
    }
  }, [setIsListening]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Don't fully clean up the speech recognizer since it's shared
      // Just reset the local reference
      recognizerRef.current = null;

      // Don't clean up the audio config since it's shared
      // Just reset the local reference
      audioConfigRef.current = null;

      // Clean up the microphone stream
      if (microphoneStreamRef.current) {
        try {
          microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error("Error stopping microphone tracks:", err);
        }
        microphoneStreamRef.current = null;
      }

      // Reset the last recognized text and other refs
      const oldValue = lastRecognizedTextRef.current;
      lastRecognizedTextRef.current = "";
      lastRecognitionTimestampRef.current = 0;
      processingRecognitionRef.current = false;
      console.log(`Reset last recognized text on component unmount (was: "${oldValue}")`);
    };
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Add a global cleanup effect that will run when the app unmounts
  // This is a bit of a hack, but it ensures the global resources are cleaned up
  useEffect(() => {
    // Add event listener for beforeunload to clean up global resources
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanupGlobalResources);

      return () => {
        window.removeEventListener('beforeunload', cleanupGlobalResources);
      };
    }
  }, []);

  // Update stopListeningRef whenever stopListening changes
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  return {
    recognizedText,
    isListening,
    error,
    permissionState,
    checkPermission,
    startListening,
    stopListening,
  };
};
