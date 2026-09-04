import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import ConversationsListScreen from "../screens/ConversationsListScreen";
import ChatScreen from "../screens/ChatScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AccessCodesScreen from "../screens/AccessCodesScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { colors } from "../lib/theme";

const Tab = createBottomTabNavigator();
const ConversationsStack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    primary: colors.accent,
    text: colors.text
  }
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "700" },
  headerShadowVisible: false
};

function ConversationsStackNavigator() {
  return (
    <ConversationsStack.Navigator screenOptions={screenOptions}>
      <ConversationsStack.Screen
        name="ConversationsList"
        component={ConversationsListScreen}
        options={{ title: "Percakapan" }}
      />
      <ConversationsStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: "Percakapan" }}
      />
    </ConversationsStack.Navigator>
  );
}

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function RootNavigator({ onLoggedOut }) {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
        }}
      >
        <Tab.Screen
          name="PercakapanTab"
          component={ConversationsStackNavigator}
          options={{
            title: "Percakapan",
            tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />
          }}
        />
        <Tab.Screen
          name="ProfilTab"
          component={ProfileScreen}
          options={{
            title: "Profil Publik",
            headerShown: true,
            ...screenOptions,
            tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />
          }}
        />
        <Tab.Screen
          name="KodeAksesTab"
          component={AccessCodesScreen}
          options={{
            title: "Kode Akses",
            headerShown: true,
            ...screenOptions,
            tabBarIcon: ({ focused }) => <TabIcon emoji="🔑" focused={focused} />
          }}
        />
        <Tab.Screen
          name="PengaturanTab"
          options={{
            title: "Pengaturan",
            headerShown: true,
            ...screenOptions,
            tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />
          }}
        >
          {() => <SettingsScreen onLoggedOut={onLoggedOut} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
