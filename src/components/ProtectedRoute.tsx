import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireCompany?: boolean; // Requiere login de empresa
  requireUser?: boolean;    // Requiere login de usuario completo
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireCompany = false,
  requireUser = false 
}) => {
  const { isAuthenticated, companyData } = useAuth();

  // Si requiere usuario completo (login completo)
  if (requireUser && !isAuthenticated) {
    return <Navigate to="/login-company" replace />;
  }

  // Si requiere solo datos de empresa
  if (requireCompany && !companyData) {
    return <Navigate to="/login-company" replace />;
  }

  return children;
};

export default ProtectedRoute;

