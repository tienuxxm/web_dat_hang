<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    /* ---------- Mass‑assign ---------- */
    protected $fillable = [
// optional – tự sinh nếu rỗng
        'name',
        'price',
        'quantity',
        'min_stock',
        'description',
        'image',
        'category_id',
        'status',
        'color',
        'barcode', 
        'created_by',
    ];

    protected $casts = [
        'price' => 'float',
    ];

    /* ---------- Relationships ---------- */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /* ---------- Accessor ---------- */
    protected $appends = ['image_url'];

    

    public function getImageUrlAttribute(): string
    {
        return $this->image
            ? asset('storage/' . $this->image)
            : asset('images/default.png');
    }

    /* ---------- Auto‑generate CODE & created_by ---------- */
    protected static function booted()
    {
        static::creating(function (Product $p) {
            // 1. Sinh code duy nhất nếu chưa có
            if (blank($p->code)) {
                $date   = Carbon::now()->format('dmy');            // 010725
                $prefix = $p->category()->value('prefix') ?? 'XX'; // lấy prefix category (nếu có)
                do {
                    $random = Str::upper(Str::random(5));          // K8U9B
                    $p->code = "{$date}{$prefix}{$random}";
                } while (self::where('code', $p->code)->exists());
            }

            // 2. Gán người tạo nếu quên truyền
            $p->created_by = $p->created_by ?? auth()->id();
        });
        static::saving(function ($product) {
        if ($product->quantity == 0) {
            $product->status = 'out_of_stock';
        } elseif ($product->quantity < $product->min_stock) {
            $product->status = 'active';        // nhưng sẽ cảnh báo low‑stock
        }
    });
    }
    public function calculateTotals(array $rawItems, float $shippingFee = 0): array
    {
        $subtotal = 0;
        $itemData = [];

        foreach ($rawItems as $item) {
            $product = Product::findOrFail($item['product_id']);

            $quantity   = $item['quantity'];
            $unitPrice  = $product->price;
            $lineTotal  = $unitPrice * $quantity;

            $itemData[] = [
                'product_id'   => $product->id,
                'product_name' => $product->name,
                'quantity'     => $quantity,
                'price'        => $unitPrice,
                'line_total'   => $lineTotal,
            ];

            $subtotal += $lineTotal;
        }

        $tax   = round($subtotal * 0.08, 2); // 8% VAT
        $total = $subtotal + $tax + $shippingFee;

        return [$subtotal, $tax, $total, $itemData];
    }
}
