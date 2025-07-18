import React, { useState ,useEffect,useMemo} from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';

import { OrderPayload, OrderStatus, PaymentStatus,OrderFromAPI } from './OrderModal';
import OrderModal from './OrderModal'; // 👈 Nếu OrderModal.tsx nằm cùng thư mục

import { getCurrentUser } from '../../utils/auth';
import { useLocation } from 'react-router-dom';

import toast from 'react-hot-toast';





interface OrderItem {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  
}

interface Order {
  id: string;
  orderNumber: string;
  supplier_name: string; // Tùy chọn nếu có
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus; // 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: PaymentStatus; // 'pending' | 'paid' | 'failed' | 'refunded'
  shippingAddress: string;
  orderDate: string;
  estimatedDelivery: string;
  notes: string;
  merged?: boolean; // Thêm trường này để đánh dấu đơn hàng đã được gộp
}

interface OrdersPageProps {
  mode: 'normal' | 'monthly';
}





const OrdersPage: React.FC<OrdersPageProps> = ({ mode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage]     = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const { searchTerm: initialSearch } = location.state || {};
  const [search, setSearch]     = useState(initialSearch || '');
  const [totalOrders, setTotalOrders] = useState(0);
  const [monthlyOrders, setMonthlyOrders] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());



  const fetchOrders = async (searchTerm?:string) => {
      setLoading(true);
      try {
        const res = await api.get('/orders',{params: { page,q: searchTerm ||''} });
              const { data, current_page, last_page,total } = res.data;

        
        const mapped = (res.data.data || []).map((o: any) => ({
          id: String(o.id),
          orderNumber: o.order_number,
          supplier_name: o.supplier_name || '',
          items: (o.items || []).map((it: any) => ({
            productCode: String(it.product_code),
            productName: it.product_name || it.product?.name || '',
            quantity: Number(it.quantity),
            price: Number(it.unit_price),
          })),
          subtotal: Number(o.subtotal),
          tax: Number(o.tax),
          shipping: Number(o.shipping),
          total: Number(o.total_amount),
          status: o.status as OrderStatus,
          paymentStatus: o.payment_status as PaymentStatus,
          shippingAddress: o.shipping_address,
          orderDate: o.order_date,
          estimatedDelivery: o.estimated_delivery,
          notes: o.notes || '',
        }));
        setOrders(mapped);
        setLastPage(last_page);
        setTotalOrders(total);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Không thể tải đơn hàng');
      } finally {
        setLoading(false);
      }
    };
 

    



  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderFromAPI | null>(null);

  const statuses = ['all', 'draft', 'pending', 'approved', 'rejected', 'fulfilled', 'inactive'];
  const paymentStatuses = ['all', 'pending', 'paid', 'failed', 'refunded'];

 const filteredOrders = useMemo(() => {
  let temp = orders;
      // search
      if (search.trim()) {
        const q = search.toLowerCase();
        temp = temp.filter(o =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.supplier_name.toLowerCase().includes(q)
        );
      }

      // status filter
      if (selectedStatus !== 'all') {
        temp = temp.filter(o => o.status === selectedStatus);
      }

      // payment filter
      if (selectedPaymentStatus !== 'all') {
        temp = temp.filter(o => o.paymentStatus === selectedPaymentStatus);
      }

      return temp;
    }, [orders, search, selectedStatus, selectedPaymentStatus]);



  const getStatusIcon = (status: OrderStatus) => {
  switch (status) {
    case 'draft':
      return <Clock className="h-4 w-4" />;
    case 'pending':
      return <AlertCircle className="h-4 w-4" />;
    case 'approved':
      return <CheckCircle className="h-4 w-4" />;
    case 'rejected':
      return <XCircle className="h-4 w-4" />;
    case 'fulfilled':
      return <Package className="h-4 w-4" />;
    case 'inactive':
      return <XCircle className="h-4 w-4" />;
  }
};

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'draft':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'pending':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'approved':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'fulfilled':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'rejected':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'inactive':
      return 'text-gray-500 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getPaymentStatusColor = (status: Order['paymentStatus']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'paid':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'failed':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'refunded':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const handleAddOrder = () => {
    setEditingOrder(null);
    setShowModal(true);
  };
  const canEditOrder = (order: Order): boolean => {
    const status = order.status;

    const role = currentUser.role?.name_role;
    const dept = currentUser.department?.name_department;

    const isGD = role === 'giam_doc';
    const isKD = dept === 'KINH_DOANH';
    const isCU = dept === 'CUNG_UNG';
    const isManager = ['truong_phong', 'pho_phong'].includes(role);
    const isEmployee = role === 'nhan_vien_chinh_thuc';

    if (isGD) return status === 'approved';
    if (isKD) {
      if (isManager) return true;
      if (isEmployee) return status === 'draft';
    }
    if (isCU) return ['draft', 'pending'].includes(status);
    return false;
  };



const handleEditOrder = async (order: Order) => {
  try {
    const res = await api.get(`/orders/${order.id}`);
    const apiOrder = res.data.order;

    const orderFromAPI: OrderFromAPI = {
      ...apiOrder,
      orderNumber: apiOrder.order_number,
      supplierName: apiOrder.supplier_name ?? '',
      paymentStatus: apiOrder.payment_status,
      shippingAddress: apiOrder.shipping_address,
      orderDate: apiOrder.order_date,
      estimatedDelivery: apiOrder.estimated_delivery ?? '',
      notes: apiOrder.notes ?? '',
      subtotal: Number(apiOrder.subtotal),
      tax: Number(apiOrder.tax),
      shipping: Number(apiOrder.shipping),
      total: Number(apiOrder.total_amount),
      items: apiOrder.items.map((it: any) => ({
        product: {
          code: it.product?.code || '',
          name: it.product?.name || '',
          price: Number(it.product?.price || 0)
        },
        quantity: Number(it.quantity)
      }))
    };

    setEditingOrder(orderFromAPI);
    setShowModal(true);
    toast.success('Đơn hàng đã được tải thành công!');
  } catch (err) {
    toast.error('Không thể tải đơn hàng từ server');
  }
};


  const handleDeleteOrder = async (order: Order) => {
    if (!window.confirm('Bạn có chắc muốn xóa đơn hàng này không?')) return;

  try {
    const res = await api.delete(`/orders/${order.orderNumber}`);
    toast.success('Đã xóa đơn hàng');
    // Gọi lại hàm loadOrders để cập nhật danh sách
    fetchOrders();
  } catch (error: any) {
    const message = error.response?.data?.message || 'Xóa thất bại';
    toast.error(message);
  }
  };

function mapOrderFromApi(o: any): Order {
  return {
    id: String(o.id),
    orderNumber: o.order_number,
    supplier_name: o.supplier_name || '',
    items: (o.items || []).map((it: any) => ({
      productCode: it.product_code,
      productName: it.product_name || it.product?.name || '',
      quantity: Number(it.quantity),
      price: Number(it.unit_price),
    })),
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    shipping: Number(o.shipping),
    total: Number(o.total_amount),
    status: o.status,
    paymentStatus: o.payment_status,
    shippingAddress: o.shipping_address,
    orderDate: o.order_date,
    estimatedDelivery: o.estimated_delivery,
    notes: o.notes || '',
  };
}


  const handleSaveOrder = async (orderData: OrderPayload) => {
  if (editingOrder) {
    // === CẬP NHẬT ĐƠN HÀNG ===
    try {
      const res = await api.put(`/orders/${editingOrder.id}`, orderData);
      const updated = mapOrderFromApi(res.data.order);
      setOrders(orders.map(o => (o.id === updated.id ? updated : o)));
      setShowModal(false);
      toast.success('Cập nhật đơn hàng thành công!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cập nhật đơn hàng thất bại');
    }
  } else {
    // === TẠO MỚI ĐƠN HÀNG ===
    try {
      const payload = {
        orderDate: orderData.orderDate,
        shippingAddress: orderData.shippingAddress,
        supplier_name: orderData.supplier_name,
        items: orderData.items.map(it => ({
          productCode: it.productCode,
          quantity: it.quantity,
        })),
        status: orderData.status,
        payment_status: orderData.payment_status,
        estimatedDelivery: orderData.estimatedDelivery,
        shipping: orderData.shipping,
        notes: orderData.notes,
      };

      const res = await api.post('/orders', payload);
      const newOrder = mapOrderFromApi(res.data.order);

      // Cập nhật danh sách (có thể prepend vào đầu hoặc gọi lại GET)
      setOrders([newOrder, ...orders]);
      setShowModal(false);
      toast.success('Tạo đơn hàng thành công!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Tạo đơn hàng thất bại');
    }
  }
  };
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const toggleOrderSelection = (id: string) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
const handleMergeOrders = async () => {
  try {
    const res = await api.patch('/orders/merge', {
      order_ids: selectedOrders,
    });

    toast.success('Gộp đơn thành công!');
    setSelectedOrders([]);
    fetchOrders(); // hoặc fetchMergedOrders nếu đang xem danh sách gộp
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Gộp đơn thất bại');
  }
};
const [selectedMonths, setSelectedMonths] = useState<string[]>([]);


useEffect(() => {
  const user = getCurrentUser();
    setCurrentUser(user);
  }, []); // 👈 hoặc bạn trigger lại sau login/logout
  console.log('👤 Current user:', currentUser); // 👈 THÊM DÒNG NÀY

const fetchMonthlyOrders = async () => {
      try {
        const res = await api.get('/orders/merged-by-month');
        setMonthlyOrders(res.data); // [{ month: 7, items: [...] }]
      } catch (error) {
        console.error('❌ Lỗi khi fetch đơn gộp theo tháng:', error);
      }
    };

// 🚦 Tự động xử lý khi `mode` thay đổi
useEffect(() => {
      // ✅ Reset toàn bộ liên quan
      setOrders([]);
      setMonthlyOrders([]);
      setSelectedOrders([]);
      setSelectedMonths([]);

      if (mode === 'normal') {
        fetchOrders();
      } else if (mode === 'monthly') {
        fetchMonthlyOrders();
      }
    }, [mode, page, currentUser]);

const toggleMonthSelection = (month: string) => {
  setSelectedMonths(prev =>
    prev.includes(month)
      ? prev.filter(m => m !== month)
      : [...prev, month]
  );
};
const handleExportSelectedMonths = async () => {
  try {
    const response = await api.post(
      '/export-merged-orders-multi-months',
      { months: selectedMonths }, // đúng key
      { responseType: 'blob' }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'don-gop-theo-thang.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err: any) {
    console.error(err);
    toast.error(err.response?.data?.message || 'Xuất thất bại');
  }
};
// Giả sử bạn có:
const [pendingOrders, setPendingOrders] = useState(0);
const [processingOrders, setProcessingOrders] = useState(0);

useEffect(() => {
  if (!currentUser || !orders) return;

  const statusCount = {
    pending: 0,
    processing: 0,
  };

  const department = currentUser?.department?.name_department;
  const role = currentUser?.role?.name_role;
  

  orders.forEach(order => {
    const status = order.status;

    if (department === 'KINH_DOANH') {
      if (status === 'draft') statusCount.pending++;
      if (status === 'pending') statusCount.processing++;
    } else if (department === 'CUNG_UNG') {
      if (status === 'pending') statusCount.pending++;
      if (status === 'approved') statusCount.processing++;
    } else if (role === 'giam_doc') {
      if (status === 'approved') statusCount.pending++;
      if (status === 'fulfilled') statusCount.processing++;
    }
  });


  setPendingOrders(statusCount.pending);
  setProcessingOrders(statusCount.processing);
}, [currentUser, orders]);
const role = currentUser?.role?.name_role;
const dept = currentUser?.department?.name_department;

const pendingLabel =
  dept === 'KINH_DOANH'
    ? 'Đơn nháp (Draft)'
    : dept === 'CUNG_UNG'
    ? 'Đơn chờ xử lý (Pending)'
    : role === 'giam_doc'
    ? 'Đơn cần duyệt (Approved)'
    : 'Chưa rõ';

const processingLabel =
  dept === 'KINH_DOANH'
    ? 'Đơn đã gửi chờ duyệt (Pending)'
    : dept === 'CUNG_UNG'
    ? 'Đơn đã duyệt (Approved)'
    : role === 'giam_doc'
    ? 'Đơn đang giao (Fulfilled)'
    : 'Chưa rõ';
useEffect(() => {
    if (initialSearch) {
      console.log('🔍 Tìm đơn hàng với:', initialSearch);
      setSearch(initialSearch);
      fetchOrders(initialSearch); // Có search
    } else {
      fetchOrders(); // Không search
    }
  }, [initialSearch, page]); // 👈 thêm `page` nếu có phân trang

    


  const totalRevenue = orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Order Management</h1>
          <p className="text-gray-400">Track and manage customer orders</p>
        </div>
        <button
          onClick={handleAddOrder}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="h-5 w-5" />
          <span>Create Order</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Orders</p>
              <p className="text-white text-2xl font-bold">{totalOrders}</p>
            </div>
            <Package className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              
              <p className="text-gray-400 text-sm">{pendingLabel}</p>
              <p className="text-white text-2xl font-bold">{pendingOrders}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{processingLabel}</p>
              <p className="text-white text-2xl font-bold">{processingOrders}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-white text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>
          {selectedOrders.length > 0 && (
          <button
            onClick={handleMergeOrders}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            Gộp {selectedOrders.length} đơn đã chọn
          </button>
        )}


          {/* Filters */}
          <div className="flex items-center space-x-4">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Status' : status.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {paymentStatuses.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Payments' : status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    

      

      {/* Orders Table */}
      {mode === 'normal' && (
      
      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50 border-b border-gray-700/50">
              <tr>
                <th className="text-left p-4 text-gray-300 font-medium">Order</th>
                <th className="text-left p-4 text-gray-300 font-medium">Supplier</th>
                <th className="text-left p-4 text-gray-300 font-medium">Items</th>
                <th className="text-left p-4 text-gray-300 font-medium">Total</th>
                <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                <th className="text-left p-4 text-gray-300 font-medium">Payment</th>
                <th className="text-left p-4 text-gray-300 font-medium">Date</th>
                <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors">
                  <td className="p-4 flex items-center gap-2">
           
                    {order.status === 'fulfilled' && 
                    order.paymentStatus === 'paid'   &&
                    currentUser.department?.name_department === 'CUNG_UNG' &&
                    (
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="form-checkbox text-blue-500 h-6 w-6"
                      />
                    )}
                    <div>
                      <p className="text-white font-medium">{order.orderNumber}</p>
                      <p className="text-gray-400 text-sm">ID: {order.id}</p>
                    </div>
                  </td>

                  <td className="p-4">
                    <div>
                      <p className="text-white">{order.supplier_name}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white">{order.items.length} item(s)</p>
                      <p className="text-gray-400 text-sm">
                        {order.items[0]?.productName}
                        {order.items.length > 1 && ` +${order.items.length - 1} more`}
                      </p>
                    </div>
                  </td>
                  <td className="p-4 text-white font-semibold">${order.total.toFixed(2)}</td>
                  <td className="p-4">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border w-fit ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span>{order.status.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {order.paymentStatus.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">{order.orderDate ? new Date(order.orderDate).toLocaleDateString('vi-VN'):''}</td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                     {canEditOrder(order) && ( 
                      <button
                        onClick={() => handleEditOrder(order)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      )}
                      {currentUser.department?.name_department === 'KINH_DOANH' && order.status === 'draft' && (
                        <button
                        onClick={() => handleDeleteOrder(order)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      )}
                      
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        


        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No orders found matching your criteria</p>
          </div>
        )}

      
      {lastPage > 1 && (
      <div className="flex justify-center gap-2 py-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 rounded text-sm bg-gray-800/50 disabled:opacity-40"
        >
          Prev
        </button>

        {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`px-3 py-1 rounded text-sm ${
              p === page ? 'bg-blue-600 text-white' : 'bg-gray-800/50 text-gray-300'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => setPage(p => Math.min(lastPage, p + 1))}
          disabled={page === lastPage}
          className="px-3 py-1 rounded text-sm bg-gray-800/50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
      )}

      </div>
      )}
      {selectedMonths.length > 0 && (
          <button
            onClick={handleExportSelectedMonths}
            className="mb-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            Xuất {selectedMonths.length} tháng đã chọn
          </button>
        )}


      {mode === 'monthly'  &&(
          <div className="mt-6 space-y-6">
            {monthlyOrders.map((group: any) => (
              <div key={group.month} className="bg-gray-800/40 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-white text-lg font-semibold">Tháng {group.month}</h2>
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(group.month)}
                    onChange={() => toggleMonthSelection(group.month)}
                    className="form-checkbox text-green-500 h-5 w-5"
                  />
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="p-2 text-gray-300">Sản phẩm</th>
                      <th className="p-2 text-gray-300">Tổng số lượng</th>
                      <th className="p-2 text-gray-300">Giá</th>
                      <th className="p-2 text-gray-300">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item: any) => (
                      <tr key={item.product_id} className="border-t border-gray-700/40">
                        <td className="p-2 text-white">{item.product_name}</td>
                        <td className="p-2 text-white">{item.total_quantity}</td>
                        <td className="p-2 text-white">${item.price}</td>
                        <td className="p-2 text-white">${(item.price * item.total_quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          </div>
        )}

      {/* Order Modal */}
      {showModal && (
        <OrderModal
          order={editingOrder}
          onSave={handleSaveOrder}
          onClose={() => setShowModal(false)}
          currentUser={currentUser} // Truyền currentUser vào modal
        />
      )}
    </div>
  );
};

export default OrdersPage;