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
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/ProtectedRoute";

function AppRoutes(){const protect=Page=><ProtectedRoute><Page/></ProtectedRoute>;return <BrowserRouter><MainLayout><Routes><Route path="/" element={<Home/>}/><Route path="/shop" element={<Shop/>}/><Route path="/categories" element={<Categories/>}/><Route path="/categories/:slug" element={<CategoryPage/>}/><Route path="/products/:id" element={<ProductDetails/>}/><Route path="/deals" element={<Deals/>}/><Route path="/search" element={<Search/>}/><Route path="/wishlist" element={<Wishlist/>}/><Route path="/cart" element={<Cart/>}/><Route path="/checkout" element={protect(Checkout)}/><Route path="/order-success" element={protect(OrderSuccess)}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<Navigate to="/login" replace state={{message:"Password reset is not available because the backend does not yet provide reset endpoints."}}/>}/><Route path="/reset-password" element={<Navigate to="/login" replace state={{message:"Password reset is not available because the backend does not yet provide reset endpoints."}}/>}/><Route path="/account" element={protect(Account)}/><Route path="/addresses" element={protect(Addresses)}/><Route path="/orders" element={protect(Orders)}/><Route path="/orders/:id" element={protect(OrderDetails)}/><Route path="*" element={<main className="mx-auto max-w-4xl px-6 py-24 text-center"><h1 className="text-3xl font-semibold">Page not found</h1><p className="mt-3 text-sm text-[#737A74]">We couldn’t find that page.</p></main>}/></Routes></MainLayout></BrowserRouter>}
export default AppRoutes;
