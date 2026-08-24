import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Network from "expo-network";
import { useEffect, useState, type PropsWithChildren } from "react";
import { AppState, Platform } from "react-native";

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "pulse.query-cache", throttleTime: 1000 });

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 2, refetchOnReconnect: true },
      mutations: { retry: 1 },
    },
  }));

  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      const subscription = Network.addNetworkStateListener((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)));
      return () => subscription.remove();
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: "pulse-mobile-v1" }}>
      {children}
    </PersistQueryClientProvider>
  );
}
