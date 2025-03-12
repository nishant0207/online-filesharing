import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store";

const Auth = () => {
  const { login, signup, user, logout } = useStore();
  const [formData, setFormData] = React.useState({ username: "", email: "", password: "" });
  const [isLogin, setIsLogin] = React.useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard"); // Redirect to dashboard if logged in
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      await login(formData.email, formData.password);
    } else {
      const success = await signup(formData.username, formData.email, formData.password);
      if (success) setIsLogin(true);
    }
  };

  return (
    <div className="w-[100vw] min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-700 p-6 shadow-lg rounded-md">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-4">
          File Sharing System
        </h1>

        {user ? (
          <div className="text-center">
            <p className="text-lg text-gray-700">Welcome, {user.email}!</p>
            <button 
              className="mt-4 w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
              {isLogin ? "Login" : "Signup"}
            </button>
          </form>
        )}

        {!user && (
          <p 
            className="text-center text-blue-500 cursor-pointer mt-3 hover:underline"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Don't have an account? Signup" : "Already have an account? Login"}
          </p>
        )}
      </div>
    </div>
  );
};

export default Auth;