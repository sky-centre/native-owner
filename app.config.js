export default {
  expo: {
    name: "Sam Zone Owner",
    slug: "sam-chat",
    owner: "sam-zone88",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0b0b0f"
    },
    android: {
      package: "com.samowner.app",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0b0b0f"
      }
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#0b0b0f"
        }
      ]
    ],
    extra: {
      supabaseUrl: "https://jkaasjzqqhqumuzuxkmd.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYWFzanpxcWhxdW11enV4a21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjczNzYsImV4cCI6MjEwNDAwMzM3Nn0.L2BpGiGsTMxlu_oNySyBmE5XvvkZ58ZcxpQeMKhKS8k",
      eas: {
        projectId: "18fe1d81-d779-49e3-a76d-8d1556bc40b7"
      }
    }
  }
};
