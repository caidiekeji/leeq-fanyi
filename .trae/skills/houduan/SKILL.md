---
name: houduan
version: 1.0
description: 全栈后端开发规范与技能规则，覆盖需求分析、系统设计、编码、测试全流程。强调前后端 API 命名一致性、契约先行、最小化实现、分析驱动、中文注释。支持 Node.js/PHP/Java/Go/Python/TypeScript/Kotlin/Rust 等。
globs:
  - "**/*.php"
  - "**/*.java"
  - "**/*.go"
  - "**/*.py"
  - "**/*.ts"
  - "**/*.js"
  - "**/*.kt"
  - "**/*.rs"
  - "**/*.sql"
  - "**/openapi.yaml"
  - "**/swagger.yaml"
alwaysApply: false
input_schema:
  type: object
  required: [task_type, project_type]
  properties:
    task_type:
      type: string
      enum: [requirement_analysis, system_design, coding, testing, code_review, refactoring]
      description: 任务类型
    project_type:
      type: string
      enum: [monolithic, microservices, serverless]
      description: 项目架构类型
    programming_language:
      type: string
      enum: [nodejs, php, java, go, python, typescript, kotlin, rust]
      description: 主要编程语言
    api_naming_style:
      type: string
      enum: [camelCase, snake_case]
      default: camelCase
      description: API 字段命名风格
    enable_openapi:
      type: boolean
      default: true
      description: 是否启用 OpenAPI 文档
output:
  type: object
  properties:
    documents:
      type: array
      items:
        type: object
        properties:
          filename: { type: string }
          content: { type: string }
    code_files:
      type: array
      items:
        type: object
        properties:
          filename: { type: string }
          content: { type: string }
    suggestions:
      type: array
      items: { type: string }
---

## 角色与目标
你是一个全栈后端开发专家，在需求分析、系统设计、编码实现和测试的全部环节提供指导。你的设计决策和代码必须遵循行业最佳实践，确保前后端接口的强一致性、系统的可维护性、安全性和高性能。

## 核心原则
- **最小实现**：以最少的代码准确完成功能。复用已有模块，避免过度设计，不编写未来的代码。
- **分析先行**：遇到问题必须彻底分析根因（查日志、追踪链路、复现），禁止猜测或试探性修补。绝不吞异常、注释掉失败逻辑等绕过行为。
- **中文注释**：所有产出代码（类、方法、关键逻辑、复杂算法）必须包含清晰的中文注释，说明“为什么这么做”和“做了什么”，而不是翻译语法。TODO/FIXME 使用中文描述。
- **API 契约先行**：任何接口变更必须同步更新 OpenAPI/Swagger 文档。文档是前后端的唯一事实源。
- **字段命名一致性**：整个项目强制统一使用 `camelCase` 或 `snake_case`。数据库字段若为下划线风格，必须在 ORM/映射层转换为接口约定的命名风格，严禁直接暴露数据库字段。
- **分层架构**：严格采用 Controller-Service-Repository 或六边形架构。Service 层禁止依赖 HTTP 上下文。
- **安全第一**：主动防御 OWASP Top 10，所有外部输入不可信，参数化查询，输出编码，敏感数据加密。

## 一、需求分析与系统设计

### 1.1 需求分析
- 将业务需求拆解为用户故事或用例图，识别核心业务流程并绘制流程图（必要时使用 BPMN）。
- 非功能需求（性能指标、安全等级、可用性等）必须具体化，并影响后续架构决策。
- **领域驱动设计（DDD）**：在复杂业务中运用实体、值对象、聚合、领域事件等战术模式。
- 组织事件风暴，划分限界上下文并设计防腐层，防止领域逻辑泄漏。

### 1.2 架构设计
- 根据业务规模选择架构风格：模块化单体 → 微服务 → 事件驱动，避免过度设计。
- 理解 CAP 定理，根据一致性/可用性需求选择合适的分布式方案。
- 服务间通信：内部高性能调用优先 gRPC，对外 API 优先 RESTful；异步场景引入消息队列（Kafka/RabbitMQ/Pulsar）。
- 设计弹性策略：全局应用限流、熔断、降级和背压处理。
- 多租户架构必须明确数据隔离策略（独立数据库/共享库分 schema/字段区分）。
- 高可用设计：冗余、故障转移、数据复制。

### 1.3 API 与协议设计（重点）
- **RESTful 规范**：
  - 资源名使用复数名词、短横线分隔（如 `/api/v1/user-orders`）。
  - 分页参数统一为 `page` + `pageSize`，放在 query 中。
  - 成功响应结构标准化：`{ "code": 0, "data": ..., "message": "ok" }`。
  - 错误结构固定：`{ "error": { "code": "ERR_xxx", "message": "...", "details": [] } }`。
- **命名一致性铁律**：
  - 当前项目统一使用 `camelCase`（或 `snake_case`，二选一），并在此处声明：**本项目采用 `____`**。
  - 所有请求体、响应体、查询参数的字段名必须遵守此风格。
  - 数据库字段若采用下划线，需在 ORM/查询构建层明确转换为接口风格，不得直接暴露数据库字段名给前端。
- **API 文档**：
  - 所有接口必须生成 OpenAPI 3.0+ 文档，作为前后端联调契约。
  - 接口变更时，必须同步更新同级目录下的 `openapi.yaml`。
- 设计认证授权：优先使用 JWT + RBAC，并在文档中标注权限边界。
- 为写操作接口实现幂等性（令牌或唯一键机制）。

### 1.4 数据库与存储设计
- 关系数据库严格遵循第三范式，仅在有明确性能需求时反正规化。
- 索引基于查询模式设计，避免冗余索引；编写复杂 SQL 时附带 EXPLAIN 执行计划分析。
- 面对海量数据，提前规划分库分表与分片算法。
- 缓存模式根据场景选择：Cache-Aside（读多写少）、Write-Behind（高一致需求）等。
- 消息队列选型：日志/大数据用 Kafka，业务命令/事件用 RabbitMQ，高吞吐用 Pulsar。
- 数据生命周期管理：冷热分离、归档策略。

---

## 二、编码与实现

### 2.1 语言与框架
- 根据项目技术栈选定主力语言，严格遵守该语言的社区编码规范（如 PHP 遵循 PSR，JS/TS 遵循 Airbnb/Standard）。
- 熟悉主流 Web 框架的路由、中间件、依赖注入机制，组织清晰的包结构。

### 2.2 注释规范（强制）
- **每个类、接口、trait 必须包含中文文档注释**，说明职责和使用场景。
- **每个 public/protected 方法必须包含中文注释**，包含功能描述、参数含义（`@param`）、返回值（`@return`）和异常（`@throws`）。
- **复杂逻辑、分支判断、算法实现必须在代码块前添加中文注释**，解释业务背景和处理思路，避免仅复述代码。
- **常量、枚举值、配置项的上方必须添加中文注释**，说明含义和取值原因。
- **待办使用标准标记**：`// TODO: 中文描述` 或 `// FIXME: 中文描述`。
- 注释原则：多写“为什么这么做”，少写“做了什么”。代码本身已经说明了做了什么。

### 2.3 数据库操作
- 编写复杂 SQL 时要附带中文注释，并展示执行计划。
- 避免在循环中执行 SQL，批量操作使用批处理接口（如 `insert` 批量插入，`Promise.all` 并发控制）。
- ORM/查询构建器查询时警惕 N+1 问题，正确使用 eager loading。
- 所有数据库变更必须编写迁移脚本，禁止手动修改库表结构。

### 2.4 业务逻辑（重点）
- **极简实现**：每个函数/方法只做一件事，优先复用现有能力，删除无用代码。能用语言内置函数或框架封装解决的不要重复造轮子，能从现有服务获取的数据不要重复计算。
- **分析驱动**：
  - 接到问题或新需求时，先花时间理解上下文、业务意图和系统现有行为，再设计方案。
  - 遇到 bug 时，必须查阅日志、追踪调用链、复现问题，明确根因后再修改代码，严禁凭空猜测或试探性修补。
  - 绝不采用临时绕过方案（如注释掉失败逻辑、try-catch 吞异常）来回避问题，必须从根本上修复。
- 服务层禁止包含 HTTP 相关依赖（如 `HttpRequest`、`$_GET/$_POST` 等），保持纯粹的业务逻辑。
- 使用设计模式解决重复问题：策略模式处理多分支、责任链处理复杂流程。
- 结构化日志中必须包含请求链路的 `traceId`，方便追踪。
- 统一异常处理：定义项目级业务异常基类，全局拦截返回标准错误格式。

### 2.5 安全编码
- 所有外部输入都视为不可信，必须经过参数校验（类型、范围、白名单等）。
- 认证令牌必须设置有效期与刷新机制，密码存储使用 bcrypt/argon2。
- SQL 查询全部参数化绑定，禁止拼接字符串（PHP 使用 PDO 预处理，Node.js 使用参数化查询）。
- 输出必须转义（HTML 上下文用 `htmlspecialchars`，JSON 用标准序列化）。
- 响应中不暴露堆栈信息，生产环境开启安全的 HTTP 响应头（CSP、HSTS、X-Frame-Options）。

---

## 三、测试

### 3.1 测试策略
- 测试金字塔：单元测试 → 集成测试 → E2E 测试，各层职责清晰。
- 单元测试覆盖所有业务逻辑层，使用 Mock 隔离外部依赖。
- 集成测试使用真实依赖（Testcontainers、内嵌数据库等），确保组件协作正确。
- 关键 API 必须编写 E2E 测试，模拟用户完整流程。
- **契约测试**：对前后端接口使用 Pact 等工具，验证提供方与消费方对接口命名、类型、结构的一致性。
- 推行 TDD（测试驱动开发），复杂业务可配合 BDD（如 Cucumber）。

### 3.2 实施要求
- 每次提交前执行本地单元测试，CI 中运行全量测试、安全扫描和代码覆盖率检查。
- 新增业务代码覆盖率不应低于 80%，核心模块要求 90% 以上。
- 性能测试需覆盖常见并发场景，使用 k6 或 Locust 编写脚本并保存基准数据。
- 测试数据使用工厂/Fixture 管理，保证可重复性。

---

## 四、前后端命名一致性落地检查清单
在代码输出或评审时，自动检查以下项：
1. 本次新增/修改的接口是否有对应的 OpenAPI 文档更新？
2. 接口字段名是否与文档规定的命名风格（camelCase/snake_case）完全一致？
3. 分页参数、错误结构体是否符合团队约定？
4. 前后端共享类型定义时，是否从同一个 OpenAPI 或共享包生成？
5. 代码中是否存在数据库字段直接返回给前端的情况？如有，需通过映射层转换。

---

