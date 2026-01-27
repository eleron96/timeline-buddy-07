import { Toaster } from "@/shared/ui/toaster";
import { Toaster as Sonner } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PlannerPage from "@/features/planner/pages/PlannerPage";
import NotFoundPage from "@/app/NotFoundPage";
import AuthPage from "@/features/auth/pages/AuthPage";
import InvitePage from "@/features/auth/pages/InvitePage";
import AdminUsersPage from "@/features/admin/pages/AdminUsersPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import { AuthProvider } from "@/features/auth/providers/AuthProvider";
import { ProtectedRoute } from "@/app/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/invite/:workspaceId" element={<InvitePage />} />
            <Route
              path="/admin/users"
              element={(
                <ProtectedRoute>
                  <AdminUsersPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/"
              element={(
                <ProtectedRoute>
                  <PlannerPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/dashboard"
              element={(
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              )}
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
