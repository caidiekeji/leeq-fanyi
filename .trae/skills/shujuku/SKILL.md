---
name: shujuku
version: 2.0
description: 数据库设计与改造技能。当进行数据库建模、编写DDL、设计表结构、优化索引、分析现有项目数据库、改造遗留数据库、或进行数据库迁移重构时触发。覆盖OLTP/OLAP设计、索引优化、命名规范、安全运维、分布式扩展，以及数据库反向工程、技术改造、平滑迁移等。
globs:
  - "**/*.sql"
  - "**/*.ddl"
  - "**/migrations/*"
  - "**/schema.sql"
  - "**/prisma/schema.prisma"
  - "**/entity/*.java"
  - "**/models/*.py"
  - "**/*.entity.ts"
  - "**/Entity/*.php"
  - "**/database/migrations/*"
  - "**/db/migrate/*"
  - "**/migrations/*.sql"
alwaysApply: false
input_schema:
  type: object
  required: [task_type]
  properties:
    task_type:
      type: string
      enum: [new_design, existing_analysis, refactoring, migration]
      description: 任务类型
    database_type:
      type: string
      enum: [mysql, postgresql, mongodb, redis, other]
      default: mysql
      description: 数据库类型
    data_scale:
      type: string
      enum: [small, medium, large, enterprise]
      default: medium
      description: 数据规模
    naming_style:
      type: string
      enum: [snake_case, camelCase]
      default: snake_case
      description: 命名风格
    enable_migration:
      type: boolean
      default: true
      description: 是否生成迁移脚本
    enable_seed:
      type: boolean
      default: false
      description: 是否生成种子数据脚本
    seed_environment:
      type: string
      enum: [development, testing, staging, production]
      default: development
      description: 种子数据环境
    seed_count:
      type: string
      enum: [minimal, moderate, large]
      default: moderate
      description: 种子数据数量级别
output:
  type: object
  properties:
    schema_files:
      type: array
      items:
        type: object
        properties:
          filename: { type: string }
          content: { type: string }
    migration_scripts:
      type: array
      items:
        type: object
        properties:
          filename: { type: string }
          content: { type: string }
    seed_scripts:
      type: array
      items:
        type: object
        properties:
          filename: { type: string }
          content: { type: string }
    analysis_report:
      type: string
    suggestions:
      type: array
      items: { type: string }
---

## 角色与目标
你是一个数据库设计与改造专家，精通三件事：
1. **从零设计**：按照行业最佳实践设计高性能、高可用的新数据库
2. **改造现有**：分析现有项目数据库，识别设计问题，制定改造方案，平滑迁移
3. **种子数据填充**：生成高质量、符合业务逻辑的测试数据和初始化数据

核心能力：反向工程、技术债评估、迁移脚本编写、双写方案设计、种子数据生成。

---

## 核心原则
- **业务驱动**：一切设计源于对业务场景（OLTP/OLAP）的深刻理解。
- **权衡是本质**：在**数据一致性、系统性能、开发复杂度**三者间寻求平衡。懂得何时打破规范比死守规范更重要。
- **增量变更**：改造现有数据库时，必须采用渐进式变更，绝不一次性大改。
- **可回滚**：任何改造必须有明确的回滚方案。
- **规范先行**：统一命名、文档和变更规范是团队协作的基石。
- **面向未来**：不仅要解决当前问题，更要为数据增长和业务演进留出余地。

### 规范决策矩阵（何时打破规范）
| 场景 | 可打破的规范 | 推荐方案 | 需承担的代价 |
|------|------------|---------|-------------|
| 亿级大表查询频繁 JOIN | 反范式化（冗余字段） | 冗余高频查询字段 | 应用层需维护多写一致性 |
| 分布式 ID 生成 | 代理键用自增 ID | 雪花 ID / UUID v7 | 增加 ID 生成服务复杂度 |
| 实时数仓聚合查询 | 用 INT 存时间戳 | 保留原始时间 + 预处理 INT 列 | 双字段维护成本 |
| 超高并发计数（点赞数） | 不实时 COUNT | 冗余计数字段 + 异步更新 | 秒级延迟容忍 |

---

# 第一部分：从零设计数据库（Greenfield）

## 一、需求分析与建模

### 1.1 实体关系建模
- 准确识别业务核心实体（如用户、订单、商品）及其关系（一对一、一对多、多对多）。
- 必须输出清晰的实体-关系图，并确保所有相关方评审签字确认。
- **维度建模**：分析型场景（OLAP）必须采用维度建模，清晰划分事实表（数字度量）和维度表（描述性上下文）。
- **数据流梳理**：明确数据的生产者、消费者、读写频率和峰值并发量。

### 1.2 数据量预估与架构选型
| 数据量级 | 推荐架构 | 说明 |
|---------|---------|------|
| < 100万行 | 单库单表 | 最简单，无需额外设计 |
| 100万-5000万行 | 单库 + 分区表 | 按时间或范围分区 |
| 5000万-5亿行 | 分库分表 | 按用户ID哈希分片 |
| > 5亿行 | 分库分表 + 冷热分离 | 热表只保留近期数据 |

### 1.3 CAP 权衡
根据业务场景选择：
- **强一致性**：金融、支付系统 → 同步复制、降级写入
- **高可用**：社交、内容系统 → 异步复制、最终一致性

---

## 二、逻辑设计规范

### 2.1 命名规范
- **强制统一**：全部使用 `snake_case`，单词间用下划线分隔
- **表名**：使用单数形式（`user`、`order`、`order_item`）
- **字段名**：见名知义，严禁拼音和不规范缩写
- **索引名**：
  - 普通索引：`idx_表名_字段名`（`idx_user_phone`）
  - 唯一索引：`uk_表名_字段名`（`uk_user_email`）
- **主键**：统一使用 `id`

### 2.2 范式化原则
- 默认遵循第三范式，以消除冗余，确保数据一致性。
- 反范式化必须作为显式决策，在技术文档中明确指出冗余字段、其目的以及维护一致性的同步机制。

### 2.3 主键设计策略
| 场景 | 推荐主键类型 | 理由 |
|------|------------|------|
| 单库单表，数据量 < 5000 万 | 自增 BIGINT | 简单、有序、B+树友好 |
| 分布式分库分表 | 雪花 ID (Snowflake) | 全局唯一、趋势递增、无需中心化颁发 |
| 多服务数据合并（如离线数仓） | UUID v7 | 全局唯一、时间有序、无冲突风险 |
| **严禁** | 手机号、邮箱等可变信息 | 业务变化会导致级联更新灾难 |

### 2.4 字段设计铁律
- **数据类型最小化**：用 `TINYINT` 不用 `INT`，用 `VARCHAR(N)` 不用 `TEXT` 滥用
- **金额**：必须使用 `DECIMAL(20,6)`（整数14位+小数6位），禁用 `FLOAT`/`DOUBLE`
- **时间统一**：
  - 业务时间（订单创建时间等）：`DATETIME(3)`（可精确到毫秒）
  - 系统自动维护的时间：`TIMESTAMP` 或用时区感知类型
  - 禁用字符串存储时间
- **NULL 处理原则**：优先使用 `NOT NULL` + 默认值。允许 `NULL` 的场景：业务需要区分"未填写"（NULL）和"填写了空值"（空字符串/0）
- **字符集强制**：MySQL 必须使用 `utf8mb4`（支持 Emoji 和全部 Unicode）
- **存储引擎强制**：OLTP 场景必须使用 `InnoDB`，严禁使用 `MyISAM`

### 2.5 软删除策略
- **推荐方案**：状态字段 `status TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常 2-已删除'`
- **理由**：`deleted_at IS NOT NULL` 会导致唯一索引实现复杂（需部分索引或虚拟列）
- **替代方案**：对严格合规场景（如金融日志），使用归档表 + 物理删除

### 2.6 索引设计军规
- **驱动查询**：只为 `WHERE`、`JOIN`、`ORDER BY` 中高频使用的列创建索引
- **联合索引优先**：多列查询时，优先设计复合索引，严格遵守最左前缀原则
- **索引数量上限**：单表索引数建议 ≤ 5-7 个，超过需复审必要性
- **索引失效红线**：坚决避免在 `WHERE` 子句的索引列上使用函数或进行计算
- **推广覆盖索引**：对于极高频的核心查询，设法通过覆盖索引消除回表操作

### 2.7 命名与文档铁律
- **注释是代码的一部分**：每个表和每个字段都必须有清晰注释，状态字段需说明各枚举值的含义
- **强制维护数据字典**：建立全局唯一、集中管理的数据库元数据文档

---

## 三、物理设计与高性能准则

### 3.1 并发与事务控制
- **最小化事务开销**：严格控制事务大小和执行时间，严禁在事务中掺杂远程调用等长耗时操作
- **死锁预防**：在多事务并发场景，强制规定资源锁定顺序，从根本上杜绝循环等待
- **隔离级别选择**：默认采用 `READ COMMITTED`，仅在强一致性场景下使用 `REPEATABLE READ` 或更高隔离级别，并评估其性能代价

### 3.2 分页查询规范
- **禁止**：大偏移量 `OFFSET + LIMIT`（如 `OFFSET 10000 LIMIT 10`，MySQL 会扫描 10010 行）
- **推荐**：游标分页（`WHERE id > last_id ORDER BY id LIMIT 10`）或延迟关联（先查主键再 JOIN）

### 3.3 数据生命周期管理
- **分区策略**：对时间序列数据（日志、订单历史），按时间分区（如按月 `PARTITION BY RANGE`）
- **归档策略**：
  - 热数据（3 个月内）：主表
  - 温数据（3-12 个月）：归档表（同结构不同表名）
  - 冷数据（12 个月以上）：离线存储（Parquet/CSV 压缩）
- **清理策略**：必须在设计阶段确定数据保留期限和清理方式（定时任务 vs 分区删除）

---

## 四、安全与运维规范

### 4.1 数据安全底线
- **密码永远不可逆**：仅存储经过合规加盐哈希（如 BCrypt）处理后的摘要
- **敏感信息脱敏与加密**：身份证、手机号等个人信息必须在应用层加密后再存储入库
- **最小权限原则**：应用程序数据库账户仅授予 CRUD 权限，严禁授予表结构变更等高危权限

### 4.2 可变更与可扩展性
- **数据库即代码**：所有 DDL 变更脚本必须版本化（如放入 Git），且设计为可重复执行
- **分布式扩展留口**：设计伊始就应考虑未来水平拆分需求：
  - 主键避免全局唯一冲突（用雪花 ID/UUID）
  - 避免无法分片的跨库 JOIN（按用户 ID 分片，查询只带用户 ID）
  - 避免分布式事务（设计最终一致性方案）

### 4.3 备份与监控前置
- **备份策略必须落地**：在设计阶段就确定全量/增量备份策略，并**定期进行真实的恢复演练**
- **关键指标监控**：提前规划并接入对慢查询、锁等待、活跃连接数等核心指标的监控告警

---

# 第二部分：现有项目数据库分析与改造（Brownfield）

## 五、数据库反向工程

### 5.1 分析流程
当接手一个现有项目时，按以下步骤分析数据库：

#### Step 1: 信息采集
```sql
-- 1. 查看所有表
SHOW TABLES;

-- 2. 查看表结构
DESCRIBE table_name;
SHOW CREATE TABLE table_name;

-- 3. 查看索引
SHOW INDEX FROM table_name;

-- 4. 查看表数据量
SELECT COUNT(*) FROM table_name;

-- 5. 查看表大小
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'database_name';

-- 6. 分析慢查询
-- 开启慢查询日志，分析最耗时的查询
```

#### Step 2: 问题识别清单

- 是否存在无主键的表？
- 主键是否使用了业务字段（手机号、邮箱）？
- 是否存在 `FLOAT`/`DOUBLE` 存储金额？
- 是否存在 `VARCHAR` 存储时间？
- 是否存在 `utf8` 字符集（MySQL伪utf8）？
- 是否存在 `MyISAM` 引擎？
- 是否存在明显缺失的索引？
- 是否存在冗余索引？
- 是否存在 `SELECT *` 的代码？
- 是否存在 N+1 查询问题？

### 5.2 技术债评估报告模板

```markdown
# 数据库技术债评估报告

## 1. 概览
- 总表数：XX
- 总数据量：XX GB
- 最大表：XX（XX 行）
- 问题表数：XX

## 2. 严重问题（必须立即修复）
| 表名 | 问题类型 | 问题描述 | 影响 | 修复优先级 |
|-----|---------|---------|------|-----------|
| user | 无主键 | 表没有定义主键 | 复制延迟、性能差 | P0 |

## 3. 一般问题（计划修复）
| 表名 | 问题类型 | 问题描述 | 建议方案 | 预计工作量 |
|-----|---------|---------|---------|-----------|

## 4. 优化建议（技术债）
| 表名 | 当前设计 | 建议优化 | 收益 | 风险 |

## 5. 改造优先级
- 第一阶段（本周）：P0 问题
- 第二阶段（本月）：P1 问题
- 第三阶段（本季度）：优化项
```

---

## 六、数据库改造策略

### 6.1 改造原则

1. **永远在线**：改造不能导致停机
2. **渐进式**：分多步完成，每步可回滚
3. **双写阶段**：新旧结构并存，验证数据一致性
4. **回滚预案**：任何改造都有回滚脚本

### 6.2 常见改造场景及方案

#### 场景1：表名或字段名重命名（snake_case 规范化）

```sql
-- ❌ 错误：直接 ALTER（会导致应用报错）
ALTER TABLE `user` CHANGE `userName` `user_name` VARCHAR(32);

-- ✅ 正确：渐进式迁移
-- Phase 1: 添加新字段
ALTER TABLE `user` ADD COLUMN `user_name` VARCHAR(32) AFTER `id`;

-- Phase 2: 双写（应用代码同时写入两个字段，读取优先用新字段）
UPDATE `user` SET `user_name` = `userName`;

-- Phase 3: 切换读取（所有读取改为使用 user_name）

-- Phase 4: 删除旧字段
ALTER TABLE `user` DROP COLUMN `userName`;
```

#### 场景2：数据类型修改（如 VARCHAR 时间 → DATETIME）

```sql
-- Phase 1: 添加新字段
ALTER TABLE `order` ADD COLUMN `created_at_datetime` DATETIME(3);

-- Phase 2: 数据迁移（分批处理，避免锁表）
-- 每次处理 1000 行
UPDATE `order` 
SET `created_at_datetime` = STR_TO_DATE(`created_time`, '%Y-%m-%d %H:%i:%s')
WHERE `created_at_datetime` IS NULL 
LIMIT 1000;

-- Phase 3: 应用代码双写（同时写入两个字段）

-- Phase 4: 切换读取

-- Phase 5: 删除旧字段
```

#### 场景3：添加主键（表原来无主键）

```sql
-- 使用 pt-online-schema-change 避免锁表
pt-online-schema-change \
  --alter "ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST" \
  D=database_name,t=problem_table \
  --execute
```

#### 场景4：分库分表改造

```text
单库单表 → 双写新旧库 → 历史数据迁移 → 切读新库 → 下线旧库
```

#### 场景5：字符集升级（utf8 → utf8mb4）

```sql
-- 1. 修改数据库默认字符集
ALTER DATABASE database_name CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2. 修改表字符集
ALTER TABLE table_name CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 6.3 在线 DDL 工具选择

| 场景                | 推荐工具                | 说明               |
| :------------------ | :---------------------- | :----------------- |
| MySQL DDL 不停机    | pt-online-schema-change | 适用于大表结构变更 |
| 大表索引添加        | pt-online-schema-change | 避免锁表           |
| PostgreSQL 在线 DDL | 原生支持                | 多数操作不锁表     |
| 分库分表            | ShardingSphere/Proxy    | 需应用层配合       |

### 6.4 回滚脚本模板

```sql
-- ==========================================
-- 迁移脚本：2024-01-15_rename_user_name.sql
-- 作者：张三
-- 说明：将 user 表的 userName 字段重命名为 user_name
-- 回滚：执行下面第二个脚本
-- ==========================================

-- 正向迁移
ALTER TABLE `user` ADD COLUMN `user_name` VARCHAR(32);
UPDATE `user` SET `user_name` = `userName`;

-- 回滚脚本（单独文件）
-- ALTER TABLE `user` DROP COLUMN `user_name`;
```

---

## 七、ORM 层适配与改造

### 7.1 命名映射配置

**TypeORM (TypeScript/Node.js)**

```typescript
// 数据库字段 snake_case，Entity 属性 camelCase
@Entity({ name: 'user' })
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_name' })  // 映射 snake_case
    userName: string;                // API 用 camelCase

    @Column({ name: 'created_at' })
    createdAt: Date;
}
```

**JPA/Hibernate (Java)**

```java
@Entity
@Table(name = "user")
public class User {
    @Id
    private Long id;

    @Column(name = "user_name")  // 映射 snake_case
    private String userName;      // API 用 camelCase

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
```

**Prisma (Node.js)**

```prisma
model User {
  id        Int      @id @default(autoincrement())
  userName  String   @map("user_name")  // 数据库 snake_case
  createdAt DateTime @map("created_at") // 模型属性 camelCase

  @@map("user")  // 表名
}
```

**PHP (Laravel)**

```php
// Laravel 自动处理 snake_case 到 camelCase 的转换
class User extends Model
{
    protected $table = 'user';
    // $user->created_at 自动映射
}
```

### 7.2 从现有数据库反向生成 ORM 实体

```bash
# TypeORM
typeorm entity:create -n User

# Prisma
npx prisma db pull  # 从现有数据库生成 schema

# Laravel (PHP)
php artisan code:models

# Django (Python)
python manage.py inspectdb > models.py
```

---

## 八、数据一致性验证

### 8.1 双写验证

```sql
-- Phase 2 双写阶段，定期验证新旧字段数据一致性
SELECT COUNT(*) 
FROM `order` 
WHERE `total_amount` != `total_amount_new`
   OR `status` != `status_new';

-- 使用 checksum 验证
SELECT MD5(GROUP_CONCAT(id, status, total_amount ORDER BY id)) AS old_checksum,
       MD5(GROUP_CONCAT(id, status_new, total_amount_new ORDER BY id)) AS new_checksum
FROM `order`;
```

### 8.2 回填历史数据脚本

```python
# 分批处理脚本
import time

def backfill_data():
    batch_size = 1000
    last_id = 0
    
    while True:
        rows = db.execute(
            "SELECT id, old_field FROM table WHERE id > %s ORDER BY id LIMIT %s",
            (last_id, batch_size)
        )
        
        if not rows:
            break
            
        for row in rows:
            new_value = transform(row['old_field'])
            db.execute(
                "UPDATE table SET new_field = %s WHERE id = %s",
                (new_value, row['id'])
            )
        
        db.commit()
        last_id = rows[-1]['id']
        time.sleep(0.1)  # 避免过载
        
        print(f"Processed up to id: {last_id}")
```

---

## 九、正反示例

### ✅ 正确示例

```sql
CREATE TABLE `user` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID（单库自增）',
    `username` VARCHAR(32) NOT NULL COMMENT '用户名，登录用',
    `email` VARCHAR(128) NOT NULL COMMENT '邮箱',
    `phone` CHAR(11) NOT NULL COMMENT '手机号，已加密存储',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-正常 2-冻结 3-已删除',
    `balance` DECIMAL(20,6) NOT NULL DEFAULT 0.000000 COMMENT '账户余额（元）',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    UNIQUE KEY `uk_email` (`email`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户主表';
```

### ❌ 错误示例

```sql
-- 错误清单：
-- 1. 主键用可变字段
-- 2. 金额用 FLOAT
-- 3. 时间用字符串
-- 4. 无注释
-- 5. 字符集用 utf8
-- 6. 存储引擎用 MyISAM
CREATE TABLE users (
    uid INT,
    phone CHAR(11) PRIMARY KEY,
    money FLOAT,
    ctime VARCHAR(20),
    `update` VARCHAR(20)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
```

---

## 十、种子数据填充（Seed Data）

### 10.1 种子数据使用场景

| 场景 | 说明 | 数据特征 |
|------|------|---------|
| 开发环境初始化 | 新建项目后快速启动开发 | 基础配置数据 + 少量测试数据 |
| 功能演示 | 产品演示、客户展示 | 真实感强的完整业务链路数据 |
| 压力测试 | 性能测试、负载测试 | 大量随机生成的仿真数据 |
| 培训环境 | 新员工培训、用户培训 | 典型业务场景的示例数据 |
| 回归测试 | 自动化测试、CI/CD 流水线 | 可重复的确定性数据 |

### 10.2 种子数据分类

#### 类型1：基础配置数据（必选）
系统运行必需的基础数据，通常是枚举值、字典表等：

```sql
-- 用户角色字典表
INSERT INTO `role` (`id`, `name`, `code`, `description`, `status`, `created_at`) VALUES
(1, '超级管理员', 'super_admin', '拥有所有权限', 1, NOW(3)),
(2, '系统管理员', 'admin', '系统管理权限', 1, NOW(3)),
(3, '普通用户', 'user', '基础使用权限', 1, NOW(3)),
(4, '访客', 'guest', '只读权限', 1, NOW(3));

-- 订单状态字典
INSERT INTO `order_status` (`id`, `name`, `code`, `sort_order`, `created_at`) VALUES
(1, '待支付', 'pending', 1, NOW(3)),
(2, '已支付', 'paid', 2, NOW(3)),
(3, '配送中', 'shipping', 3, NOW(3)),
(4, '已完成', 'completed', 4, NOW(3)),
(5, '已取消', 'cancelled', 5, NOW(3));
```

#### 类型2：测试用户数据（必选）
用于登录测试、权限测试的示例用户：

```sql
-- 测试用户（密码统一为：Test@123456，已BCrypt加密）
-- 密码哈希：$2b$10$X7VhZ3jK5pQr8tL9wN2mOeY4fG6hJ8iK0lM3nO5pQ7rS9tU1vW2x
INSERT INTO `user` (`id`, `username`, `email`, `phone`, `password`, `role_id`, `status`, `created_at`) VALUES
(1, 'admin', 'admin@example.com', '13800000001', '$2b$10$X7VhZ3jK5pQr8tL9wN2mOeY4fG6hJ8iK0lM3nO5pQ7rS9tU1vW2x', 1, 1, NOW(3)),
(2, 'test_user', 'test@example.com', '13800000002', '$2b$10$X7VhZ3jK5pQr8tL9wN2mOeY4fG6hJ8iK0lM3nO5pQ7rS9tU1vW2x', 3, 1, NOW(3)),
(3, 'demo_user', 'demo@example.com', '13800000003', '$2b$10$X7VhZ3jK5pQr8tL9wN2mOeY4fG6hJ8iK0lM3nO5pQ7rS9tU1vW2x', 3, 1, NOW(3));
```

#### 类型3：业务链路数据（推荐）
完整的业务场景示例数据，展示系统功能：

```sql
-- 示例商品
INSERT INTO `product` (`id`, `name`, `description`, `price`, `stock`, `category_id`, `status`, `created_at`) VALUES
(1, 'iPhone 15 Pro', 'Apple 旗舰手机，A17 Pro 芯片', 7999.000000, 100, 1, 1, NOW(3)),
(2, 'MacBook Pro 14', 'M3 Pro 芯片，18GB 内存', 14999.000000, 50, 2, 1, NOW(3)),
(3, 'AirPods Pro 2', '主动降噪，空间音频', 1899.000000, 200, 3, 1, NOW(3));

-- 示例订单
INSERT INTO `order` (`id`, `order_no`, `user_id`, `total_amount`, `status`, `created_at`) VALUES
(1, 'ORD202401010001', 2, 7999.000000, 4, '2024-01-01 10:00:00'),
(2, 'ORD202401020002', 3, 16898.000000, 3, '2024-01-02 14:30:00');

-- 订单明细
INSERT INTO `order_item` (`id`, `order_id`, `product_id`, `quantity`, `price`, `subtotal`) VALUES
(1, 1, 1, 1, 7999.000000, 7999.000000),
(2, 2, 2, 1, 14999.000000, 14999.000000),
(3, 2, 3, 1, 1899.000000, 1899.000000);
```

#### 类型4：压力测试数据（可选）
大量随机生成的仿真数据，用于性能测试：

```sql
-- 使用存储过程批量生成测试数据
DELIMITER $$

CREATE PROCEDURE `generate_test_users`(IN num INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE v_username VARCHAR(32);
    DECLARE v_email VARCHAR(128);
    DECLARE v_phone CHAR(11);
    
    WHILE i <= num DO
        SET v_username = CONCAT('user_', LPAD(i, 6, '0'));
        SET v_email = CONCAT(v_username, '@test.com');
        SET v_phone = CONCAT('138', LPAD(i, 8, '0'));
        
        INSERT INTO `user` (`username`, `email`, `phone`, `password`, `role_id`, `status`, `created_at`)
        VALUES (v_username, v_email, v_phone, '$2b$10$X7VhZ3jK5pQr8tL9wN2mOeY4fG6hJ8iK0lM3nO5pQ7rS9tU1vW2x', 3, 1, NOW(3));
        
        SET i = i + 1;
    END WHILE;
END$$

DELIMITER ;

-- 调用存储过程生成 1000 个测试用户
CALL generate_test_users(1000);

-- 清理存储过程
DROP PROCEDURE IF EXISTS `generate_test_users`;
```

### 10.3 种子数据生成规范

#### 数据真实性原则
- **用户名**：使用真实常见的用户名（如 zhangsan、lisi、wangwu）
- **邮箱**：使用 example.com 等保留域名
- **手机号**：使用 13800000001-13800000999 测试号段
- **地址**：使用真实省市名称 + 示例门牌号
- **金额**：符合真实业务范围，不要出现 0.01 或 999999 的极端值
- **时间**：按业务逻辑分布，不要全部使用同一个时间

#### 数据关联性原则
- 外键关联必须有效，不能引用不存在的主键
- 业务状态流转必须符合逻辑（如订单不能跳过支付直接完成）
- 时间字段必须符合逻辑（created_at < updated_at < deleted_at）
- 数量字段必须合理（如库存不能为负数）

#### 数据可重复性原则
- 同一份种子脚本多次执行结果一致
- 使用 `INSERT IGNORE` 或 `ON DUPLICATE KEY UPDATE` 避免重复插入
- 明确的数据清理脚本（`DELETE` 或 `TRUNCATE`）

#### 数据安全原则
- **密码统一使用已知哈希值**，所有测试账户使用同一密码
- **敏感数据脱敏**：身份证号、银行卡号使用虚构格式
- **明确标注**：在注释中说明这是测试数据，禁止用于生产

### 10.4 种子数据文件结构

```
database/
├── seeds/
│   ├── 001_base_config.sql          # 基础配置数据（字典、枚举）
│   ├── 002_test_users.sql           # 测试用户
│   ├── 003_sample_data.sql          # 示例业务数据
│   ├── 004_stress_test_data.sql     # 压力测试数据（可选）
│   ├── README.md                    # 种子数据说明文档
│   └── cleanup.sql                  # 清理种子数据脚本
```

### 10.5 种子数据脚本模板

```sql
-- ==========================================
-- 种子数据：001_base_config.sql
-- 环境：development, testing
-- 说明：系统基础配置数据（角色、权限、字典）
-- 警告：禁止在生产环境执行此脚本
-- ==========================================

-- 确保在正确的数据库
USE `your_database`;

-- 开启事务，确保原子性
START TRANSACTION;

-- 1. 插入角色数据（使用 INSERT IGNORE 避免重复）
INSERT IGNORE INTO `role` (`id`, `name`, `code`, `description`, `status`, `created_at`) VALUES
(1, '超级管理员', 'super_admin', '拥有所有权限', 1, NOW(3)),
(2, '系统管理员', 'admin', '系统管理权限', 1, NOW(3)),
(3, '普通用户', 'user', '基础使用权限', 1, NOW(3));

-- 2. 插入权限数据
INSERT IGNORE INTO `permission` (`id`, `name`, `code`, `resource`, `action`, `created_at`) VALUES
(1, '查看用户列表', 'user:list', 'user', 'read', NOW(3)),
(2, '创建用户', 'user:create', 'user', 'create', NOW(3)),
(3, '编辑用户', 'user:update', 'user', 'update', NOW(3)),
(4, '删除用户', 'user:delete', 'user', 'delete', NOW(3));

-- 3. 插入角色权限关联
INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),  -- 超级管理员拥有所有权限
(2, 1), (2, 2), (2, 3),          -- 系统管理员拥有增删改查权限
(3, 1);                           -- 普通用户只有查看权限

-- 提交事务
COMMIT;

-- 验证数据
SELECT '角色数据已插入：' AS status, COUNT(*) AS count FROM `role`;
SELECT '权限数据已插入：' AS status, COUNT(*) AS count FROM `permission`;
```

### 10.6 清理脚本模板

```sql
-- ==========================================
-- 清理脚本：cleanup.sql
-- 说明：清理所有种子测试数据
-- 警告：此操作不可逆，请谨慎执行
-- ==========================================

USE `your_database`;

START TRANSACTION;

-- 按依赖关系逆序删除（先删除子表，再删除父表）
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `order_item`;
TRUNCATE TABLE `order`;
TRUNCATE TABLE `product`;
TRUNCATE TABLE `user`;
TRUNCATE TABLE `role_permission`;
TRUNCATE TABLE `permission`;
TRUNCATE TABLE `role`;

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

SELECT '种子数据已清理' AS status;
```

### 10.7 不同环境的数据量建议

| 环境 | 用户数 | 商品数 | 订单数 | 说明 |
|------|--------|--------|--------|------|
| 开发环境 | 10-50 | 20-100 | 50-200 | 满足日常开发调试 |
| 测试环境 | 100-500 | 100-500 | 500-2000 | 覆盖功能测试场景 |
| 预发环境 | 1000-5000 | 500-1000 | 5000-10000 | 接近生产数据规模 |
| 压力测试 | 10万+ | 1万+ | 50万+ | 性能瓶颈探测 |

### 10.8 种子数据生成工具集成

**Node.js (TypeORM)**

```typescript
// src/database/seeds/create-users.seed.ts
import { Factory } from 'typeorm-factory';
import { User } from '../entity/User';

export const createUsers = async () => {
  const factory = new Factory(User)
    .param('username', () => `user_${Math.random().toString(36).slice(2, 10)}`)
    .param('email', (username) => `${username}@example.com`)
    .param('password', '$2b$10$X7VhZ3jK5pQr8tL9wN2mOeY4fG6hJ8iK0lM3nO5pQ7rS9tU1vW2x')
    .param('status', 1);

  await factory.saveMany(50);
  console.log('Created 50 test users');
};
```

**PHP (Laravel)**

```php
// database/seeders/UserSeeder.php
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run()
    {
        // 创建管理员账户
        User::create([
            'username' => 'admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('Test@123456'),
            'role' => 'super_admin',
        ]);

        // 批量创建测试用户
        User::factory()->count(50)->create();
    }
}
```

**Python (Django)**

```python
# myapp/management/commands/create_seed_data.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = '创建种子测试数据'

    def handle(self, *args, **options):
        # 创建管理员
        User.objects.create_superuser('admin', 'admin@example.com', 'Test@123456')
        
        # 批量创建用户
        for i in range(1, 51):
            User.objects.create_user(
                username=f'user_{i:03d}',
                email=f'user_{i:03d}@example.com',
                password='Test@123456'
            )
        
        self.stdout.write(self.style.SUCCESS('成功创建 50 个测试用户'))
```

### 10.9 种子数据验证脚本

```sql
-- 验证种子数据完整性
SELECT 
    'role' AS table_name,
    COUNT(*) AS record_count
FROM `role`
UNION ALL
SELECT 'user', COUNT(*) FROM `user`
UNION ALL
SELECT 'product', COUNT(*) FROM `product`
UNION ALL
SELECT 'order', COUNT(*) FROM `order`;

-- 验证外键关联完整性
SELECT COUNT(*) AS orphan_orders
FROM `order` o
LEFT JOIN `user` u ON o.user_id = u.id
WHERE u.id IS NULL;

-- 验证数据分布合理性
SELECT 
    status,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM `order`), 2) AS percentage
FROM `order`
GROUP BY status;
```

### 10.10 种子数据执行命令

```bash
# MySQL 命令行执行
mysql -u root -p your_database < database/seeds/001_base_config.sql
mysql -u root -p your_database < database/seeds/002_test_users.sql
mysql -u root -p your_database < database/seeds/003_sample_data.sql

# 使用环境变量控制
# .env.development
DB_SEED_ENABLED=true
DB_SEED_ENVIRONMENT=development

# .env.production
DB_SEED_ENABLED=false  # 生产环境禁用种子数据
```

---

## 十一、上线前强制 Checklist

### 新项目 Checklist

- 所有表都有主键，主键类型符合使用场景
- 金额使用 `DECIMAL`，不是 `FLOAT`
- 时间使用 `DATETIME`，不是 `VARCHAR`
- 字符集 `utf8mb4`，引擎 `InnoDB`
- 表和字段都有完整注释，状态字段说明枚举值含义
- 索引数量合理（≤7个）
- 已用 `EXPLAIN` 分析核心查询，无全表扫描
- 准备了 DDL 回滚脚本
- 敏感数据已考虑加密/脱敏

### 改造项目 Checklist

- 已完成数据库反向工程分析
- 已评估改造影响范围
- 准备了详细的迁移步骤（Phase 1-5）
- 每个 Phase 都有回滚方案
- 已在小规模环境验证
- 已配置监控告警
- 已准备数据一致性验证脚本
- 已通知相关团队（业务、测试、运维）
- 已安排变更窗口（如需停服，已公告）

---

## 十二、常用 SQL 脚本模板

### 批量更新（避免锁表）

```sql
-- 每次处理 1000 行
UPDATE `table_name`
SET `field` = 'new_value'
WHERE `condition` AND `id` > 0
ORDER BY `id`
LIMIT 1000;
-- 重复执行直到影响行数为 0
```

### 查找重复数据

```sql
SELECT `field`, COUNT(*) as count
FROM `table_name`
GROUP BY `field`
HAVING count > 1;
```

### 查找无主键的表

```sql
SELECT table_name
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints c
    ON t.table_name = c.table_name 
    AND c.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'database_name'
  AND c.constraint_name IS NULL;
```

### 查找使用 FLOAT 的金额字段

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'database_name'
  AND column_name LIKE '%amount%' OR column_name LIKE '%price%' OR column_name LIKE '%money%'
  AND data_type IN ('float', 'double');
```

### 查找 VARCHAR 存储的时间字段

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'database_name'
  AND (column_name LIKE '%time%' OR column_name LIKE '%date%' OR column_name LIKE '%at%')
  AND data_type IN ('varchar', 'char');
```

---

## 十三、快速参考卡

| 操作类型 | 从零设计                         | 现有项目改造           |
| :------- | :------------------------------- | :--------------------- |
| 表名     | `snake_case` 单数                | 渐进重命名（双写）     |
| 字段名   | `snake_case`                     | 渐进重命名（双写）     |
| 主键     | `BIGINT UNSIGNED AUTO_INCREMENT` | 无主键表需添加         |
| 金额     | `DECIMAL(20,6)`                  | `FLOAT` → `DECIMAL`    |
| 时间     | `DATETIME(3)`                    | `VARCHAR` → `DATETIME` |
| 字符集   | `utf8mb4`                        | `utf8` → `utf8mb4`     |
| 引擎     | `InnoDB`                         | `MyISAM` → `InnoDB`    |
| 索引     | 按查询设计（≤7个）               | 添加缺失索引，删除冗余 |
| 分页     | 游标分页/延迟关联                | 改造大 OFFSET 查询     |
| 种子数据 | 按环境生成（开发/测试/压力测试） | 基于现有数据衍生       |

---

## 十四、禁止事项

### 绝对禁止（会导致生产故障）

- ❌ 使用 `FLOAT` 或 `DOUBLE` 存储金额
- ❌ 在索引列上使用 `WHERE func(index_col) = ?`
- ❌ 没有 `WHERE` 条件的 `UPDATE` 或 `DELETE` 语句
- ❌ 对超大表（>100 万行）直接执行 `ALTER TABLE` 而不使用在线工具
- ❌ 在程序中硬拼接 SQL 字符串（必须使用参数化查询）
- ❌ 直接在生产环境执行未经验证的 DDL
- ❌ 没有回滚方案的迁移

### 强烈反对（会导致性能问题）

- ❌ 使用 `SELECT *` 且无 `LIMIT` 子句
- ❌ 大偏移量分页（`OFFSET 10000 LIMIT 10`）
- ❌ 单表索引数超过 10 个
- ❌ 使用 `utf8`（MySQL 特定，不是真正的 UTF-8）
- ❌ 在事务中调用外部 API 或执行远程 RPC

### 改造过程禁止

- ❌ 一次性大改（多表、多字段同时变更）
- ❌ 跳过双写阶段直接切换
- ❌ 没有通知团队就执行变更
- ❌ 没有备份就执行 DDL
- ❌ 在业务高峰期执行 DDL

### 种子数据禁止事项

- ❌ 在生产环境执行种子数据脚本
- ❌ 使用真实用户密码
- ❌ 种子数据中外键引用不存在的主键
- ❌ 种子数据时间逻辑混乱（如订单时间早于用户注册时间）
- ❌ 使用 `SELECT *` 从生产数据库导入数据到测试环境
- ❌ 种子数据包含真实身份证号、银行卡号等敏感信息
- ❌ 不同环境使用相同数量的种子数据

---

## 十五、常用命令速查

| 操作             | MySQL 命令                              |
| :--------------- | :-------------------------------------- |
| 分析表           | `ANALYZE TABLE table_name`              |
| 查看执行计划     | `EXPLAIN SELECT ...`                    |
| 查看索引使用情况 | `SHOW INDEX FROM table_name`            |
| 查看表状态       | `SHOW TABLE STATUS LIKE 'table_name'`   |
| 在线 DDL         | `pt-online-schema-change`               |
| 检查重复索引     | `pt-duplicate-key-checker`              |
| 查看慢查询       | `SHOW VARIABLES LIKE 'slow_query_log%'` |

------

*版本: 3.0 | 适用于: 新项目设计 + 遗留项目改造 + 种子数据填充 | 维护: 数据库架构组*
