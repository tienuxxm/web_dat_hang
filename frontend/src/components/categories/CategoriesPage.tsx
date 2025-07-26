import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Folder } from 'lucide-react';
import CategoryModal from './CategoryModal';
import api from '../../services/api'; // Adjust the import based on your API setup
import { useEffect } from 'react';
interface Category {
  id: string;
  name: string;
  prefix: string;
  status: 'active' | 'inactive';
  description: string; // Optional field for description
  user_emails?: string[]; // Optional field for user emails
}

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filteredCategories = categories.filter(cat => {
    const matchSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === 'all' || cat.status === selectedStatus;
    return matchSearch && matchStatus;
  });
  const fetchCategories = async () => {
  const res = await api.get('/categories');
  return res.data.categories;
};
  const createCategory = async (data: {
  name: string;
  prefix: string;
  status: 'active' | 'inactive';
  description?: string;
  user_emails?: string[];
}) => {
  const res = await api.post('/categories', data);
  return res.data.category;
};

    const handleSave = async (form: {
      name: string;
      prefix: string;
      status: 'active' | 'inactive';
      description?: string;
      user_emails?: string[];
    }) => {
      try {
        if (editingCategory) {
          await api.put(`/categories/${editingCategory.id}`, form);
        } else {
          await api.post(`/categories`, form);
        }
        const updated = await fetchCategories();
        setCategories(updated);
        setShowForm(false);
        setEditingCategory(null);
      } catch (error) {
        console.error('Error saving:', error);
      }
    };




useEffect(() => {
  const load = async () => {
    const data = await fetchCategories();
    setCategories(data);
  };
  load();
}, [])


  const handleDelete = (id: string) => {
    if (confirm('Delete this category?')) {
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-2">Category Management</h1>
          <p className="text-gray-400 text-sm sm:text-base">Manage product categories</p>
        </div>
        <button
          onClick={() => { setEditingCategory(null); setShowForm(true); }}
          className="flex items-center px-3 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm sm:text-base"
        >
          <Plus className="h-5 w-5 mr-2" />
          <span className="hidden sm:inline">Add Category</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:gap-4 bg-gray-900/40 border border-gray-700/50 p-3 sm:p-4 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 sm:px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white text-sm sm:text-base"
        >
          <option value="all">All Status</option>
          <option value="active">ACTIVE</option>
          <option value="inactive">INACTIVE</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900/40 border border-gray-700/50 rounded-xl">
        <table className="w-full text-xs sm:text-sm min-w-[600px]">
          <thead className="bg-gray-800/50 border-b border-gray-700/50">
            <tr>
              <th className="text-left text-gray-300 p-2 sm:p-4">Name</th>
              <th className="text-left text-gray-300 p-2 sm:p-4">Description</th>
              <th className="text-left text-gray-300 p-2 sm:p-4">Status</th>
              <th className="text-left text-gray-300 p-2 sm:p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map(cat => (
              <tr key={cat.id} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                <td className="p-2 sm:p-4 text-white">{cat.name}</td>
                <td className="p-2 sm:p-4 text-gray-300">{cat.description}</td>
                <td className="p-2 sm:p-4">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${
                    cat.status === 'active' ? 'text-green-400 bg-green-500/10 border-green-500/30' :
                    'text-gray-400 bg-gray-500/10 border-gray-500/30'
                  }`}>
                    {cat.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-2 sm:p-4">
                  <div className="flex space-x-2">
                  <button onClick={() => { setEditingCategory(cat); setShowForm(true); }}
                    className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCategories.length === 0 && (
          <div className="text-center text-gray-400 py-6">
            <Folder className="mx-auto w-6 h-6 sm:w-8 sm:h-8 mb-2" />
            No categories found
          </div>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <CategoryModal
          category={editingCategory}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false)
            setEditingCategory(null);}}
        />
      )}

    </div>
  );
};

export default CategoriesPage;
