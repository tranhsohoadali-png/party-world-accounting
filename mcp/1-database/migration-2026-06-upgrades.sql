-- ============================================================
-- MIGRATION 2026-06: Nâng cấp MCP sổ kế toán DALI
--   1) payment_method (tiền mặt / chuyển khoản) cho income/expense
--   2) app_settings (lưu số dư đầu kỳ tiền mặt / ngân hàng cho get_cash_position)
-- An toàn chạy lại nhiều lần (IF NOT EXISTS — MariaDB 10.0.2+).
-- Áp dụng:  mysql -u <user> -p <db> < migration-2026-06-upgrades.sql
-- ============================================================
SET NAMES utf8mb4;

-- 1) Hình thức thanh toán -> phân biệt tiền mặt vs ngân hàng để tính cash position
ALTER TABLE `accounting_entries`
  ADD COLUMN IF NOT EXISTS `payment_method`
    ENUM('cash','bank','ewallet','other') NULL DEFAULT NULL
    COMMENT 'cash=tiền mặt, bank=chuyển khoản/ngân hàng, ewallet=ví, other=khác'
    AFTER `currency`;

ALTER TABLE `accounting_entries`
  ADD INDEX IF NOT EXISTS `idx_paymethod` (`payment_method`);

-- 2) Bảng cấu hình key-value (số dư đầu kỳ, các thiết lập khác)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `skey` VARCHAR(64) PRIMARY KEY,
  `svalue` TEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cấu hình chung: opening_cash, opening_bank, opening_as_of...';
