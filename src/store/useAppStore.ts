// ===== 状态管理 v6.0 =====
// v6.0：profile 类型从含 exposure Map 改为含 directions 数组
import { create } from "zustand";
import { profileManager, type CognitiveProfile } from "../lib/profileManager";

interface AppState {
  profile: CognitiveProfile | null;
  loading: boolean;
  error: string | null;

  refreshProfile: () => void;
  setProfile: (p: CognitiveProfile | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  clearProfile: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: profileManager.getProfile(),
  loading: false,
  error: null,

  refreshProfile: () => set({ profile: profileManager.getProfile() }),
  setProfile: (p) => set({ profile: p }),
  setLoading: (b) => set({ loading: b }),
  setError: (e) => set({ error: e }),
  clearProfile: () => {
    profileManager.clearProfile();
    set({ profile: null });
  },
}));
