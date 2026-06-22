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

try {
    if ($method === 'GET') {
        $token = require_token('reports:read');
        switch ($path_info) {
            case 'summary': report_summary(); break;
            case 'by-month': report_by_month(); break;
            case 'by-category': report_by_category(); break;
            case 'cash-position': report_cash_position(); break;
            default: json_error('Report not found. Use: summary | by-month | by-category | cash-position', 404);
        }
    } elseif ($method === 'POST') {
        // Ghi thiết lập (số dư đầu kỳ) — cần quyền ghi
        $token = require_token('entries:write');
        if ($path_info === 'cash-opening') set_cash_opening();
        else json_error('Unknown report action. Use POST cash-opening', 404);
    } else {
        json_error('Method not allowed', 405);
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

// Tình hình tiền: số dư đầu kỳ (app_settings) + dòng tiền vào/ra theo hình thức thanh toán
function report_cash_position(): void {
    $opening_cash = (float)(get_setting('opening_cash') ?? 0);
    $opening_bank = (float)(get_setting('opening_bank') ?? 0);
    $as_of = get_setting('opening_as_of'); // YYYY-MM-DD hoặc null

    $sql = "SELECT entry_type, COALESCE(payment_method, 'unclassified') AS pm,
                   COALESCE(SUM(amount), 0) AS total
            FROM accounting_entries
            WHERE entry_type IN ('income','expense')";
    $params = [];
    if ($as_of) { $sql .= " AND entry_date >= ?"; $params[] = $as_of; }
    $sql .= " GROUP BY entry_type, pm";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $f = [];
    foreach (['cash','bank','ewallet','other','unclassified'] as $k) $f[$k] = ['income' => 0.0, 'expense' => 0.0];
    foreach ($stmt->fetchAll() as $r) {
        $pm = $r['pm'];
        if (!isset($f[$pm])) $pm = 'other';
        $f[$pm][$r['entry_type']] = (float)$r['total'];
    }

    $cash    = $opening_cash + $f['cash']['income']    - $f['cash']['expense'];
    $bank    = $opening_bank + $f['bank']['income']    - $f['bank']['expense'];
    $ewallet =                 $f['ewallet']['income'] - $f['ewallet']['expense'];
    $other   =                 $f['other']['income']   - $f['other']['expense'];

    json_response([
        'ok' => true,
        'opening' => ['cash' => $opening_cash, 'bank' => $opening_bank, 'as_of' => $as_of],
        'flows' => $f,
        'balances' => [
            'cash' => $cash, 'bank' => $bank, 'ewallet' => $ewallet, 'other' => $other,
            'total' => $cash + $bank + $ewallet + $other,
        ],
        'unclassified' => $f['unclassified'],
    ]);
}

// Đặt số dư đầu kỳ tiền mặt / ngân hàng (và mốc ngày bắt đầu cộng dồn dòng tiền)
function set_cash_opening(): void {
    $data = read_json_body();
    if (array_key_exists('cash', $data)) set_setting('opening_cash', (string)validate_amount($data['cash']));
    if (array_key_exists('bank', $data)) set_setting('opening_bank', (string)validate_amount($data['bank']));
    if (!empty($data['as_of'])) set_setting('opening_as_of', validate_date($data['as_of']));
    json_response(['ok' => true, 'message' => 'Opening balances saved', 'opening' => [
        'cash' => (float)(get_setting('opening_cash') ?? 0),
        'bank' => (float)(get_setting('opening_bank') ?? 0),
        'as_of' => get_setting('opening_as_of'),
    ]]);
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
