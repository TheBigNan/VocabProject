import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Home" },
  { to: "/lists", label: "View Lists" },
  { to: "/about", label: "About Me" },
];

export default function Navbar() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogOut() {
    await logOut();
    navigate("/");
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">W</span>
          WordWise
        </NavLink>
        <nav className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " nav-link-active" : "")
              }
            >
              {link.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <span className="nav-user">{user.email}</span>
              <button
                type="button"
                className="nav-link nav-link-button"
                onClick={handleLogOut}
              >
                Log Out
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                "nav-link" + (isActive ? " nav-link-active" : "")
              }
            >
              Log In
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
