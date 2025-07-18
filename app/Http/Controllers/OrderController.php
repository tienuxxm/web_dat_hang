<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\Order;
use App\Models\Product;
use App\Models\OrderItem;
use App\Models\Category;
use Illuminate\Support\Facades\Gate;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Validation\Rule;
use Carbon\Carbon;



class OrderController extends Controller
{
    use AuthorizesRequests;
    public function __construct()
    {
        $this->middleware('auth:api'); // Middleware bảo vệ bằng JWT
    }
    
    public function store(Request $request)
    {
        $user = JWTAuth::user();
        $this->authorize('create', Order::class); // ① Kiểm tra quyền tổng

        // ② Validate đầu vào
        $validated = $request->validate([
            'orderDate'         => 'required|date',
            'shippingAddress'   => 'required|string',
            'supplier_name'     => 'required|string|max:255',
            'items'             => 'required|array|min:1',
            'items.*.productCode' => ['required', 'string', Rule::exists('products', 'code')],
            'items.*.quantity'  => 'required|integer|min:1',
            'status'            => ['nullable', Rule::in(Order::STATUSES)],
            'payment_status'    => ['nullable', Rule::in(Order::PAYMENT_STATUSES)],
            'estimatedDelivery' => 'required|date|after_or_equal:orderDate',
            'shipping'          => 'required|numeric|min:0',
            'notes'             => 'nullable|string',
        ]);

        // ③ Xác định category_id của sản phẩm đầu tiên
        $firstProduct    = Product::where('code', $request->items[0]['productCode'])->firstOrFail();
        $orderCategoryId = $firstProduct->category_id;

        // ④ Kiểm tra quyền theo category nếu là nhân viên
        if ($user->role->name_role === 'nhan_vien_chinh_thuc') {
            $allowed = $user->categories()->pluck('categories.id')->toArray();
            if (!in_array($orderCategoryId, $allowed)) {
                return response()->json(['message' => 'Bạn không được phép tạo đơn với danh mục này.'], 403);
            }
        }

        // ⑤ Kiểm tra các sản phẩm đều cùng category + tồn kho
        $subtotal = 0;
        foreach ($request->items as $item) {
            $product = Product::where('code', $item['productCode'])->firstOrFail();

            // 5.1 Kiểm tra cùng danh mục
            if ($product->category_id !== $orderCategoryId) {
                return response()->json([
                    'message' => 'Tất cả sản phẩm trong đơn phải thuộc cùng một danh mục.'
                ], 422);
            }

            // 5.2 Tính tổng
            $subtotal += $item['quantity'] * $product->price;
        }

        // ⑥ Tính toán tổng tiền
        $tax      = round($subtotal * 0.08, 2);
        $shipping = $request->shipping;
        $total    = $subtotal + $tax + $shipping;

        $prefix = DB::table('categories')->where('id', $orderCategoryId)->value('prefix') ?? 'XX';
            $timestamp = now('Asia/Ho_Chi_Minh')->format('ymdHis');
            $random    = strtoupper(Str::random(4));
            $orderNumber = "{$prefix}-{$timestamp}-{$random}";

        // ⑦ Tạo đơn hàng và item trong transaction
        DB::beginTransaction();
        try {
            // ⑦.1 Lấy prefix theo category
            

            $order = Order::create([
                'order_number'       => $orderNumber,
                'total_amount'       => $total,
                'status'             => $request->status ?? 'draft',
                'payment_status'     => $request->payment_status ?? 'pending',
                'user_id'            => $user->id,
                'shipping_address'   => $request->shippingAddress,
                'supplier_name'      => $request->supplier_name,
                'order_date'         => $request->orderDate,
                'estimated_delivery' => $request->estimatedDelivery,
                'notes'              => $request->notes,
                'subtotal'           => $subtotal,
                'tax'                => $tax,
                'shipping'           => $shipping,
            ]);

            foreach ($request->items as $item) {
                $product = Product::where('code', $item['productCode'])->firstOrFail();

                OrderItem::create([
                    'order_id'     => $order->id,
                    'product_id'   => $product->id,
                    'quantity'     => $item['quantity'],
                    'unit_price'   => $product->price,
                    'product_name' => $product->name,
                    'barcode'     => $product->barcode, 
                    'color'       => $product->color, 
                    'line_total'   => $product->price * $item['quantity'],
                ]);
            }

            DB::commit();
            return response()->json([
                'message' => 'Order created successfully.',
                'order'   => $order->load('items.product'),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create order',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }


    public function update(Request $request, Order $order)
    {
        $user = JWTAuth::user();
        $this->authorize('update', $order);

        $statusBefore = $order->status;
        $statusAfter  = $request->get('status', $statusBefore);

        // 🎯 VALIDATE chuyển trạng thái đúng theo role
        if ($user->isInDepartment('KINH_DOANH') && $statusAfter !== $statusBefore) {
        if (!in_array($statusBefore, ['draft']) || $statusAfter !== 'pending') {
            return response()->json(['message' => 'KD chỉ được chuyển từ draft sang pending.'], 403);
            }
        }

        if ($user->isInDepartment('CUNG_UNG') && $statusAfter !== $statusBefore) {
            if ($statusBefore === 'pending' && $statusAfter === 'draft') {
                // OK
            } elseif ($statusBefore === 'pending' && $statusAfter === 'approved') {
                // OK
            } else {
                return response()->json(['message' => 'CU chỉ được chuyển pending → draft hoặc pending → approved.'], 403);
            }
        }

        if ($user->isRole('giam_doc') && $statusAfter !== $statusBefore) {
            if ($statusBefore !== 'approved' || !in_array($statusAfter, ['fulfilled', 'rejected'])) {
                return response()->json(['message' => 'GD chỉ được duyệt từ approved → fulfilled / rejected.'], 403);
            }
        }


        /* 2. Validate */
        $isPatch = $request->isMethod('patch');
        $req     = $isPatch ? 'sometimes' : 'required';

        $rules = [
            'orderDate'           => $req . '|date',
            'shippingAddress'     => $req . '|string',
            'supplier_name'       => $req . '|string|max:255',
            'items'               => $req . '|array|min:1',
            // 🔑 so sánh & validate theo productCode
            'items.*.productCode' => [$req, 'string', Rule::exists('products', 'code')],
            'items.*.quantity'    => $req . '|integer|min:1',
            'status'              => [$req, Rule::in(Order::STATUSES)],
            'payment_status'       => [$req, Rule::in(Order::PAYMENT_STATUSES)],
            'estimatedDelivery'   => $req . '|date|after_or_equal:orderDate',
            'shipping'            => 'sometimes|numeric|min:0',
            'notes'               => 'sometimes|string'
        ];
        $validated = $request->validate($rules);

        /* 3. Chuẩn bị dữ liệu mới */
        $hasItems   = $request->has('items');
        $subtotal   = 0;
        $newByCode  = collect();   // key = productCode

        if ($hasItems) {
             $firstProduct    = Product::where('code', $request->items[0]['productCode'])->firstOrFail();
            $orderCategoryId = $firstProduct->category_id;

            if (!$user->isManager()) {
                $allowed = $user->categories()->pluck('categories.id')->toArray();
            if (!$orderCategoryId || !in_array($orderCategoryId, $allowed)) {
                    return response()->json(['message' => 'Bạn không có quyền với danh mục này.'], 403);
                }
            }

            foreach ($request->items as $it) {
                $product = Product::where('code', $it['productCode'])->firstOrFail();

                if ($product->category_id !== $orderCategoryId) {
                    return response()->json(['message' => 'Tất cả sản phẩm phải cùng danh mục.'], 422);
                }

                $subtotal += $it['quantity'] * $product->price;
                $newByCode->put($product->code, [
                    'product'  => $product,
                    'quantity' => $it['quantity']
                ]);
            }
        }

        /* 4. Giao dịch */
        DB::beginTransaction();
        try {
            /* 4.1 Cập nhật header đơn */
            $order->fill($validated);

            if ($hasItems) {
                $shipping = $request->get('shipping', $order->shipping ?? 0);
                $tax      = round($subtotal * 0.08, 2);
                $total    = $subtotal + $tax + $shipping;

                $order->subtotal     = $subtotal;
                $order->tax          = $tax;
                $order->shipping     = $shipping;
                $order->total_amount = $total;
            }
            $order->save();

            /* 4.2 Lấy danh sách item cũ theo productCode */
            $oldItems = $order->items()
                            ->with('product:id,code,name,price')
                            ->get()
                            ->keyBy(fn($item) => $item->product->code);   // key = productCode

                        /* a. Thêm mới / cập nhật */
            $keptProductIds = [];          // ⭐ sẽ chứa ID đã xử lý

            foreach ($newByCode as $code => $row) {
                $product = $row['product'];
                $qty     = $row['quantity'];

                $order->items()->updateOrCreate(
                    ['product_id' => $product->id],
                    [
                        'quantity'     => $qty,
                        'unit_price'   => $product->price,
                        'product_name' => $product->name,
                        'barcode'     => $product->barcode,
                        'color'       => $product->color,
                        'line_total'   => $product->price * $qty,
                    ]
                );

                $keptProductIds[] = $product->id;     // ⭐ thu thập ID
            }

            /* b. Xoá những product_id không còn được giữ lại */
            $order->items()
                ->whereNotIn('product_id', $keptProductIds)
                ->delete();
            DB::commit();
            return response()->json([
                'message' => 'Order updated successfully.',
                'order'   => $order->load('items')
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Update failed',
                'error'   => $e->getMessage()
            ], 500);
        }
    }




   


    public function index(Request $request)
    {
        $user = auth()->user();
        $this->authorize('viewAny', Order::class); // Đã được sửa đúng

        $query = Order::with('items.product')
            ->where('merged', false) ;// Chỉ lấy đơn chưa gộp

        // Xác định trạng thái phù hợp với từng vai trò/phòng
        if ($user->isRole('giam_doc')) {
            $query->whereIn('status', ['approved', 'rejected', 'fulfilled']);
        } elseif ($user->isInDepartment('KINH_DOANH') && ($user->isManager() || $user->isEmployee())) {
            $query->whereIn('status', ['draft', 'pending']);
        } elseif ($user->isInDepartment('CUNG_UNG') && ($user->isManager() || $user->isEmployee())) {
            $query->whereIn('status', ['pending', 'rejected', 'fulfilled']);
        } else {
            return response()->json(['message' => 'Bạn không có quyền xem đơn hàng'], 403);
        }

        $orders = $query->get();

        $filtered = $orders->filter(function ($order) use ($user) {
            return Gate::forUser($user)->allows('view', $order); // kiểm tra theo category nếu là nhân viên
        });

        // ✅ Phân trang thủ công
        $page = $request->input('page', 1);
        $perPage = 10;
        $paginated = $filtered->values()->forPage($page, $perPage);

        return response()->json([
            'data' => $paginated,
            'total' => $filtered->count(),
            'current_page' => $page,
            'last_page' => ceil($filtered->count() / $perPage),
        ]);
    }






    /** ----------- DELETE ----------- */
    public function destroy($orderNumber)
    {
        $user = JWTAuth::user();
        $order = Order::where('order_number', $orderNumber)->firstOrFail();


        // Gọi policy delete (tự động kiểm tra trạng thái và phòng ban)
        $this->authorize('delete', $order);

        DB::beginTransaction();
        try {
            $order->items()->delete();
            $order->delete();

            DB::commit();
            return response()->json(['message' => 'Đơn hàng đã được xóa.']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Lỗi khi xóa đơn hàng.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function show(Order $order)          // <- route‑model binding
    {
        $user = JWTAuth::user();

        /* 1️⃣  Phân quyền: HEAD/DEPUTY xem tất cả – nhân viên bị Policy lọc */
        $this->authorize('view', $order);   
        if ($user->role->name_role === 'nhan_vien_chinh_thuc') {
            $allowed = $user->categories()->pluck('categories.id')->toArray();
            $orderCategoryId = $order->items->first()->product->category_id ?? null;

            if (!$orderCategoryId || !in_array($orderCategoryId, $allowed)) {
                return response()->json([
                    'message' => 'Bạn không được phép xem đơn hàng trong danh mục này.'
                ], 403);
            }
        }


        /* 2️⃣  Eager‑load quan hệ cần thiết */
        $order->load([
            'creator:id,name',
            'items.product:id,code,name,price,category_id',
            'items.product.category:id,prefix,name'
        ]);

        /* 3️⃣  Trả JSON */
        return response()->json([
            'message' => 'Chi tiết đơn hàng',
            'order'   => $order
        ]);
    }
    public function combine(Request $request)
    {
        $user = JWTAuth::user();

        if (!$user->isInDepartment('CUNG_UNG')) {
            return response()->json(['message' => 'Không có quyền gộp đơn'], 403);
        }

        $orderIds = $request->input('order_ids', []);
        if (empty($orderIds)) {
            return response()->json(['message' => 'Chưa chọn đơn hàng nào'], 422);
        }
        Order::whereIn('id', $orderIds)->update(['merged' => true]);


        $orders = Order::with('items.product')
            ->whereIn('id', $orderIds)
            ->where('status', 'fulfilled')
            ->where('payment_status', 'paid')
            ->get();

        if ($orders->count() < 1) {
            return response()->json(['message' => 'Không có đơn hợp lệ để gộp'], 422);
        }

        // Bắt đầu gom sản phẩm
        $itemsByProduct = collect();

        foreach ($orders as $order) {
        foreach ($order->items as $item) {
                $pid = $item->product_id;

                $existing = $itemsByProduct->get($pid);

                if ($existing) {
                    $existing['quantity'] += $item->quantity;
                } else {
                    $existing = [
                        'product'  => $item->product,
                        'quantity' => $item->quantity,
                    ];
                }

                $itemsByProduct->put($pid, $existing);
            }
        }


        DB::beginTransaction();
        try {
            $subtotal = 0;
            foreach ($itemsByProduct as $row) {
                $subtotal += $row['quantity'] * $row['product']->price;
            }

            $tax = round($subtotal * 0.08, 2);
            $shipping = 0;
            $total = $subtotal + $tax + $shipping;
            // Tự sinh order_number cho đơn gộp
            $prefix = 'XX'; // Hoặc lấy từ prefix chung (nếu có)
            $timestamp = now('Asia/Ho_Chi_Minh')->format('ymdHis');
            $random = strtoupper(Str::random(4));
            $orderNumber = "{$prefix}-{$timestamp}-{$random}";


            $newOrder = Order::create([
                'order_number'       => $orderNumber, 

                'user_id'         => $user->id,
                'order_date'      => now(),
                'shipping_address'=> 'Gộp từ nhiều đơn',
                'supplier_name'   => 'N/A',
                'estimated_delivery' => now()->addDays(7),
                'status'          => 'draft',
                'payment_status'  => 'pending',
                'subtotal'        => $subtotal,
                'tax'             => $tax,
                'shipping'        => $shipping,
                'total_amount'    => $total,
                'notes'           => 'Gộp từ đơn: ' . implode(', ', $orders->pluck('order_number')->toArray()),
            ]);

            foreach ($itemsByProduct as $row) {
                $product = $row['product'];
                $qty = $row['quantity'];

                OrderItem::create([
                    'order_id'     => $newOrder->id,
                    'product_id'   => $product->id,
                    'quantity'     => $qty,
                    'unit_price'   => $product->price,
                    'product_name' => $product->name,
                    'line_total'   => $qty * $product->price,
                ]);
                $product->increment('quantity', $qty); // ✅ cộng vào tồn kho

            }

            DB::commit();

            return response()->json([
                'message' => 'Đã gộp đơn thành công',
                'order'   => $newOrder->load('items.product'),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gộp thất bại', 'error' => $e->getMessage()], 500);
        }
    }

    public function mergedByMonth()
    {
        $orders = Order::with('items.product')
            ->where('status', 'fulfilled')
            ->where('payment_status', 'paid')
            ->where('merged', true) // cột merged = true
            ->get();

        $grouped = $orders->groupBy(function ($order) {
            return Carbon::parse($order->order_date)->format('m/Y');
        });

        $result = [];

        foreach ($grouped as $month => $ordersInMonth) {
            $items = [];

            foreach ($ordersInMonth as $order) {
                foreach ($order->items as $item) {
                    $key = $item->product_id;

                    if (!isset($items[$key])) {
                        $items[$key] = [
                            'product_id' => $item->product_id,
                            'product_name' => $item->product_name,
                            'price' => $item->unit_price,
                            'total_quantity' => 0
                        ];
                    }

                    $items[$key]['total_quantity'] += $item->quantity;
                }
            }

            $result[] = [
                'month' => $month,
                'items' => array_values($items)
            ];
        }

        return response()->json($result);
    }
    public function search(Request $request)
    {
        $q = $request->query('q', '');

        $orders = Order::with(['items.product.category'])
            ->where('order_number', 'like', "%$q%")
            ->orWhere('supplier_name', 'like', "%$q%")
            ->orWhereHas('items', function ($query) use ($q) {
                $query->where('product_name', 'like', "%$q%");
            })
            ->orWhereHas('items.product', function ($query) use ($q) {
                $query->where('barcode', 'like', "%$q%")
                    ->orWhere('color', 'like', "%$q%");
            })
            ->orWhereHas('items.product.category', function ($query) use ($q) {
                $query->where('name', 'like', "%$q%");
            })
            ->get();

        return response()->json($orders);
    }



    



}
