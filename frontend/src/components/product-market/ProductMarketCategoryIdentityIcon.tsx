import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getCustomerServiceCategoryExpertByKey,
  type CustomerServiceAvatarOverride,
} from "@/lib/product-market-store";
import { resolveProductMarketCategoryExpertMaterialId } from "@/lib/product-market-category-contract";
import { CustomerServiceAvatarMedia } from "@/components/customer-service/CustomerServiceAvatarMedia";

type CategoryAvatarPreview = {
  url: string;
  kind: "image" | "video";
};

type ProductMarketCategoryIdentityIconProps = {
  categoryKey: string;
  categoryLabel: string;
  categoryOrder?: readonly string[] | null;
  avatarPreviews?: Record<string, CategoryAvatarPreview>;
  avatarOverrides?: Record<string, CustomerServiceAvatarOverride>;
  visible?: boolean;
  interactive?: boolean;
  onActivate?: (expertId: string) => void;
  displaySize?: "sidebar-20" | "category-16";
  className?: string;
};

/**
 * Shared category identity icon for the left navigation, Column Configuration
 * and Operations Market. Customer Service -> Select Expert is the only roster
 * source for all 01-12 portraits: loaded media, inline override, that expert's
 * factory portrait, then the shared Users fallback.
 */
export function ProductMarketCategoryIdentityIcon({
  categoryKey,
  categoryLabel,
  categoryOrder,
  avatarPreviews = {},
  avatarOverrides = {},
  visible = true,
  interactive = false,
  onActivate,
  displaySize = "sidebar-20",
  className,
}: ProductMarketCategoryIdentityIconProps) {
  if (!visible) return null;

  const expert = getCustomerServiceCategoryExpertByKey(categoryKey, categoryOrder);
  if (!expert) return null;

  const preview = avatarPreviews[expert.id];
  const override = avatarOverrides[expert.id];
  const materialId = resolveProductMarketCategoryExpertMaterialId(expert.id, override, expert.defaultAvatarAssetId);
  const avatarUrl = override?.imageDataUrl || preview?.url;
  const avatarKind = override?.imageDataUrl
    ? (override.mediaMimeType?.startsWith("video/") ? "video" : "image")
    : preview?.kind || "image";
  const content = (
    <CustomerServiceAvatarMedia
      sourceUrl={avatarUrl}
      sourceKind={avatarKind}
      fallbackUrl={expert.defaultAvatarUrl}
      alt={`${categoryLabel}专家头像`}
      fallback={<Users className="h-[60%] w-[60%]" />}
    />
  );
  const sharedProps = {
    "data-shared-product-market-category-icon": categoryKey,
    "data-shared-product-market-category-icon-source": "customer-service-select-expert",
    "data-shared-product-market-category-expert-id": expert.id,
    "data-shared-product-market-category-material-id": materialId,
    "data-shared-product-market-category-media-source": override?.mediaAssetId
      ? "customer-service-local-material"
      : override?.imageDataUrl
        ? "customer-service-inline-legacy"
        : "customer-service-local-material",
    "data-shared-product-market-category-display-size": displaySize === "category-16" ? "16" : "20",
    "data-shared-product-market-category-media-stability": "stable-preview-url-cache-v1",
    className: cn(
      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
      displaySize === "category-16" ? "h-4 w-4" : "h-5 w-5",
      className,
    ),
    style: {
      borderColor: `${expert.color}a0`,
      backgroundColor: `${expert.color}20`,
      color: expert.color,
    },
    title: `查看${expert.name}头像`,
  } as const;

  if (interactive && onActivate) {
    return (
      <button
        type="button"
        {...sharedProps}
        data-sidebar-category-expert-avatar={expert.id}
        onClick={() => onActivate(expert.id)}
      >
        {content}
      </button>
    );
  }

  return <span {...sharedProps}>{content}</span>;
}
