import { Navigate } from 'react-router-dom';

export default function AdminOnlyRoute({ isAdmin, children }) {
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}