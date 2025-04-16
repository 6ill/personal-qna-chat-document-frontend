import "./App.css";
import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import { useSelector } from "react-redux";
import { RootState } from "./store/store";
import { useEffect, useState } from "react";

function App() {
    const token = useSelector((state: RootState) => state.auth.token);
    const [isAuthenticated, setAuthenticated] = useState(!!token);

    useEffect(() => {
      if (token) {
        fetch("http://localhost:3000/api/v1/auth/check", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((response) => {
          if (response.status === 200) {
            return response.json();
          } else if (response.status === 401) {
            throw new Error("Unauthorized");
          } else {
            throw new Error("Unexpected status");
          }
        })
        .then(() => {
          setAuthenticated(true);
        })
        .catch((error) => {
          setAuthenticated(false);
        });
      } else {
        setAuthenticated(false);
      }
    }, [token]);
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <HomePage />
                ) : (
                  <Navigate to="/login" replace />
                )
              }/>
        </Routes>
      </BrowserRouter>
    );
}

export default App;
