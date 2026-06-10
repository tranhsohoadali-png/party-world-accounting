-- ============================================================
-- PARTY WORLD ACCOUNTING - SCHEMA MỞ RỘNG CHO SỔ KẾ TOÁN FULL
-- ============================================================
-- Áp dụng vào MariaDB hiện tại trên VPS Hostinger (72.62.76.78)
-- DB: party_world (hoặc tên DB Party World đang dùng)
-- ============================================================

-- Đảm bảo UTF8MB4 cho tiếng Việt có dấu
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- 1. BẢNG ENTRIES UNIVERSAL (chi/thu/công nợ)
-- ============================================================
CREATE TABLE IF NOT EXISTS `accounting_entries` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `entry_type` ENUM('expense','income','receivable','payable','inventory_in','inventory_out') NOT NULL,
  `entry_date` DATE NOT NULL,
  `description` TEXT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'VND',
  `category` VARCHAR(100) DEFAULT NULL COMMENT 'Danh mục: NVL, Lương, Thuế, Vận chuyển...',
  `counterparty_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'FK đến counterparties (nếu có)',
  `inventory_item_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'FK đến inventory_items (cho inventory_in/out)',
  `quantity` DECIMAL(15,3) DEFAULT NULL COMMENT 'Số lượng (cho tồn kho)',
  `data` JSON DEFAULT NULL COMMENT 'Trường mở rộng: mã HĐ, ảnh, ghi chú...',
  `dedup_hash` VARCHAR(64) NOT NULL UNIQUE COMMENT 'SHA256 chống trùng',
  `source` VARCHAR(20) NOT NULL DEFAULT 'manual' COMMENT 'manual | mcp | import | api',
  `created_by` VARCHAR(100) DEFAULT NULL COMMENT 'Tên user hoặc API token name',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type_date` (`entry_type`, `entry_date` DESC),
  INDEX `idx_counterparty` (`counterparty_id`),
  INDEX `idx_inventory_item` (`inventory_item_id`),
  INDEX `idx_source` (`source`),
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sổ cái universal: chi, thu, công nợ, tồn kho';

-- ============================================================
-- 2. BẢNG ITEMS TỒN KHO
-- ============================================================
CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã tranh hoặc mã NVL: BVB.11, BXC.9, canvas-kansai-100m...',
  `name` VARCHAR(255) NOT NULL,
  `unit` VARCHAR(20) DEFAULT 'cái' COMMENT 'cái, kg, m, lít, bộ, vỉ...',
  `category` VARCHAR(100) DEFAULT NULL COMMENT 'Thành phẩm, NVL, Phụ liệu, Khung, Vải...',
  `current_qty` DECIMAL(15,3) NOT NULL DEFAULT 0 COMMENT 'Tồn kho hiện tại (tự cập nhật)',
  `cost_per_unit` DECIMAL(15,2) DEFAULT NULL COMMENT 'Giá vốn trung bình',
  `data` JSON DEFAULT NULL COMMENT 'Mô tả, kích thước, ảnh, ngưỡng cảnh báo...',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Danh mục item tồn kho (tranh + NVL)';

-- ============================================================
-- 3. BẢNG ĐỐI TÁC (NCC + KH)
-- ============================================================
CREATE TABLE IF NOT EXISTS `counterparties` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `type` ENUM('supplier','customer','both') NOT NULL DEFAULT 'supplier',
  `name` VARCHAR(255) NOT NULL,
  `short_name` VARCHAR(100) DEFAULT NULL COMMENT 'Tên ngắn để gợi ý nhanh',
  `tax_code` VARCHAR(20) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `bank_account` VARCHAR(50) DEFAULT NULL,
  `bank_name` VARCHAR(100) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `current_balance` DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Số dư công nợ: dương=KH nợ ta, âm=ta nợ NCC',
  `data` JSON DEFAULT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_name` (`name`),
  INDEX `idx_type` (`type`),
  INDEX `idx_short_name` (`short_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nhà cung cấp và khách hàng (chung 1 bảng)';

-- ============================================================
-- 4. BẢNG API TOKEN (cho MCP authentication)
-- ============================================================
CREATE TABLE IF NOT EXISTS `api_tokens` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `token` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Token random 32 byte hex',
  `name` VARCHAR(100) NOT NULL COMMENT 'Tên ví dụ: claude-mcp-prod',
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'entries:write,entries:read,inventory:write,inventory:read'
    COMMENT 'CSV của scope: entries:write, entries:read, inventory:write, inventory:read, reports:read',
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `last_used_ip` VARCHAR(45) DEFAULT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `expires_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = không hết hạn',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='API token cho MCP và tích hợp ngoài';

-- ============================================================
-- 5. BẢNG AUDIT LOG (theo dõi mọi thay đổi qua API)
-- ============================================================
CREATE TABLE IF NOT EXISTS `api_audit_log` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `token_id` INT UNSIGNED DEFAULT NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `method` VARCHAR(10) NOT NULL,
  `ip` VARCHAR(45) DEFAULT NULL,
  `request_body` JSON DEFAULT NULL,
  `response_code` INT DEFAULT NULL,
  `affected_id` BIGINT UNSIGNED DEFAULT NULL,
  `error` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_token` (`token_id`),
  INDEX `idx_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log mọi request qua API để audit';

-- ============================================================
-- TRIGGER: Tự động cập nhật tồn kho khi có inventory_in/out
-- ============================================================
DELIMITER $$

DROP TRIGGER IF EXISTS `trg_entries_after_insert_inventory`$$
CREATE TRIGGER `trg_entries_after_insert_inventory`
AFTER INSERT ON `accounting_entries`
FOR EACH ROW
BEGIN
  IF NEW.entry_type = 'inventory_in' AND NEW.inventory_item_id IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    UPDATE `inventory_items`
    SET `current_qty` = `current_qty` + NEW.quantity
    WHERE `id` = NEW.inventory_item_id;
  ELSEIF NEW.entry_type = 'inventory_out' AND NEW.inventory_item_id IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    UPDATE `inventory_items`
    SET `current_qty` = `current_qty` - NEW.quantity
    WHERE `id` = NEW.inventory_item_id;
  END IF;

  -- Cập nhật công nợ
  IF NEW.entry_type = 'receivable' AND NEW.counterparty_id IS NOT NULL THEN
    UPDATE `counterparties`
    SET `current_balance` = `current_balance` + NEW.amount
    WHERE `id` = NEW.counterparty_id;
  ELSEIF NEW.entry_type = 'payable' AND NEW.counterparty_id IS NOT NULL THEN
    UPDATE `counterparties`
    SET `current_balance` = `current_balance` - NEW.amount
    WHERE `id` = NEW.counterparty_id;
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- DỮ LIỆU MẪU: danh mục chi phí mặc định
-- ============================================================
-- (categories được lưu trực tiếp ở cột category, không cần bảng riêng để đơn giản)

-- Tạo 1 API token mặc định cho Claude MCP
-- LƯU Ý: thay token này bằng giá trị random thực khi cài (xem install.sh)
INSERT IGNORE INTO `api_tokens` (`token`, `name`, `scopes`, `is_active`)
VALUES (
  'REPLACE_WITH_REAL_TOKEN_FROM_INSTALL_SCRIPT',
  'claude-mcp-default',
  'entries:write,entries:read,inventory:write,inventory:read,counterparties:write,counterparties:read,reports:read',
  TRUE
);
