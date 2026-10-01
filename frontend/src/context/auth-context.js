import { createContext } from "react";

const AuthContext = createContext({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  cartCount: 0,
  wishlistCount: 0,
  refreshCounts: async () => {},
});

export default AuthContext;
