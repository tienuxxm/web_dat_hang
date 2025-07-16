<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;         
use App\Http\Controllers\ExportController;

/* ---------- PUBLIC ---------- */
Route::post('register', [AuthController::class, 'register']);
Route::post('login',    [AuthController::class, 'login']);
Route::get('me',       [AuthController::class, 'me']);
Route::get('roles',      [RoleController::class,     'role']);
Route::get('departments',[DepartmentController::class,'department']);

/* ---------- PROTECTED (JWT) ---------- */
Route::middleware('auth:api')->group(function () {

    /* Auth */
    Route::post('logout', [AuthController::class, 'logout']);

    /* Reports */
    Route::apiResource('reports', ReportController::class); // tự sinh index, store, show, update, destroy

    /* Categories */
    Route::apiResource('categories', CategoryController::class)->only(['index','store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::get('/categories/{id}', [CategoryController::class, 'show']);


    /* Products */
    Route::get('products',  [ProductController::class, 'index']);
    Route::post('products', [ProductController::class, 'store']);
    Route::put('products/{id}',          [ProductController::class, 'update']);
    Route::put('products/{id}/status',   [ProductController::class, 'updateStatus']);

    /* Orders */
    Route::prefix('orders')->controller(OrderController::class)->group(function () {
    Route::get('merged-by-month', 'mergedByMonth'); // Đưa trước
    Route::patch('merge',         'combine');       // Đưa trước

    Route::get('/',        'index');   
    Route::post('/',       'store');
    Route::match(['put', 'patch'], '{order}', 'update');
    Route::delete('{order}','destroy');
    Route::get('{order}',  'show'); 
});
    Route::post('/export-merged-orders-multi-months', [ExportController::class, 'exportMergedOrdersMultipleMonths']);


       
});
