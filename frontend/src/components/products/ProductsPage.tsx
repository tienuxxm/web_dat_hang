import React, { useState ,useEffect,useMemo} from 'react';
import api from '../../services/api';
import {ArrowUpCircle, Plus, Search, Filter, Edit, Trash2, Eye, Package, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import ProductModal from './ProductModal';
import { useLocation} from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';




interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  category_id: number; // Thêm category_id
  price: number;
  stock: number;
  min_stock: number;
  status: 'active' | 'inactive' | 'out_of_stock';
  image: string;
  description: string;
  createdAt: string;
  sales: number;
  color: string; 
  barcode: string; // Thêm barcode
}

const ProductsPage: React.FC = () => {
  const location = useLocation();
const initialSearch = location.state?.searchTerm || '';
const [searchTerm, setSearchTerm] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<{id:number,name :string}[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 10,
    total: 0,
    last_page: 1,
  });
  /* --- Xác định role & helper --- */
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  const role = user?.role;  // Ví dụ: 'nhan_vien' | 'truong_phong'
// const department = user?.department?.name_department;

  const isManager = ['truong_phong', 'pho_phong'].includes(role);
  console.log('role =', role);          // 'truong_phong'?
  console.log('isManager =', isManager); // true?


  /* --------------------------------
    1) useEffect: Lấy danh sách SP
  ----------------------------------*/
const fetchProducts = async (searchTerm?: string) => {
  setIsLoading(true);
  let cancel = false;
  try {
    let endpoint = `/products?page=${page}&per_page=${pagination.per_page}`;
    if (searchTerm) {
      endpoint += `&q=${encodeURIComponent(searchTerm)}`;
    }
    if (isManager) {
      endpoint += `&withInactive=1`;
    }

    const res = await api.get(endpoint);

    const mapped = res.data.products.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      sku: p.code,
      category: p.category,
      category_id: Number(p.category_id),
      price: Number(p.price),
      stock: Number(p.quantity),
      min_stock: Number(p.min_stock),
      status: p.status,
      image: p.image,
      color: p.color,
      barcode: p.barcode,
      description: p.description ?? '',
      createdAt: p.created_at,
      sales: Number(p.sales),
    }));

    if (!cancel) {
      setProducts(mapped);
      setPagination(res.data.pagination);
      setPage(res.data.pagination.current_page);
    }
  } catch (err) {
    if (!cancel) {
      setProducts([]);
      console.error(err);
    }
  } finally {
    if (!cancel) setIsLoading(false);
  }
};
   useEffect(() => {
  fetchProducts(searchTerm);
}, [page, searchTerm]);

   

/* --------------------------------
   2) useEffect: Lấy danh mục
----------------------------------*/
useEffect(() => {
  let cancel = false;
  const fetchCategories = async () => {
    try {
      const res = await api.get<{ categories: any[] }>('/categories');
      if (!cancel) {
        setCategories(res.data.categories.map(c => ({
          id: c.id,
          name: c.name,
        })));
      }
    } catch (e) {
      !cancel && setCategories([]);
    }
  };

  fetchCategories();
  return () => {
    cancel = true;
  };
}, []);
                        


useEffect(() => {
  const fetchCategories = async () => {
    try {
      const res = await api.get<{ categories: any[] }>('/categories');
      setCategories(res.data.categories.map((c: any) => ({ id: c.id, name: c.name })));
    } catch (e) {
      setCategories([]);
    }
  };
  fetchCategories();
}, []);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const statuses = ['all', 'active', 'inactive', 'out_of_stock'];



const filteredProducts = useMemo(() => {
  return products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || product.category === selectedCategory;

    const matchesStatus =
      selectedStatus === 'all' || product.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });
}, [products, searchTerm, selectedCategory, selectedStatus]);





  const getStatusColor = (status: Product['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'inactive':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
      case 'out_of_stock':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
    }
  };

  const getStockStatus = (stock: number,min_stock :number) => {
    if (stock === 0) return { color: 'text-red-400', label: 'Out of Stock' };
    if (stock < min_stock) return { color: 'text-yellow-400', label: 'Low Stock' };
    return { color: 'text-green-400', label: 'In Stock' };
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
      const result = await Swal.fire({
        title: 'Xác nhận',
        text: 'Bạn chắc chắn muốn ẩn sản phẩm này không?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Huỷ',
        reverseButtons: true,
      });

  if (!result.isConfirmed) return;
    try {
      await api.put(`/products/${productId}/status`, { status: 'inactive' });
      // Sau khi đổi status → refetch lại
      const res = await api.get('/products' + (isManager ? '?withInactive=1' : ''));
      const mapped = res.data.products.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        sku: p.code,
        category: p.category,
        category_id: Number(p.category_id),
        price: Number(p.price),
        stock: Number(p.quantity),
        min_stock: Number(p.min_stock),
        status: p.status,
        image: p.image,
        description: p.description ?? '',
        createdAt: p.created_at,
        color: p.color, 
        barcode:p.barcode,
        sales: Number(p.sales),
      }));
      setProducts(mapped);
      } catch (e: any) {
      const message = e?.response?.data?.message || 'Ẩn sản phẩm thất bại!';
      toast.error(message); // 👈 Hiển thị message thực tế từ backend
      console.error(e);
      }
  };
  const handleRestoreProduct = async (productId: string) => {
  try {
    await api.put(`/products/${productId}/status`, { status: 'active' });
    const res = await api.get('/products?withInactive=1');
    const mapped = res.data.products.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      sku: p.code,
      category: p.category,
      category_id: Number(p.category_id),
      price: Number(p.price),
      stock: Number(p.quantity),
      min_stock: Number(p.min_stock),
      status: p.status,
      image: p.image,
      description: p.description ?? '',
      createdAt: p.created_at,
      color: p.color, // Thêm color
    barcode:p.barcode,
      sales: Number(p.sales),
    }));
    setProducts(mapped);
  } catch (e: any) {
  const message = e?.response?.data?.message || 'Khôi phục sản phẩm thất bại!';
  toast.error(message); // 👈 Hiển thị message thực tế từ backend
  console.error(e);
}

};


  const handleSaveProduct = async (form: FormData) => {
    setIsLoading(true);
    try {
      if (editingProduct) {
        // Nếu là sửa, gọi API update (bạn có thể bổ sung sau)
        await api.post(`/products/${editingProduct.id}?_method=PUT`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });     
        } else {
        // Thêm mới
        await api.post('/products', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
      // Sau khi thêm thành công, reload lại danh sách sản phẩm
      const res = await api.get<{products: any[]}>('/products');
      const mappedProducts: Product[] = res.data.products.map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        sku: p.code,
        category: p.category,
        category_id: Number(p.category_id), // thêm category_id,
        price: Number(p.price),
        stock: Number(p.quantity),
        min_stock: Number(p.min_stock),
        status: p.status,
        image: p.image,
        color: p.color, 
        barcode: p.barcode, 
        description: p.description ?? '',
        createdAt: p.created_at,
        sales: Number(p.sales),
      }));
      setProducts(mappedProducts);
      setShowModal(false);
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Thêm sản phẩm thất bại!';
      toast.error(message); // 👈 Hiển thị message thực tế từ backend
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
const [totalProducts, setTotalProducts] = useState(0);
const [activeProducts, setActiveProducts] = useState(0);
const [lowStockProducts, setLowStockProducts] = useState(0);
const [outOfStockProducts, setOutOfStockProducts] = useState(0);

  const fetchAllProducts = async (): Promise<Product[]> => {
  let page = 1;
  let all: Product[] = [];
  let lastPage = 1;

  try {
    do {
      const res = await api.get(`/products?page=${page}&per_page=100`);
      const data = res.data;

      const mapped = data.products.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        sku: p.code,
        category: p.category,
        category_id: Number(p.category_id),
        price: Number(p.price),
        stock: Number(p.quantity),
        min_stock: Number(p.min_stock),
        status: p.status,
        image: p.image,
        color: p.color,
        barcode: p.barcode,
        description: p.description ?? '',
        createdAt: p.created_at,
        sales: Number(p.sales),
      }));

      all = [...all, ...mapped];
      lastPage = data.pagination?.last_page || 1;
      page++;
    } while (page <= lastPage);

    return all;
  } catch (err) {
    console.error("❌ Lỗi khi load toàn bộ sản phẩm:", err);
    return [];
  }
};  
  useEffect(() => {
  const loadStats = async () => {
    const allProducts = await fetchAllProducts();

    setTotalProducts(allProducts.length);
    setActiveProducts(allProducts.filter(p => p.status === 'active').length);
    setLowStockProducts(allProducts.filter(p => +p.stock < +p.min_stock && +p.stock > 0).length);
    setOutOfStockProducts(allProducts.filter(p => +p.stock === 0).length);
  };

  loadStats();
}, []);

useEffect(() => {
  if (location.state?.searchTerm) {
    setSearchTerm(location.state.searchTerm);

    // Sau khi dùng xong, xóa để tránh lặp lại khi chuyển trang
    window.history.replaceState({}, document.title);
  }
}, [location.state]);





  



  return (
    <div className="space-y-6 relative z-20">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-2">Product Management</h1>
          <p className="text-gray-400 text-sm sm:text-base">Manage your product inventory and catalog</p>
        </div>
        <button
          onClick={handleAddProduct}
          className="flex items-center space-x-2 px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Add Product</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Total Products</p>
              <p className="text-white text-lg sm:text-2xl font-bold">{totalProducts}</p>
            </div>
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Active Products</p>
              <p className="text-white text-lg sm:text-2xl font-bold">{activeProducts}</p>
            </div>
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Low Stock</p>
              <p className="text-white text-lg sm:text-2xl font-bold">{lowStockProducts}</p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Out of Stock</p>
              <p className="text-white text-lg sm:text-2xl font-bold">{outOfStockProducts}</p>
            </div>
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 sm:p-6">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
               onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // reset trang về đầu khi người dùng gõ mới
                }}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 sm:px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm sm:text-base"
            >
              {categories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 sm:px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm sm:text-base"
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Status' : status.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>

            <div className="hidden sm:flex items-center space-x-2 bg-gray-800/50 border border-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Package className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden overflow-x-auto">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-800/50 border-b border-gray-700/50">
              <tr>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Product</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">SKU</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Category</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Price</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Stock</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Status</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Color</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Barcode</th>
                <th className="text-left p-2 sm:p-4 text-gray-300 font-medium text-xs sm:text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product.stock,product.min_stock);
                return (
                  <tr
                    key={product.id}
                    className={`border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors ${
                      product.status === 'inactive' ? 'opacity-40' : ''
                    }`}
                  >

                    <td className="p-2 sm:p-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="text-white font-medium text-xs sm:text-sm">{product.name}</p>
                          <p className="text-gray-400 text-xs hidden sm:block">{product.description.substring(0, 40)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-gray-300 text-xs sm:text-sm">{product.sku}</td>
                    <td className="p-2 sm:p-4 text-gray-300 text-xs sm:text-sm">{product.category}</td>
                    <td className="p-2 sm:p-4 text-white font-semibold text-xs sm:text-sm">${product.price}</td>
                    <td className="p-2 sm:p-4">
                      <span className={`${stockStatus.color} font-medium`}>
                        <span className="text-xs sm:text-sm">{product.stock} units</span>
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 whitespace-nowrap overflow-visible">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(product.status)}`}>
                        {product.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 text-gray-300 text-xs sm:text-sm">{product.color}</td>
                    <td className="p-2 sm:p-4 text-gray-300 text-xs sm:text-sm">{product.barcode}</td>

                    <td className="p-2 sm:p-4">
                      <div className="flex items-center space-x-2">
                        {['active', 'out_of_stock'].includes(product.status) && (
                          <>
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isManager && product.status === 'inactive' && (
                          <button
                            onClick={() => handleRestoreProduct(product.id)}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                          >
                            <ArrowUpCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No products found matching your criteria</p>
          </div>
        )}
        {pagination.last_page > 1 && (
        <div className="flex justify-center gap-2 py-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded text-sm bg-gray-800/50 disabled:opacity-40"
          >
            Prev
          </button>

          {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map(p => (
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
            onClick={() => setPage(p => Math.min(p + 1, pagination.last_page))}
            disabled={page === pagination.last_page}
            className="px-3 py-1 rounded text-sm bg-gray-800/50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
        
      )}
      <p className="text-center text-gray-400 text-xs sm:text-sm py-2">
        Hiển thị {pagination.per_page} / Tổng {pagination.total} sản phẩm
      </p>

      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => setShowModal(false)}
          categories={categories}
          role={role}
        />
      )}
    </div>
  );
};

export default ProductsPage;
