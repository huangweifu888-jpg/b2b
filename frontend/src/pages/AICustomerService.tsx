import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bot,
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  FileText,
  FileType,
  Headphones,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
} from "lucide-react";

import SiteContextCard from "@/components/SiteContextCard";
import AIAssignmentScopeCard from "@/components/AIAssignmentScopeCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  appendCustomerServiceMessage,
  createCustomerServiceConversation,
  deleteCustomerServiceConversation,
  getCustomerServiceConversation,
  listCustomerServiceConversations,
  updateCustomerServiceMessageFeedback,
} from "@/lib/customer-service-storage";
import { aiProviderApi } from "@/lib/ai-provider-api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  feedback?: "up" | "down";
};

type Conversation = {
  id: number;
  title: string;
  message_count: number;
  created_at: string;
  last_message_at: string;
};

const quickQuestions = [
  "如何添加新产品？",
  "怎么设置 SEO 关键词？",
  "如何发布社交媒体内容？",
  "询盘管理怎么使用？",
  "如何配置智能推广？",
  "怎么看数据报表？",
  "如何设置多语言站点？",
  "产品市场功能介绍",
];

const SYSTEM_PROMPT = `你是 TradePro B2B 独立站平台的智能客服助手。

你的任务是帮助用户解答平台使用问题，优先给出清晰、可执行的中文步骤。

平台重点功能包括：
1. 服务概览
2. AI 建站
3. 产品管理
4. 企业资料
5. SEO 优化
6. GEO 中心
7. 社交媒体
8. 智能推广
9. 数据报表
10. 询盘管理
11. CRM 管理
12. 产品市场

回答要求：
- 使用简洁、自然、专业的中文
- 优先给操作步骤
- 如果暂时无法确认，就明确说明并给下一步建议
- 保持友好和稳定，不夸张，不制造不存在的能力`;

const WELCOME_MSG: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "您好，我是 TradePro 智能客服助手。\n\n我可以协助您处理产品管理、SEO、社交媒体、AI 建站、询盘、数据报表等问题。您可以直接提问，也可以点击右侧常见问题快速开始。",
  timestamp: new Date(),
};

function buildLocalCustomerServiceReply(userText: string) {
  const text = userText.trim();
  if (/产品|商品|上传|新增/.test(text)) {
    return "您可以先进入“产品管理”，先创建分类，再补充产品名称、图片、参数和描述。保存后，产品会同步到当前站点的前台展示。";
  }
  if (/seo|关键词|排名|tdk/i.test(text)) {
    return "您可以进入“SEO 优化”，先完善首页和产品页的标题、关键词、描述，再逐步做关键词布局和排名跟踪。";
  }
  if (/建站|模板|网站|页面/.test(text)) {
    return "建议先在“AI 建站”中生成站点初稿，再回到可视化编辑区调整模块、样式和多语言内容，最后发布到当前计划。";
  }
  if (/社交|facebook|linkedin|媒体/i.test(text)) {
    return "您可以在“社交媒体”中先接入账号，再安排内容计划和发布任务，最后检查数据回流是否正常。";
  }
  if (/客服|聊天|询盘/.test(text)) {
    return "建议先检查欢迎语、接待渠道和询盘接收流程是否已配置，再到前台测试一次完整咨询链路。";
  }
  if (/广告|推广|投放/.test(text)) {
    return "您可以先进入“智能推广”，确认广告平台账号接入是否正常，再检查投放计划、预算和同步频率。";
  }
  return "当前已经切换为本地智能客服应答模式。您可以继续提问，我会优先基于现有平台功能给您稳定回复。";
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("zh-CN");
}

export default function AICustomerService() {
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get("siteId");

  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<number>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const generateId = () => Math.random().toString(36).slice(2, 10);

  const loadConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setConversations(listCustomerServiceConversations());
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    setConversations(listCustomerServiceConversations());
  }, []);

  const loadConversationMessages = async (convId: number) => {
    const conversation = getCustomerServiceConversation(convId);
    if (!conversation) return;
    const nextMessages: Message[] = [
      WELCOME_MSG,
      ...conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp),
        feedback: message.feedback,
      })),
    ];
    setMessages(nextMessages);
    setCurrentConvId(convId);
    setShowHistory(false);
  };

  const saveMessage = (convId: number, role: "user" | "assistant", content: string) => {
    appendCustomerServiceMessage(convId, {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    setConversations(listCustomerServiceConversations());
  };

  const createConversation = async (title: string) => {
    const conversation = createCustomerServiceConversation(title);
    setConversations(listCustomerServiceConversations());
    return conversation.id;
  };

  const buildAssignedModelReply = async (userText: string) => {
    const history = messages
      .filter((item) => item.id !== "welcome")
      .slice(-10)
      .map((item) => ({
        role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: item.content,
      }));

    const assigned = await aiProviderApi.runAssignedApp({
      app_key: "ai-customer-service",
      prompt: `${SYSTEM_PROMPT}\n\nUser question:\n${userText}`,
      history,
      site_id: siteId || undefined,
    });

    return assigned.content?.trim() || null;
  };

  const sendMessage = async (presetText?: string) => {
    const userText = (presetText || input).trim();
    if (!userText || loading) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let convId = currentConvId;
    if (!convId) {
      convId = await createConversation(userText);
      if (convId) setCurrentConvId(convId);
    }

    if (convId) {
      saveMessage(convId, "user", userText);
    }

    const assistantId = generateId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

    try {
      const modelReply = await buildAssignedModelReply(userText);
      const assistantContent =
        modelReply ||
        `${buildLocalCustomerServiceReply(userText)}\n\n当前已自动切换为本地客服应答模式，本次对话已为您保留。`;

      setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, content: assistantContent } : message)));
      if (convId) {
        saveMessage(convId, "assistant", assistantContent);
      }
    } catch {
      const fallbackContent = `${buildLocalCustomerServiceReply(userText)}\n\n当前已自动切换为本地客服应答模式，本次对话已为您保留。`;
      setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, content: fallbackContent } : message)));
      if (convId) {
        saveMessage(convId, "assistant", fallbackContent);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (msgId: string, type: "up" | "down") => {
    setMessages((prev) => prev.map((item) => (item.id === msgId ? { ...item, feedback: type } : item)));
    if (currentConvId) {
      updateCustomerServiceMessageFeedback(currentConvId, msgId, type);
      setConversations(listCustomerServiceConversations());
    }
  };

  const copyMessage = async (msgId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([WELCOME_MSG]);
    setShowHistory(false);
    setSelectedConvIds(new Set());
    inputRef.current?.focus();
  };

  const deleteConversation = async (convId: number) => {
    deleteCustomerServiceConversation(convId);
    setConversations((prev) => prev.filter((item) => item.id !== convId));
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      next.delete(convId);
      return next;
    });
    if (currentConvId === convId) {
      startNewChat();
    }
  };

  const toggleSelectConv = (id: number) => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredConversations = useMemo(
    () => conversations.filter((item) => !historySearch || item.title.toLowerCase().includes(historySearch.toLowerCase())),
    [conversations, historySearch]
  );

  const toggleSelectAllConvs = () => {
    if (selectedConvIds.size === filteredConversations.length) {
      setSelectedConvIds(new Set());
      return;
    }
    setSelectedConvIds(new Set(filteredConversations.map((item) => item.id)));
  };

  const fetchConvMessages = async (convId: number) => {
    const conversation = getCustomerServiceConversation(convId);
    if (!conversation) return [] as Message[];
    return conversation.messages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      timestamp: new Date(item.timestamp),
      feedback: item.feedback,
    }));
  };

  const exportAsTxt = async () => {
    if (!selectedConvIds.size) return;
    setExportLoading(true);
    try {
      let text = "";
      const selected = conversations.filter((item) => selectedConvIds.has(item.id));
      for (const conversation of selected) {
        const items = await fetchConvMessages(conversation.id);
        text += `对话记录：${conversation.title}\n`;
        text += `创建时间：${formatDate(conversation.created_at)}\n`;
        text += `${"=".repeat(50)}\n\n`;
        for (const item of items) {
          const roleLabel = item.role === "user" ? "用户" : "智能客服";
          text += `[${formatDate(item.timestamp)}] ${roleLabel}\n${item.content}\n\n`;
        }
        text += `${"=".repeat(60)}\n\n`;
      }

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `智能客服对话_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  };

  const exportAsPdf = async () => {
    if (!selectedConvIds.size) return;
    setExportLoading(true);
    try {
      const selected = conversations.filter((item) => selectedConvIds.has(item.id));
      let html = `
        <html><head><meta charset="utf-8" />
        <style>
          body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; padding: 36px; color: #0f172a; }
          h1 { color: #1d4ed8; margin-bottom: 12px; }
          h2 { margin-top: 28px; color: #1e293b; }
          .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
          .message { margin: 12px 0; padding: 10px 14px; border-radius: 10px; }
          .user { background: #eff6ff; border-left: 3px solid #2563eb; }
          .assistant { background: #f8fafc; border-left: 3px solid #10b981; }
          .role { font-weight: 700; font-size: 12px; margin-bottom: 6px; }
        </style></head><body>
        <h1>TradePro 智能客服对话记录</h1>
        <div class="meta">导出时间：${formatDate(new Date())}</div>
      `;

      for (const conversation of selected) {
        const items = await fetchConvMessages(conversation.id);
        html += `<h2>${conversation.title}</h2><div class="meta">创建时间：${formatDate(conversation.created_at)}</div>`;
        for (const item of items) {
          html += `<div class="message ${item.role === "user" ? "user" : "assistant"}">`;
          html += `<div class="role">${item.role === "user" ? "用户" : "智能客服"} | ${formatDate(item.timestamp)}</div>`;
          html += `<div>${item.content.replace(/\n/g, "<br>")}</div></div>`;
        }
      }
      html += "</body></html>";

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 400);
      }
    } finally {
      setExportLoading(false);
    }
  };

  if (showHistory) {
    return (
      <FactoryPage pageId="client-ai-customer-service" template="dashboard" sourceScope="client_source" autoRegions>
      <div className="flex min-h-[calc(100vh-9rem)] flex-col space-y-4 lg:min-h-[calc(100vh-8rem)]">
        <SiteContextCard siteId={siteId} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <History className="h-5 w-5 text-blue-600" />
              对话历史
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedConvIds.size > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exportLoading}>
                    {exportLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                    导出 ({selectedConvIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportAsPdf}>
                    <FileText className="mr-2 h-4 w-4 text-red-500" />
                    导出 PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsTxt}>
                    <FileType className="mr-2 h-4 w-4 text-blue-500" />
                    导出 TXT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={startNewChat}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新对话
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="搜索对话记录" className="pl-9" />
          </div>
          {filteredConversations.length > 0 ? (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedConvIds.size === filteredConversations.length && filteredConversations.length > 0}
                onCheckedChange={toggleSelectAllConvs}
              />
              <span className="text-xs text-slate-500">全选</span>
            </div>
          ) : null}
        </div>

        <Card className="min-h-0 flex-1 border-slate-200">
          <ScrollArea data-page-factory-region="small-card" className="h-full p-4">
            {historyLoading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                <p>加载中...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>{historySearch ? "未找到匹配的对话" : "暂无对话记录"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:border-blue-200 hover:bg-blue-50 ${
                      currentConvId === conversation.id ? "border-blue-200 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <Checkbox
                      checked={selectedConvIds.has(conversation.id)}
                      onCheckedChange={() => toggleSelectConv(conversation.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <div className="min-w-0 flex-1" onClick={() => loadConversationMessages(conversation.id)}>
                      <div className="truncate text-sm font-medium">{conversation.title}</div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {conversation.message_count} 条消息
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(conversation.created_at).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-slate-400 hover:text-red-500"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteConversation(conversation.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
      </FactoryPage>
    );
  }

  return (
    <FactoryPage pageId="client-ai-customer-service" template="dashboard" sourceScope="client_source" autoRegions>
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <SiteContextCard siteId={siteId} />
      <AIAssignmentScopeCard
        appKey="ai-customer-service"
        siteId={siteId}
        title="智能客服分配链"
        description="这里显示当前客服问答实际走的是总部、代理还是客户层的 AI 应用分配。"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Headphones className="h-6 w-6 text-blue-600" />
            智能客服
          </h1>
          <p className="mt-1 text-sm text-slate-500">优先使用总部分配的模型进行回答，模型不可用时自动切换到本地客服应答模式。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <Sparkles className="mr-1 h-3 w-3" />
            稳定应答
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowHistory(true);
              void loadConversations();
            }}
          >
            <History className="mr-1 h-3.5 w-3.5" />
            历史记录
          </Button>
          <Button variant="outline" size="sm" onClick={startNewChat}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            新对话
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="flex min-h-0 flex-col border-slate-200 lg:col-span-3">
          <ScrollArea data-page-factory-region="small-card" className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === "user" ? "bg-blue-100" : "bg-gradient-to-br from-blue-600 to-sky-500"
                    }`}
                  >
                    {message.role === "user" ? <User className="h-4 w-4 text-blue-600" /> : <Bot className="h-4 w-4 text-white" />}
                  </div>
                  <div className={`max-w-full sm:max-w-[75%] ${message.role === "user" ? "text-right" : ""}`}>
                    <div
                      className={`whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
                        message.role === "user" ? "rounded-tr-sm bg-blue-600 text-white" : "rounded-tl-sm bg-slate-100 text-slate-800"
                      }`}
                    >
                      {message.content || (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          思考中...
                        </span>
                      )}
                    </div>
                    {message.role === "assistant" && message.content && message.id !== "welcome" ? (
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback(message.id, "up")}
                          className={`rounded p-1 hover:bg-slate-100 ${message.feedback === "up" ? "text-emerald-600" : "text-slate-400"}`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, "down")}
                          className={`rounded p-1 hover:bg-slate-100 ${message.feedback === "down" ? "text-red-500" : "text-slate-400"}`}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                        <button onClick={() => copyMessage(message.id, message.content)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                          {copiedId === message.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-slate-200 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="输入您的问题..."
                disabled={loading}
              />
              <Button onClick={() => void sendMessage()} disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col border-slate-200">
          <div className="border-b border-slate-200 p-3">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              常见问题
            </h3>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => void sendMessage(question)}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs whitespace-normal break-words transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-slate-200 p-3">
            <div className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-medium text-slate-700">服务说明</span>
              </div>
              <p className="text-[11px] text-slate-500">优先使用已分配模型在线回答。</p>
              <p className="mt-0.5 text-[11px] text-slate-500">当模型不可用时，系统会自动切换到本地客服应答，不中断当前对话。</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
    </FactoryPage>
  );
}
