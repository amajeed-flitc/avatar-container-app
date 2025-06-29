import React from "react";

import { useVoiceChat } from "../logic/useVoiceChat";
import { AudioInput } from "./AudioInput";

export const AvatarControls: React.FC = () => {
  const {
    isVoiceChatLoading,
    isVoiceChatActive,
  } = useVoiceChat();

  return (
    <div className="flex flex-col gap-3 relative w-full items-center">
      {/* Always show AudioInput since we're always in voice chat mode */}
      <AudioInput />
    </div>
  );
};
