import { useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import DashboardContent from '../components/DashboardContent';
import BackgroundEffects from '../components/BackgroundEffects';
import ProductsPage from '../components/products/ProductsPage';
import CustomersPage from '../components/customers/CustomersPage';
import OrdersPage from '../components/orders/OrdersPage';
import CategoriesPage from '../components/categories/CategoriesPage';
import { Toaster } from 'react-hot-toast';


export type Pagetype =  'dashboard' | 'orders' | 'customers' | 'products' | 'reports' | 'settings'|'ordersMonthly'|'ordersYearly'|'productsCategories';

export default function DashboardLayout() {
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;
  const [currentPage, setCurrentPage] = useState<Pagetype>('dashboard'); // Giả sử bạn có state để quản lý trang hiện tại

  const [collapsed, setCollapsed] = useState(false);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'products':
        return <ProductsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'orders':
        return <OrdersPage mode ="normal"/>;
      case 'ordersMonthly':
        return <OrdersPage mode="monthly" />;
      case 'ordersYearly':
        return <OrdersPage mode="yearly" />;
      case 'productsCategories':
        return <CategoriesPage />;  
      default:
        return <OrdersPage mode ="normal" />;
    }
  };

  if (!user) return null;        // chưa đăng nhập → không render

  return (
   <>
<Toaster
  position="top-right"
  reverseOrder={false}
  toastOptions={{
    duration: 4000,
    style: {
      background: '#1f2937', // màu nền toast: gray-800
      color: '#fff',         // màu chữ
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    },
    success: {
      iconTheme: {
        primary: '#10b981', // xanh lá - giống nút create
        secondary: '#d1fae5',
      },
    },
    error: {
      iconTheme: {
        primary: '#ef4444', // đỏ
        secondary: '#fee2e2',
      },
    },
  }}
/>
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      <BackgroundEffects />


      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          user={user}
          onToggleSidebar={() => setCollapsed(!collapsed)}
          sidebarCollapsed={collapsed}
          onPageChange={setCurrentPage}
        />

        <div className="flex flex-1">
          <Sidebar 
          collapsed={collapsed}
          userRole={user.role}
          userDepartment={user.department}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          />

          <main className={`flex-1 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
            <div className="p-6">
              {renderCurrentPage()}
            </div>
          </main>
        </div>

        <Footer />
      </div>
    </div>
    </>
  );
}
