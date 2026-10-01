import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "../pages/Home";
import Shop from "../pages/Shop";
import Categories, { CategoryPage } from "../pages/Categories";
import ProductDetails from "../pages/ProductDetails";
import Deals from "../pages/Deals";
import Search from "../pages/Search";
import Wishlist from "../pages/Wishlist";
import Cart from "../pages/Cart";
import Checkout from "../pages/Checkout";
import OrderSuccess from "../pages/OrderSuccess";

import Login from "../pages/Login";
import Register from "../pages/Register";
import Account from "../pages/Account";
import Addresses from "../pages/Addresses";
import Orders from "../pages/Orders";
import OrderDetails from "../pages/OrderDetails";

import AdminLogin from "../pages/AdminLogin";
import AdminDashboard from "../pages/AdminDashboard";
import AdminProducts from "../pages/AdminProducts";
import AdminCategories from "../pages/AdminCategories";
import AdminOrders from "../pages/AdminOrders";
import AdminCustomers from "../pages/AdminCustomers";
import AdminInventory from "../pages/AdminInventory";
import AdminDiscounts from "../pages/AdminDiscounts";
import AdminRefunds from "../pages/AdminRefunds";
import AdminSiteSettings from "../pages/AdminSiteSettings";

import MainLayout from "../layouts/MainLayout";
import ScrollToTop from "../components/ScrollToTop";
import Privacy from "../pages/Privacy";
import Terms from "../pages/Terms";
import AdminLayout from "../components/AdminLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminRoute from "../components/AdminRoute";
import NotFound from "../pages/NotFound";

function AppRoutes() {
  const protect = (Page) => (
    <ProtectedRoute>
      <Page />
    </ProtectedRoute>
  );

  const admin = (Page) => (
    <AdminRoute>
      <Page />
    </AdminRoute>
  );

  return (
    <BrowserRouter>
    <ScrollToTop />
      <Routes>
        {/* Customer storefront */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />

          <Route path="/categories" element={<Categories />} />
          <Route path="/categories/:slug" element={<CategoryPage />} />

          <Route path="/products/:id" element={<ProductDetails />} />

          <Route path="/deals" element={<Deals />} />
          <Route path="/search" element={<Search />} />

          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/cart" element={<Cart />} />

          <Route path="/checkout" element={protect(Checkout)} />
          <Route path="/order-success" element={protect(OrderSuccess)} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
          <Route
            path="/forgot-password"
            element={
              <Navigate
                to="/login"
                replace
                state={{
                  message:
                    "Password reset is unavailable because the backend does not yet provide reset endpoints.",
                }}
              />
            }
          />

          <Route
            path="/reset-password"
            element={
              <Navigate
                to="/login"
                replace
                state={{
                  message:
                    "Password reset is unavailable because the backend does not yet provide reset endpoints.",
                }}
              />
            }
          />

          <Route path="/account" element={protect(Account)} />
          <Route path="/addresses" element={protect(Addresses)} />
          <Route path="/orders" element={protect(Orders)} />
          <Route path="/orders/:id" element={protect(OrderDetails)} />

          {/* Customer 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin application */}
        <Route path="/admin" element={admin(AdminLayout)}>
          <Route index element={<AdminDashboard />} />

          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="refunds" element={<AdminRefunds />} />
          <Route path="settings" element={<AdminSiteSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;