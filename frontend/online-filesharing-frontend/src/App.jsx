import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Auth from "./components/Auth";
import useStore from "./store";

function App() {
  const { user } = useStore();

  return (
    <Router>
      <Routes>
        {/* Redirect to Dashboard if logged in */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;