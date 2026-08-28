export type HQAIModelStatus = "active" | "disabled";

export interface HQAIModelConfig {
  id: string;
  provider: string;
  name: string;
  type: string;
  status: HQAIModelStatus;
  keyAlias: string;
  apiKey: string;
  monthlyCost: number;
  monthlyQuota: number;
  calls: number;
  description: string;
  tags: string[];
}

export interface HQAIAppAssignment {
  id: string;
  app: string;
  appKey: string;
  category: string;
  primaryModelId: string;
  backupModelId: string;
  scope: string;
  enabled: boolean;
}

export interface HQAIConfig {
  models: HQAIModelConfig[];
  assignments: HQAIAppAssignment[];
}

export interface HQAIModelCatalogItem {
  id: string;
  provider: string;
  name: string;
  type: string;
  context: string;
  inputPrice: string;
  outputPrice: string;
  speed: string;
  strengths: string[];
  description: string;
  defaultKeyAlias: string;
  estimatedMonthlyCost: number;
}

export interface HQAIApplicationOption {
  app: string;
  appKey: string;
  category: string;
  scope: string;
}

const STORAGE_KEY = "tradepro.hqAiConfig";

export const HQ_AI_APPLICATIONS: HQAIApplicationOption[] = [
  { app: "AI 对话建站", appKey: "ai-chat", category: "建站生成", scope: "客户端 / 项目" },
  { app: "智能客服", appKey: "ai-customer-service", category: "客户服务", scope: "客户端 / 代理商" },
  { app: "在线聊天客服", appKey: "live-chat", category: "IM 接待", scope: "客户端项目" },
  { app: "AI SEO 博客", appKey: "seo-blog", category: "内容生成", scope: "客户端项目" },
  { app: "产品描述生成", appKey: "product-copy", category: "商品资料", scope: "客户端项目" },
  { app: "询盘自动回复", appKey: "inquiry-auto", category: "销售自动化", scope: "客户端 / 项目" },
  { app: "社媒文案生成", appKey: "social-copy", category: "营销内容", scope: "客户端项目" },
  { app: "广告投放建议", appKey: "smart-ads", category: "广告优化", scope: "客户端项目" },
  { app: "产品分析", appKey: "product-analysis", category: "数据洞察", scope: "客户端项目" },
  { app: "图片素材生成", appKey: "image-generation", category: "视觉素材", scope: "客户端项目" },
];

export const HQ_AI_MODEL_CATALOG: HQAIModelCatalogItem[] = [
  {
    id: "catalog-gemini-25-pro",
    provider: "Google",
    name: "gemini-2.5-pro",
    type: "文本/多模态",
    context: "长上下文",
    inputPrice: "$1.25 / 1M tokens",
    outputPrice: "$10 / 1M tokens",
    speed: "中",
    strengths: ["AI建站", "多模态", "长上下文"],
    description: "适合 AI 对话建站、页面改版、复杂需求理解和长上下文内容生成。",
    defaultKeyAlias: "prod-gemini",
    estimatedMonthlyCost: 48200,
  },
  {
    id: "catalog-gemini-15-flash",
    provider: "Google",
    name: "gemini-1.5-flash",
    type: "文本/多模态",
    context: "长上下文",
    inputPrice: "$0.075 / 1M tokens",
    outputPrice: "$0.30 / 1M tokens",
    speed: "快",
    strengths: ["低成本", "客服", "批量生成"],
    description: "适合高频客服、批量摘要、轻量内容生成和低成本测试。",
    defaultKeyAlias: "prod-gemini",
    estimatedMonthlyCost: 6800,
  },
  {
    id: "catalog-gpt-4o",
    provider: "OpenAI",
    name: "gpt-4o",
    type: "文本/多模态",
    context: "128K",
    inputPrice: "$2.50 / 1M tokens",
    outputPrice: "$10 / 1M tokens",
    speed: "快",
    strengths: ["通用", "工具调用", "多模态"],
    description: "适合通用 AI 应用、客服、结构化输出和多模态理解。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 28800,
  },
  {
    id: "catalog-gpt-4o-mini",
    provider: "OpenAI",
    name: "gpt-4o-mini",
    type: "文本/多模态",
    context: "128K",
    inputPrice: "$0.15 / 1M tokens",
    outputPrice: "$0.60 / 1M tokens",
    speed: "快",
    strengths: ["低延迟", "客服", "高频"],
    description: "适合智能客服、产品描述、社媒文案等高频低成本调用。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 9800,
  },
  {
    id: "catalog-o3",
    provider: "OpenAI",
    name: "o3",
    type: "推理模型",
    context: "长上下文",
    inputPrice: "$2 / 1M tokens",
    outputPrice: "$8 / 1M tokens",
    speed: "中",
    strengths: ["推理", "复杂规划", "代码"],
    description: "适合复杂需求拆解、代码生成、系统规划和多步骤推理。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 32000,
  },
  {
    id: "catalog-claude-sonnet-4",
    provider: "Anthropic",
    name: "claude-sonnet-4",
    type: "文本/推理",
    context: "200K",
    inputPrice: "$3 / 1M tokens",
    outputPrice: "$15 / 1M tokens",
    speed: "中",
    strengths: ["长文", "代码", "分析"],
    description: "适合 SEO 长文、复杂页面策划、合规内容和深度润色。",
    defaultKeyAlias: "prod-claude",
    estimatedMonthlyCost: 36500,
  },
  {
    id: "catalog-claude-haiku",
    provider: "Anthropic",
    name: "claude-3.5-haiku",
    type: "文本",
    context: "200K",
    inputPrice: "$0.80 / 1M tokens",
    outputPrice: "$4 / 1M tokens",
    speed: "快",
    strengths: ["快速", "客服", "摘要"],
    description: "适合快速问答、摘要、分类和客服场景。",
    defaultKeyAlias: "prod-claude",
    estimatedMonthlyCost: 11800,
  },
  {
    id: "catalog-deepseek-chat",
    provider: "DeepSeek",
    name: "deepseek-chat",
    type: "文本",
    context: "64K",
    inputPrice: "$0.27 / 1M tokens",
    outputPrice: "$1.10 / 1M tokens",
    speed: "快",
    strengths: ["中文", "低成本", "高频"],
    description: "适合中文客服、在线聊天、问答和成本敏感型高频调用。",
    defaultKeyAlias: "prod-deepseek",
    estimatedMonthlyCost: 8800,
  },
  {
    id: "catalog-deepseek-reasoner",
    provider: "DeepSeek",
    name: "deepseek-reasoner",
    type: "推理模型",
    context: "64K",
    inputPrice: "$0.55 / 1M tokens",
    outputPrice: "$2.19 / 1M tokens",
    speed: "中",
    strengths: ["推理", "代码", "中文"],
    description: "适合中文复杂推理、代码辅助、数据分析和策略规划。",
    defaultKeyAlias: "prod-deepseek",
    estimatedMonthlyCost: 16800,
  },
  {
    id: "catalog-qwen-plus",
    provider: "Alibaba",
    name: "qwen-plus",
    type: "文本/多语言",
    context: "长上下文",
    inputPrice: "按阿里云计费",
    outputPrice: "按阿里云计费",
    speed: "快",
    strengths: ["中文", "外贸", "低成本"],
    description: "适合中文业务场景、外贸资料整理、多语言内容生成。",
    defaultKeyAlias: "prod-qwen",
    estimatedMonthlyCost: 7600,
  },
  {
    id: "catalog-kimi-k2",
    provider: "Moonshot",
    name: "kimi-k2",
    type: "文本/长上下文",
    context: "长上下文",
    inputPrice: "按 Moonshot 计费",
    outputPrice: "按 Moonshot 计费",
    speed: "中",
    strengths: ["长文档", "中文", "分析"],
    description: "适合长文档理解、资料抽取、中文分析和知识库问答。",
    defaultKeyAlias: "prod-kimi",
    estimatedMonthlyCost: 12800,
  },
  {
    id: "catalog-gemini-image",
    provider: "Google",
    name: "gemini-3-pro-image",
    type: "图像生成",
    context: "图像",
    inputPrice: "按图片计费",
    outputPrice: "按图片计费",
    speed: "中",
    strengths: ["图片", "素材", "建站视觉"],
    description: "适合建站素材、产品场景图和视觉生成。",
    defaultKeyAlias: "prod-gemini",
    estimatedMonthlyCost: 12800,
  },
  {
    id: "catalog-codex",
    provider: "OpenAI",
    name: "codex",
    type: "代码/开发代理",
    context: "项目上下文",
    inputPrice: "按 OpenAI/Codex 计费",
    outputPrice: "按 OpenAI/Codex 计费",
    speed: "中",
    strengths: ["代码开发", "本地项目", "自动修复"],
    description: "适合代码编辑、项目搭建、自动化修复、前后端联调和开发协作，可分配给 AI 对话建站、代码生成等应用。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 18000,
  },
  {
    id: "catalog-gpt-41",
    provider: "OpenAI",
    name: "gpt-4.1",
    type: "文本/工具调用",
    context: "1M",
    inputPrice: "$2 / 1M tokens",
    outputPrice: "$8 / 1M tokens",
    speed: "中",
    strengths: ["长上下文", "工具调用", "复杂生成"],
    description: "适合长上下文资料理解、复杂页面生成、结构化输出和多工具协作。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 26000,
  },
  {
    id: "catalog-gpt-41-mini",
    provider: "OpenAI",
    name: "gpt-4.1-mini",
    type: "文本/工具调用",
    context: "1M",
    inputPrice: "$0.40 / 1M tokens",
    outputPrice: "$1.60 / 1M tokens",
    speed: "快",
    strengths: ["低成本", "长上下文", "客服"],
    description: "适合需要较长上下文但预算敏感的客服、内容生成和项目资料整理。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 12000,
  },
  {
    id: "catalog-gpt-41-nano",
    provider: "OpenAI",
    name: "gpt-4.1-nano",
    type: "轻量文本",
    context: "1M",
    inputPrice: "$0.10 / 1M tokens",
    outputPrice: "$0.40 / 1M tokens",
    speed: "很快",
    strengths: ["高频", "低成本", "分类"],
    description: "适合高频分类、标签生成、短文案和轻量问答。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 5200,
  },
  {
    id: "catalog-o3-mini",
    provider: "OpenAI",
    name: "o3-mini",
    type: "推理模型",
    context: "长上下文",
    inputPrice: "$1.10 / 1M tokens",
    outputPrice: "$4.40 / 1M tokens",
    speed: "中",
    strengths: ["推理", "代码", "低成本"],
    description: "适合低成本推理、代码辅助、流程规划和质量检查。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 18000,
  },
  {
    id: "catalog-o4-mini",
    provider: "OpenAI",
    name: "o4-mini",
    type: "推理/多模态",
    context: "长上下文",
    inputPrice: "$1.10 / 1M tokens",
    outputPrice: "$4.40 / 1M tokens",
    speed: "快",
    strengths: ["多模态", "推理", "工具调用"],
    description: "适合多模态分析、需求拆解、工具调用和低延迟推理场景。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 18800,
  },
  {
    id: "catalog-gpt-image-1",
    provider: "OpenAI",
    name: "gpt-image-1",
    type: "图像生成",
    context: "图像",
    inputPrice: "按图片计费",
    outputPrice: "按图片计费",
    speed: "中",
    strengths: ["图片", "素材", "编辑"],
    description: "适合产品场景图、落地页素材、图片编辑和视觉创意生成。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 15800,
  },
  {
    id: "catalog-text-embedding-3-large",
    provider: "OpenAI",
    name: "text-embedding-3-large",
    type: "向量嵌入",
    context: "文本",
    inputPrice: "$0.13 / 1M tokens",
    outputPrice: "-",
    speed: "快",
    strengths: ["知识库", "检索", "RAG"],
    description: "适合站内知识库、客户资料检索、语义搜索和 RAG 应用。",
    defaultKeyAlias: "prod-openai",
    estimatedMonthlyCost: 3600,
  },
  {
    id: "catalog-gemini-25-flash",
    provider: "Google",
    name: "gemini-2.5-flash",
    type: "文本/多模态",
    context: "长上下文",
    inputPrice: "$0.30 / 1M tokens",
    outputPrice: "$2.50 / 1M tokens",
    speed: "快",
    strengths: ["多模态", "低延迟", "批量"],
    description: "适合高频 AI 客服、内容改写、多模态理解和低延迟交互。",
    defaultKeyAlias: "prod-gemini",
    estimatedMonthlyCost: 12800,
  },
  {
    id: "catalog-gemini-25-flash-lite",
    provider: "Google",
    name: "gemini-2.5-flash-lite",
    type: "轻量文本/多模态",
    context: "长上下文",
    inputPrice: "$0.10 / 1M tokens",
    outputPrice: "$0.40 / 1M tokens",
    speed: "很快",
    strengths: ["低成本", "高频", "客服"],
    description: "适合高并发客服、批量摘要、标签提取和成本优先的应用。",
    defaultKeyAlias: "prod-gemini",
    estimatedMonthlyCost: 6200,
  },
  {
    id: "catalog-gemini-15-pro",
    provider: "Google",
    name: "gemini-1.5-pro",
    type: "文本/多模态",
    context: "长上下文",
    inputPrice: "$1.25 / 1M tokens",
    outputPrice: "$5 / 1M tokens",
    speed: "中",
    strengths: ["长上下文", "多模态", "分析"],
    description: "适合大文档分析、项目资料整理、复杂内容生成和多模态任务。",
    defaultKeyAlias: "prod-gemini",
    estimatedMonthlyCost: 26800,
  },
  {
    id: "catalog-claude-opus-4",
    provider: "Anthropic",
    name: "claude-opus-4",
    type: "文本/推理",
    context: "200K",
    inputPrice: "$15 / 1M tokens",
    outputPrice: "$75 / 1M tokens",
    speed: "中",
    strengths: ["深度推理", "复杂代码", "策略"],
    description: "适合高价值策略分析、复杂代码任务、深度研究和严格质量要求的内容生成。",
    defaultKeyAlias: "prod-claude",
    estimatedMonthlyCost: 78000,
  },
  {
    id: "catalog-claude-37-sonnet",
    provider: "Anthropic",
    name: "claude-3.7-sonnet",
    type: "文本/推理",
    context: "200K",
    inputPrice: "$3 / 1M tokens",
    outputPrice: "$15 / 1M tokens",
    speed: "中",
    strengths: ["代码", "长文", "推理"],
    description: "适合代码开发、长文档分析、页面策划和复杂对话任务。",
    defaultKeyAlias: "prod-claude",
    estimatedMonthlyCost: 34800,
  },
  {
    id: "catalog-deepseek-coder",
    provider: "DeepSeek",
    name: "deepseek-coder",
    type: "代码模型",
    context: "长上下文",
    inputPrice: "按 DeepSeek 计费",
    outputPrice: "按 DeepSeek 计费",
    speed: "快",
    strengths: ["代码", "低成本", "中文"],
    description: "适合代码生成、代码解释、问题修复和中文开发协作。",
    defaultKeyAlias: "prod-deepseek",
    estimatedMonthlyCost: 9800,
  },
  {
    id: "catalog-qwen-max",
    provider: "Alibaba",
    name: "qwen-max",
    type: "文本/复杂推理",
    context: "长上下文",
    inputPrice: "按阿里云计费",
    outputPrice: "按阿里云计费",
    speed: "中",
    strengths: ["中文", "复杂任务", "企业"],
    description: "适合复杂中文业务、企业知识处理、方案生成和多语言外贸内容。",
    defaultKeyAlias: "prod-qwen",
    estimatedMonthlyCost: 18800,
  },
  {
    id: "catalog-qwen-turbo",
    provider: "Alibaba",
    name: "qwen-turbo",
    type: "轻量文本",
    context: "长上下文",
    inputPrice: "按阿里云计费",
    outputPrice: "按阿里云计费",
    speed: "很快",
    strengths: ["低成本", "高频", "中文"],
    description: "适合高频中文问答、产品资料生成、批量处理和轻量客服。",
    defaultKeyAlias: "prod-qwen",
    estimatedMonthlyCost: 5200,
  },
  {
    id: "catalog-qwen-long",
    provider: "Alibaba",
    name: "qwen-long",
    type: "长上下文文本",
    context: "超长上下文",
    inputPrice: "按阿里云计费",
    outputPrice: "按阿里云计费",
    speed: "中",
    strengths: ["长文档", "资料整理", "中文"],
    description: "适合长资料理解、合同/文档摘要、知识库整理和跨项目资料分析。",
    defaultKeyAlias: "prod-qwen",
    estimatedMonthlyCost: 9800,
  },
  {
    id: "catalog-qwen-vl-plus",
    provider: "Alibaba",
    name: "qwen-vl-plus",
    type: "视觉多模态",
    context: "图文",
    inputPrice: "按阿里云计费",
    outputPrice: "按阿里云计费",
    speed: "快",
    strengths: ["图文理解", "产品图", "识别"],
    description: "适合产品图片理解、图文问答、素材审核和视觉信息抽取。",
    defaultKeyAlias: "prod-qwen",
    estimatedMonthlyCost: 11200,
  },
  {
    id: "catalog-kimi-latest",
    provider: "Moonshot",
    name: "kimi-latest",
    type: "文本/长上下文",
    context: "长上下文",
    inputPrice: "按 Moonshot 计费",
    outputPrice: "按 Moonshot 计费",
    speed: "中",
    strengths: ["长文档", "中文", "知识库"],
    description: "适合中文长文档理解、知识库问答、内容总结和资料抽取。",
    defaultKeyAlias: "prod-kimi",
    estimatedMonthlyCost: 11800,
  },
  {
    id: "catalog-kimi-thinking",
    provider: "Moonshot",
    name: "kimi-thinking",
    type: "推理模型",
    context: "长上下文",
    inputPrice: "按 Moonshot 计费",
    outputPrice: "按 Moonshot 计费",
    speed: "中",
    strengths: ["推理", "中文", "分析"],
    description: "适合中文复杂推理、方案拆解、竞品分析和项目规划。",
    defaultKeyAlias: "prod-kimi",
    estimatedMonthlyCost: 16800,
  },
  {
    id: "catalog-grok-4",
    provider: "xAI",
    name: "grok-4",
    type: "文本/推理",
    context: "长上下文",
    inputPrice: "按 xAI 计费",
    outputPrice: "按 xAI 计费",
    speed: "中",
    strengths: ["推理", "实时", "通用"],
    description: "适合通用问答、实时信息辅助、复杂推理和运营分析。",
    defaultKeyAlias: "prod-xai",
    estimatedMonthlyCost: 30000,
  },
  {
    id: "catalog-grok-3",
    provider: "xAI",
    name: "grok-3",
    type: "文本/推理",
    context: "长上下文",
    inputPrice: "按 xAI 计费",
    outputPrice: "按 xAI 计费",
    speed: "中",
    strengths: ["通用", "推理", "对话"],
    description: "适合通用对话、运营问答、数据解释和复杂需求辅助。",
    defaultKeyAlias: "prod-xai",
    estimatedMonthlyCost: 24000,
  },
  {
    id: "catalog-grok-3-mini",
    provider: "xAI",
    name: "grok-3-mini",
    type: "轻量推理",
    context: "长上下文",
    inputPrice: "按 xAI 计费",
    outputPrice: "按 xAI 计费",
    speed: "快",
    strengths: ["低成本", "推理", "高频"],
    description: "适合低成本推理、快速问答和高频业务助手。",
    defaultKeyAlias: "prod-xai",
    estimatedMonthlyCost: 10800,
  },
  {
    id: "catalog-llama-31-405b",
    provider: "Meta",
    name: "llama-3.1-405b",
    type: "开源文本",
    context: "长上下文",
    inputPrice: "按部署/渠道计费",
    outputPrice: "按部署/渠道计费",
    speed: "中",
    strengths: ["开源生态", "可私有化", "多语言"],
    description: "适合需要开源生态、可控部署、多语言生成和企业私有化的场景。",
    defaultKeyAlias: "prod-meta",
    estimatedMonthlyCost: 22000,
  },
  {
    id: "catalog-llama-33-70b",
    provider: "Meta",
    name: "llama-3.3-70b",
    type: "开源文本",
    context: "长上下文",
    inputPrice: "按部署/渠道计费",
    outputPrice: "按部署/渠道计费",
    speed: "快",
    strengths: ["开源", "低成本", "多语言"],
    description: "适合低成本私有化、内容生成、客服和多语言业务处理。",
    defaultKeyAlias: "prod-meta",
    estimatedMonthlyCost: 9800,
  },
  {
    id: "catalog-llama-4-maverick",
    provider: "Meta",
    name: "llama-4-maverick",
    type: "开源多模态",
    context: "长上下文",
    inputPrice: "按部署/渠道计费",
    outputPrice: "按部署/渠道计费",
    speed: "中",
    strengths: ["多模态", "开源", "私有化"],
    description: "适合图文理解、私有化多模态应用和可控部署场景。",
    defaultKeyAlias: "prod-meta",
    estimatedMonthlyCost: 16800,
  },
  {
    id: "catalog-mistral-large",
    provider: "Mistral",
    name: "mistral-large",
    type: "文本/推理",
    context: "长上下文",
    inputPrice: "按 Mistral 计费",
    outputPrice: "按 Mistral 计费",
    speed: "中",
    strengths: ["多语言", "欧洲合规", "推理"],
    description: "适合多语言内容、欧洲合规场景、复杂文本生成和分析。",
    defaultKeyAlias: "prod-mistral",
    estimatedMonthlyCost: 21000,
  },
  {
    id: "catalog-mistral-small",
    provider: "Mistral",
    name: "mistral-small",
    type: "轻量文本",
    context: "长上下文",
    inputPrice: "按 Mistral 计费",
    outputPrice: "按 Mistral 计费",
    speed: "快",
    strengths: ["低成本", "多语言", "客服"],
    description: "适合低成本多语言客服、摘要、分类和短内容生成。",
    defaultKeyAlias: "prod-mistral",
    estimatedMonthlyCost: 7600,
  },
  {
    id: "catalog-codestral",
    provider: "Mistral",
    name: "codestral",
    type: "代码模型",
    context: "长上下文",
    inputPrice: "按 Mistral 计费",
    outputPrice: "按 Mistral 计费",
    speed: "快",
    strengths: ["代码", "补全", "开发"],
    description: "适合代码补全、代码解释、脚本生成和开发辅助。",
    defaultKeyAlias: "prod-mistral",
    estimatedMonthlyCost: 11800,
  },
  {
    id: "catalog-command-r-plus",
    provider: "Cohere",
    name: "command-r-plus",
    type: "RAG/文本",
    context: "长上下文",
    inputPrice: "按 Cohere 计费",
    outputPrice: "按 Cohere 计费",
    speed: "中",
    strengths: ["RAG", "企业检索", "工具调用"],
    description: "适合企业知识库、检索增强生成、复杂问答和工具调用。",
    defaultKeyAlias: "prod-cohere",
    estimatedMonthlyCost: 18800,
  },
  {
    id: "catalog-command-r",
    provider: "Cohere",
    name: "command-r",
    type: "RAG/文本",
    context: "长上下文",
    inputPrice: "按 Cohere 计费",
    outputPrice: "按 Cohere 计费",
    speed: "快",
    strengths: ["检索", "问答", "低成本"],
    description: "适合知识库问答、资料检索、客户资料分析和成本敏感型 RAG。",
    defaultKeyAlias: "prod-cohere",
    estimatedMonthlyCost: 9800,
  },
  {
    id: "catalog-glm-4-plus",
    provider: "Zhipu",
    name: "glm-4-plus",
    type: "文本/中文",
    context: "长上下文",
    inputPrice: "按智谱计费",
    outputPrice: "按智谱计费",
    speed: "中",
    strengths: ["中文", "企业", "多工具"],
    description: "适合中文企业应用、复杂问答、业务助手和工具调用。",
    defaultKeyAlias: "prod-zhipu",
    estimatedMonthlyCost: 12800,
  },
  {
    id: "catalog-glm-4-flash",
    provider: "Zhipu",
    name: "glm-4-flash",
    type: "轻量文本",
    context: "长上下文",
    inputPrice: "按智谱计费",
    outputPrice: "按智谱计费",
    speed: "很快",
    strengths: ["低成本", "中文", "高频"],
    description: "适合高频中文问答、轻量内容生成、标签分类和客服。",
    defaultKeyAlias: "prod-zhipu",
    estimatedMonthlyCost: 4800,
  },
  {
    id: "catalog-ernie-45",
    provider: "Baidu",
    name: "ernie-4.5",
    type: "文本/多模态",
    context: "长上下文",
    inputPrice: "按百度千帆计费",
    outputPrice: "按百度千帆计费",
    speed: "中",
    strengths: ["中文", "多模态", "企业"],
    description: "适合中文企业应用、多模态理解、内容生成和知识问答。",
    defaultKeyAlias: "prod-baidu",
    estimatedMonthlyCost: 13800,
  },
  {
    id: "catalog-ernie-x1",
    provider: "Baidu",
    name: "ernie-x1",
    type: "深度推理",
    context: "长上下文",
    inputPrice: "按百度千帆计费",
    outputPrice: "按百度千帆计费",
    speed: "中",
    strengths: ["推理", "中文", "复杂分析"],
    description: "适合中文复杂推理、策略分析、数据洞察和业务规划。",
    defaultKeyAlias: "prod-baidu",
    estimatedMonthlyCost: 16800,
  },
];

export const DEFAULT_HQ_AI_MODELS: HQAIModelConfig[] = [
  {
    id: "gemini-25-pro",
    provider: "Google",
    name: "gemini-2.5-pro",
    type: "文本/多模态",
    status: "active",
    keyAlias: "prod-gemini",
    apiKey: "",
    monthlyCost: 48200,
    monthlyQuota: 54,
    calls: 128000,
    description: "适合 AI 建站、多语言内容生成、复杂推理和长上下文规划场景。",
    tags: ["AI建站", "多语言", "复杂推理"],
  },
  {
    id: "openai-codex",
    provider: "OpenAI",
    name: "codex",
    type: "代码/自动化",
    status: "active",
    keyAlias: "prod-openai",
    apiKey: "",
    monthlyCost: 18000,
    monthlyQuota: 36,
    calls: 32000,
    description: "Codex 适合 AI 建站工作流、代码生成、自动化修改和开发协作场景。",
    tags: ["Codex", "AI建站", "开发协作"],
  },
  {
    id: "gpt-4o-mini",
    provider: "OpenAI",
    name: "gpt-4o-mini",
    type: "文本/轻量",
    status: "active",
    keyAlias: "prod-openai",
    apiKey: "",
    monthlyCost: 9800,
    monthlyQuota: 42,
    calls: 186000,
    description: "适合高频问答、轻量生成、智能客服和低成本多场景应用。",
    tags: ["问答", "轻量", "客服"],
  },
  {
    id: "deepseek-chat",
    provider: "DeepSeek",
    name: "deepseek-chat",
    type: "文本",
    status: "active",
    keyAlias: "prod-deepseek",
    apiKey: "",
    monthlyCost: 8800,
    monthlyQuota: 18,
    calls: 486000,
    description: "适合日常对话、内容改写、成本敏感型应用和批量生成任务。",
    tags: ["对话", "批量生成", "低成本"],
  },
  {
    id: "claude-sonnet-4",
    provider: "Anthropic",
    name: "claude-sonnet-4",
    type: "文本/分析",
    status: "active",
    keyAlias: "prod-claude",
    apiKey: "",
    monthlyCost: 36500,
    monthlyQuota: 36,
    calls: 12400,
    description: "适合 SEO 策略、长文改写、知识整理和复杂内容分析工作。",
    tags: ["分析", "SEO", "长文"],
  },
  {
    id: "gemini-image",
    provider: "Google",
    name: "gemini-3-pro-image",
    type: "图像生成",
    status: "disabled",
    keyAlias: "prod-gemini",
    apiKey: "",
    monthlyCost: 12800,
    monthlyQuota: 0,
    calls: 8600,
    description: "适合产品图生成、营销素材制作、页面配图和视觉创意扩展。",
    tags: ["图像", "营销素材", "创意"],
  },
];

export const DEFAULT_HQ_AI_ASSIGNMENTS: HQAIAppAssignment[] = [
  {
    id: "app-ai-chat",
    app: "AI 对话建站",
    appKey: "ai-chat",
    category: "建站生成",
    primaryModelId: "gemini-25-pro",
    backupModelId: "gpt-4o-mini",
    scope: "客户端 / 项目",
    enabled: true,
  },
  {
    id: "app-ai-customer-service",
    app: "智能客服",
    appKey: "ai-customer-service",
    category: "客户服务",
    primaryModelId: "gpt-4o-mini",
    backupModelId: "deepseek-chat",
    scope: "客户端 / 代理商",
    enabled: true,
  },
  {
    id: "app-live-chat",
    app: "在线聊天客服",
    appKey: "live-chat",
    category: "IM 接待",
    primaryModelId: "deepseek-chat",
    backupModelId: "gpt-4o-mini",
    scope: "客户端项目",
    enabled: true,
  },
  {
    id: "app-seo-blog",
    app: "AI SEO 博客",
    appKey: "seo-blog",
    category: "内容生成",
    primaryModelId: "claude-sonnet-4",
    backupModelId: "gemini-25-pro",
    scope: "客户端项目",
    enabled: true,
  },
  {
    id: "app-product-copy",
    app: "产品描述生成",
    appKey: "product-copy",
    category: "商品资料",
    primaryModelId: "gpt-4o-mini",
    backupModelId: "deepseek-chat",
    scope: "客户端项目",
    enabled: true,
  },
];

export function catalogItemToModel(item: HQAIModelCatalogItem): HQAIModelConfig {
  return {
    id: `${item.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    provider: item.provider,
    name: item.name,
    type: item.type,
    status: "active",
    keyAlias: item.defaultKeyAlias,
    apiKey: "",
    monthlyCost: item.estimatedMonthlyCost,
    monthlyQuota: 0,
    calls: 0,
    description: item.description,
    tags: [...item.strengths],
  };
}

export function getDefaultHQAIConfig(): HQAIConfig {
  return {
    models: DEFAULT_HQ_AI_MODELS.map((model) => ({ ...model, tags: [...model.tags] })),
    assignments: DEFAULT_HQ_AI_ASSIGNMENTS.map((assignment) => ({ ...assignment })),
  };
}

function normalizeConfig(config: HQAIConfig): HQAIConfig {
  const normalizedModels = config.models.map((model) => ({
    ...model,
    tags: Array.isArray(model.tags) ? model.tags : [],
  }));
  const hasCodexModel = normalizedModels.some(
    (model) =>
      model.provider.trim().toLowerCase() === "openai" &&
      model.name.trim().toLowerCase() === "codex"
  );
  const models = hasCodexModel
    ? normalizedModels
    : [
        ...normalizedModels,
        {
          id: "openai-codex",
          provider: "OpenAI",
          name: "codex",
          type: "代码/自动化",
          status: "active",
          keyAlias: "prod-openai",
          apiKey: "",
          monthlyCost: 18000,
          monthlyQuota: 36,
          calls: 32000,
          description: "Codex 适合 AI 建站工作流、代码生成、自动化修改和开发协作场景。",
          tags: ["Codex", "AI建站", "开发协作"],
        },
      ];
  const usableCodexModel = models.find(
    (model) =>
      model.provider.trim().toLowerCase() === "openai" &&
      model.name.trim().toLowerCase() === "codex" &&
      model.status === "active" &&
      model.apiKey.trim()
  );
  const assignments = config.assignments.map((assignment) => {
    if (assignment.appKey !== "ai-chat" || !usableCodexModel) return assignment;
    const primaryModel = models.find((model) => model.id === assignment.primaryModelId);
    const primaryReady = Boolean(primaryModel && primaryModel.status === "active" && primaryModel.apiKey.trim());
    if (primaryReady) return assignment;
    return {
      ...assignment,
      primaryModelId: usableCodexModel.id,
      backupModelId:
        assignment.primaryModelId && assignment.primaryModelId !== usableCodexModel.id
          ? assignment.primaryModelId
          : assignment.backupModelId,
    };
  });
  return {
    models,
    assignments,
  };
}

export function readHQAIConfig(): HQAIConfig {
  if (typeof window === "undefined") return getDefaultHQAIConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultHQAIConfig();
    const parsed = JSON.parse(raw) as HQAIConfig;
    if (!Array.isArray(parsed.models) || !Array.isArray(parsed.assignments)) {
      return getDefaultHQAIConfig();
    }
    return normalizeConfig(parsed);
  } catch {
    return getDefaultHQAIConfig();
  }
}

export function writeHQAIConfig(config: HQAIConfig) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(normalizeConfig(config)), { compact: true });
  window.dispatchEvent(new CustomEvent("hq-ai-config-updated", { detail: config }));
}

export function resolveAIAppConfig(appKey: string) {
  const config = readHQAIConfig();
  const assignment = config.assignments.find((item) => item.appKey === appKey && item.enabled);
  const primary = assignment
    ? config.models.find((model) => model.id === assignment.primaryModelId && model.status === "active")
    : null;
  const backup = assignment
    ? config.models.find((model) => model.id === assignment.backupModelId && model.status === "active")
    : null;
  const model = primary || backup || config.models.find((item) => item.status === "active") || null;
  return { assignment, model, config };
}
import { safeSetLocalStorage } from "./storage-guards";
