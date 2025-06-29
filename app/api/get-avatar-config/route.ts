import { NextResponse } from 'next/server';
import { AvatarQuality, VoiceEmotion, VoiceChatTransport, ElevenLabsModel } from '@heygen/streaming-avatar';

export async function GET() {
  // Get configuration from environment variables
  const config = {
    quality: process.env.AVATAR_QUALITY as AvatarQuality || AvatarQuality.Low,
    avatarName: process.env.DEFAULT_AVATAR_ID || "",
    voice: {
      voiceId: process.env.VOICE_ID || undefined,
      rate: parseFloat(process.env.VOICE_RATE || "1.5"),
      emotion: process.env.VOICE_EMOTION as VoiceEmotion || VoiceEmotion.EXCITED,
      model: process.env.VOICE_MODEL as ElevenLabsModel || ElevenLabsModel.eleven_flash_v2_5,
    },
    language: process.env.LANGUAGE || "en",
    voiceChatTransport: process.env.VOICE_CHAT_TRANSPORT as VoiceChatTransport || VoiceChatTransport.WEBSOCKET,
    activityIdleTimeout: 30
  };

  return NextResponse.json(config);
}
