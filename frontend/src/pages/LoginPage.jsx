import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    User,
    Lock,
    Eye,
    EyeOff,
    GraduationCap,
    LogIn,
    ShieldCheck,
} from "lucide-react";
import Cookies from "js-cookie";
import api from "../services/api";
import "./styles/LoginPage.css";
import swalService from "../services/swal"; // استدعاء السيرفيس للتنبيه

const LoginPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [roleType, setRoleType] = useState("student");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    // UI-only addition for the new "Remember me" checkbox — does not affect auth logic.
    const [rememberMe, setRememberMe] = useState(true);

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const endpoint = roleType === "student" ? "/student/login" : "/staff/login";

            const { data } = await api.post(endpoint, { username, password });


            if (!data.token) {
                throw new Error("No token returned from server");
            }

            Cookies.set("token", data.token, { expires: 1 });

            const userRes = await api.get(roleType === "student" ? "/student/me" : "/staff/me");
            const user = userRes.data;


            Cookies.set("currentUser", JSON.stringify(user), { expires: 1 });

            // --- منطق فحص البيانات الناقصة ---
            const email = roleType === "student" ? user.studentEmail : user.email;
            const phone = roleType === "student" ? user.studentPhone : user.phone;

            const isDataMissing = !email || !phone || email.trim() === "" || phone.trim() === "";

            if (roleType === "student") {
                Cookies.set("userType", "student", { expires: 1 });
                if (isDataMissing) {
                    // توجيه للبروفايل مع بعت معلومة إن الداتا ناقصة
                    navigate("/student/profile", { state: { forceEdit: true }, replace: true });
                } else {
                    navigate("/student/dashboard", { replace: true });
                }
            } else {
                const roles = user.roles || [];
                if (roles.length === 0) {
                    setError("This staff account has no roles assigned.");
                    return;
                }
                const firstRole = roles[0];
                Cookies.set("activeRole", firstRole, { expires: 1 });
                Cookies.set("userType", "staff", { expires: 1 });

                if (isDataMissing) {
                    // توجيه لبروفايل الموظف مع بعت معلومة إن الداتا ناقصة
                    navigate("/staff/profile", { state: { forceEdit: true }, replace: true });
                } else {
                    navigate(`/staff/${firstRole}/dashboard`, { replace: true });
                }
            }
        } catch (err) {
            console.error("Login error:", err);
            setError(err.response?.data?.message || err.message || "Invalid login credentials");
        } finally {
            setLoading(false);
        }
    };

    // SSO is not wired to a backend flow yet — placeholder so the button
    // doesn't silently do nothing and doesn't touch the login logic above.
    const handleSsoLogin = () => {
        swalService?.info?.("SSO login is not available yet.") ??
            console.info("SSO login clicked - not implemented yet.");
    };

    return (
        <div className="orbit-login-page">
            <div className="orbit-login-card">
                <div className="orbit-login-left">
                    <div className="orbit-login-rings" aria-hidden="true">
                        <span className="orbit-login-ring orbit-login-ring-1" />
                        <span className="orbit-login-ring orbit-login-ring-2" />
                        <span className="orbit-login-planet orbit-login-planet-blue" />
                        <span className="orbit-login-planet orbit-login-planet-gold" />
                        <div className="orbit-login-stars" />
                    </div>

                    <div className="orbit-login-left-content">
                        <img
                            src="/images/orbitLogo.png"
                            alt="ECE Logo"
                            className="orbit-login-logo"
                        />
                        <h2>Orbit Academic Portal</h2>

                        <div className="orbit-login-left-text">
                            
                        </div>

                        <div className="orbit-login-left-footer">
                            <h3><span className="orbit-login-brand-title">ORBIT</span> Academic Portal</h3>
                        </div>
                    </div>

                    <div className="orbit-login-campus-silhouette orbit-login-campus-dark" aria-hidden="true" />
                </div>

                <div className="orbit-login-right">
                    <form className="orbit-login-form" onSubmit={handleLogin}>
                        <div className="orbit-login-welcome-header">
                            <h1>Welcome Back</h1>
                            <p>Please sign in to continue to your account</p>
                        </div>

                        <div className="orbit-login-role-tabs" role="tablist" aria-label="Account type">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={roleType === "student"}
                                className={`orbit-login-role-tab ${roleType === "student" ? "orbit-login-role-tab--active" : ""}`}
                                onClick={() => setRoleType("student")}
                            >
                                <GraduationCap size={18} />
                                <span>Student</span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={roleType === "staff"}
                                className={`orbit-login-role-tab ${roleType === "staff" ? "orbit-login-role-tab--active" : ""}`}
                                onClick={() => setRoleType("staff")}
                            >
                                <User size={18} />
                                <span>Staff</span>
                            </button>
                        </div>

                        <div className="orbit-login-input-group">
                            <User size={20} className="orbit-login-input-icon" />
                            <input
                                type="text"
                                placeholder="UserName ..."
                                className="orbit-login-input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="orbit-login-input-group">
                            <Lock size={20} className="orbit-login-input-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password ..."
                                className="orbit-login-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="orbit-login-eye-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* <div className="orbit-login-form-row">
                            <label className="orbit-login-remember-me">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span>Remember me</span>
                            </label>
                            <a href="/forgot-password" className="orbit-login-forgot-link">
                                Forgot Password?
                            </a>
                        </div> */}

                        {error && <p className="orbit-login-error">{error}</p>}

                        <button type="submit" className="btn-1 " disabled={loading}>
                            <LogIn size={18} />
                            {loading ? "Logging in..." : "Login"}
                        </button>

                      
                    </form>
                </div>

                <div className="orbit-login-campus-silhouette orbit-login-campus-light" aria-hidden="true" />
            </div>
        </div>
    );
};

export default LoginPage;