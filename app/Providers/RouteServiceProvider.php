<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Định nghĩa route cho API
        Route::middleware('api')
            ->prefix('api')
            ->group(base_path('routes/api.php'));

        // Định nghĩa route cho web
        Route::middleware('web')
            ->group(base_path('routes/web.php'));
    }
}
