<?php

// autoload_static.php @generated by Composer

namespace Composer\Autoload;

class ComposerStaticInit30d0bd7c2ba08c78c2d827dc63f47a12
{
    public static $prefixLengthsPsr4 = array (
        'E' => 
        array (
            'Extendify\\' => 10,
        ),
    );

    public static $prefixDirsPsr4 = array (
        'Extendify\\' => 
        array (
            0 => __DIR__ . '/../..' . '/app',
        ),
    );

    public static function getInitializer(ClassLoader $loader)
    {
        return \Closure::bind(function () use ($loader) {
            $loader->prefixLengthsPsr4 = ComposerStaticInit30d0bd7c2ba08c78c2d827dc63f47a12::$prefixLengthsPsr4;
            $loader->prefixDirsPsr4 = ComposerStaticInit30d0bd7c2ba08c78c2d827dc63f47a12::$prefixDirsPsr4;

        }, null, ClassLoader::class);
    }
}
