<?php
/**
 * /api/v1/reports.php  - báo cáo tổng hợp
 * GET /api/v1/reports/summary?from=&to=  → P&L tóm tắt
 * GET /api/v1/reports/by-month?year=2026 → chi/thu theo tháng
 * GET /api/v1/reports/by-category?type=expense → phân tích danh mục
 */
require_once __DIR__ . '/../helpers.php';
set_cors();

$method = $_SERVER['REQUEST_METHOD'];
$path_info = trim($_SERVER['PATH_INFO'] ?? '', '/');
if ($method !== 'GET') json_error('Method not allowed', 405);

$token = require_token('reports:read');

try {
    switch ($path_info) {
        case 'summary': report_summary(); break;
        case 'by-month': report_by_month(); break;
        case 'by-category': report_by_category(); break;
        default: json_error('Report not found. Use: summary | by-month | by-category', 404);
    }
} catch (Throwable $e) {
    json_error('Server error: ' . $e->getMessage(), 500);
}

function report_summary(): void {
    $from = !empty($_GET['from']) ? validate_date($_GET['from']) : date('Y-01-01');
    $to   = !empty($_GET['to'])   ? validate_date($_GET['to'])   : date('Y-m-d');

    $stmt = db()->prepare("SELECT entry_type, COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
        FROM accounting_entries
        WHERE entry_date BETWEEN ? AND ?
        GROUP BY entry_type");
    $stmt->execute([$from, $to]);
    $by_type = [];
    foreach ($stmt->fetchAll() as $r) {
        $by_type[$r['entry_type']] = ['total' => (float)$r['total'], 'count' => (int)$r['count']];
    }
    $income = $by_type['income']['total'] ?? 0;
    $expense = $by_type['expense']['total'] ?? 0;
    json_response([
        'ok' => true,
        'period' => ['from' => $from, 'to' => $to],
        'income' => $income,
        'expense' => $expense,
        'net_profit' => $income - $expense,
        'by_type' => $by_type,
    ]);
}

function report_by_month(): void {
    $year = (int)($_GET['year'] ?? date('Y'));
    $stmt = db()->prepare("SELECT
        MONTH(entry_date) AS month,
        entry_type,
        COALESCE(SUM(amount),0) AS total
        FROM accounting_entries
        WHERE YEAR(entry_date) = ?
        AND entry_type IN ('income','expense')
        GROUP BY MONTH(entry_date), entry_type
        ORDER BY month ASC");
    $stmt->execute([$year]);
    $months = [];
    for ($m = 1; $m <= 12; $m++) {
        $months[$m] = ['month' => $m, 'income' => 0, 'expense' => 0, 'net' => 0];
    }
    foreach ($stmt->fetchAll() as $r) {
        $months[(int)$r['month']][$r['entry_type']] = (float)$r['total'];
    }
    foreach ($months as &$m) {
        $m['net'] = $m['income'] - $m['expense'];
    }
    json_response(['ok' => true, 'year' => $year, 'months' => array_values($months)]);
}

function report_by_category(): void {
    $type = $_GET['type'] ?? 'expense';
    $from = !empty($_GET['from']) ? validate_date($_GET['from']) : date('Y-01-01');
    $to   = !empty($_GET['to'])   ? validate_date($_GET['to'])   : date('Y-m-d');

    $stmt = db()->prepare("SELECT
        COALESCE(category, '(chưa phân loại)') AS category,
        COALESCE(SUM(amount),0) AS total,
        COUNT(*) AS count
        FROM accounting_entries
        WHERE entry_type = ? AND entry_date BETWEEN ? AND ?
        GROUP BY category
        ORDER BY total DESC");
    $stmt->execute([$type, $from, $to]);
    $rows = $stmt->fetchAll();
    $grand_total = 0;
    foreach ($rows as $r) $grand_total += (float)$r['total'];
    foreach ($rows as &$r) {
        $r['total'] = (float)$r['total'];
        $r['count'] = (int)$r['count'];
        $r['percentage'] = $grand_total > 0 ? round($r['total'] / $grand_total * 100, 2) : 0;
    }
    json_response([
        'ok' => true,
        'type' => $type,
        'period' => ['from' => $from, 'to' => $to],
        'grand_total' => $grand_total,
        'categories' => $rows,
    ]);
}
