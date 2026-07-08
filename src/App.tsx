import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { useAppStore } from "./store/useAppStore";
import { profileManager } from "./lib/profileManager";
import { DiagScanPage } from "./pages/DiagScanPage";
import { ChallengePage } from "./pages/ChallengePage";
import { GrowthPage } from "./pages/GrowthPage";
import { MilestonePage } from "./pages/MilestonePage";
import { HeatmapPage } from "./pages/HeatmapPage";
import { ReaderPage } from "./pages/ReaderPage";
import { CoachChat } from "./components/CoachChat";
import { NavBar } from "./components/NavBar";

// ===== 错误边界：捕获 React 渲染错误，显示降级 UI =====
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 下次渲染时切换到降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] 捕获到渲染错误:", error, errorInfo);
  }

  // 重新诊断：清除 localStorage 档案并跳转到诊断页
  handleRestart = () => {
    profileManager.clearProfile();
    window.location.href = "/scan";
  };

  // 刷新页面
  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-8">
          <h1 className="text-2xl font-bold mb-4">出了点问题</h1>
          <p className="text-sm text-white/60 mb-2">错误信息：</p>
          <pre className="text-xs text-white/80 bg-white/5 rounded-lg p-4 max-w-2xl overflow-auto mb-8 whitespace-pre-wrap break-all">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <div className="flex gap-4">
            <button
              onClick={this.handleRestart}
              className="px-4 py-2 bg-white text-[#0a0a0f] rounded-lg font-medium hover:bg-white/90 transition-colors"
            >
              重新诊断
            </button>
            <button
              onClick={this.handleRefresh}
              className="px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== 路由守卫：有档案才渲染 children，否则重定向到诊断页 =====
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { profile } = useAppStore();
  if (!profile) {
    return <Navigate to="/scan" />;
  }
  return <>{children}</>;
}

function App() {
  const { profile, refreshProfile } = useAppStore();

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const hasProfile = !!profile;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-[#0a0a0f] text-[#f5f5f7]">
          {hasProfile && <NavBar />}
          <Routes>
            <Route path="/scan" element={hasProfile ? <Navigate to="/" /> : <DiagScanPage />} />
            <Route path="/" element={<ProtectedRoute><ChallengePage /></ProtectedRoute>} />
            <Route path="/growth" element={<ProtectedRoute><GrowthPage /></ProtectedRoute>} />
            <Route path="/milestones" element={<ProtectedRoute><MilestonePage /></ProtectedRoute>} />
            <Route path="/heatmap" element={<ProtectedRoute><HeatmapPage /></ProtectedRoute>} />
            <Route path="/read/:id" element={<ProtectedRoute><ReaderPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={hasProfile ? "/" : "/scan"} />} />
          </Routes>
          {hasProfile && <CoachChat />}
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
