import React from "react";
import { useDispatch } from "react-redux";
import { clearCredentials } from "../store/authSlice";
import { useNavigate } from "react-router-dom";

const LogoutButton: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = () => {
        dispatch(clearCredentials());

        navigate("/login");
    };

    return <button onClick={handleLogout}>Logout</button>;
};

export default LogoutButton;
