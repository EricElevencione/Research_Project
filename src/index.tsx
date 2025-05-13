import { Navigate, Route, Routes } from "react-router-dom";
import { Dashboard } from "./screens/Dashboard";
import Login from "./connection/loginConnection";

export * from "./screens/LoginPage"
export * from "./connection/loginConnection"

<Routes>
    <Route path="/" element={<Navigate to="/login" />} />
    <Route path="/login" element={<Login role="default" />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="*" element={<div>Not Found</div>} />
</Routes>
