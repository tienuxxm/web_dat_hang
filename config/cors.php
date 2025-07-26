<?php
return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [*], // ✅ Thay bằng domain Netlify

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
