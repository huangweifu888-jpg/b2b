import inventoryData from "./page-inventory.json";
import verificationData from "./phase-two-verification.json";

import type { PageFactoryInventory, PageFactoryVerification } from "./page-factory";

export const PAGE_FACTORY_INVENTORY = Object.freeze(inventoryData as PageFactoryInventory);
export const PAGE_FACTORY_VERIFICATION = Object.freeze(verificationData as PageFactoryVerification);
