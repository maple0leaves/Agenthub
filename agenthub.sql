SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `tb_agent_category`;
CREATE TABLE `tb_agent_category` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `sort` int unsigned DEFAULT 0,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent`;
CREATE TABLE `tb_agent` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'PROMPT',
  `visibility` varchar(32) NOT NULL DEFAULT 'PUBLIC',
  `status` tinyint unsigned NOT NULL DEFAULT 1,
  `star_count` int unsigned NOT NULL DEFAULT 0,
  `fork_count` int unsigned NOT NULL DEFAULT 0,
  `copy_count` int unsigned NOT NULL DEFAULT 0,
  `view_count` int unsigned NOT NULL DEFAULT 0,
  `version_count` int unsigned NOT NULL DEFAULT 0,
  `score` int NOT NULL DEFAULT 0,
  `parent_agent_id` bigint unsigned DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_category` (`category_id`),
  KEY `idx_agent_user` (`user_id`),
  KEY `idx_agent_score` (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_version`;
CREATE TABLE `tb_agent_version` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `agent_id` bigint unsigned NOT NULL,
  `version` varchar(32) NOT NULL,
  `prompt_template` text,
  `input_schema` text,
  `workflow_config` text,
  `model_suggestion` varchar(128) DEFAULT NULL,
  `changelog` varchar(512) DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_version_agent` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_star`;
CREATE TABLE `tb_agent_star` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `agent_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_agent_star` (`user_id`, `agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_fork`;
CREATE TABLE `tb_agent_fork` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `source_agent_id` bigint unsigned NOT NULL,
  `target_agent_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_source_agent` (`source_agent_id`),
  KEY `idx_target_agent` (`target_agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_copy_record`;
CREATE TABLE `tb_agent_copy_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `agent_id` bigint unsigned NOT NULL,
  `version_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_copy_agent` (`agent_id`),
  KEY `idx_copy_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_search_doc`;
CREATE TABLE `tb_agent_search_doc` (
  `agent_id` bigint unsigned NOT NULL,
  `version_id` bigint unsigned NOT NULL,
  `title` varchar(128) NOT NULL,
  `content` text,
  `embedding_status` tinyint unsigned NOT NULL DEFAULT 0,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tb_agent_category` (`id`, `name`, `icon`, `sort`) VALUES
(1, 'Writing', '/agenthub/icons/writing.svg', 1),
(2, 'Coding', '/agenthub/icons/coding.svg', 2),
(3, 'Research', '/agenthub/icons/research.svg', 3),
(4, 'Data Analysis', '/agenthub/icons/data.svg', 4),
(5, 'Office Automation', '/agenthub/icons/office.svg', 5),
(6, 'Marketing', '/agenthub/icons/marketing.svg', 6),
(7, 'Customer Support', '/agenthub/icons/support.svg', 7),
(8, 'Workflow', '/agenthub/icons/workflow.svg', 8);

INSERT INTO `tb_agent` (`id`, `user_id`, `category_id`, `name`, `description`, `avatar`, `type`, `visibility`, `status`, `star_count`, `fork_count`, `copy_count`, `view_count`, `version_count`, `score`, `parent_agent_id`) VALUES
(1, 1, 3, '论文摘要助手 Paper Summary Assistant', '粘贴论文或摘要，输出中文总结、研究问题、方法、结论和创新点。Paste a paper or abstract to get a structured summary.', '/agenthub/avatars/research.svg', 'PROMPT', 'PUBLIC', 1, 12, 4, 20, 80, 1, 168, NULL),
(2, 2, 2, 'Java Interview Coach', 'Generate Java backend interview questions and answer outlines based on a topic.', '/agenthub/avatars/coding.svg', 'PROMPT', 'PUBLIC', 1, 9, 2, 13, 63, 1, 124, NULL),
(3, 1, 8, 'SQL Debug Workflow', 'A workflow template for explaining SQL errors, suggesting indexes, and rewriting slow queries.', '/agenthub/avatars/workflow.svg', 'WORKFLOW', 'PUBLIC', 1, 6, 1, 8, 42, 1, 81, NULL);

INSERT INTO `tb_agent_version` (`id`, `agent_id`, `version`, `prompt_template`, `input_schema`, `workflow_config`, `model_suggestion`, `changelog`) VALUES
(1, 1, 'v1', '你是论文阅读和总结助手。请根据下面的论文内容输出：1. 中文摘要 2. 研究问题 3. 方法 4. 主要结论 5. 创新点。论文内容：{{paper_text}}', '{"paper_text":{"type":"string","required":true,"label":"Paper content"}}', NULL, 'gpt-4o-mini', 'Initial prompt template'),
(2, 2, 'v1', 'You are a senior Java interviewer. Generate interview questions, key points, and sample answers for this backend topic: {{topic}}', '{"topic":{"type":"string","required":true,"label":"Topic"}}', NULL, 'gpt-4o-mini', 'Initial prompt template'),
(3, 3, 'v1', 'Analyze SQL issue: {{sql}}', '{"sql":{"type":"string","required":true,"label":"SQL"}}', '{"steps":["explain_error","suggest_index","rewrite_sql"]}', 'gpt-4o-mini', 'Initial workflow template');

INSERT INTO `tb_agent_search_doc` (`agent_id`, `version_id`, `title`, `content`, `embedding_status`) VALUES
(1, 1, '论文摘要助手 Paper Summary Assistant', '论文 摘要 总结 助手 帮我总结论文 research paper summary abstract method conclusion innovation points prompt template', 0),
(2, 2, 'Java Interview Coach', 'Java Interview Coach backend interview questions answers Redis Spring MyBatis Java prompt template', 0),
(3, 3, 'SQL Debug Workflow', 'SQL Debug Workflow explain error suggest index rewrite slow query workflow template', 0);

DROP TABLE IF EXISTS `tb_user`;
CREATE TABLE `tb_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(20) NOT NULL,
  `password` varchar(128) DEFAULT NULL,
  `nick_name` varchar(64) DEFAULT NULL,
  `icon` varchar(255) DEFAULT '',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_user_info`;
CREATE TABLE `tb_user_info` (
  `user_id` bigint unsigned NOT NULL,
  `city` varchar(64) DEFAULT NULL,
  `introduce` varchar(128) DEFAULT NULL,
  `fans` int DEFAULT 0,
  `followee` int DEFAULT 0,
  `gender` tinyint(1) DEFAULT 0,
  `birthday` date DEFAULT NULL,
  `credits` int DEFAULT 0,
  `level` tinyint(1) DEFAULT 0,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_blog`;
CREATE TABLE `tb_blog` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `shop_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `images` varchar(2048) DEFAULT NULL,
  `content` text,
  `liked` int unsigned DEFAULT 0,
  `comments` int unsigned DEFAULT 0,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_blog_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_blog_comments`;
CREATE TABLE `tb_blog_comments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `blog_id` bigint unsigned NOT NULL,
  `parent_id` bigint unsigned DEFAULT 0,
  `answer_id` bigint unsigned DEFAULT 0,
  `content` varchar(2048) NOT NULL,
  `liked` int unsigned DEFAULT 0,
  `status` tinyint(1) DEFAULT 0,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_blog_comment_blog` (`blog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_blog_comment_like`;
CREATE TABLE `tb_blog_comment_like` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_blog_comment_user` (`comment_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_follow`;
CREATE TABLE `tb_follow` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `follow_user_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_follow_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_voucher`;
CREATE TABLE `tb_voucher` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `shop_id` bigint unsigned DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `sub_title` varchar(255) DEFAULT NULL,
  `rules` varchar(1024) DEFAULT NULL,
  `pay_value` bigint unsigned DEFAULT NULL,
  `actual_value` bigint DEFAULT NULL,
  `type` int unsigned DEFAULT 0,
  `status` int unsigned DEFAULT 1,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_seckill_voucher`;
CREATE TABLE `tb_seckill_voucher` (
  `voucher_id` bigint unsigned NOT NULL,
  `stock` int NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `begin_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_voucher_order`;
CREATE TABLE `tb_voucher_order` (
  `id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `voucher_id` bigint unsigned NOT NULL,
  `pay_type` tinyint unsigned DEFAULT 1,
  `status` tinyint unsigned DEFAULT 1,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `pay_time` timestamp NULL DEFAULT NULL,
  `use_time` timestamp NULL DEFAULT NULL,
  `refund_time` timestamp NULL DEFAULT NULL,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_user` (`user_id`),
  KEY `idx_order_voucher` (`voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_comment`;
CREATE TABLE `tb_agent_comment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `agent_id` bigint unsigned NOT NULL,
  `parent_id` bigint unsigned DEFAULT 0,
  `user_id` bigint unsigned NOT NULL,
  `content` varchar(2048) NOT NULL,
  `likes` int unsigned DEFAULT 0,
  `updated` int unsigned DEFAULT 0,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_comment_agent` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_agent_comment_like`;
CREATE TABLE `tb_agent_comment_like` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_comment_user` (`comment_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tb_user` (`id`, `phone`, `nick_name`, `icon`) VALUES
(1, '13800000001', 'Paper Lab', ''),
(2, '13800000002', 'Java Coach', '');

INSERT INTO `tb_user_info` (`user_id`, `city`, `introduce`) VALUES
(1, 'Beijing', 'AI research templates'),
(2, 'Shanghai', 'Backend interview coaching');

INSERT INTO `tb_voucher` (`id`, `shop_id`, `title`, `sub_title`, `rules`, `pay_value`, `actual_value`, `type`, `status`) VALUES
(1, 1, '论文助手限量体验包', '限量抢领 100 次调用额度', '每人限领 1 份，领取后 30 天内有效', 0, 100, 1, 1);

INSERT INTO `tb_seckill_voucher` (`voucher_id`, `stock`, `begin_time`, `end_time`) VALUES
(1, 100, '2025-01-01 00:00:00', '2030-12-31 23:59:59');

SET FOREIGN_KEY_CHECKS = 1;
