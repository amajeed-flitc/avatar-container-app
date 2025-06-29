/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
  },
}

module.exports = nextConfig
