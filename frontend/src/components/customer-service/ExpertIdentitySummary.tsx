import type { ReactNode } from "react";
import { CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT } from "@/lib/customer-service-expert-contract";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

export type ExpertIdentitySummaryData = {
  name: string;
  title: string;
  customerServiceName: string;
  gender: string;
  animation: string;
  reminder: string;
  voice: string;
  greeting: string;
};

type ExpertIdentitySummaryProps = {
  avatar: ReactNode;
  data: ExpertIdentitySummaryData;
  variant: "small" | "editor";
  compactCopy?: boolean;
  showFrameMarker?: boolean;
  className?: string;
  expertId?: string;
  projection?: typeof CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.projections[number];
};

type ExpertIdentityField = typeof CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.identityFields[number]
  | typeof CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.behaviorFields[number];

const compactExpertValue = (value: string) => {
  const compactValue = value.trim();
  const characters = Array.from(compactValue);
  return characters.length > 7 ? `${characters.slice(0, 6).join("")}…` : compactValue;
};

const compactExpertName = (value: string) => {
  const compactName = value.trim();
  const characters = Array.from(compactName);
  return characters.length > 7 ? `${characters.slice(0, 6).join("")}…` : compactName;
};

const normalizeVoiceSequence = (value: string) => value.trim().replace(
  /^(\d+)[.．、_-]?\s*/,
  (_match, sequence: string) => `${formatDisplayOrdinal(Number(sequence))}.`,
);

const compactExpertVoice = (value: string) => {
  const numberedVoice = normalizeVoiceSequence(value);
  const characters = Array.from(numberedVoice);
  return characters.length > 7 ? `${characters.slice(0, 6).join("")}…` : numberedVoice;
};

const MetaItem = ({ field, label, value, compact = false }: { field: ExpertIdentityField; label: string; value: string; compact?: boolean }) => {
  const displayValue = value || "未设置";
  const normalizedValue = field === "voice" ? normalizeVoiceSequence(displayValue) : displayValue;
  const renderedValue = compact
    ? field === "voice" ? compactExpertVoice(displayValue) : compactExpertValue(displayValue)
    : normalizedValue;
  return (
    <div className="shared-expert-identity-meta-item" data-shared-expert-field={field}>
      <span data-shared-expert-text-label>{label}：</span>
      <strong data-shared-expert-text-value title={normalizedValue}>{renderedValue}</strong>
    </div>
  );
};

export function ExpertIdentitySummary({ avatar, data, variant, compactCopy, showFrameMarker = false, className = "", expertId, projection }: ExpertIdentitySummaryProps) {
  const compact = compactCopy ?? variant === "small";
  const renderedName = compact ? compactExpertName(data.name) : data.name;
  return (
    <section
      data-shared-expert-identity-summary={variant}
      data-development-standard-frame-region={showFrameMarker ? "small-card" : undefined}
      data-development-standard-frame-label={showFrameMarker ? "小卡片" : undefined}
      data-development-standard-marker-placement={showFrameMarker ? "content-card-start" : undefined}
      data-shared-expert-text-overflow-contract="single-line-ellipsis-v1"
      data-shared-expert-avatar-frame-contract="floating-service-v1"
      data-shared-expert-avatar-size-contract="floating-launcher-size-v1"
      data-shared-expert-compact-copy={compact ? "true" : undefined}
      data-shared-expert-small-copy-contract={compact ? CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.selectionCopy : undefined}
      data-shared-expert-layout-contract={CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.layout}
      data-shared-customer-service-expert-content-source={CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.source}
      data-shared-customer-service-expert-projection={projection}
      data-shared-expert-projection-id={expertId}
      data-shared-expert-customer-service-name={data.customerServiceName}
      data-shared-expert-voice-label={data.voice}
      data-shared-expert-greeting-text={data.greeting}
      className={`shared-expert-identity-summary is-${variant} ${className}`.trim()}
      aria-label={`${data.name}专家身份摘要`}
    >
      <div className="shared-expert-identity-avatar">{avatar}</div>
      <div className="shared-expert-identity-core">
        <div data-shared-expert-text-name className="shared-expert-identity-name" title={data.name}>{renderedName}</div>
        <MetaItem field="gender" label="性别" value={data.gender} compact={compact} />
        <MetaItem field="title" label="头衔" value={data.title} compact={compact} />
        <MetaItem field="animation" label="动画" value={data.animation} compact={compact} />
      </div>
      <div className="shared-expert-identity-behavior">
        <MetaItem field="customer-service-name" label="名称" value={data.customerServiceName} compact={compact} />
        <MetaItem field="greeting" label="招呼" value={data.greeting || "未设置"} compact={compact} />
        <MetaItem field="reminder" label="提醒" value={data.reminder} compact={compact} />
        <MetaItem field="voice" label="朗音" value={data.voice} compact={compact} />
      </div>
    </section>
  );
}
