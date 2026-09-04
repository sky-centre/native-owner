export default {
  expo: {
    name: "Sam Zone Owner",
    slug: "sam-zone",
    owner: "sam-zone88",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/f220810e-9933-46cf-bdda-6b42320ac0f3"
    },
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
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Izinkan Sam Zone Owner mengakses galeri untuk memilih foto profil."
        }
      ]
    ],
    extra: {
      supabaseUrl: "https://jkaasjzqqhqumuzuxkmd.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYWFzanpxcWhxdW11enV4a21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjczNzYsImV4cCI6MjEwNDAwMzM3Nn0.L2BpGiGsTMxlu_oNySyBmE5XvvkZ58ZcxpQeMKhKS8k",
      eas: {
        projectId: "f220810e-9933-46cf-bdda-6b42320ac0f3"
      }
    }
  }
};
