export const CUSTOMER_SERVICE_EXPERT_CHAT_EVENT = "b2b:customer-service-expert-chat";

export type CustomerServiceExpertChatRequest = {
  expertId: string;
};

export function openCustomerServiceExpertChat(expertId: string) {
  window.dispatchEvent(new CustomEvent<CustomerServiceExpertChatRequest>(CUSTOMER_SERVICE_EXPERT_CHAT_EVENT, {
    detail: { expertId },
  }));
}
