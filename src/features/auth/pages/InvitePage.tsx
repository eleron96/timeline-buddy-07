import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { t } from '@lingui/macro';

const InvitePage: React.FC = () => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    loading,
    workspaces,
    fetchWorkspaces,
    setCurrentWorkspaceId,
  } = useAuthStore();
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (user && workspaces.length === 0) {
      fetchWorkspaces();
    }
  }, [fetchWorkspaces, user, workspaces.length]);

  useEffect(() => {
    if (!user || !workspaceId || workspaces.length === 0) return;

    const hasAccess = workspaces.some((workspace) => workspace.id === workspaceId);
    if (!hasAccess) {
      setNoAccess(true);
      return;
    }

    setCurrentWorkspaceId(workspaceId);
    navigate('/', { replace: true });
  }, [navigate, setCurrentWorkspaceId, user, workspaceId, workspaces]);

  if (!user && !loading) {
    return <Navigate to="/auth" state={{ redirectTo: location.pathname }} replace />;
  }

  if (noAccess) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-destructive">
        {t`You do not have access to this workspace.`}
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      {t`Checking invite...`}
    </div>
  );
};

export default InvitePage;
