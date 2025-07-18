<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
class ProductController extends Controller
{
    use AuthorizesRequests;
    public function __construct()
    {
        $this->middleware('auth:api'); // Middleware bảo vệ bằng JWT
    }

    /**
     * Tạo sản phẩm mới
     * POST /api/products
     */
    public function store(Request $request): JsonResponse
    {
        // 1️⃣ VALIDATE NGAY TRONG CONTROLLER
        $validated = $request->validate([
            'code'        => 'nullable|string|unique:products,code',
            'name'        => 'required|string|max:255',
            'price'       => 'required|numeric|min:0',
            'quantity'    => 'required|integer|min:0',
            'min_stock'  => 'required|integer|min:0',
            'description' => 'nullable|string',
            'image'       => 'nullable|image|max:2048',
            'category_id' => 'required|exists:categories,id',
            'color'       => 'nullable|string|max:50',
            'barcode'     => 'nullable|string|max:255', // Thêm validate cho barcode
            'status'      => 'in:active,inactive',
        ]);

        DB::beginTransaction();

        try {
            // 2️⃣ Upload ảnh nếu có
            if ($request->hasFile('image')) {
                $path = $request->file('image')->store('products', 'public');
                $validated['image'] = $path;
            }

            // 3️⃣ Gán người tạo (dù trong model có cũng nên gán rõ)
            $validated['created_by'] = auth()->id();

            // 4️⃣ Tạo sản phẩm (model sẽ tự sinh code nếu chưa có)
            $product = Product::create($validated)->load('category');

            DB::commit();

            return response()->json([
                'message' => 'Tạo sản phẩm thành công',
                'product' => $product,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Lỗi tạo sản phẩm',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
    public function index(Request $request): JsonResponse
    {
        $user = JWTAuth::user();
        $this->authorize('viewAny', Product::class);

        // 1️⃣ Tạo query cơ bản
        $query = Product::with('category');

        // 2️⃣ Lọc theo quyền
        $roleName = $user->role->name_role;

        if (in_array($roleName, ['truong_phong', 'pho_phong'])) {
            if (!$request->boolean('withInactive')) {
                $query->where('status', 'active');
            }
        } else {
            // Nhân viên
            $query->whereIn('status', ['active', 'out_of_stock']);
        }

        // 3️⃣ Phân trang (mặc định 10/sp, có thể truyền ?per_page=20 từ FE)
        $perPage = $request->integer('per_page', 10);
        $products = $query->latest()->paginate($perPage);

        // 4️⃣ Format lại từng item
        $data = $products->getCollection()->map(fn(Product $p) => [
            'id'          => $p->id,
            'name'        => $p->name,
            'code'        => $p->code,
            'price'       => $p->price,
            'quantity'    => $p->quantity,
            'min_stock'   => $p->min_stock,
            'description' => $p->description,
            'image'       => $p->image_url,
            'category'    => $p->category->name ?? null,
            'category_id' => $p->category_id,
            'status'      => $p->status,
            'color'       => $p->color, 
            'barcode'     => $p->barcode, // Thêm barcode vào response
            'created_at'  => $p->created_at->toDateString(),
            'sales'       => 0,
        ]);

        // 5️⃣ Trả về kết quả dạng phân trang
        return response()->json([
            'message'     => 'Danh sách sản phẩm',
            'products'    => $data,
            'pagination'  => [
                'current_page' => $products->currentPage(),
                'per_page'     => $products->perPage(),
                'total'        => $products->total(),
                'last_page'    => $products->lastPage(),
            ],
        ], 200);
    }

    public function update(Request $request,  $id)
    {
        $product = Product::findOrFail($id);
        $user = JWTAuth::user();
        $this->authorize('update', $product);

        // Validate dữ liệu
        $validated = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'price'       => 'sometimes|numeric|min:0',
            'quantity'    => 'sometimes|integer|min:0',
            'min_stock'   => 'sometimes|integer|min:0',
            'description' => 'sometimes|string|nullable',
            'image'       => 'nullable|image|max:2048',
            'category_id' => 'sometimes|exists:categories,id',
            'status'      => 'in:active,inactive',
            'barcode'     => 'nullable|string|max:255',
            'color'       => 'nullable|string|max:50', 
        ]);

        DB::beginTransaction();
        try {
            // Nếu có ảnh mới thì upload và xóa ảnh cũ nếu cần
            if ($request->hasFile('image')) {
                // Xóa ảnh cũ nếu có
                if ($product->image && \Storage::disk('public')->exists($product->image)) {
                    \Storage::disk('public')->delete($product->image);
                }
                $path = $request->file('image')->store('products', 'public');
                $validated['image'] = $path;
            }

            $product->update($validated);
            $product->load('category');

            DB::commit();

            return response()->json([
                'message' => 'Cập nhật sản phẩm thành công',
                'product' => [
                    'id'         => $product->id,
                    'name'       => $product->name,
                    'price'      => $product->price,
                    'quantity'   => $product->quantity,
                    'min_stock'  => $product->min_stock,
                    'description'=> $product->description,
                    'image'      => $product->image_url,
                    'category'   => $product->category->name ?? null,
                    'category' =>$product->category_id,
                    'status'     => $product->status,
                    'color'      => $product->color,
                    'created_at' => $product->created_at->toDateString(),
                    'sales'      => 0,
                ],
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Lỗi cập nhật sản phẩm',
                'error'   => $e->getMessage(),
            ], 500);
        }
        }
    public function updateStatus(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $this->authorize('update', $product);

        $request->validate([
            'status' => 'required|in:active,inactive',
        ]);

        $product->update(['status' => $request->status]);

        return response()->json([
            'message' => 'Cập nhật trạng thái thành công',
            'status'  => $product->status,
        ]);
    }

    public function search(Request $request)
    {
        $q = $request->query('q');

        $products = Product::with('category')
            ->where('code', 'like', "%$q%")
            ->orWhere('name', 'like', "%$q%")
            ->orWhere('barcode', 'like', "%$q%")
            ->orWhere('color', 'like', "%$q%")
            ->orWhereHas('category', function ($query) use ($q) {
                $query->where('name', 'like', "%$q%");
            })
            ->get();

        return response()->json($products);
    }



}
