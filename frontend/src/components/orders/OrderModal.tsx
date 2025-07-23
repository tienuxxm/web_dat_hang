import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getCurrentUser } from '../../utils/auth';


interface OrderItem {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
}
interface Product {
  code: string;
  name: string;
  price: number;
  barcode: string; 
  color: string; // Thêm color
}
// Trong OrderModal.tsx hoặc file types.ts nếu tách riêng
export type OrderStatus = 'draft' | 'pending' | 'approved'| 'rejected'| 'fulfilled' | 'inactive';
export type PaymentStatus = 'pending'| 'paid'| 'failed'| 'refunded';
 export interface OrderPayload {
  orderDate: string;
  shippingAddress: string;
  supplier_name: string;
  items: { productCode: string; quantity: number }[];
  status: OrderStatus;
  payment_status: PaymentStatus;
  estimated_delivery: string;
  shipping: number;
  notes: string;
}

export interface OrderFromAPI {
  id: string;
  orderNumber: string;
  supplierName?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingAddress: string;
  orderDate: string;
  estimatedDelivery: string;
  notes: string;
  items: {
    product: {
      code: string;
      name: string;
      price: number;
    };
    quantity: number;
  }[];
}



interface OrderModalProps {
  order: OrderFromAPI | null; 
  onSave: (order: OrderPayload) => void|Promise<void>;
  onClose: () => void;
  currentUser: any; // Hoặc User type nếu bạn đã có

}

const OrderModal: React.FC<OrderModalProps> = ({ order, onSave, onClose }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());


  const [formData, setFormData] = useState({
        orderNumber: '',
        supplier_name: '',
        items: [] as OrderItem[],
        subtotal: 0,
        tax:   0,
        shipping: 0,
        total: 0,
        status: 'draft' as OrderStatus,            
        paymentStatus: 'pending' as PaymentStatus, 
        shippingAddress: '',
        orderDate: new Date().toISOString().split('T')[0],
        estimatedDelivery: '',
        notes: ''
  });

  const  statuses :OrderStatus[]= ['draft' , 'pending'  ,'approved','rejected', 'fulfilled' , 'inactive'];
  const paymentStatuses :PaymentStatus[]= ['pending', 'paid', 'failed', 'refunded'];

  useEffect(() => {
  const fetchProducts = async () => {
    try {
      const res = await api.get('/products?per_page=1000');
      console.log('📦 Products response:', res.data);

      // 👇 Phải lấy res.data.products thay vì res.data
      setProducts(res.data.products || []);
    } catch (e) {
      console.error('❌ Failed to load products', e);
      setProducts([]); // fallback rỗng
    } finally {
      setLoadingProducts(false);
    }
  };

  fetchProducts();
}, []);


 useEffect(() => {
    console.log("🔥 Order received in modal:", order);

  if (order) {
        setFormData({
        orderNumber: order.orderNumber,
        supplier_name: order.supplierName ?? '',
        items: order.items.map(it => ({
          productCode: it.product.code,
          productName: it.product.name,
          quantity: it.quantity,
          price: it.product.price
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        shippingAddress: order.shippingAddress,
        orderDate: order.orderDate ? order.orderDate.split('T')[0] : '',
        estimatedDelivery: order.estimatedDelivery ? order.estimatedDelivery.split('T')[0] : '',
        notes: order.notes ?? ''
      });

  } else {
    // 👉  Khởi tạo đơn mới
    setFormData(prev => ({
      ...prev,
      orderNumber: `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`
    }));
  }
}, [order]);


useEffect(() => {
  console.log('🔄 formData.items:', formData.items);

  const subtotal = formData.items.reduce(
    (sum, item) => sum + (Number(item.quantity) * Number(item.price)), 0
  );
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + tax + Number(formData.shipping);

  setFormData(prev => ({
    ...prev,
    subtotal,
    tax,
    total
  }));
}, [formData.items, formData.shipping]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderDate = new Date(formData.orderDate);
    const deliveryDate = new Date(formData.estimatedDelivery);

  // Kiểm tra ngày hợp lệ
      if (isNaN(orderDate.getTime()) || isNaN(deliveryDate.getTime())) {
        toast.error("Ngày đặt hàng hoặc ngày giao hàng không hợp lệ.");
        return;
      }

      if (deliveryDate <= orderDate) {
        toast.error("Ngày giao hàng phải sau ngày đặt hàng.");
        return;
      }
    // Chỉ lấy các trường cần gửi cho BE
    const payload :OrderPayload= {
      orderDate: formData.orderDate,
      shippingAddress: formData.shippingAddress,
      supplier_name: formData.supplier_name, // Đổi từ supplierName sang supplier_name
      items: formData.items.map(it => ({
        productCode: it.productCode,
        quantity: it.quantity
      })),
      status: formData.status||'draft', // Mặc định là 'draft' nếu không có
      payment_status: formData.paymentStatus||'pending', // Mặc định là 'pending' nếu không có
      estimated_delivery: formData.estimatedDelivery,
      shipping: formData.shipping,
      notes: formData.notes
    };
    onSave(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'shipping' ? parseFloat(value) || 0 : value
    }));
  };

  const addItem = () => {
    const newItem: OrderItem = {
      productCode: '',
      productName: '',
      quantity: 1,
      price: 0
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          if (field === 'productCode') {
            const product = products.find(p => p.code === value);
            return {
              ...item,
              productCode: value as string,
              productName: product?.name || '',
              price: product?.price || 0
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    }));
    console.log("🧪 productCode value:", value, typeof value);

  };
  useEffect(() => {
  if (products.length === 0 || formData.items.length === 0) return;

  console.log("👉 formData.items:", formData.items);
  console.log("👉 products:", products.map(p => p.code));
}, [products, formData.items]);
  const getAvailableStatuses = (order: OrderFromAPI | null): string[] => {
  if (!order) return ['draft']; // Khi tạo mới đơn

  const status = order.status;

  const role = currentUser.role?.name_role;
  const dept = currentUser.department?.name_department;

  const isGD = role === 'giam_doc';
  const isKD = dept === 'KINH_DOANH';
  const isCU = dept === 'CUNG_UNG';
  const isManager = ['truong_phong', 'pho_phong'].includes(role);
  const isEmployee = role === 'nhan_vien_chinh_thuc';

  if (isGD && status === 'approved') return ['fulfilled', 'rejected'];
  if (isKD) {
    if (isManager) return ['draft', 'pending'];
    if (isEmployee && status === 'draft') return ['pending','draft'];
  }
  if (isCU && status === 'pending') return ['draft', 'approved','pending'];

  return []; // không được đổi trạng thái
};




  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <h2 className="text-2xl font-bold text-white">
            {order ? 'Edit Order' : 'Create New Order'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                value={formData.orderNumber}
                onChange={handleChange}
                required
                disabled={!!order} // Không cho sửa nếu là đơn đã có
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                placeholder="Enter order number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Order Date</label>
              <input
                type="date"
                name="orderDate"
                value={formData.orderDate}
                onChange={handleChange}
                required
                disabled={!!order} // Không cho sửa nếu là đơn đã có
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Supplier Information</h3>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Supplier Name</label>
                <input
                  type="text"
                  name="supplier_name"
                  value={formData.supplier_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  placeholder="Enter supplier name"
                />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Shipping Address</label>
              <input
                type="text"
                name="shippingAddress"
                value={formData.shippingAddress}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                placeholder="Enter shipping address"
              />
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Order Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className="bg-gray-800/30 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Product</label>
                    <select
                      value={item.productCode}
                      onChange={(e) => updateItem(index, 'productCode', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Select a product</option>
                      {products.map(product => (
                        <option key={product.code} value={String(product.code)}>
                          {product.name}-[{product.barcode}] - {product.color}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="bg-gray-800/30 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-300">
                <span>Subtotal:</span>
                <span>${formData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Tax (8%):</span>
                <span>${formData.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span>Shipping:</span>
                <input
                  type="number"
                  name="shipping"
                  step="100"
                  value={formData.shipping ?? 0}
                  onChange={handleChange}
                  className="w-24 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-right focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between text-white font-semibold text-lg">
                <span>Total:</span>
                <span>${Number(formData.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Status and Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Order Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {getAvailableStatuses(order).map(status => (
                  <option key={status} value={status}>{status.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Payment Status</label>
              <select
                name="paymentStatus"
                value={formData.paymentStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {paymentStatuses.map(status => (
                  <option key={status} value={status}>{status.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Estimated Delivery</label>
              <input
                type="date"
                name="estimatedDelivery"
                value={formData.estimatedDelivery}
                min={formData.orderDate}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Order Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              placeholder="Enter any special instructions or notes"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all duration-300"
            >
              {order ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;