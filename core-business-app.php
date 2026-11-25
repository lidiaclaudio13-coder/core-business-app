<?php
/**
 * Plugin Name:       Core Business App
 * Description:       Ecosistema modulare white-label con Web App PWA multi-ruolo per WordPress.
 * Version:           3.1.1
 * Requires at least: 6.4
 * Requires PHP:      8.2
 * Author:            Core Architecture
 * Text Domain:       core-business-app
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('CBA_VERSION', '3.3.0');
define('CBA_DB_VERSION', '1.7.0');
define('CBA_FILE', __FILE__);
define('CBA_PATH', plugin_dir_path(__FILE__));
define('CBA_URL', plugin_dir_url(__FILE__));

require_once CBA_PATH . 'src/Core/Autoloader.php';

$cbaAutoloader = new \CoreBusinessApp\Core\Autoloader('CoreBusinessApp\\', CBA_PATH . 'src/');
$cbaAutoloader->register();

use CoreBusinessApp\Core\BootstrapEndpoint;
use CoreBusinessApp\Core\Database;
use CoreBusinessApp\Core\Pwa;
use CoreBusinessApp\Core\Roles;
use CoreBusinessApp\Core\Router;
use CoreBusinessApp\Modules\Auth\AuthController;
use CoreBusinessApp\Modules\Booking\BookingController;
use CoreBusinessApp\Modules\Booking\DashboardController;
use CoreBusinessApp\Modules\Catalog\CatalogController;
use CoreBusinessApp\Modules\Staff\StaffController;

register_activation_hook(CBA_FILE, static function (): void {
    Database::migrate();
    Roles::register();
    Pwa::seedDefaultBrandConfig();
    Router::addRewriteRules();
    flush_rewrite_rules();
});

register_deactivation_hook(CBA_FILE, static function (): void {
    wp_clear_scheduled_hook('cba_hourly_reminders');
    flush_rewrite_rules();
});

add_action('plugins_loaded', static function (): void {
    Database::maybeMigrate();
    Roles::init();
    Router::init();
    BootstrapEndpoint::init();
    AuthController::init();
    CatalogController::init();
    DashboardController::init();

    if (class_exists(BookingController::class)) {
        BookingController::init();
    }

    if (class_exists(StaffController::class)) {
        StaffController::init();
    }

    if (class_exists(\CoreBusinessApp\Modules\Clients\ClientsController::class)) {
        \CoreBusinessApp\Modules\Clients\ClientsController::init();
    }

    if (class_exists(\CoreBusinessApp\Modules\Notifications\WhatsAppService::class)) {
        \CoreBusinessApp\Modules\Notifications\WhatsAppService::init();
    }

    if (class_exists(\CoreBusinessApp\Modules\Notifications\WebPushService::class)) {
        \CoreBusinessApp\Modules\Notifications\WebPushService::init();
    }

    if (class_exists(\CoreBusinessApp\Modules\Notifications\PushController::class)) {
        \CoreBusinessApp\Modules\Notifications\PushController::init();
    }

    if (class_exists(\CoreBusinessApp\Modules\Marketing\MarketingService::class)) {
        \CoreBusinessApp\Modules\Marketing\MarketingService::init();
    }
});
